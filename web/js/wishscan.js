// Spieler aus Screenshots für die Einkaufs-/Merkliste lesen.
// Zwei Arten von Bildern:
//  1. Listen (z. B. „Futter spielbar“): jede Zeile hat einen grünen „+“-Knopf, rechts daneben den Preis,
//     links Name(Position) und direkt dahinter das goldene Rating-Abzeichen.
//  2. Einzelkarte mit Preis (Karte links, großer Preis rechts).

const isGreen = (r, g, b) => g > 170 && r < 150 && b > 100 && g - r > 60;
const isGold = (r, g, b) => r > 165 && g > 125 && b < 145 && r - b > 55;
const isWhite = (r, g, b) => Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 45;

/// Zeilen anhand der grünen Knöpfe finden → [{ y0, y1, x0, x1 }]
export function findRows(d, W, H) {
  const from = Math.floor(W * 0.45), to = Math.floor(W * 0.95), min = Math.max(4, W * 0.012);
  const hit = new Array(H).fill(null);
  for (let y = 0; y < H; y++) {
    // längster zusammenhängender grüner Abschnitt dieser Pixelzeile (= der Knopf; kleine Lücken durch das „+“ erlaubt)
    let best = null, run = null, gap = 0;
    for (let x = from; x < to; x++) {
      const i = (y * W + x) * 4, g = isGreen(d[i], d[i + 1], d[i + 2]);
      if (g) { if (!run) run = { x0: x, x1: x }; run.x1 = x; gap = 0; }
      else if (run && ++gap > W * 0.01) { if (!best || run.x1 - run.x0 > best.x1 - best.x0) best = run; run = null; gap = 0; }
    }
    if (run && (!best || run.x1 - run.x0 > best.x1 - best.x0)) best = run;
    if (best && best.x1 - best.x0 + 1 >= min) hit[y] = best;
  }
  const rows = [];
  for (let y = 0; y < H; y++) {
    if (!hit[y]) continue;
    const r = { y0: y, y1: y, x0: hit[y].x0, x1: hit[y].x1 };
    while (y + 1 < H && hit[y + 1]) { y++; r.y1 = y; r.x0 = Math.min(r.x0, hit[y].x0); r.x1 = Math.max(r.x1, hit[y].x1); }
    if (r.y1 - r.y0 >= Math.max(6, H * 0.006)) rows.push(r);
  }
  // Nur gleichartige Knöpfe (ähnliche Höhe/Position) zählen
  if (rows.length < 2) return [];
  const med = [...rows].sort((a, b) => (a.y1 - a.y0) - (b.y1 - b.y0))[rows.length >> 1];
  const h = med.y1 - med.y0;
  return rows.filter(r => Math.abs((r.y1 - r.y0) - h) < h * 0.5 && Math.abs(r.x1 - med.x1) < W * 0.05);
}

/// Goldenes Abzeichen links vom Knopf in der Zeile → { x0, x1, y0, y1 } oder null
export function findBadge(d, W, H, row) {
  const h = row.y1 - row.y0, cy = (row.y0 + row.y1) / 2;
  const ya = Math.max(0, Math.floor(cy - h * 0.95)), yb = Math.min(H - 1, Math.ceil(cy + h * 0.95));
  const xa = Math.floor(W * 0.12), xb = Math.floor(row.x0 - W * 0.02);
  const cols = [];
  for (let x = xa; x < xb; x++) {
    let n = 0;
    for (let y = ya; y <= yb; y++) { const i = (y * W + x) * 4; if (isGold(d[i], d[i + 1], d[i + 2])) n++; }
    cols.push(n >= h * 0.5);
  }
  for (let k = 0; k < cols.length; k++) {
    if (!cols[k]) continue;
    let e = k; while (e + 1 < cols.length && cols[e + 1]) e++;
    if (e - k + 1 >= h * 0.5) {
      const x0 = xa + k, x1 = xa + e; let y0 = yb, y1 = ya;
      for (let y = ya; y <= yb; y++) {
        let n = 0; for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; if (isGold(d[i], d[i + 1], d[i + 2])) n++; }
        if (n >= (x1 - x0 + 1) * 0.3) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      return { x0, x1, y0, y1 };
    }
    k = e;
  }
  return null;
}

