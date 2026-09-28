// Liest Kauf-/Verkaufsdaten aus erkannten Textzeilen der deutschen EA FC Oberfläche.
// Portierung von FCTrader/Services/ScreenshotScanner.swift (ScreenshotParser).
//
// Eingabe je Bild: Zeilen { text, x0, y0, x1, y1 } in normierten Koordinaten (0…1, oben links).
// Unterstützte Ansichten:
// - Item-Details nach Kauf („…ergattert f. 1.000“) oder Verkauf („Endpreis 2.100“)
// - Kandidatenliste / Transferliste: je Karte Name, „Verkauft für“ + Preis (mehrere Karten)

import { matchStyle } from "./calc.js";

const CONTENT_TOP = 0.14;
const CONTENT_BOTTOM = 0.9;

const PAID_LABELS = ["verkauft fur", "gekauft fur", "sold for", "bought for"];
const WON_PHRASES = ["ergattert", "erworben"];
const SOLD_PHRASES = ["endpreis"];
// Erkennungsmerkmale der Ansicht. Kauf-Seiten zeigen u. a. „Transferliste voll“ oder „Zu Mein Verein“ –
// deshalb zählt „Transferliste“ nur als Verkauf, wenn es allein als Seitentitel steht.
const PURCHASE_MARKERS = ["kandidatenliste", "ersteigerte items", "ergattert", "gluckwunsch", "zu mein verein",
  "zur aktiven mannschaft", "alles an verein senden", "transferliste voll", "transfer targets", "items won"];
const SALE_MARKERS = ["verk. items", "verkaufte loschen", "nicht verk. items", "endpreis", "alle neu anbieten",
  "sold items"];
const SALE_TITLES = ["transferliste", "transfer list"];
const PRICE_KEYWORDS = ["ergattert", "verkauft fur", "gekauft fur", "kaufpreis", "verkaufspreis",
  "sofortkauf", "preis", "bought for", "sold for", "buy now", "price"];

const STAT_LABELS = new Set(("TEM SCH PAS DRI DEF PHY VER KÖR HEC BAL ABS REF GES STE BSI TMP " +
  "PAC SHO DIV HAN KIC SPD POS").split(" "));
const POSITIONS = new Set(("TW RV IV LV RAV LAV ZDM ZM ZOM RM LM RF LF MS ST " +
  "GK RB CB LB RWB LWB CDM CM CAM RW LW CF").split(" "));
const UI_FRAGMENTS = ["item", "details", "biografie", "verein", "mannschaft", "transfer", "preisvergleich",
  "schnellverkauf", "sofortkauf", "startpreis", "startseite", "shop", "gebot", "jagd", "winde",
  "kandidat", "abgelaufen", "zeit", "verkauft", "gekauft", "gluckwunsch", "ergattert", "senden",
  "liste", "beobachtet", "aktive", "chemie", "attribute", "vergleich", "zuruck", "schliessen",
  "bestatigen", "abbrechen", "optionen", "weiter", "fertig", "voll", "ultimate", "kader",
  "anbieten", "entfernen", "loschen", "restzeit", "endpreis", "verk.", "bieten", "kaufen", "beob",
  "buy now", "bid", "club", "squad", "market", "compare", "back"];

// ---------- Text-Hilfen ----------

export const fold = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const compact = t => fold(t).replace(/\s+/g, "");
const has = (line, keyword) => compact(line.text).includes(keyword.replace(/\s+/g, ""));
const midY = l => (l.y0 + l.y1) / 2;
const midX = l => (l.x0 + l.x1) / 2;
const height = l => l.y1 - l.y0;
const width = l => l.x1 - l.x0;

const NUMBER = /\d{1,3}(?:[.,]\d{3})+|\d{3,8}/g;
export const coinNumbers = t => (t.match(NUMBER) || []).map(s => parseInt(s.replace(/\D/g, ""), 10));

function isStatLabels(text) {
  const letters = text.toUpperCase().replace(/\s+/g, "");
  if (!letters.length || letters.length % 3) return false;
  for (let i = 0; i < letters.length; i += 3) if (!STAT_LABELS.has(letters.slice(i, i + 3))) return false;
  return true;
}

