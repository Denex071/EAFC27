// Auswertungen: Nachkauf-Bewertung, Ladenhüter, Aufschlüsselung, Verluste, Kapital – reine Rechenfunktionen.

import { profitOf, roundDown, DAY, dOnly, toISODate, parseDay, daysBetween, isoWeek } from "./calc.js";
import { nameKey } from "./parser.js";

const isSold = c => c.vk != null;
const sum = a => a.reduce((x, y) => x + y, 0);
const hold = c => daysBetween(parseDay(c.ekDate), parseDay(c.vkDate));
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

export const DEFAULTS = { weeklyGoal: 0, minProfit: 300, staleDays: 3 };

// ---------- Nachkauf-Bewertung ----------

/// Bisherige Flips einer Karte (gleicher Name & Rating; gleicher Stil, wenn davon genug da sind).
export function flipStats(cards, name, rating, chem, minProfit = DEFAULTS.minProfit) {
  const key = nameKey(name);
  const all = cards.filter(c => isSold(c) && c.rating === rating && nameKey(c.name) === key);
  const same = all.filter(c => c.chem === chem);
  const flips = (same.length >= 2 ? same : all).sort((a, b) => a.vkDate.localeCompare(b.vkDate));
  if (!flips.length) return null;
  const profits = flips.map(c => profitOf(c.ek, c.vk));
  const recent = flips.slice(-3);
  const expVk = median(recent.map(c => c.vk));
  const maxEk = roundDown(expVk - Math.round(expVk * 0.05) - minProfit);
  return {
    n: flips.length, sameStyle: flips === same,
    profit: sum(profits), avg: Math.round(sum(profits) / flips.length),
    hold: sum(flips.map(hold)) / flips.length,
    losses: profits.filter(p => p < 0).length,
    history: flips.slice(-5).reverse().map(c => ({ ek: c.ek, vk: c.vk, date: c.vkDate, profit: profitOf(c.ek, c.vk) })),
    expVk, maxEk: maxEk > 0 ? maxEk : null,
  };
}

// ---------- Ladenhüter ----------

export function staleCards(cards, days = DEFAULTS.staleDays, today = new Date()) {
  return cards.filter(c => !isSold(c) && daysBetween(parseDay(c.ekDate), today) >= days)
    .sort((a, b) => a.ekDate.localeCompare(b.ekDate));
}

// ---------- Aufschlüsselung ----------

export const PRICE_CLASSES = [[2000, "bis 2k"], [4000, "2–4k"], [6000, "4–6k"], [10000, "6–10k"], [15000, "10–15k"],
  [25000, "15–25k"], [50000, "25–50k"], [100000, "50–100k"], [Infinity, "über 100k"]];
