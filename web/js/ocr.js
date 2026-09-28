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

/// Ein Bild: zwei Durchgänge (Graustufen + invertiert), Wörter zusammenführen, Symbol erkennen.
async function analyseCanvas(canvas, learned) {
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
  for (const inv of [false, true]) {
    const { data } = await worker.recognize(make(inv));
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

async function imageFrames(file) {
  const bmp = await createImageBitmap(file);
  return [canvasFrom(bmp, bmp.width, bmp.height)];
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

/// Einzelbilder aus einem Bildschirmvideo: alle 0,5 s eins, fast gleiche werden übersprungen (max. 12).
async function videoFrames(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  await new Promise((ok, fail) => { v.onloadeddata = ok; v.onerror = () => fail(new Error("Video kann nicht gelesen werden")); });
  try { await v.play(); v.pause(); } catch (e) { /* iOS: Wiedergabe nicht nötig */ }
  const times = [];
  for (let t = 0.1; t < v.duration; t += 0.5) times.push(t);
  if (!times.length) times.push(0);
  const frames = [];
  let last = null;
  for (const t of times) {
    await new Promise(ok => { v.onseeked = ok; v.currentTime = Math.min(t, Math.max(0, v.duration - 0.05)); });
    const sig = signature(v, v.videoWidth, v.videoHeight);
    if (last && difference(sig, last) < 0.12) continue; // gleiche Ansicht wie zuvor
    last = sig;
    frames.push(canvasFrom(v, v.videoWidth, v.videoHeight));
    if (frames.length >= 12) break;
  }
  URL.revokeObjectURL(url);
  return frames;
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
  const canvases = [];
  for (const f of files) canvases.push(...(f.type.startsWith("video") ? await videoFrames(f) : await imageFrames(f)));
  const results = [];
  for (let i = 0; i < canvases.length; i++) {
    progressFn = p => onProgress(`Bild ${i + 1} von ${canvases.length} wird gelesen …`, (i + p) / canvases.length);
    onProgress(`Bild ${i + 1} von ${canvases.length} wird gelesen …`, i / canvases.length);
    results.push(await analyseCanvas(canvases[i], learned));
  }
  // Mehrere Screenshots = mehrere Karten; ein Video = Einzelbilder derselben Szene zusammenführen
  const isVideo = files.length === 1 && files[0].type.startsWith("video");
  if (isVideo) return parseFrames(results, knownNames);
  const parts = results.map(r => parseFrames([r], knownNames));
  const votes = parts.map(p => p.kind).filter(k => k !== "unknown");
  const kind = votes.length ? (votes.filter(k => k === "sale").length > votes.length / 2 ? "sale" : "purchase") : "unknown";
  return { kind, items: parts.flatMap(p => p.items), tokens: parts.flatMap(p => p.tokens) };
}