function isNameCandidate(text) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const c = compact(text);
  if (text.length < 3 || text.length > 30) return false;
  if (/\d/.test(text)) return false;
  if (!/^[\p{L} .'-]+$/u.test(text)) return false;
  if ((text.match(/\p{L}/gu) || []).length < 3) return false;
  if (words.every(w => STAT_LABELS.has(w) || POSITIONS.has(w))) return false;
  if (isStatLabels(text)) return false;
  if (UI_FRAGMENTS.some(f => c.includes(f.replace(/\s+/g, "")))) return false;
  if (matchStyle(text)) return false;
  // Einzelne Buchstaben-Reste der Texterkennung ("a", "BL") am Anfang entfernen wir vorher
  return true;
}

/// "84", "84 ZOM" → 84
function rating(text) {
  const parts = text.trim().split(/\s+/);
  if (!parts[0] || parts[0].length !== 2 || !/^\d\d$/.test(parts[0])) return null;
  const v = +parts[0];
  if (v < 40 || v > 99) return null;
  if (parts.length === 1) return v;
  if (parts.length === 2 && POSITIONS.has(parts[1].toUpperCase())) return v;
  return null;
}

export const nameKey = n => fold(n).replace(/[^\p{L}]/gu, "");

export function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/// Ähnlich genug für einen Lesefehler der Texterkennung (bis 2 Zeichen Abweichung, bei kurzen Namen 1).
export const similarKeys = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= (a.length >= 8 ? 2 : 1));

/// Bekannten Namen bevorzugen ("Fiamma Benítez" → "Benitez" aus der Excel).
export function canonicalName(text, knownNames) {
  const key = nameKey(text);
  const exact = knownNames.find(n => nameKey(n) === key);
  if (exact) return exact;
  const last = text.trim().split(/\s+/).pop();
  const byLast = knownNames.find(n => nameKey(n) === nameKey(last));
  if (byLast) return byLast;
  // Lesefehler tolerieren: ganzer Name, letztes Wort, oder die letzten Buchstaben ("Benititez" ~ "Benitez")
  const fuzzy = knownNames.find(n => similarKeys(nameKey(n), key) || similarKeys(nameKey(n), nameKey(last))
    || (nameKey(n).length >= 5 && similarKeys(nameKey(n), key.slice(-nameKey(n).length))));
  if (fuzzy) return fuzzy;
  if (text === text.toUpperCase()) return text.toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase());
  return text.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2");
}

// ---------- Ansichten ----------

export function kindOf(lines) {
  if (lines.some(l => WON_PHRASES.some(k => has(l, k)))) return "purchase";
  if (lines.some(l => SOLD_PHRASES.some(k => has(l, k)))) return "sale";
  const p = lines.filter(l => PURCHASE_MARKERS.some(k => has(l, k))).length;
  const s = lines.filter(l => SALE_MARKERS.some(k => has(l, k))
    || SALE_TITLES.some(k => compact(l.text).replace(/[^a-z]/g, "") === k.replace(/\s+/g, ""))).length;
  if (p === 0 && s === 0) return "unknown";
  return s > p ? "sale" : "purchase";
}

function numberBelow(label, lines, maxDistance, alignX, preferLast = false) {
  let best = null;
  for (const l of lines) {
    const dy = midY(l) - midY(label);
    if (!(dy > 0.002 && dy < maxDistance)) continue;
    if (alignX && Math.abs(l.x0 - label.x0) > 0.12) continue;
    const nums = coinNumbers(l.text).filter(n => n >= 100);
    const v = preferLast ? nums[nums.length - 1] : nums[0];
    if (v == null) continue;
    if (!best || dy < best.dy) best = { dy, v };
  }
  return best ? best.v : null;
}

