// Wörter aus der Texterkennung (zwei Durchgänge: normal + invertiert) zu Zeilen zusammenfassen.
// Wie bei Apple Vision werden Spalten, die weit auseinanderliegen, zu eigenen Zeilen.

const overlap = (a, b) => {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const area = r => (r.x1 - r.x0) * (r.y1 - r.y0);
  // Schnitt / Vereinigung: ein großes Fehl-Wort verdrängt keine kleinen, richtig gelesenen Wörter
  return inter / Math.max(1e-9, area(a) + area(b) - inter);
};

/// Wörter beider Durchgänge vereinen: bei Überlappung gewinnt die höhere Sicherheit.
export function mergeWords(passes) {
  const all = passes.flat()
    .map(w => ({ ...w, text: w.text.trim() }))
    .filter(w => w.text && w.confidence >= 30)
    // kurze Zeichen-Reste mit niedriger Sicherheit verwerfen ("a", "BL", "©")
    .filter(w => !(w.text.length <= 2 && !/^\d\d$/.test(w.text) && w.confidence < 70))
    .sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const w of all) if (!kept.some(k => overlap(k, w) > 0.5)) kept.push(w);
  return kept;
}

/// Wörter → Zeilen. Koordinaten in Pixeln rein, normiert (0…1) raus.
export function buildLines(words, imgW, imgH) {
  const sorted = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const rows = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2, h = w.y1 - w.y0;
    const row = rows.find(r => Math.abs(r.cy - cy) < Math.max(h, r.h) * 0.5);
    if (row) { row.words.push(w); row.cy = (row.cy * (row.words.length - 1) + cy) / row.words.length; row.h = Math.max(row.h, h); }
    else rows.push({ cy, h, words: [w] });
  }
  const lines = [];
  for (const r of rows) {
    const ws = r.words.sort((a, b) => a.x0 - b.x0);
    let seg = [ws[0]];
    const flush = () => {
      const x0 = Math.min(...seg.map(s => s.x0)), x1 = Math.max(...seg.map(s => s.x1));
      const y0 = Math.min(...seg.map(s => s.y0)), y1 = Math.max(...seg.map(s => s.y1));
      lines.push({ text: seg.map(s => s.text).join(" "), x0: x0 / imgW, x1: x1 / imgW, y0: y0 / imgH, y1: y1 / imgH });
    };
    for (let i = 1; i < ws.length; i++) {
      const gap = ws[i].x0 - seg[seg.length - 1].x1;
      if (gap > r.h * 1.6) { flush(); seg = [ws[i]]; } else seg.push(ws[i]);
    }
    flush();
  }
  return lines.sort((a, b) => Math.abs(a.y0 + a.y1 - b.y0 - b.y1) > 0.016 ? (a.y0 + a.y1) - (b.y0 + b.y1) : a.x0 - b.x0);
}