const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function groupRows(sold, keyOf, labelOf, order) {
  const groups = new Map();
  for (const c of sold) { const k = keyOf(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  return [...groups.entries()].map(([k, list]) => {
    const profits = list.map(c => profitOf(c.ek, c.vk));
    const days = sum(list.map(c => Math.max(1, hold(c)))); // angebrochener Tag zählt als 1
    return { key: k, label: labelOf(k), n: list.length, profit: sum(profits), avg: Math.round(sum(profits) / list.length),
      margin: sum(list.map((c, i) => profits[i] / c.vk)) / list.length, hold: sum(list.map(hold)) / list.length,
      perDay: Math.round(sum(profits) / days), losses: profits.filter(p => p < 0).length };
  }).sort(order);
}

/// dim: "price" | "chem" | "rating" | "weekday"
export function breakdown(sold, dim) {
  if (dim === "price") {
    const idx = c => PRICE_CLASSES.findIndex(p => c.ek <= p[0]);
    return groupRows(sold, idx, i => PRICE_CLASSES[i][1], (a, b) => a.key - b.key);
  }
  if (dim === "weekday") {
    const wd = c => (parseDay(c.vkDate).getDay() + 6) % 7;
    return groupRows(sold, wd, i => WEEKDAYS[i], (a, b) => a.key - b.key);
  }
  if (dim === "rating") return groupRows(sold, c => c.rating, r => `Rating ${r}`, (a, b) => b.key - a.key);
  // Styles nach Gewinn pro Tag; Styles mit weniger als 3 Verkäufen ans Ende (zu wenig Daten)
  return groupRows(sold, c => c.chem, s => s, (a, b) => (a.n < 3) - (b.n < 3) || b.perDay - a.perDay);
}

// ---------- Verluste ----------

export function lossStats(sold) {
  const rows = sold.map(c => ({ c, p: profitOf(c.ek, c.vk) }));
  const losses = rows.filter(r => r.p < 0);
  const byName = new Map();
  for (const r of losses) {
    const k = nameKey(r.c.name) + "|" + r.c.rating;
    const g = byName.get(k) || { name: r.c.name, rating: r.c.rating, n: 0, loss: 0 };
    g.n++; g.loss += r.p; byName.set(k, g);
  }
  return { n: losses.length, share: sold.length ? losses.length / sold.length : 0, sum: sum(losses.map(r => r.p)),
    worst: [...byName.values()].sort((a, b) => a.loss - b.loss).slice(0, 5) };
}

// ---------- Wochen: Gewinn, Kapital, Rendite ----------

const monday = d => { const x = dOnly(d); return new Date(x - ((x.getDay() + 6) % 7) * DAY); };

/// Letzte n Kalenderwochen (älteste zuerst): Gewinn, Verkäufe, gebundenes Kapital am Wochenende, Rendite.
export function weekly(cards, n = 12, today = new Date()) {
  const first = new Date(+monday(today) - (n - 1) * 7 * DAY);
  const weeks = [];
  for (let i = 0; i < n; i++) {
    const start = new Date(+first + i * 7 * DAY), end = toISODate(new Date(+start + 6 * DAY)), from = toISODate(start);
    const sold = cards.filter(c => isSold(c) && c.vkDate >= from && c.vkDate <= end);
    const capital = sum(cards.filter(c => c.ekDate <= end && (!isSold(c) || c.vkDate > end)).map(c => c.ek));
    const profit = sum(sold.map(c => profitOf(c.ek, c.vk)));
    weeks.push({ start, profit, n: sold.length, capital, roi: capital ? profit / capital : null });
  }
  let run = sum(cards.filter(c => isSold(c) && c.vkDate < toISODate(first)).map(c => profitOf(c.ek, c.vk)));
  for (const w of weeks) { run += w.profit; w.cumulative = run; }
  return weeks;
}

/// Gewinn der laufenden und der vorigen Kalenderwoche.
export function weekProgress(cards, today = new Date()) {
  const start = monday(today), prevStart = new Date(+start - 7 * DAY);
  const inRange = (c, a, b) => isSold(c) && c.vkDate >= toISODate(a) && c.vkDate < toISODate(b);
  const profit = (a, b) => sum(cards.filter(c => inRange(c, a, b)).map(c => profitOf(c.ek, c.vk)));
  const end = new Date(+start + 7 * DAY);
  const dayOfWeek = daysBetween(start, today) + 1; // 1 = Montag
  // Vorwoche bis zum gleichen Wochentag, damit der Vergleich fair ist
  return { start, profit: profit(start, end), prev: profit(prevStart, start),
    prevSoFar: profit(prevStart, new Date(+prevStart + dayOfWeek * DAY)), dayOfWeek };
}

// ---------- Zeiträume für die Spielerliste ----------

export function ranges(cards, today = new Date()) {
  const out = [["all", "Gesamter Zeitraum"]];
  const mon = monday(today);
  for (let i = 0; i < 12; i++) {
    const s = new Date(+mon - i * 7 * DAY), e = new Date(+s + 6 * DAY);
    const has = i < 2 || cards.some(c => (c.vkDate || c.ekDate) >= toISODate(s) && (c.vkDate || c.ekDate) <= toISODate(e));
    if (has) out.push([`w:${toISODate(s)}`, `${i === 0 ? "Diese Woche" : i === 1 ? "Letzte Woche" : "KW " + isoWeek(s)} (${s.getDate()}.${s.getMonth() + 1}.–${e.getDate()}.${e.getMonth() + 1}.)`]);
  }
  for (let i = 0; i < 6; i++) {
    const s = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push([`m:${toISODate(s)}`, s.toLocaleDateString("de-DE", { month: "long", year: "numeric" })]);
  }
  return out;
}
export function inRange(iso, range) {
  if (!range || range === "all") return true;
  const [kind, from] = range.split(":");
  const s = parseDay(from);
  const end = kind === "w" ? new Date(+s + 6 * DAY) : new Date(s.getFullYear(), s.getMonth() + 1, 0, 12);
  return iso >= from && iso <= toISODate(end);
}