function parseDetail(lines, knownNames) {
  const item = {};
  let anchor = lines.find(l => WON_PHRASES.some(k => has(l, k)));
  const statsAny = lines.find(l => isStatLabels(l.text) && l.text.replace(/\s+/g, "").length >= 9);
  if (anchor) item.price = numberBelow(anchor, lines, 0.08, false);
  else if ((anchor = lines.find(l => SOLD_PHRASES.some(k => has(l, k))))) {
    // "Endpreis" steht rechts in einer Zeile mit "Restzeit" → Zahl darunter, rechte Spalte
    item.price = numberBelowAt(anchorColumn(anchor, "endpreis"), anchor, lines, 0.05);
  } else if (statsAny) {
    // Andere Kartenansicht (z. B. Transfermarkt): Karte auswerten, Preis über Stichwörter
    anchor = { ...statsAny, y0: statsAny.y1 + 0.02, y1: statsAny.y1 + 0.03 };
    const below = lines.filter(l => midY(l) > statsAny.y1);
    for (const k of PRICE_KEYWORDS) {
      const label = below.find(l => has(l, k));
      if (!label) continue;
      item.price = coinNumbers(label.text).find(n => n >= 100) ?? numberBelow(label, lines, 0.06, true);
      if (item.price != null) break;
    }
  } else return null;

  const card = lines.filter(l => midY(l) < midY(anchor));
  const statsRow = card.find(l => isStatLabels(l.text));
  if (statsRow) {
    const row = card.filter(l => isStatLabels(l.text) && Math.abs(midY(l) - midY(statsRow)) < height(statsRow))
      .reduce((a, l) => ({ x0: Math.min(a.x0, l.x0), y0: Math.min(a.y0, l.y0), x1: Math.max(a.x1, l.x1), y1: Math.max(a.y1, l.y1) }), statsRow);
    item.iconSearch = { type: "detail", statsRow: row };
  }
  // Name: direkt über der Werte-Zeile und horizontal auf der Karte
  const names = card.filter(l => isNameCandidate(l.text) && (!statsRow ||
    (midY(l) < midY(statsRow) && midY(statsRow) - midY(l) < 4 * height(statsRow) + 0.02
      && midX(l) > statsRow.x0 && midX(l) < statsRow.x1)));
  const nameLine = names.sort((a, b) => midY(a) - midY(b))[names.length - 1];
  if (nameLine) item.name = canonicalName(nameLine.text, knownNames);
  // Rating = die größte Zahl oben links auf der Karte (Störzeichen aus dem Kartenbild sind kleiner)
  const limit = nameLine ? midY(nameLine) : midY(anchor);
  const leftEdge = statsRow ? statsRow.x0 + 0.25 * width(statsRow) : 1;
  const ratings = card.filter(l => midY(l) < limit && l.x0 < leftEdge && rating(l.text) != null)
    .sort((a, b) => height(b) - height(a));
  if (ratings.length) item.rating = rating(ratings[0].text);
  return (item.name || item.rating || item.price) ? item : null;
}

/// x-Position eines Stichworts innerhalb einer Zeile (für zusammengefasste Spalten).
function anchorColumn(line, keyword) {
  const i = compact(line.text).indexOf(keyword);
  const len = compact(line.text).length || 1;
  return line.x0 + (line.x1 - line.x0) * Math.max(0, i) / len;
}

function numberBelowAt(x, label, lines, maxDistance) {
  let best = null;
  for (const l of lines) {
    const dy = midY(l) - midY(label);
    if (!(dy > 0.002 && dy < maxDistance)) continue;
    for (const seg of segmentsOf(l)) {
      if (seg.x1 < x - 0.05) continue;
      const v = coinNumbers(seg.text).find(n => n >= 100);
      if (v == null) continue;
      const score = dy + Math.abs(seg.x0 - x);
      if (!best || score < best.score) best = { score, v };
    }
  }
  return best ? best.v : null;
}

/// Zeile in Wortgruppen zerlegen (falls die Texterkennung Wörter mit Position liefert).
const segmentsOf = l => l.words && l.words.length ? l.words : [l];

function parseList(lines, knownNames) {
  const labels = lines.filter(l => PAID_LABELS.some(k => has(l, k)));
  return labels.map(label => {
    const item = {};
    const second = PAID_LABELS.some(k => compact(label.text).indexOf(k.replace(/\s+/g, "")) > 0);
    item.price = second
      ? numberBelowAt(anchorColumn(label, "verkauftfur") ?? label.x0, label, lines, 0.05)
      : numberBelow(label, lines, 0.05, true);

    const nameLine = lines.filter(l => isNameCandidate(l.text) && midY(l) < midY(label)
      && midY(label) - midY(l) < 0.06 && l.x0 < label.x0)
      .sort((a, b) => midY(b) - midY(a))[0];
    if (nameLine) item.name = canonicalName(nameLine.text, knownNames);

    const ref = nameLine || label;
    const hits = lines.filter(l => l.x1 <= ref.x0 + 0.01 && Math.abs(midY(l) - midY(ref)) < 0.05)
      .map(l => ({ l, v: rating(l.text), d: Math.abs(midY(l) - midY(ref)) })).filter(h => h.v != null)
      .sort((a, b) => a.d - b.d);
    if (hits[0]) {
      item.rating = hits[0].v;
      const r = hits[0].l;
      const pos = lines.find(l => POSITIONS.has(l.text.trim().toUpperCase()) && midY(l) > midY(r)
        && midY(l) - midY(r) < 3 * height(r) && Math.abs(midX(l) - midX(r)) < width(r));
      if (pos) item.iconSearch = { type: "list", position: pos, spacing: midY(pos) - midY(r) };
    }
    return (item.name || item.rating || item.price) ? item : null;
  }).filter(Boolean);
}

