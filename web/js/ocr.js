// Screenshots und Bildschirmvideos im Browser auswerten (Tesseract, läuft komplett auf dem Gerät).

import { mergeWords, buildLines } from "./ocr-lines.js";
import { parseFrames } from "./parser.js";
import { grayscale, detailBox, listBox, extract, match, fromHex } from "./chemicons.js";

let workerPromise = null;
let progressFn = () => {};

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Konnte " + src + " nicht laden"));
    document.head.appendChild(s);
  });
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      if (!window.Tesseract) await loadScript("vendor/tesseract/tesseract.min.js");
      const base = new URL(".", location.href).href;
      const w = await window.Tesseract.createWorker("deu", 1, {
        workerPath: base + "vendor/tesseract/worker.min.js",
        corePath: base + "vendor/tesseract/",
        langPath: base + "vendor/lang",
        gzip: true,
        workerBlobURL: false,
        logger: m => { if (m.status === "recognizing text") progressFn(m.progress); },
      });
      // Modus „verstreuter Text“ – passt zu Spielbildschirmen mit Karten und Beschriftungen
      await w.setParameters({ tessedit_pageseg_mode: "11" });
      return w;
    })().catch(e => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

/// Texterkennung vorab starten (lädt ~9 MB beim ersten Mal, danach aus dem Cache).
export const warmUp = () => getWorker().catch(() => {});

const MAX_SIDE = 2600;

function canvasFrom(source, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0, c.width, c.height);
  return c;
}

const release = c => { c.width = c.height = 0; }; // Speicher sofort freigeben (iOS ist hier knapp)

/// Ein Bild: zwei Durchgänge (Graustufen + invertiert), Wörter zusammenführen, Symbol erkennen.
/// Videobilder nur invertiert – die Einzelbilder ergänzen sich gegenseitig, das halbiert die Zeit.
async function analyseCanvas(canvas, learned, modes = [false, true]) {
  const W = canvas.width, H = canvas.height;
  const px = canvas.getContext("2d").getImageData(0, 0, W, H);
  const gray = grayscale(px.data, W, H);
  const make = invert => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); const img = ctx.createImageData(W, H);
    for (let i = 0; i < gray.length; i++) {
      const v = Math.round(gray[i] * 255), o = invert ? 255 - v : v;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = o; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return c;
  };
  const worker = await getWorker();
  const passes = [];
  for (const inv of modes) {
    const c = make(inv);
    const { data } = await worker.recognize(c);
    release(c);
    passes.push(data.words.map(w => ({ text: w.text, confidence: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })));
  }
  const lines = buildLines(mergeWords(passes), W, H);
  const recognizeIcon = item => {
    const s = item.iconSearch; if (!s) return item;
    const p = r => ({ x0: r.x0 * W, y0: r.y0 * H, x1: r.x1 * W, y1: r.y1 * H });
    const box = s.type === "detail" ? detailBox(p(s.statsRow)) : listBox(p(s.position), s.spacing * H);
    const bits = extract(gray, W, H, box);
    const m = bits ? match(bits, learned) : null;
    return { ...item, iconPrint: bits, chemistryStyle: m ? m.style : null };
  };
  return { lines, recognizeIcon };
}

/// Kleiner Graustufen-Fingerabdruck eines Bildes, um fast gleiche Einzelbilder zu überspringen.
function signature(source, w, h) {
  const c = document.createElement("canvas"); c.width = 48; c.height = 104;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h, 0, 0, 48, 104);
  const d = ctx.getImageData(0, 0, 48, 104).data, s = new Float32Array(48 * 104);
  for (let i = 0; i < s.length; i++) s[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 765;
  return s;
}
// Größte Abweichung: ein anderer Spieler ändert nur den Kartenbereich, das aber deutlich (> 0,3);
// dasselbe Bild schwankt durch Kompression nur um < 0,05.
const difference = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

const seek = (v, t) => new Promise(ok => {
  const timer = setTimeout(ok, 3000); // iOS meldet „seeked“ nicht immer
  v.onseeked = () => {
    clearTimeout(timer);
    // Warten, bis das neue Bild wirklich dargestellt ist (sonst liest iOS teils noch das alte)
    if (!v.requestVideoFrameCallback) return ok();
    const t2 = setTimeout(ok, 200);
    v.requestVideoFrameCallback(() => { clearTimeout(t2); ok(); });
  };
  v.currentTime = t;
});

