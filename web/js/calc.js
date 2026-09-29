// Rechenregeln – identisch mit der Excel bzw. der iOS-Version.

export const STYLES = ["Basic", "Sniper", "Finisher", "Deadeye", "Marksman", "Hawk", "Artist", "Architect",
  "Powerhouse", "Maestro", "Engine", "Sentinel", "Guardian", "Gladiator", "Backbone", "Anchor",
  "Hunter", "Catalyst", "Shadow", "Wall", "Shield", "Cat", "Glove"];

/// "GK Basic" (Torhüter) ist derselbe Stil wie "Basic".
export function matchStyle(text) {
  const t = String(text || "").trim().toLowerCase();
  if (t === "gk basic") return "Basic";
  return STYLES.find(s => s.toLowerCase() === t) || null;
}

/// Aufschlag auf den EK für den kalkulierten VK (Spalte „kalk. VK“ der Excel): [EK bis einschl., Aufschlag]
export const TIERS = [[2000, 1000], [4000, 1500], [6000, 2000], [10000, 2500], [15000, 3000],
  [25000, 4000], [50000, 6000], [100000, 10000], [200000, 20000]];
export const MARKUP_ABOVE = 60000;

export const TAX_RATE = 0.05;
export const tax = p => Math.round(p * TAX_RATE);
/// Gewinn = Verkaufspreis − 5 % EA Tax − Einkaufspreis
export const profitOf = (ek, vk) => vk - tax(vk) - ek;
/// EA-Preisstufen: bis 1.000 in 50ern (ab 150), bis 10.000 in 100ern, bis 50.000 in 250ern, bis 100.000 in 500ern, darüber in 1.000ern
export const priceStep = p => p < 1000 ? 50 : p < 10000 ? 100 : p < 50000 ? 250 : p < 100000 ? 500 : 1000;
const roundUp = p => Math.max(150, Math.ceil(p / priceStep(p)) * priceStep(p));
export const roundDown = p => Math.max(150, Math.floor(p / priceStep(p)) * priceStep(p));
/// Nächster gültiger Marktpreis
export const roundPrice = p => { const d = roundDown(p), u = roundUp(p); return p - d <= u - p ? d : u; };
/// Eine Preisstufe höher (dir > 0) bzw. tiefer (dir < 0) – auch über Grenzen wie 10.000 → 9.900 hinweg
export const stepPrice = (p, dir) => dir > 0 ? roundUp(p + 1) : roundDown(p - 1);
/// kalk. VK = EK + Aufschlag laut Tabelle, auf den nächsten gültigen Preis aufgerundet
export const target = ek => roundUp(ek + (TIERS.find(t => ek <= t[0]) || [0, MARKUP_ABOVE])[1]);
/// Kleinster gültiger Marktpreis, der nach Tax mindestens EK × (1 + Marge) bringt.
export function breakEven(ek, margin = 0) {
  const goal = Math.ceil(ek * (1 + margin));
  let p = roundUp(Math.ceil(goal / (1 - TAX_RATE)));
  while (p - tax(p) < goal) p = roundUp(p + 1);
  return p;
}

// ---------- Formatierung ----------

export const fmt = n => Math.round(n).toLocaleString("de-DE");
export const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));
/// Zahlen immer ausgeschrieben (keine k/M-Abkürzungen)
export const compact = n => (n < 0 ? "−" : "") + fmt(Math.abs(n));
export const pct = v => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toLocaleString("de-DE",
  { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";

/// "12500", "12.500", "12,5k", "1.2m", "1.100,00"
export function parseCoins(t) {
  let s = String(t ?? "").toLowerCase().replace(/\s/g, "");
  if (!s) return null;
  let m = 1;
  if (s.endsWith("k")) { m = 1e3; s = s.slice(0, -1); } else if (s.endsWith("m")) { m = 1e6; s = s.slice(0, -1); }
  if (m > 1) { const d = parseFloat(s.replace(",", ".")); return isNaN(d) ? null : Math.round(d * m); }
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const neg = s.startsWith("-");
  // Dezimalteil mit 1–2 Stellen abschneiden ("1.100,00")
  const dec = s.match(/^(.*)[.,](\d{1,2})$/);
  if (dec) s = dec[1] + (parseInt(dec[2].padEnd(2, "0"), 10) >= 50 ? "+" : "");
  const up = s.endsWith("+");
  const v = parseInt(s.replace(/[^\d]/g, ""), 10);
  if (isNaN(v)) return null;
  return (neg ? -1 : 1) * (v + (up ? 1 : 0));
}

// ---------- Datum ----------

export const DAY = 864e5;
export const dOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const toISODate = d => {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const parseDay = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const fmtDate = d => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
export const fmtShort = d => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
export const daysBetween = (a, b) => Math.round((dOnly(b) - dOnly(a)) / DAY);
export const holdText = days => days <= 0 ? "< 1 T" : Math.round(days) + " T";
export function isoWeek(d) {
  const t = new Date(d); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / DAY - 3 + (w1.getDay() + 6) % 7) / 7);
}