function parseGeneric(lines, knownNames) {
  const item = {};
  for (const k of PRICE_KEYWORDS) {
    const label = lines.find(l => has(l, k));
    if (!label) continue;
    item.price = coinNumbers(label.text).find(n => n >= 100) ?? numberBelow(label, lines, 0.08, false);
    if (item.price != null) break;
  }
  const n = lines.find(l => isNameCandidate(l.text));
  if (n) item.name = canonicalName(n.text, knownNames);
  const r = lines.map(l => rating(l.text)).find(v => v != null);
  if (r != null) item.rating = r;
  return (item.name || item.rating || item.price) ? item : null;
}

function itemsIn(lines, knownNames) {
  const d = parseDetail(lines, knownNames);
  if (d) return [d];
  const list = parseList(lines, knownNames);
  if (list.length) return list;
  const g = parseGeneric(lines, knownNames);
  return g ? [g] : [];
}

function mostCommon(values) {
  const c = new Map();
  for (const v of values) c.set(v, (c.get(v) || 0) + 1);
  let best = null, n = 0;
  for (const [v, k] of c) if (k > n) { best = v; n = k; }
  return best;
}

/// Mehrere Einzelbilder (Video): pro Name die höchste Anzahl in einem Bild, Werte per Mehrheit.
function merge(frames) {
  if (frames.length <= 1) return frames[0] || [];
  const order = [], occ = new Map();
  for (const items of frames) {
    const count = new Map();
    for (const it of items) {
      let key = it.name ? nameKey(it.name) : "?";
      // Leicht unterschiedlich gelesene Namen desselben Spielers zusammenfassen
      const similar = order.find(k => k !== "?" && key !== "?" && similarKeys(k, key));
      if (similar) key = similar;
      const i = count.get(key) || 0;
      count.set(key, i + 1);
      if (!occ.has(key)) { order.push(key); occ.set(key, []); }
      if (occ.get(key).length <= i) occ.get(key).push([]);
      occ.get(key)[i].push(it);
    }
  }
  const keys = order.length > 1 ? order.filter(k => k !== "?") : order;
  return keys.flatMap(k => occ.get(k).map(obs => ({
    name: mostCommon(obs.map(o => o.name).filter(Boolean)),
    rating: mostCommon(obs.map(o => o.rating).filter(v => v != null)),
    price: mostCommon(obs.map(o => o.price).filter(v => v != null)),
    chemistryStyle: mostCommon(obs.map(o => o.chemistryStyle).filter(Boolean)),
    iconPrint: obs.map(o => o.iconPrint).find(Boolean) || null,
  })));
}

/**
 * @param frames [{ lines, recognizeIcon?: (item) => item }]
 * @returns { kind, items, tokens }
 */
export function parseFrames(frames, knownNames = []) {
  const votes = { purchase: 0, sale: 0 };
  const perFrame = [];
  const tokens = [], seen = new Set();
  for (const f of frames) {
    const k = kindOf(f.lines);
    if (k !== "unknown") votes[k]++;
    const content = f.lines.filter(l => midY(l) > CONTENT_TOP && midY(l) < CONTENT_BOTTOM && l.text.trim());
    let items = itemsIn(content, knownNames);
    if (f.recognizeIcon) items = items.map(f.recognizeIcon);
    perFrame.push(items);
    for (const l of content) {
      const t = l.text.trim();
      if (t.length >= 2 && t.length <= 40 && !seen.has(fold(t))) { seen.add(fold(t)); tokens.push(t); }
    }
  }
  const kind = votes.purchase === votes.sale ? "unknown" : votes.purchase > votes.sale ? "purchase" : "sale";
  return { kind, items: merge(perFrame), tokens: tokens.slice(0, 40) };
}