/// Einzelbilder aus einem Bildschirmvideo: alle 0,5 s eins, fast gleiche werden übersprungen (max. 12).
/// Jedes Bild wird sofort an `use(canvas, nr, anteil)` übergeben und danach verworfen.
async function eachVideoFrame(file, use, onStep) {
  const url = URL.createObjectURL(file);
  // Nicht ins Dokument hängen: iOS lädt unsichtbare Videos im Dokument oft gar nicht.
  const v = document.createElement("video");
  v.muted = v.defaultMuted = true; v.playsInline = true; v.preload = "auto";
  v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
  v.src = url;
  onStep(0, 0);
  try {
    await new Promise((ok, fail) => {
      let done = false;
      const finish = e => { if (done) return; done = true; clearTimeout(timer); e ? fail(e) : ok(); };
      const timer = setTimeout(() => finish(new Error("Video lädt nicht – bitte als Screenshot versuchen")), 30000);
      v.onloadeddata = v.oncanplay = () => finish();
      // iOS lädt Bilddaten teils erst beim Abspielen
      v.onloadedmetadata = () => { v.play().then(() => v.pause()).catch(() => {}); };
      v.onerror = () => finish(new Error("Dieses Videoformat kann der Browser nicht lesen"));
      v.load();
    });
    try { await v.play(); v.pause(); } catch (e) { /* iOS: Wiedergabe nicht nötig */ }
    const duration = isFinite(v.duration) ? v.duration : 0;
    const times = [];
    for (let t = 0.1; t < duration; t += 0.5) times.push(t);
    if (!times.length) times.push(0);
    let last = null, kept = 0;
    for (const t of times) {
      const at = t / Math.max(duration, 0.1);
      onStep(kept, at);
      await seek(v, Math.min(t, Math.max(0, duration - 0.05)));
      const sig = signature(v, v.videoWidth, v.videoHeight);
      if (last && difference(sig, last) < 0.12) continue; // gleiche Ansicht wie zuvor
      // Nur ruhige Bilder lesen: 0,2 s später muss es noch genauso aussehen (sonst wird gerade gewischt)
      if (t + 0.2 < duration) {
        await seek(v, t + 0.2);
        const later = signature(v, v.videoWidth, v.videoHeight);
        if (difference(sig, later) >= 0.12) continue;
      }
      last = sig;
      const c = canvasFrom(v, v.videoWidth, v.videoHeight);
      kept++;
      await use(c, kept, at);
      release(c);
      if (kept >= 12) break;
    }
    if (!kept) throw new Error("Im Video wurden keine Bilder gefunden");
  } finally {
    v.pause(); v.removeAttribute("src"); v.load();
    URL.revokeObjectURL(url);
  }
}

/// Alle Einzelbilder eines Videos lesen und zu einem Ergebnis zusammenführen.
async function scanVideo(file, knownNames, learned, onProgress, from = 0, span = 1) {
  const results = [];
  await eachVideoFrame(file, async (canvas, n, at) => {
    progressFn = p => onProgress(`Video: Bild ${n} wird gelesen …`, from + span * Math.min(1, at + p * 0.05));
    progressFn(0);
    results.push(await analyseCanvas(canvas, learned, [true]));
  }, (n, at) => onProgress(n ? `Video: ${n} Bild${n > 1 ? "er" : ""} gelesen, suche weitere …` : "Video wird geöffnet …", from + span * at));
  return parseFrames(results, knownNames);
}

/**
 * @param files FileList/Array (Bilder und/oder Videos)
 * @param knownNames bekannte Spielernamen
 * @param learnedIcons [{style, hex}]
 * @param onProgress (text, anteil 0…1)
 */
export async function scanFiles(files, knownNames, learnedIcons, onProgress = () => {}) {
  const learned = {};
  for (const i of learnedIcons) (learned[i.style] ||= []).push(fromHex(i.hex));
  onProgress("Texterkennung wird geladen …", 0);
  await getWorker();
  files = [...files];
  const isVideo = f => f.type.startsWith("video") || /\.(mov|mp4|m4v|webm)$/i.test(f.name || "");
  // Ein Video = Einzelbilder derselben Szene zusammenführen
  if (files.length === 1 && isVideo(files[0])) return scanVideo(files[0], knownNames, learned, onProgress);
  // Mehrere Dateien = jede für sich (mehrere Karten)
  const parts = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i], label = `Datei ${i + 1} von ${files.length} wird gelesen …`;
    if (isVideo(f)) { parts.push(await scanVideo(f, knownNames, learned, (t, x) => onProgress(label, x), i / files.length, 1 / files.length)); continue; }
    progressFn = p => onProgress(label, (i + p) / files.length);
    onProgress(label, i / files.length);
    const bmp = await createImageBitmap(f);
    const canvas = canvasFrom(bmp, bmp.width, bmp.height);
    bmp.close?.();
    parts.push(parseFrames([await analyseCanvas(canvas, learned)], knownNames));
    release(canvas);
  }
  const votes = parts.map(p => p.kind).filter(k => k !== "unknown");
  const kind = votes.length ? (votes.filter(k => k === "sale").length > votes.length / 2 ? "sale" : "purchase") : "unknown";
  return { kind, items: parts.flatMap(p => p.items), tokens: parts.flatMap(p => p.tokens) };
}
