// Chemiestil am Kartensymbol erkennen.
// Portierung von Tools/chem_icons/iconlib.py (Referenz) bzw. ChemistryIconMatcher.swift.

import { TEMPLATES } from "./chem-templates.js";

export const SIZE = 24;
export const MIN_SCORE = 0.68;
export const MIN_MARGIN = 0.08;

// ---------- Abdruck ----------

export const fromHex = hex => {
  const bits = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < hex.length; i++) {
    const n = parseInt(hex[i], 16);
    for (let b = 0; b < 4; b++) bits[i * 4 + b] = (n >> (3 - b)) & 1;
  }
  return bits;
};
export const toHex = bits => {
  let s = "";
  for (let i = 0; i < bits.length; i += 4) s += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
  return s;
};

const BUNDLED = Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.map(fromHex)]));

/// Graustufen wie PIL "L" (ITU-R 601), Werte 0…1. rgba: Uint8ClampedArray (ImageData.data).
export function grayscale(rgba, w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = ((rgba[p] * 19595 + rgba[p + 1] * 38470 + rgba[p + 2] * 7471 + 0x8000) >> 16) / 255;
  }
  return g;
}

// ---------- Suchbereiche (Pixel) ----------

/// Detailseite: relativ zur Werte-Zeile „TEM SCH PAS …“.
export function detailBox(r) {
  const W = r.x1 - r.x0, cx = r.x0 + 0.115 * W, cy = (r.y0 + r.y1) / 2 - 0.588 * W, s = 0.15 * W;
  return { x0: cx - s, y0: cy - 0.8 * s, x1: cx + s, y1: cy + 0.8 * s, unit: s };
}
/// Listen: direkt unter der Positionsangabe („ZOM“).
export function listBox(pos, spacing) {
  const cx = (pos.x0 + pos.x1) / 2;
  return { x0: cx - 0.8 * spacing, y0: pos.y1 + 1, x1: cx + 0.8 * spacing, y1: pos.y1 + 1.1 * spacing, unit: spacing };
}

// ---------- Ausschneiden ----------

function areaResize(a, side, n) {
  const out = new Float64Array(n * n), sc = side / n;
  for (let oy = 0; oy < n; oy++) {
    const y0 = oy * sc, y1 = (oy + 1) * sc;
    for (let ox = 0; ox < n; ox++) {
      const x0 = ox * sc, x1 = (ox + 1) * sc;
      let tot = 0, wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.min(Math.ceil(y1), side); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.min(Math.ceil(x1), side); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          tot += a[yy * side + xx] * wx * wy; wsum += wx * wy;
        }
      }
      out[oy * n + ox] = wsum ? tot / wsum : 1;
    }
  }
  return out;
}

/**
 * Symbol aus einem Graustufenbild (Float64Array, Breite imgW) ausschneiden.
 * @returns Uint8Array(24*24) oder null
 */