/// Ausschnitt als dunkle Schrift auf weißem Grund (Graustufen, damit Kanten erhalten bleiben), vergrößert für die Texterkennung.
/// ink(r,g,b) liefert 0…1: wie sehr der Pixel zur Schrift gehört.
export function binaryCrop(d, W, box, ink, scale = 3, pad = 6) {
  const w = Math.max(1, box.x1 - box.x0 + 1), h = Math.max(1, box.y1 - box.y0 + 1);
  if (ink === "auto") ink = autoInk(d, W, box);
  const src = document.createElement("canvas"); src.width = w + pad * 2; src.height = h + pad * 2;
  const ctx = src.getContext("2d"), img = ctx.createImageData(src.width, src.height);
  img.data.fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((box.y0 + y) * W + box.x0 + x) * 4, o = ((y + pad) * src.width + x + pad) * 4;
    const v = Math.round(255 * (1 - Math.max(0, Math.min(1, ink(d[i], d[i + 1], d[i + 2])))));
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const out = document.createElement("canvas"); out.width = src.width * scale; out.height = src.height * scale;
  const oc = out.getContext("2d"); oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high"; oc.drawImage(src, 0, 0, out.width, out.height);
  src.width = src.height = 0;
  return out;
}

/// Helle Schrift auf dunklem Grund: Helligkeit mit Kontrastdehnung (2 % abgeschnitten)
function autoInk(d, W, box) {
  const lum = [];
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) { const i = (y * W + x) * 4; lum.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]); }
  lum.sort((a, b) => a - b);
  const lo = lum[Math.floor(lum.length * 0.02)], hi = Math.max(lo + 1, lum[Math.floor(lum.length * 0.98)]);
  return (r, g, b) => (0.3 * r + 0.59 * g + 0.11 * b - lo) / (hi - lo);
}
const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
export const PRED = {
  // helle, farblose Schrift auf dunklem Grund (die goldene Münze fällt wegen der Farbe raus)
  price: (r, g, b) => sat(r, g, b) < 60 ? (Math.min(r, g, b) - 75) / 140 : 0,
  name: (r, g, b) => sat(r, g, b) < 60 ? (Math.min(r, g, b) - 75) / 140 : 0,
  // weiße Zahl auf Gold: der Blauanteil unterscheidet Weiß (hoch) von Gold (niedrig)
  digits: (r, g, b) => (Math.min(r, g, b) - 120) / 100,
};

/// Ausschnitte einer Listenzeile
export function rowBoxes(W, H, row, badge) {
  const h = row.y1 - row.y0, cy = (row.y0 + row.y1) / 2;
  const clampY = v => Math.max(0, Math.min(H - 1, Math.round(v)));
  return {
    price: { x0: Math.min(W - 2, row.x1 + Math.round(W * 0.03)), x1: W - 1, y0: clampY(cy - h * 0.6), y1: clampY(cy + h * 0.6) },
    name: { x0: Math.round(W * 0.125), x1: badge ? Math.max(Math.round(W * 0.2), badge.x0 - 2) : Math.round(W * 0.4), y0: clampY(cy - h * 0.85), y1: clampY(cy - h * 0.02) },
    badge: badge && { x0: badge.x0 + 1, x1: badge.x1 - 1, y0: badge.y0 + 1, y1: badge.y1 - 1 },
  };
}

// ---------- Texte auswerten ----------

