// Import der bisherigen Excel (Reiter „Spieler“) als .xlsx oder .csv.
// Stabile IDs wie in der iOS-Version: ein erneuter Import überschreibt, statt zu verdoppeln.

import { matchStyle, parseCoins, toISODate } from "./calc.js";

const COLUMNS = {
  name: ["name", "spieler"],
  rating: ["rating", "bewertung", "ovr"],
  chem: ["chemiestyle", "chemiestil", "chemie", "chemistry", "chemistrystyle"],
  ek: ["ek", "einkaufspreis", "einkauf", "ekpreis", "kaufpreis"],
  ekDate: ["ekdatum", "kaufdatum", "einkaufsdatum"],
  vk: ["vk", "verkaufspreis", "verkauf", "vkpreis"],
  vkDate: ["vkdatum", "verkaufsdatum"],
  notes: ["notiz", "notizen", "bemerkung"],
};
// Spaltenpositionen im Reiter „Spieler“, falls keine Überschrift erkannt wird
const EXCEL_INDEX = { name: 0, rating: 1, chem: 2, ek: 3, ekDate: 4, vk: 6, vkDate: 7 };

const norm = h => String(h ?? "").toLowerCase().replace(/[^a-zäöüß]/g, "");

/// CSV mit Anführungszeichen; Trennzeichen (; , Tab) wird erkannt.
export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const delim = [";", "\t", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(f => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(f => f !== "")) rows.push(row);
  return rows;
}

function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return toISODate(v);
  if (typeof v === "number" && v > 30000 && v < 80000) { // Excel-Seriennummer
    const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5);
    return toISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return toISODate(new Date(y, +m[2] - 1, +m[1])); }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return toISODate(new Date(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return toISODate(new Date(+m[3], +m[1] - 1, +m[2]));
  return null;
}
const amount = v => typeof v === "number" ? Math.round(v) : parseCoins(v);

/// FNV-1a 64 Bit – gleiche IDs wie in der iOS-App.
function stableHash(text) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) { h ^= BigInt(b); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16);
}

/**
 * @param rows Array von Zeilen (Array von Zellen)
 * @returns { cards, skipped: [{line, reason}] }
 */
export function rowsToCards(rows, recordedBy = "") {
  if (!rows.length) return { cards: [], skipped: [] };
  const header = rows[0].map(norm);
  const map = {};
  for (const [key, names] of Object.entries(COLUMNS)) {
    const i = header.findIndex(h => names.includes(h));
    if (i >= 0) map[key] = i;
  }
  const hasHeader = map.name != null && map.ek != null;
  const idx = hasHeader ? map : EXCEL_INDEX;
  const cards = [], skipped = [], occ = new Map();
  rows.slice(hasHeader ? 1 : 0).forEach((row, n) => {
    const line = n + (hasHeader ? 2 : 1);
    const get = k => idx[k] != null ? row[idx[k]] : undefined;
    const name = String(get("name") ?? "").trim();
    if (!name) return;
    const ek = amount(get("ek"));
    if (!(ek > 0)) return skipped.push({ line, reason: `${name}: EK fehlt oder ist ungültig` });
    const ekDate = parseDate(get("ekDate"));
    if (!ekDate) return skipped.push({ line, reason: `${name}: EK-Datum fehlt oder ist ungültig` });
    const vkRaw = amount(get("vk"));
    const vk = vkRaw > 0 ? vkRaw : null;
    const vkDate = vk ? (parseDate(get("vkDate")) || ekDate) : null;
    const chemRaw = String(get("chem") ?? "").trim();
    const [y, m, d] = ekDate.split("-").map(Number);
    const key = `${name.toLowerCase()}|${ek}|${y}-${m}-${d}`;
    const o = occ.get(key) || 0; occ.set(key, o + 1);
    cards.push({
      id: "import-" + stableHash(`${key}|${o}`), name,
      rating: parseInt(String(get("rating") ?? "").replace(/\D/g, ""), 10) || 0,
      chem: matchStyle(chemRaw) || chemRaw || "Basic",
      ek, ekDate, vk, vkDate, owner: recordedBy, notes: String(get("notes") ?? ""), createdAt: new Date(ekDate).getTime(),
    });
  });
  return { cards, skipped };
}

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((ok, fail) => {
    const s = document.createElement("script"); s.src = "vendor/xlsx.full.min.js"; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

/// Datei lesen: .xlsx (Reiter „Spieler“ oder erster passender) oder .csv
export async function readFile(file, recordedBy) {
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const XLSX = await loadXLSX();
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const names = wb.SheetNames;
    const pick = names.find(n => norm(n) === "spieler") || names.find(n => {
      const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, blankrows: false })[0] || [];
      return r.map(norm).includes("name") && r.map(norm).includes("ek");
    }) || names[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[pick], { header: 1, raw: true, blankrows: false });
    return { sheet: pick, ...rowsToCards(rows, recordedBy) };
  }
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
  return { sheet: null, ...rowsToCards(parseCSV(text), recordedBy) };
}