export function extract(gray, imgW, imgH, box) {
  const x0 = Math.max(0, Math.trunc(box.x0)), y0 = Math.max(0, Math.trunc(box.y0));
  const x1 = Math.min(imgW, Math.trunc(box.x1)), y1 = Math.min(imgH, Math.trunc(box.y1));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 4 || h <= 4) return null;
  const c = new Float64Array(w * h);
  let mn = 1, mx = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = gray[(y0 + y) * imgW + x0 + x]; c[y * w + x] = v; if (v < mn) mn = v; if (v > mx) mx = v;
  }
  const thr = (mn + mx) / 2;
  const label = new Int32Array(w * h);
  const comps = [null];
  for (let s = 0; s < w * h; s++) {
    if (!(c[s] < thr) || label[s]) continue;
    const id = comps.length, comp = { n: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1, sx: 0, sy: 0 };
    const stack = [s]; label[s] = id;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      comp.n++; comp.sx += x; comp.sy += y;
      if (x < comp.minX) comp.minX = x; if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y; if (y > comp.maxY) comp.maxY = y;
      if (x > 0 && c[i - 1] < thr && !label[i - 1]) { label[i - 1] = id; stack.push(i - 1); }
      if (x < w - 1 && c[i + 1] < thr && !label[i + 1]) { label[i + 1] = id; stack.push(i + 1); }
      if (y > 0 && c[i - w] < thr && !label[i - w]) { label[i - w] = id; stack.push(i - w); }
      if (y < h - 1 && c[i + w] < thr && !label[i + w]) { label[i + w] = id; stack.push(i + w); }
    }
    comps.push(comp);
  }
  const cand = [];
  for (let i = 1; i < comps.length; i++) {
    const k = comps[i];
    if (k.minX === 0 || k.maxX === w - 1) continue;
    if (Math.abs(k.sx / k.n - w / 2) < 0.3 * w && Math.abs(k.sy / k.n - h / 2) < 0.3 * h) cand.push(i);
  }
  if (!cand.length) return null;
  const main = comps[cand.reduce((a, b) => comps[b].n > comps[a].n ? b : a)];
  const tol = 0.2 * box.unit;
  const keep = new Set(cand.filter(i => {
    const k = comps[i];
    return k.minX <= main.maxX + tol && k.maxX >= main.minX - tol && k.minY <= main.maxY + tol && k.maxY >= main.minY - tol;
  }));
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let i = 0; i < w * h; i++) if (keep.has(label[i])) {
    const x = i % w, y = (i / w) | 0;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const sw = bx1 - bx0 + 1, sh = by1 - by0 + 1, side = Math.max(sw, sh) + 2;
  const sq = new Float64Array(side * side).fill(mx);
  const ox = ((side - sw) / 2) | 0, oy = ((side - sh) / 2) | 0;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = (by0 + y) * w + bx0 + x;
    if (keep.has(label[i])) sq[(oy + y) * side + ox + x] = c[i];
  }
  const small = areaResize(sq, side, SIZE);
  let smn = 1, smx = 0;
  for (const v of small) { if (v < smn) smn = v; if (v > smx) smx = v; }
  const t = (smn + smx) / 2;
  const bits = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < bits.length; i++) bits[i] = small[i] < t ? 1 : 0;
  return bits;
}

// ---------- Vergleich ----------

function roll(b, dy, dx) {
  const out = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
    out[((y + dy + SIZE) % SIZE) * SIZE + (x + dx + SIZE) % SIZE] = b[y * SIZE + x];
  return out;
}
function blur(bits) {
  let a = Float64Array.from(bits);
  for (let r = 0; r < 2; r++) {
    const o = new Float64Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let s = 0;
      for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
        const yy = y + ky, xx = x + kx;
        if (yy >= 0 && yy < SIZE && xx >= 0 && xx < SIZE) s += a[yy * SIZE + xx];
      }
      o[y * SIZE + x] = s / 9;
    }
    a = o;
  }
  return a;
}
function ncc(a, b) {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  const d = Math.sqrt(da * db);
  return d ? num / d : 0;
}
export function similarity(p, q) {
  const bp = blur(p);
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const qq = roll(q, dy, dx);
    let inter = 0, union = 0;
    for (let i = 0; i < qq.length; i++) { if (p[i] && qq[i]) inter++; if (p[i] || qq[i]) union++; }
    const iou = union ? inter / union : 0;
    best = Math.max(best, 0.5 * ncc(bp, blur(qq)) + 0.5 * iou);
  }
  return best;
}

/**
 * @param learned { Stil: [Uint8Array] } – vom Nutzer bestätigte Symbole
 * @returns { style, score, margin } oder null, wenn unsicher
 */
export function match(bits, learned = {}) {
  const styles = new Set([...Object.keys(BUNDLED), ...Object.keys(learned)]);
  const scores = [...styles].map(s => {
    const list = [...(BUNDLED[s] || []), ...(learned[s] || [])];
    return [s, Math.max(0, ...list.map(q => similarity(bits, q)))];
  }).sort((a, b) => b[1] - a[1]);
  const [first, second] = scores;
  if (!first || first[1] < MIN_SCORE || first[1] - (second ? second[1] : 0) < MIN_MARGIN) return null;
  return { style: first[0], score: first[1], margin: first[1] - (second ? second[1] : 0) };
}