/// „7.6K“ → 7600, „850“ → 850, „10,250“ → 10250, „1.2M“ → 1200000
export function parsePrice(t) {
  const s = String(t || "").toUpperCase().replace(/\s/g, "").replace(/[^\d.,KM]/g, "");
  const m = s.match(/^(\d+(?:[.,]\d+)?)([KM])?/); if (!m) return null;
  if (m[2]) {
    const v = parseFloat(m[1].replace(",", ".")) * (m[2] === "M" ? 1e6 : 1e3);
    return Math.round(v);
  }
  const v = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return v >= 150 ? v : null;
}
/// „Ona Batlle(RB)“ → „Ona Batlle“
export function parseName(t) {
  const s = String(t || "").split("(")[0].replace(/[^A-Za-zÀ-ÿĀ-žØøß'’.\- ]/g, " ").replace(/\s+/g, " ").trim();
  // kurze Störzeichen am Anfang („x Konaté“) und Reste der Position am Ende („Konat Co“, „Yıldız c aM“) entfernen
  const parts = s.replace(/^([a-z]{1,2} |[A-Za-z] )+(?=[A-ZÀ-ÝĀ-Ž])/, "").trim().split(" ");
  while (parts.length > 1 && (parts[parts.length - 1].replace(/[^A-Za-zÀ-ž]/g, "").length <= 2
    || /^(cb|rb|lb|st|cm|cam|cdm|gk|lm|rm|lw|rw|cf|lwb|rwb)$/i.test(parts[parts.length - 1]))) parts.pop();
  return parts.join(" ").replace(/[.\-']+$/, "").trim();
}
export function parseRating(t) {
  const m = String(t || "").match(/\d{2}/); if (!m) return null;
  const v = +m[0]; return v >= 40 && v <= 99 ? v : null;
}

/// „10, 250“ → „10,250“ (Leerzeichen nach dem Tausender-Trennzeichen)
const fixNum = t => String(t).replace(/(\d)\s*([.,])\s+(\d{3})\b/g, "$1$2$3");

/// Einzelkarte: Rating (groß, links oben), Name (über den Werte-Kürzeln), Preis (größte Zahl rechts)
const STAT = ["TEM", "SCH", "PAS", "DRI", "DEF", "PHY", "PAC", "SHO", "KOR", "PHY", "TEMPO", "DIV", "HAN", "KIC", "REF", "SPD", "POS"];
export function parseCard(lines) {
  const statLine = lines.find(l => STAT.filter(s => l.text.toUpperCase().split(/[^A-Z]+/).includes(s)).length >= 3);
  const left = lines.filter(l => l.x0 < 0.5);
  const ratings = left.filter(l => /^\d{2}$/.test(l.text.trim()) && +l.text >= 40 && +l.text <= 99 && (!statLine || l.y0 < statLine.y0));
  const rating = ratings.sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))[0];
  let nameLine = null;
  if (statLine) nameLine = left.filter(l => l.y1 <= statLine.y0 + 0.01 && /[A-Za-zÀ-ž]{3,}/.test(l.text) && !/\d/.test(l.text))
    .sort((a, b) => b.y1 - a.y1)[0];
  const prices = lines.filter(l => l.x0 >= 0.4 && !/[-–]/.test(l.text) && !/trend|range|updated/i.test(l.text))
    .map(l => ({ l, v: parsePrice((fixNum(l.text).match(/\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d)?\s*[KkMm]\b|\d{3,}/) || [])[0]) }))
    .filter(p => p.v);
  const price = prices.sort((a, b) => (b.l.y1 - b.l.y0) - (a.l.y1 - a.l.y0))[0];
  const name = nameLine ? parseName(nameLine.text) : "";
  if (!name && !price) return [];
  return [{ name, rating: rating ? +rating.text : null, price: price ? price.v : null }];
}

/// Listen-Zeilen: Texte der ganzen Seite den Zeilen (grüne Knöpfe) zuordnen
export function listItems(lines, rows, ratings, W, H, cropNames = []) {
  const items = rows.map((row, k) => {
    const h = (row.y1 - row.y0) / H, cy = (row.y0 + row.y1) / 2 / H, mid = l => (l.y0 + l.y1) / 2;
    const priceLine = lines.filter(l => l.x0 > (row.x1 / W) + 0.01 && Math.abs(mid(l) - cy) < h * 0.8 && /\d/.test(l.text))
      .sort((a, b) => Math.abs(mid(a) - cy) - Math.abs(mid(b) - cy))[0];
    const nameLine = lines.filter(l => l.x0 > 0.08 && l.x0 < 0.4 && mid(l) < cy + h * 0.1 && mid(l) > cy - h * 1.2 && /[A-Za-zÀ-ž]{2,}/.test(l.text))
      .sort((a, b) => (b.text.includes("(") - a.text.includes("(")) || (Math.abs(mid(a) - (cy - h * 0.4)) - Math.abs(mid(b) - (cy - h * 0.4))))[0];
    const raw = priceLine ? (fixNum(priceLine.text).match(/\d+(?:[.,]\d+)?\s*[KkMm]|\d{1,3}(?:[.,]\d{3})+|\d{3,}/) || [])[0] : null;
    const fromCrop = parseName(cropNames[k] || ""), fromPage = nameLine ? parseName(nameLine.text) : "";
    return { name: fromCrop.length >= 3 ? fromCrop : fromPage || fromCrop, rating: ratings[k] ?? null, price: parsePrice(raw), raw };
  });
  // Fehlender Dezimalpunkt („43K“ statt „4.3K“): wenn die übrigen K-Preise der Liste unter 10K liegen
  const ks = items.filter(i => i.price && !/^\d{2}\s*K$/i.test(i.raw || "")).map(i => i.price);
  const typical = ks.length ? ks.sort((a, b) => a - b)[ks.length >> 1] : null;
  for (const i of items) {
    if (typical && typical < 10000 && /^\d{2}\s*K$/i.test(i.raw || "") && i.price >= 10000) i.price = i.price / 10;
    delete i.raw;
  }
  return items.filter(i => i.name || i.price);
}

// ---------- Rating-Ziffern im Abzeichen (Mustervergleich, Tesseract ist bei der kleinen Schrift unzuverlässig) ----------
const DW = 12, DH = 16;
/// Ziffern im Abzeichen ausschneiden → Liste von Vektoren (DW×DH, 0…1)
export function badgeDigits(d, W, bd) {
  const bw = bd.x1 - bd.x0 + 1, bh = bd.y1 - bd.y0 + 1;
  const y0 = Math.round(bd.y0 + bh * 0.2), y1 = Math.round(bd.y0 + bh * 0.75), x0 = bd.x0 + 1, x1 = bd.x1 - 1;
  const ink = (x, y) => { const i = (y * W + x) * 4; return Math.max(0, Math.min(1, (Math.min(d[i], d[i + 1], d[i + 2]) - 150) / 80)); };
  // Spalten mit Schrift → Ziffern-Blöcke
  const colInk = []; for (let x = x0; x <= x1; x++) { let s = 0; for (let y = y0; y <= y1; y++) s += ink(x, y); colInk.push(s); }
  const on = colInk.map(v => v > 0.3);
  let segs = [];
  for (let k = 0; k < on.length; k++) { if (!on[k]) continue; let e = k; while (e + 1 < on.length && on[e + 1]) e++; segs.push([x0 + k, x0 + e]); k = e; }
  // schmale Blöcke (z. B. die „1“) behalten, wenn sie genug Schrift enthalten
  segs = segs.filter(s => { let t = 0; for (let x = s[0]; x <= s[1]; x++) t += colInk[x - x0]; return t >= (y1 - y0) * 0.6; });
  if (segs.length === 1 && segs[0][1] - segs[0][0] + 1 > bw * 0.36) { const m = Math.round((segs[0][0] + segs[0][1]) / 2); segs = [[segs[0][0], m], [m + 1, segs[0][1]]]; } // zusammenhängend → teilen
  if (segs.length > 2) segs = segs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 2).sort((a, b) => a[0] - b[0]);
  return segs.map(([sx0, sx1]) => {
    // senkrechte Grenzen der Ziffer
    let ty = y1, by = y0;
    for (let y = y0; y <= y1; y++) for (let x = sx0; x <= sx1; x++) if (ink(x, y) > 0.5) { if (y < ty) ty = y; if (y > by) by = y; }
    if (by < ty) return null;
    const v = new Float32Array(DW * DH), w = sx1 - sx0 + 1, h = by - ty + 1;
    for (let j = 0; j < DH; j++) for (let i = 0; i < DW; i++) {
      // Flächenmittel des Quellbereichs
      const fx0 = sx0 + i * w / DW, fx1 = sx0 + (i + 1) * w / DW, fy0 = ty + j * h / DH, fy1 = ty + (j + 1) * h / DH;
      let s = 0, n = 0;
      for (let y = Math.floor(fy0); y < Math.max(Math.floor(fy0) + 1, Math.ceil(fy1)); y++) for (let x = Math.floor(fx0); x < Math.max(Math.floor(fx0) + 1, Math.ceil(fx1)); x++) { s += ink(x, y); n++; }
      v[j * DW + i] = s / n;
    }
    return v;
  }).filter(Boolean);
}
const ncc = (a, b) => {
  let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
  let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; }
  return s / Math.sqrt(sa * sb || 1);
};
/// Rating aus den Ziffern-Vektoren; templates: { "0": [...], … }
export function classifyRating(vecs, templates) {
  if (vecs.length !== 2) return null;
  let digits = "", worst = 1;
  for (const v of vecs) {
    let best = null, bs = -1, second = -1;
    for (const [dg, t] of Object.entries(templates)) { const s = ncc(v, t); if (s > bs) { second = bs; bs = s; best = dg; } else if (s > second) second = s; }
    digits += best; worst = Math.min(worst, bs);
  }
  const r = +digits;
  return worst > 0.55 && r >= 40 && r <= 99 ? r : null;
}
