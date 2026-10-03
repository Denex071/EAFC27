// FC Trader – Web-App (Oberfläche)

import * as S from "./store.js";
import { STYLES, TIERS, MARKUP_ABOVE, tax, profitOf, target, breakEven, fmt, signed, compact, pct, parseCoins,
  DAY, dOnly, toISODate, parseDay, fmtDate, fmtShort, daysBetween, holdText, isoWeek, roundPrice, stepPrice } from "./calc.js";
import * as I from "./insights.js";
import { nameKey, similarKeys, canonicalName } from "./parser.js";
import { toHex } from "./chemicons.js";

const VERSION = "1.11.2";

// ---------- Einstellungen (pro Gerät) ----------
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
};
const settings = { name: LS.get("fct-name") || "", depot: LS.get("fct-depot") || "" };
const CLOUD = !!window.FIREBASE_CONFIG;

const root = document.getElementById("root");
const layer = document.getElementById("layer");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Demo-Daten ----------
function demoSeed() {
  const today = dOnly(new Date());
  const d = n => toISODate(new Date(today - n * DAY));
  const rows = [
    ["Benitez", 84, "Architect", 1300, 5, 2300, 2], ["Timber", 84, "Anchor", 2000, 8, 4200, 7], ["Rice", 88, "Shadow", 9800, 6, 12500, 3],
    ["Banda", 88, "Hunter", 9300, 4, 11800, 1], ["Foden", 84, "Engine", 1500, 3, 2600, 1], ["Akanji", 83, "Anchor", 1100, 2, 2100, 0],
    ["Osimhen", 86, "Finisher", 3100, 1, null, null], ["Kimmich", 88, "Shadow", 9600, 1, null, null], ["Katoto", 86, "Hawk", 5800, 0, null, null, true], ["Rice", 91, "Shadow", 38000, 5, 45000, 2, true],
  ];
  return {
    cards: rows.map((r, i) => ({ id: "demo" + i, name: r[0], rating: r[1], chem: r[2], ek: r[3], ekDate: d(r[4]),
      vk: r[5], vkDate: r[6] != null ? d(r[6]) : null, special: !!r[7], owner: "Demo", notes: "", createdAt: Date.now() - r[4] * DAY })),
    snaps: [{ id: "demo-s1", date: d(7), team: 92000, tl: 170000, coins: 35000, tlOwn: 200000, sold: 67, listed: 82, profit: 59000, notes: "" }],
  };
}

// ---------- Statistik ----------
const isSold = c => c.vk != null;
const PERIODS = [["today", "Heute"], ["week", "7 Tage"], ["month", "30 Tage"], ["all", "Gesamt"]];
function inPeriod(iso, p) {
  const date = parseDay(iso), now = new Date();
  if (p === "today") return dOnly(date).getTime() === dOnly(now).getTime();
  if (p === "week") return date >= new Date(now - 7 * DAY);
  if (p === "month") return date >= new Date(now - 30 * DAY);
  return true;
}
const sum = a => a.reduce((x, y) => x + y, 0);
function stats(cards, period) {
  const sold = cards.filter(c => isSold(c) && inPeriod(c.vkDate, period)).sort((a, b) => a.vkDate.localeCompare(b.vkDate));
  const open = cards.filter(c => !isSold(c));
  const profits = sold.map(c => profitOf(c.ek, c.vk));
  const realized = sum(profits), totalBuy = sum(sold.map(c => c.ek));
  const byName = {};
  sold.forEach((c, i) => {
    const s = byName[c.name] || (byName[c.name] = { name: c.name, rating: 0, special: false, n: 0, vk: 0, profit: 0, hold: 0 });
    s.special ||= !!c.special;
    s.n++; s.vk += c.vk; s.profit += profits[i]; s.rating = Math.max(s.rating, c.rating); s.hold += daysBetween(parseDay(c.ekDate), parseDay(c.vkDate));
  });
  const players = Object.values(byName).map(s => ({ ...s, avg: Math.round(s.profit / s.n), hold: s.hold / s.n,
    open: open.filter(c => c.name === s.name).length })).sort((a, b) => b.profit - a.profit);
  let best = null, worst = null;
  sold.forEach((c, i) => { if (!best || profits[i] > best.p) best = { c, p: profits[i] }; if (!worst || profits[i] < worst.p) worst = { c, p: profits[i] }; });
  const today = dOnly(new Date());
  const days = [];
  for (let o = 9; o >= 0; o--) {
    const d = new Date(today - o * DAY), iso = toISODate(d);
    const g = cards.filter(c => isSold(c) && c.vkDate === iso);
    days.push({ d, profit: sum(g.map(c => profitOf(c.ek, c.vk))), n: g.length });
  }
  const weeks = {};
  cards.filter(isSold).forEach(c => {
    const d = dOnly(parseDay(c.vkDate)), mon = new Date(d - ((d.getDay() + 6) % 7) * DAY), k = mon.getTime();
    const w = weeks[k] || (weeks[k] = { start: mon, profit: 0, n: 0 }); w.profit += profitOf(c.ek, c.vk); w.n++;
  });
  return {
    sold, open, realized, totalBuy, turnover: sum(sold.map(c => c.vk)), players, best, worst: sold.length > 1 ? worst : null, days,
    weeks: Object.values(weeks).sort((a, b) => b.start - a.start),
    avg: sold.length ? Math.round(realized / sold.length) : 0,
    margin: sold.length ? sum(sold.map((c, i) => profits[i] / c.vk)) / sold.length : 0,
    roi: totalBuy ? realized / totalBuy : 0,
    win: sold.length ? profits.filter(p => p > 0).length / sold.length : 0,
    hold: sold.length ? sum(sold.map(c => daysBetween(parseDay(c.ekDate), parseDay(c.vkDate)))) / sold.length : 0,
    taxPaid: sum(sold.map(c => tax(c.vk))),
    capital: sum(open.map(c => c.ek)), targetOpen: sum(open.map(c => target(c.ek))),
    expected: sum(open.map(c => profitOf(c.ek, target(c.ek)))),
    longest: [...open].sort((a, b) => a.ekDate.localeCompare(b.ekDate)).slice(0, 3),
  };
}

/// Gemeinsame Depot-Einstellungen (Wochenziel, Mindestgewinn, Ladenhüter-Tage)
const cfg = () => ({ ...I.DEFAULTS, ...S.data.settings });

// ---------- Namen abgleichen ----------
const lastKey = n => nameKey(String(n).trim().split(/\s+/).pop());
const sameName = (a, b) => {
  const ka = nameKey(a), kb = nameKey(b);
  return !!ka && !!kb && (ka === kb || ka === lastKey(b) || kb === lastKey(a) || similarKeys(ka, kb));
};
const knownNames = () => [...new Set(S.data.cards.map(c => c.name))];
const lastCard = name => S.data.cards.filter(c => sameName(c.name, name)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).pop();
const openCardsFor = (name, rating) => S.data.cards.filter(c => !isSold(c) && sameName(c.name, name))
  .sort((a, b) => ((rating && a.rating !== rating) - (rating && b.rating !== rating)) || a.ekDate.localeCompare(b.ekDate));
const recentChems = () => [...new Set([...S.data.cards].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(c => c.chem))].slice(0, 5);

// ---------- Einkaufsliste (verkaufte Karten nachkaufen) ----------
// Jeder Verkauf landet auf der Liste, bis er nachgekauft ("done") oder übersprungen ("skip") ist.
// Verkäufe aus dem Excel-Import zählen nicht (die sind längst erledigt).
// Auf der Einkaufsliste: in der App verkaufte Karten ("open"); alte Verkäufe aus dem Excel-Import nicht
// Ladenhüter: nach bestätigter Preisanpassung noch lockDays Tage unverkauft → kein Nachkauf (außer von Hand „manual“)
const slowSeller = c => !!c.adjustedAt && daysBetween(parseDay(c.adjustedAt), parseDay(c.vkDate || toISODate(new Date()))) >= cfg().lockDays;
const onRestock = c => isSold(c) && (c.restock === "manual"
  || ((c.restock === "open" || (!c.restock && !String(c.id).startsWith("import-"))) && !slowSeller(c)));
const restockOpen = () => S.data.cards.filter(onRestock);
/// Was nachgekauft wird: die Daten des Ersatzspielers (falls übernommen), sonst die der verkauften Karte
const buyAs = c => c.plan || { name: c.name, rating: c.rating, chem: c.chem, ek: c.ek, offer: null, special: !!c.special };
const restockKey = c => { const b = buyAs(c); return `${nameKey(b.name)}|${b.rating}|${b.chem}|${b.offer || ""}|${b.special ? "sp" : ""}`; };
/// Zeitpunkt, an dem ein Verkauf auf die Einkaufsliste kam (ältere Daten ohne Uhrzeit: Verkaufstag)
const soldTime = c => c.soldAt || parseDay(c.vkDate).getTime();
function restockGroups() {
  const groups = new Map();
  for (const c of restockOpen().sort((a, b) => soldTime(a) - soldTime(b) || (a.createdAt || 0) - (b.createdAt || 0))) {
    const k = restockKey(c);
    if (!groups.has(k)) groups.set(k, { key: k, items: [] });
    groups.get(k).items.push(c);
  }
  return [...groups.values()].map(g => {
    const newest = g.items[g.items.length - 1], b = buyAs(newest);
    return { ...g, name: b.name, rating: b.rating, chem: b.chem, special: !!b.special, lastEk: b.ek, offer: b.offer, planned: !!newest.plan,
      lastVk: newest.vk, soldOn: newest.vkDate, since: soldTime(g.items[0]) };
  }).sort((a, b) => a.since - b.since || a.name.localeCompare(b.name)); // älteste Eingabe oben, neueste unten
}
/// Von Hand geplante Käufe als Gruppen (oben auf der Einkaufsliste)
const isWatch = w => w.list === "watch"; // Merkliste: nur gemerkt, zählt nicht zur Einkaufsliste
const sortedWishes = () => S.data.wishes.filter(w => !isWatch(w)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const watchList = () => S.data.wishes.filter(isWatch).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
/// Auf welchen Listen steht der Spieler schon? → ["Einkaufsliste", "Merkliste"]
function listsWith(name, rating, exceptId) {
  const same = x => x.id !== exceptId && sameName(x.name, name) && (!rating || !x.rating || +x.rating === +rating);
  const out = [];
  if (restockGroups().some(g => sameName(g.name, name) && (!rating || g.rating === +rating)) || sortedWishes().some(same)) out.push("Einkaufsliste");
  if (watchList().some(same)) out.push("Merkliste");
  return out;
}
/// Kurze Rückfrage (Ja/Nein) – liegt über offenen Fenstern
function askYesNo(text, yes = "Ja", no = "Nein") {
  return new Promise(done => {
    const el = document.createElement("div"); el.className = "progress"; el.style.zIndex = 70;
    el.innerHTML = `<div class="box" role="alertdialog" aria-modal="true"><strong>Schon auf der Liste</strong><span style="white-space:normal">${text}</span>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="mini" data-a="0">${no}</button><button class="mini gold" data-a="1">${yes}</button></div></div>`;
    el.onclick = e => { const b = e.target.closest("[data-a]"); if (!b) return; el.remove(); done(b.dataset.a === "1"); };
    document.body.appendChild(el); el.querySelector('[data-a="1"]').focus();
  });
}
/// Freie Plätze: verkaufte Ladenhüter, die nicht nachgekauft werden – dort rücken die geplanten Spieler (Ersatz) nach.
const replaceSlots = () => S.data.cards.filter(c => isSold(c) && slowSeller(c) && !onRestock(c) && !["done", "skip", "replaced"].includes(c.restock))
  .sort((a, b) => a.vkDate.localeCompare(b.vkDate));
/// Geplante Spieler (je Stück) den freien Plätzen zuordnen: älteste Planung ersetzt den ältesten Ladenhüter
function wishSlots() {
  const slots = replaceSlots(), map = new Map(); let i = 0;
  for (const w of sortedWishes()) { const mine = []; for (let k = 0; k < (w.qty || 1); k++) if (slots[i]) mine.push(slots[i++]); map.set(w.id, mine); }
  return map;
}
const wishGroups = () => { const slots = wishSlots(); return sortedWishes().map(w => ({
  key: "w:" + w.id, wish: w, name: w.name, rating: w.rating, chem: w.chem, special: !!w.special, lastEk: w.price, lastVk: null, soldOn: null,
  items: Array(w.qty || 1).fill(w), replaces: slots.get(w.id) || [] })); };
/// Jeder Spieler (Name + Rating + Gold/Special) steht nur einmal auf der Einkaufsliste: Nachkauf-Einträge und geplante Spieler
/// werden zu einer Zeile zusammengefasst (parts). Angezeigt wird der erste Teil – Nachkauf vor geplant, ältere vor neueren.
const playerKey = g => `${nameKey(g.name)}|${g.rating}|${g.special ? "sp" : ""}`;
function allBuyGroups() {
  const merged = new Map();
  for (const g of [...restockGroups(), ...wishGroups()]) {
    const k = playerKey(g), m = merged.get(k);
    if (!m) { merged.set(k, { ...g, parts: [g] }); continue; }
    m.parts.push(g); m.items = [...m.items, ...g.items];
    if (g.replaces) m.replaces = [...(m.replaces || []), ...g.replaces];
  }
  return [...merged.values()];
}
const TURN_DAYS = 10;
/// Drehungen (Verkäufe) der letzten TURN_DAYS Tage je Spieler + Rating; Tag 1 = heute. Nur gelesen, nichts wird geändert.
function turnover(name, rating, special) {
  const mine = S.data.cards.filter(c => sameName(c.name, name) && (!rating || c.rating === +rating) && !!c.special === !!special), today = new Date();
  const days = mine.filter(isSold).map(c => daysBetween(parseDay(c.vkDate), today) + 1).filter(d => d >= 1 && d <= TURN_DAYS);
  return { n: days.length, day: days.length ? Math.min(...days) : null, known: mine.length > 0 };
}
/// Rang auf der Einkaufsliste: mehrfach gedreht → neue Spieler → 1× gedreht → länger nicht gedreht (jeweils in TURN_DAYS Tagen)
const turnRank = t => t.n >= 2 ? 0 : !t.known ? 1 : t.n === 1 ? 2 : 3;
const addedAt = g => g.wish ? g.wish.createdAt || 0 : g.since;
function sortedBuyGroups() {
  const gs = allBuyGroups(); gs.forEach(g => { g.turn = turnover(g.name, g.rating, g.special); });
  return gs.sort((a, b) => turnRank(a.turn) - turnRank(b.turn) || b.turn.n - a.turn.n || addedAt(a) - addedAt(b) || a.name.localeCompare(b.name));
}
/// „TL“: Karte (Spieler + Rating) ist noch aktiv, also gekauft und nicht verkauft → nicht doppelt kaufen
function tlTag(g) {
  const act = S.data.cards.filter(c => !isSold(c) && sameName(c.name, g.name) && (!g.rating || c.rating === +g.rating) && sameKind(c, g));
  if (!act.length) return "";
  const info = act.map(c => `${c.chem}, EK ${fmt(c.ek)}`).join(" · ");
  return `<span class="tag tl" title="Noch aktiv: ${esc(info)}">TL${act.length > 1 ? " ×" + act.length : ""}</span>`;
}
const turnText = t => t.n >= 2 ? `<b>${t.n}× gedreht</b> in ${TURN_DAYS} Tagen` : t.n === 1 ? `1× gedreht in ${TURN_DAYS} Tagen (Tag ${t.day})`
  : t.known ? `in ${TURN_DAYS} Tagen nicht gedreht` : "<b>neuer Spieler</b> – noch nie gekauft";
const partsText = g => { const r = sum(g.parts.filter(p => !p.wish).map(p => p.items.length)), w = sum(g.parts.filter(p => p.wish).map(p => p.items.length));
  return [r ? `${r}× Nachkauf` : "", w ? `${w}× geplant` : ""].filter(Boolean).join(" · "); };
const openBuyCount = () => restockOpen().length + sum(sortedWishes().map(w => w.qty || 1));
/// Kauf eines geplanten Spielers: Anzahl verringern bzw. Eintrag löschen; ersetzte Ladenhüter sind damit erledigt
function useWish(w, n = 1) {
  (wishSlots().get(w.id) || []).slice(0, n).forEach(c => S.saveCard({ ...c, restock: "replaced" }));
  (w.qty || 1) > n ? S.saveWish({ ...w, qty: w.qty - n }) : S.deleteWish(w.id);
}

/// Neuer Kauf erfasst → passenden offenen Listeneintrag (gleicher Spieler & Rating, bevorzugt gleicher Stil) abhaken.
function consumeRestock(card) {
  const match = restockOpen().filter(c => sameName(buyAs(c).name, card.name) && buyAs(c).rating === card.rating && sameKind(buyAs(c), card))
    .sort((a, b) => (buyAs(a).chem !== card.chem) - (buyAs(b).chem !== card.chem) || soldTime(a) - soldTime(b))[0];
  if (match) { S.saveCard({ ...match, restock: "done" }); return true; }
  // sonst einen von Hand geplanten Kauf (gleicher Spieler & Rating) abhaken
  const wish = sortedWishes().filter(w => sameName(w.name, card.name) && w.rating === card.rating && sameKind(w, card))
    .sort((a, b) => (a.chem !== card.chem) - (b.chem !== card.chem))[0];
  if (wish) useWish(wish);
  return !!wish;
}

/// Verkaufte Karte, deren Spieler schon als Ersatzspieler geplant ist: der geplante Eintrag rückt in den Nachkauf.
/// Name, Rating, Chemistry Style, EK (und Angebotspreis) kommen aus dem Ersatzspieler, nicht aus der verkauften Karte.
function planFromWish(card, soldAt) {
  if (card.plan || !onRestock(card)) return null;
  const w = sortedWishes().filter(w => sameName(w.name, card.name) && sameKind(w, card) && (w.createdAt || 0) < soldAt)
    .sort((a, b) => (+a.rating !== card.rating) - (+b.rating !== card.rating) || (a.createdAt || 0) - (b.createdAt || 0))[0];
  if (!w) return null;
  (w.qty || 1) > 1 ? S.saveWish({ ...w, qty: w.qty - 1 }) : S.deleteWish(w.id);
  return { name: w.name, rating: +w.rating || card.rating, chem: w.chem || card.chem, ek: w.price || card.ek, offer: w.offer || null, special: !!w.special };
}
/// Verkauf speichern (inkl. Übernahme eines passenden Ersatzspielers)
function saveSale(card) {
  const plan = planFromWish(card, card.soldAt || Date.now());
  S.saveCard(plan ? { ...card, plan } : card);
  return plan;
}
/// Auch Verkäufe von anderen Geräten / aus älteren App-Versionen abgleichen
const merged = new Set(); let merging = false;
function mergePlannedRestock() {
  if (!S.data.ready || merging) return;
  merging = true;
  try {
    for (const c of restockOpen()) {
      if (c.plan || merged.has(c.id)) continue;
      merged.add(c.id);
      const plan = planFromWish(c, c.soldAt || parseDay(c.vkDate).getTime() + DAY - 1);
      if (plan) S.saveCard({ ...c, plan }); else merged.delete(c.id);
    }
  } finally { merging = false; }
}

// ---------- Bausteine ----------
/// Lila = Special-Karte, sonst Farbe nach Rating (Gold ab 75)
const badgeClass = (r, sp) => sp ? "b-special" : r >= 75 ? "b-gold" : r >= 65 ? "b-silver" : "b-bronze";
const badge = (r, sm, sp) => `<div class="badge ${sm ? "sm" : ""} ${badgeClass(r, sp)} num"${sp ? ' title="Special-Karte"' : ""}>${r || "–"}</div>`;
const spTag = sp => sp ? '<span class="tag sp">Special</span>' : "";
const spMeta = sp => sp ? '<span class="sp-text">Special</span> · ' : ""; // in engen Listen: in der Zeile unter dem Namen
const sameKind = (a, b) => !!a.special === !!b.special;
const specialCheck = (id, on) => `<label class="check"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span>Special-Karte</span><span class="hint" style="margin-left:auto">sonst Gold</span></label>`;
const profitHtml = v => `<span class="profit ${v >= 0 ? "pos" : "neg"}">${signed(v)}</span>`;
const heldSince = iso => holdText(daysBetween(parseDay(iso), new Date()));
const seg = (items, cur, attr) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-${attr}="${k}" aria-pressed="${k === cur}">${l}</button>`).join("")}</div>`;
const chemOptions = sel => STYLES.map(s => `<option ${s === sel ? "selected" : ""}>${s}</option>`).join("");
function toast(msg, bad) {
  const t = document.createElement("div"); t.className = "toast"; if (bad) t.style.background = "var(--bad)";
  t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
function download(name, text) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function calcHtml(ek, vk) {
  if (!ek) return "";
  if (!vk) return `<div class="calc"><div class="l"><span>kalk. VK</span><span class="num">${fmt(target(ek))}</span></div>
    <div class="l"><span>Break-even nach Tax</span><span class="num">${fmt(breakEven(ek))}</span></div></div>`;
  const p = profitOf(ek, vk);
  return `<div class="calc"><div class="l"><span>Verkaufspreis</span><span class="num">${fmt(vk)}</span></div>
    <div class="l"><span>EA Tax (5 %)</span><span class="num">−${fmt(tax(vk))}</span></div>
    <div class="l"><span>Einkaufspreis</span><span class="num">−${fmt(ek)}</span></div>
    <div class="total"><span>Gewinn</span>${profitHtml(p)}</div>
    <div class="l"><span></span><span class="num">${pct(p / ek)} auf EK</span></div></div>`;
}

// ---------- Onboarding ----------
function genCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", p = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join("");
  return `${p()}-${p()}`;
}
function renderOnboarding() {
  root.innerHTML = `<div class="onb">
    <h1>FC Trader</h1>
    <p class="lead">Käufe und Verkäufe gemeinsam tracken – Gewinn, kalk. VK und Vermögen immer im Blick.</p>
    ${CLOUD ? "" : `<div class="banner">Die Cloud ist noch nicht eingerichtet. Du kannst die App im Demo-Modus ausprobieren; Daten bleiben dann nur in diesem Browser.</div>`}
    <div class="group"><div class="field"><label for="o-name">Dein Name</label><input id="o-name" value="${esc(settings.name)}" placeholder="z. B. Denis" autocomplete="given-name"></div></div>
    <button class="primary" id="o-new" ${CLOUD ? "" : "disabled"}>Neues Depot erstellen</button>
    <div class="group"><div class="gh">Code vom Freund erhalten?</div>
      <div class="field"><label for="o-code">Depot-Code</label><input id="o-code" placeholder="K7RM-2XQP" autocapitalize="characters" autocomplete="off"></div></div>
    <button class="secondary" id="o-join" ${CLOUD ? "" : "disabled"}>Depot beitreten</button>
    <button class="link" id="o-demo" style="align-self:center">Mit Beispieldaten ausprobieren</button>
  </div>`;
  const name = () => document.getElementById("o-name").value.trim();
  const go = code => {
    if (!name()) return toast("Bitte zuerst deinen Namen eingeben", true);
    settings.name = name(); settings.depot = code; LS.set("fct-name", settings.name); LS.set("fct-depot", code); start();
  };
  document.getElementById("o-new").onclick = () => go(genCode());
  document.getElementById("o-join").onclick = () => {
    const c = document.getElementById("o-code").value.trim().toUpperCase();
    if (c.length < 6) return toast("Der Code hat 8 Zeichen, z. B. K7RM-2XQP", true);
    go(c);
  };
  document.getElementById("o-demo").onclick = () => { if (!name()) document.getElementById("o-name").value = "Ich"; go("DEMO"); };
}

// ---------- Hauptansicht ----------
const ui = { tab: LS.get("fct-tab") || "dash", period: "all", filter: "open", sort: "newest", q: "", sel: 9, wsel: 7,
  dim: LS.get("fct-dim") || "price", range: "all" };
const TITLES = { dash: "Übersicht", list: "Spieler", buy: "Einkauf", stale: "Ladenhüter", wealth: "Vermögen", more: "Einstellungen" };
const TABS = ["dash", "list", "buy", "stale", "wealth", "more"];
const ICONS = {
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  buy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
  stale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  wealth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
};

function renderShell() {
  root.innerHTML = `<div class="app">
    <header class="top"><h1 id="title"></h1>
      <label class="iconbtn" for="scanInput" title="Screenshot oder Video scannen" aria-label="Screenshot oder Video scannen">${ICONS.scan}</label>
      <input class="hidden" type="file" id="scanInput" accept="image/*,video/*" multiple>
      <button class="iconbtn gold" id="addBtn" aria-label="Kauf erfassen" title="Kauf erfassen">${ICONS.add}</button>
    </header>
    <main id="view"></main></div>
    <nav class="tabs"><div class="inner">${TABS.map(t => `<button data-tab="${t}"><span class="ico">${ICONS[t]}<span class="tabbadge" data-badge="${t}" hidden></span></span>${TITLES[t]}</button>`).join("")}</div></nav>`;
  root.querySelector("nav.tabs").onclick = e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    ui.tab = b.dataset.tab; LS.set("fct-tab", ui.tab); render(); scrollTo(0, 0);
  };
  document.getElementById("addBtn").onclick = () => openAdd();
  const input = document.getElementById("scanInput");
  input.onchange = () => { const files = [...input.files]; input.value = ""; if (files.length) runScan(files); };
  input.onclick = () => import("./ocr.js").then(m => m.warmUp());
  document.getElementById("view").addEventListener("click", onViewClick);
  document.getElementById("view").addEventListener("change", e => {
    if (e.target.id !== "wishScanInput") return;
    const files = [...e.target.files]; e.target.value = ""; if (files.length) runWishScan(files);
  });
  document.getElementById("view").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".item[tabindex]")) e.target.click(); });
}

function render() {
  const view = document.getElementById("view");
  if (!view) return;
  document.getElementById("title").textContent = ui.tab === "dash" ? "EA FC 27 Trading" : TITLES[ui.tab];
  root.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === ui.tab ? "page" : "false"));
  const badge = root.querySelector('[data-badge="buy"]');
  const openBuys = openBuyCount();
  badge.hidden = !openBuys; badge.textContent = openBuys > 99 ? "99+" : openBuys;
  const sb = root.querySelector('[data-badge="stale"]'), todo = S.data.ready ? staleTodo() : 0;
  sb.hidden = !todo; sb.textContent = todo > 99 ? "99+" : todo;
  const top = [];
  if (newVersion) top.push(`<div class="banner" style="display:flex;gap:10px;align-items:center;border-style:solid"><span style="flex:1">Neue Version ${esc(newVersion)} verfügbar.</span>
    <button class="mini gold" data-act="update">Aktualisieren</button></div>`);
  if (S.data.error) top.push(`<div class="err">${esc(S.data.error)}</div>`);
  if (S.data.mode === "demo") top.push(`<div class="banner">Demo-Modus – Daten bleiben nur in diesem Browser.</div>`);
  if (S.data.pending) {
    // Änderungen liegen nur auf diesem Gerät – nach kurzer Zeit deutlich warnen
    const long = Date.now() - S.data.pendingSince > 8000;
    top.push(`<div class="${long ? "err" : "banner"}">${long ? "⚠ " : ""}${S.data.pending} Änderung${S.data.pending > 1 ? "en" : ""} noch nicht in der Cloud gespeichert${long
      ? " – bitte Internetverbindung prüfen und die App geöffnet lassen, bis diese Meldung verschwindet." : " …"}</div>`);
    clearTimeout(render.pendingTimer); render.pendingTimer = setTimeout(render, 9000);
  } else if (S.data.offline && S.data.mode === "cloud") top.push(`<div class="banner">Offline – Änderungen werden gespeichert, sobald wieder eine Verbindung besteht.</div>`);
  if (!S.data.ready) { view.innerHTML = top.join("") + `<div class="empty">Daten werden geladen …</div>`; return; }
  view.innerHTML = top.join("") + ({ dash: dashHtml, list: listHtml, buy: buyHtml, stale: staleHtml, wealth: wealthHtml, more: moreHtml })[ui.tab || "dash"]();
  if (ui.tab === "list") bindListInputs();
}

function dashHtml() {
  const s = stats(S.data.cards, ui.period);
  const tile = (t, v, d) => `<div class="tile"><div class="t">${t}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`;
  const per = PERIODS.find(p => p[0] === ui.period)[1];
  if (!S.data.cards.length) return `<section class="card"><h2>Willkommen</h2>
    <p class="meta" style="white-space:normal;margin:0">Noch keine Spieler erfasst. Importiere eure Excel unter „Einstellungen“ oder erfasse den ersten Kauf mit + bzw. per Screenshot.</p>
    <button class="primary" data-act="import">Excel importieren</button></section>`;
  return `${seg(PERIODS, ui.period, "period")}
    ${backupDue() ? `<div class="banner" style="display:flex;gap:10px;align-items:center;border-style:solid"><span class="grow" style="flex:1">Letzte Sicherung ${backupAge()}. Einmal pro Woche ein Backup herunterladen.</span>
      <button class="mini gold" data-act="backup">Backup</button></div>` : ""}
    <section class="hero ${s.realized < 0 ? "neg" : ""}"><div class="lbl">Gesamtgewinn · ${per}</div>
      <div class="big num">${signed(s.realized)}</div><div class="sub">aus ${s.sold.length} Verkäufen · ${s.open.length} Spieler offen</div></section>
    ${goalHtml()}
    <section class="tiles">
      ${tile("Unverkaufte Spieler", s.open.length, "aktueller Bestand")}
      ${tile("Aktuell investiert", fmt(s.capital), "EK der offenen Spieler")}
      ${tile("Kalk. VK-Wert offen", fmt(s.targetOpen), "erwartet " + signed(s.expected))}
      ${tile("Ø Gewinn / Verkauf", signed(s.avg), s.sold.length + " Verkäufe")}
      ${tile("Ø Marge", pct(s.margin), "Gewinn / VK")}
      ${tile("Trefferquote", Math.round(s.win * 100) + " %", "Verkäufe mit Gewinn")}
      ${tile("Gesamt EK", fmt(s.totalBuy), "der verkauften Spieler")}
      ${tile("Gesamt VK", fmt(s.turnover), "Rendite " + pct(s.roi))}
      ${tile("Ø Haltedauer", holdText(s.hold), "Kauf bis Verkauf")}
      ${tile("EA Tax bezahlt", fmt(s.taxPaid), "5 % auf Verkäufe")}
    </section>
    <section class="card"><div class="head"><h2>Gewinn pro Tag</h2><span class="hint">letzte 10 Tage</span></div>${dayChart(s.days)}</section>
    ${trendHtml()}
    ${breakdownHtml(s.sold, per)}
    ${lossHtml(s.sold, per)}
    <section class="card"><div class="head"><h2>Top-Spieler · ${per}</h2>${s.players.length ? `<button class="mini" data-act="ranking">Alle ${s.players.length}</button>` : ""}</div>
      ${s.players.slice(0, 5).map((p, i) => playerRow(p, i + 1)).join("") || '<div class="empty">Keine Verkäufe im Zeitraum.</div>'}</section>
    ${s.best ? `<section class="card"><h2>Top &amp; Flop</h2>${flip(s.best, "Bester Verkauf")}${s.worst ? '<div class="divider"></div>' + flip(s.worst, "Schwächster Verkauf") : ""}</section>` : ""}
    ${s.longest.length ? `<section class="card"><h2>Am längsten im Club</h2>${s.longest.map(c => `
      <div class="row">${badge(c.rating, 1, c.special)}<div class="grow"><div class="name">${esc(c.name)}</div>
      <div class="meta">seit ${heldSince(c.ekDate)} · kalk. VK ${fmt(target(c.ek))} · BE ${fmt(breakEven(c.ek))}</div></div>
      <button class="mini gold" data-sell="${c.id}">Verkaufen</button></div>`).join("")}</section>` : ""}`;
}

// ---------- Wochenziel ----------
function goalHtml() {
  const g = cfg().weeklyGoal, w = I.weekProgress(S.data.cards);
  const kw = `KW ${isoWeek(w.start)}`;
  const vs = w.prevSoFar || w.profit ? `${signed(w.profit - w.prevSoFar)} ggü. Vorwoche bis ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][Math.min(6, w.dayOfWeek - 1)]}` : "";
  if (!g) return `<section class="card"><div class="head"><h2>${kw}</h2>${profitHtml(w.profit)}</div>
    <div class="row"><span class="meta grow">${vs || "Noch keine Verkäufe diese Woche"}</span><button class="mini" data-act="goal">Wochenziel festlegen</button></div></section>`;
  const share = w.profit / g, done = share >= 1;
  return `<section class="card" data-act="goal" style="cursor:pointer"><div class="head"><h2>Wochenziel ${kw}</h2><span class="num" style="font-weight:700">${Math.round(Math.max(0, share) * 100)} %</span></div>
    <div class="bar-track" role="progressbar" aria-valuenow="${Math.round(share * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Wochenziel"><div class="bar-fill ${done ? "done" : ""}" style="width:${Math.min(100, Math.max(0, share * 100))}%"></div></div>
    <div class="row"><span class="grow meta">${profitHtml(w.profit)} von ${fmt(g)} ${done ? "· geschafft ✓" : "· noch " + fmt(g - w.profit)}</span></div>
    ${vs ? `<div class="stat-line">${vs} · Vorwoche gesamt ${signed(w.prev)}</div>` : ""}</section>`;
}

// ---------- Ladenhüter / Preisanpassung ----------
/// Status einer Karte: "due" (Anpassung fällig), "again" (seit readjustDays Tagen nach der letzten Anpassung unverkauft → erneut anpassen),
/// "adjusted" (bestätigt, wartet), "slow" (verkaufter Ladenhüter ohne Nachkauf). Unverkaufte Ladenhüter werden nach lockDays ebenfalls nicht nachgekauft.
const lastAdjust = c => c.readjustedAt || c.adjustedAt;
function staleState(c) {
  if (isSold(c)) return slowSeller(c) ? "slow" : null;
  if (c.adjustedAt) return daysBetween(parseDay(lastAdjust(c)), new Date()) >= cfg().readjustDays ? "again" : "adjusted";
  if (daysBetween(parseDay(c.ekDate), new Date()) >= cfg().staleDays) return "due";
  return null;
}
const staleTag = c => ({ due: '<span class="tag alert">Preis anpassen</span>', again: '<span class="tag alert">erneut anpassen</span>',
  slow: '<span class="tag alert">kein Nachkauf</span>', adjusted: '<span class="tag listed">angepasst</span>' })[staleState(c)] || "";
/// Ladenhüter-Seite: noch nicht angepasst → erneut anpassen → angepasst (wartet); innerhalb jeweils am längsten im Club zuerst
const STALE_ORDER = { due: 0, again: 1, adjusted: 2 };
const staleList = () => S.data.cards.filter(c => !isSold(c) && (c.adjustedAt || staleState(c) === "due"))
  .sort((a, b) => STALE_ORDER[staleState(a)] - STALE_ORDER[staleState(b)] || a.ekDate.localeCompare(b.ekDate));
const staleTodo = () => staleList().filter(c => ["due", "again"].includes(staleState(c))).length;
function staleRow(c) {
  const st = staleState(c), { lockDays, readjustDays } = cfg();
  const since = c.adjustedAt ? daysBetween(parseDay(lastAdjust(c)), new Date()) : 0, noRestock = slowSeller(c);
  const info = st === "due" ? `${heldSince(c.ekDate)} unverkauft – bitte Preis anpassen`
    : st === "again" ? `zuletzt angepasst am ${fmtShort(parseDay(lastAdjust(c)))} (vor ${since} T), noch unverkauft – bitte Preis erneut anpassen`
    : `angepasst am ${fmtShort(parseDay(lastAdjust(c)))} · erneut anpassen in ${readjustDays - since} T`;
  const restock = st === "due" ? "" : noRestock ? " · wird nicht nachgekauft"
    : ` · noch ${lockDays - daysBetween(parseDay(c.adjustedAt), new Date())} T bis „kein Nachkauf“`;
  return `<div class="item" style="cursor:default;align-items:flex-start">${badge(c.rating, 0, c.special)}<div class="grow" style="min-width:0"><div class="name">${esc(c.name)}</div>
      <div class="meta">${spMeta(c.special)}${esc(c.chem)} · EK ${fmt(c.ek)} · BE ${fmt(breakEven(c.ek))}${c.marketEk ? ` · akt. EK ${fmt(c.marketEk)}` : ""}${c.targetVk ? ` · VK ${fmt(c.targetVk)}` : ""}</div>
      <div class="stat-line" style="${st !== "adjusted" ? "color:var(--warn)" : ""}">${info}${restock}</div></div>
    <div class="right" style="display:flex;flex-direction:column;gap:6px"><button class="mini ${st !== "adjusted" ? "gold" : ""}" data-adjust="${c.id}">${st === "adjusted" ? "Preis" : "Angepasst"}</button>
      <button class="mini" data-sell="${c.id}">VK</button></div></div>`;
}
function staleHtml() {
  const { staleDays, lockDays, readjustDays } = cfg(), list = staleList();
  const due = list.filter(c => staleState(c) === "due").length, again = list.filter(c => staleState(c) === "again").length;
  return `<section class="tiles">
      <div class="tile"><div class="t">Ladenhüter</div><div class="v num">${list.length}</div><div class="d">${fmt(sum(list.map(c => c.ek)))} Coins gebunden</div></div>
      <div class="tile"><div class="t">Anpassen</div><div class="v num">${due + again}</div><div class="d">${due} neu · ${again} erneut</div></div></section>
    <section class="card" style="padding:0;gap:0"><div class="head" style="padding:12px 14px"><h2>Anpassen</h2><span class="hint">neue zuerst</span></div>
      <div class="list" style="border:0;border-top:1px solid var(--line);border-radius:0 0 var(--radius) var(--radius)">${list.map(staleRow).join("") || '<div class="empty">Keine Ladenhüter – alles verkauft sich.</div>'}</div></section>
    <p class="hint">Nach ${staleDays} Tagen ohne Verkauf: Preis anpassen und mit „Angepasst“ bestätigen. Ist die Karte ${readjustDays} Tage nach der letzten Anpassung immer noch nicht verkauft,
      erscheint sie wieder oben mit „erneut anpassen“, bis sie sich verkauft. Ist sie ${lockDays} Tage nach der ersten Anpassung noch unverkauft, kommt sie nach dem Verkauf
      <b>nicht</b> auf die Einkaufsliste – daran ändern weitere Anpassungen nichts.</p>`;
}

/// Preisanpassung bestätigen. Der aktuelle Markt-EK dient nur zur Berechnung des neuen VK – der EK der Karte bleibt unverändert.
function openAdjust(card) {
  const again = !!card.adjustedAt, redo = staleState(card) === "again"; // redo: erneute Anpassung fällig
  let vkTouched = !!card.targetVk && !redo;
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(card.rating, 0, card.special)}<div class="grow" style="min-width:0"><div class="name">${esc(card.name)}${spTag(card.special)}</div>
      <div class="meta">${esc(card.chem)} · EK ${fmt(card.ek)} · ${heldSince(card.ekDate)} im Club</div></div></div></div>
    <div class="group"><div class="gh">Aktueller Marktpreis</div>
      <div class="field"><label for="a-ek">Aktueller EK</label><input id="a-ek" inputmode="decimal" value="${card.marketEk || card.ek}"></div>
      <p class="hint" style="padding:0 12px 10px">Nur Grundlage für den neuen VK – dein EK von ${fmt(card.ek)} bleibt gespeichert.</p></div>
    <div class="group"><div class="gh">Neuer VK</div>
      <div class="field"><label for="a-vk">Neuer VK</label><input id="a-vk" inputmode="decimal" value="${card.targetVk ? (redo ? stepPrice(card.targetVk, -1) : card.targetVk) : target(card.marketEk || card.ek)}"></div>
      <div class="chips"><button type="button" class="chip" data-av="calc">kalk. VK aus akt. EK</button><button type="button" class="chip" data-ap="-1">− Stufe</button>
        <button type="button" class="chip" data-ap="1">+ Stufe</button><button type="button" class="chip" data-av="${breakEven(card.ek)}">Break-even ${compact(breakEven(card.ek))}</button></div>
      <div id="a-calc"></div></div>
    <p class="hint">${redo ? `Seit der letzten Anpassung am ${fmtShort(parseDay(lastAdjust(card)))} nicht verkauft – neuen Preis setzen und bestätigen. In ${cfg().readjustDays} Tagen wird wieder erinnert, falls die Karte dann noch da ist. Nachgekauft wird sie nicht.`
      : again ? `Anpassung bestätigt am ${fmtShort(parseDay(card.adjustedAt))} – hier nur Preise aktualisieren.`
      : `Mit „Bestätigen“ wird die Preisanpassung vermerkt. Ist ${esc(card.name)} ${cfg().lockDays} Tage danach noch nicht verkauft, kommt die Karte nach dem Verkauf <b>nicht</b> auf die Einkaufsliste.`}
      Der neue VK ist beim Verkaufen vorbelegt.</p></div>`;
  const refresh = sheet(redo ? "Erneute Preisanpassung" : again ? "Preis aktualisieren" : "Preisanpassung", body, again && !redo ? "Sichern" : "Bestätigen", () => {
    const today = toISODate(new Date()), mEk = parseCoins($("a-ek").value), vk = parseCoins($("a-vk").value);
    S.saveCard({ ...card, adjustedAt: card.adjustedAt || today, ...(redo ? { readjustedAt: today } : {}), marketEk: mEk && mEk !== card.ek ? mEk : null, targetVk: vk || null });
    closeSheet(); toast(redo ? `Erneute Anpassung für ${card.name} bestätigt` : again ? "Preis aktualisiert" : `Preisanpassung für ${card.name} bestätigt`);
  }, () => parseCoins($("a-vk").value) > 0);
  const upd = () => {
    const mEk = parseCoins($("a-ek").value) || card.ek, vk = parseCoins($("a-vk").value);
    $("a-calc").innerHTML = (calcHtml(card.ek, vk) || "") + (vk && mEk !== card.ek
      ? `<div class="calc" style="padding-top:0"><div class="l"><span>Aufschlag auf akt. EK (${fmt(mEk)})</span><span class="num">${signed(vk - mEk)}</span></div></div>` : "");
    refresh();
  };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const d = e.target.closest("[data-ap]"), v = e.target.closest("[data-av]");
    if (d) { const p = parseCoins($("a-vk").value) || target(card.ek); $("a-vk").value = stepPrice(p, +d.dataset.ap); vkTouched = true; upd(); }
    if (v) { $("a-vk").value = v.dataset.av === "calc" ? target(parseCoins($("a-ek").value) || card.ek) : v.dataset.av; vkTouched = v.dataset.av !== "calc"; upd(); }
  });
  // Aktuellen EK ändern → neuer VK = EK + Aufschlag (solange der VK nicht von Hand gesetzt wurde)
  $("a-ek").addEventListener("input", () => { if (!vkTouched) $("a-vk").value = target(parseCoins($("a-ek").value) || card.ek); upd(); });
  $("a-vk").addEventListener("input", () => { vkTouched = true; upd(); });
  upd();
}

// ---------- Gewinnverlauf ----------
function trendHtml() {
  const weeks = I.weekly(S.data.cards, 8);
  if (!weeks.some(w => w.n || w.capital)) return "";
  const sel = weeks[ui.wsel] || weeks[weeks.length - 1];
  const prev = weeks[weeks.indexOf(sel) - 1];
  return `<section class="card"><div class="head"><h2>Gewinn pro Woche</h2><span class="hint">8 Wochen</span></div>
    ${barChart(weeks.map(w => ({ v: w.profit, label: "KW" + isoWeek(w.start) })), ui.wsel, "week", "Gewinn pro Woche")}
    <div class="chartinfo"><strong>KW ${isoWeek(sel.start)} · ${fmtShort(sel.start)}–${fmtShort(new Date(+sel.start + 6 * DAY))}</strong>${profitHtml(sel.profit)}</div>
    <div class="calc" style="padding:0"><div class="l"><span>Verkäufe</span><span class="num">${sel.n}${sel.n ? " · Ø " + signed(Math.round(sel.profit / sel.n)) : ""}</span></div>
      <div class="l"><span>Kapital gebunden (Wochenende)</span><span class="num">${fmt(sel.capital)}</span></div>
      <div class="l"><span>Rendite auf Kapital</span><span class="num">${sel.roi != null ? pct(sel.roi) : "–"}</span></div>
      ${prev ? `<div class="l"><span>ggü. Vorwoche</span>${profitHtml(sel.profit - prev.profit)}</div>` : ""}</div></section>
    <section class="card"><div class="head"><h2>Gewinnverlauf</h2><span class="hint">kumuliert</span></div>
    ${lineChart(weeks.map(w => ({ v: w.cumulative, label: "KW" + isoWeek(w.start) })), ui.wsel, "week", "Gewinn kumuliert")}
    <div class="chartinfo"><strong>bis KW ${isoWeek(sel.start)}</strong><span class="num" style="font-weight:700">${signed(sel.cumulative)}</span></div>
    ${capitalNote(weeks)}</section>`;
}
function capitalNote(weeks) {
  const a = weeks.slice(0, -1).filter(w => w.capital && w.n); // nur abgeschlossene Wochen
  if (a.length < 2) return "";
  const first = a[a.length - 2], last = a[a.length - 1];
  const dc = last.capital - first.capital, dp = last.profit - first.profit;
  const txt = dp > 0 && dc > 0 && last.roi < first.roi ? "Mehr Gewinn, aber vor allem durch mehr Kapital – die Rendite sinkt."
    : dp > 0 && last.roi >= first.roi ? "Mehr Gewinn bei gleicher oder besserer Rendite – besser getradet."
    : dp < 0 && last.roi < first.roi ? "Weniger Gewinn und schwächere Rendite als in der Woche davor." : "Rendite etwa auf Vorwochen-Niveau.";
  return `<div class="stat-line">KW ${isoWeek(first.start)} → KW ${isoWeek(last.start)}: Kapital ${signed(dc)} · Rendite ${pct(first.roi)} → <b>${pct(last.roi)}</b>. ${txt}</div>`;
}

// ---------- Aufschlüsselung ----------
const DIMS = [["price", "Preis"], ["chem", "Style"], ["rating", "Rating"], ["kind", "Karte"], ["weekday", "Tag"]];
function breakdownHtml(sold, per) {
  if (!sold.length) return "";
  const rows = I.breakdown(sold, ui.dim);
  const best = Math.max(1, ...rows.map(r => r.perDay));
  const top = [...rows].filter(r => r.n >= 3).sort((a, b) => b.perDay - a.perDay)[0];
  return `<section class="card"><div class="head"><h2>Was lohnt sich?</h2><span class="hint">${per}</span></div>
    ${seg(DIMS, ui.dim, "dim")}
    ${top ? `<div class="stat-line">Am besten pro Tag Haltedauer: <b>${esc(top.label)}</b> mit ${signed(top.perDay)} pro Tag.</div>` : ""}
    ${rows.map((r, i) => `${i ? '<div class="divider"></div>' : ""}<div class="dimrow">
      <div class="name">${esc(r.label)}</div><div class="right">${profitHtml(r.profit)}</div>
      <div class="meta">${r.n} VK · Ø ${signed(r.avg)} · ${pct(r.margin).replace("+", "")} · ${holdText(r.hold)}${r.losses ? ` · <span style="color:var(--bad)">${r.losses} Verlust</span>` : ""}</div>
      <div class="meta right num">${signed(r.perDay)}/Tag</div>
      <div class="mbar" aria-hidden="true"><span style="width:${Math.max(2, Math.max(0, r.perDay) / best * 100)}%"></span></div></div>`).join("")}
    <p class="hint" style="padding:0">Gewinn/Tag = Gewinn geteilt durch die Tage, die die Karten im Club lagen (mind. 1). Zeigt, womit die Coins am schnellsten arbeiten.</p></section>`;
}

// ---------- Verluste ----------
function lossHtml(sold, per) {
  if (!sold.length) return "";
  const l = I.lossStats(sold);
  return `<section class="card"><div class="head"><h2>Verluste</h2><span class="hint">${per}</span></div>
    <div class="calc" style="padding:0"><div class="l"><span>Verlustgeschäfte</span><span class="num">${l.n} von ${sold.length} (${Math.round(l.share * 1000) / 10} %)</span></div>
      <div class="l"><span>Summe Verluste</span>${profitHtml(l.sum)}</div></div>
    ${l.worst.length ? `<div class="gh meta" style="text-transform:uppercase;font-size:11.5px;letter-spacing:.6px">Größte Verlustbringer</div>
      ${l.worst.map(w => `<div class="row">${badge(w.rating, 1, w.special)}<div class="grow"><div class="name">${esc(w.name)}</div><div class="meta">${w.n}× mit Verlust</div></div>${profitHtml(w.loss)}</div>`).join("")}`
      : '<div class="ok" style="padding:0">Keine Verluste im Zeitraum ✓</div>'}</section>`;
}
const flip = (f, label) => `<div class="row">${badge(f.c.rating, 1, f.c.special)}<div class="grow"><div class="meta">${label}</div><div class="name">${esc(f.c.name)}</div></div>${profitHtml(f.p)}</div>`;
const playerRow = (p, rank) => `<div class="row"><span class="meta num" style="width:18px;text-align:right">${rank}</span>${badge(p.rating, 1, p.special)}
  <div class="grow"><div class="name">${esc(p.name)}</div><div class="meta">${p.n}× verkauft · VK ${compact(p.vk)} · Ø ${signed(p.avg)}</div></div>${profitHtml(p.profit)}</div>`;

function dayChart(days) {
  const W = 340, H = 170, L = 62, B = 22, T = 10;
  const max = Math.max(1, ...days.map(d => d.profit)), min = Math.min(0, ...days.map(d => d.profit));
  const y = v => T + (H - T - B) * (max - v) / (max - min);
  const bw = (W - L) / days.length;
  const ticks = [...new Set([0, Math.round(max / 200) * 100, Math.round(max / 100) * 100])];
  const sel = days[ui.sel] || days[days.length - 1];
  const bars = days.map((d, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64, top = Math.min(y(d.profit), y(0)), h = Math.max(2, Math.abs(y(d.profit) - y(0)));
    return `<g data-day="${i}" style="cursor:pointer"><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${d.profit >= 0 ? "var(--good)" : "var(--bad)"}" opacity="${i === ui.sel ? 1 : .55}"/>
      ${i % 2 === days.length % 2 ? "" : `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${fmtShort(d.d)}</text>`}</g>`;
  }).join("");
  const grid = ticks.map(v => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewinn pro Tag">${grid}${bars}</svg>
    <div class="chartinfo"><strong>${sel.d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}</strong>
    <span class="meta">${sel.n} VK · Ø ${signed(sel.n ? Math.round(sel.profit / sel.n) : 0)}</span>${profitHtml(sel.profit)}</div>`;
}

/// Säulen mit einer Nulllinie; antippbar (data-<attr>=index).
function barChart(items, selIdx, attr, label) {
  const W = 340, H = 150, L = 62, B = 22, T = 10;
  const max = Math.max(1, ...items.map(d => d.v)), min = Math.min(0, ...items.map(d => d.v));
  const y = v => T + (H - T - B) * (max - v) / (max - min);
  const bw = (W - L) / items.length;
  const ticks = [...new Set([min, 0, max].map(v => Math.round(v / 100) * 100))];
  const bars = items.map((d, i) => {
    const x = L + i * bw + bw * 0.2, w = bw * 0.6, top = Math.min(y(d.v), y(0)), h = Math.max(2, Math.abs(y(d.v) - y(0)));
    return `<g data-${attr}="${i}" style="cursor:pointer"><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${d.v >= 0 ? "var(--good)" : "var(--bad)"}" opacity="${i === selIdx ? 1 : .55}"/>
      <text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${d.label}</text></g>`;
  }).join("");
  const grid = ticks.map(v => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${grid}${bars}</svg>`;
}
/// Linie mit Punkten; antippbar wie barChart.
function lineChart(items, selIdx, attr, label) {
  const W = 340, H = 130, L = 62, B = 22, T = 10;
  const max = Math.max(1, ...items.map(d => d.v)), min = Math.min(0, ...items.map(d => d.v));
  const y = v => T + (H - T - B) * (max - v) / (max - min);
  const bw = (W - L) / items.length, x = i => L + i * bw + bw / 2;
  const path = items.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join("");
  const ticks = [...new Set([0, max].map(v => Math.round(v / 100) * 100))];
  const grid = ticks.map(v => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`).join("");
  const pts = items.map((d, i) => `<g data-${attr}="${i}" style="cursor:pointer"><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>
    <circle cx="${x(i)}" cy="${y(d.v)}" r="${i === selIdx ? 5 : 3.5}" fill="var(--gold)" stroke="var(--surface)" stroke-width="2"/>
    <text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.label}</text></g>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${grid}<path d="${path}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>${pts}</svg>`;
}

/// Verkäufe einer Karte (gleicher Spieler & Rating) und ihr durchschnittlicher VK
const cardKey = c => `${nameKey(c.name)}|${c.rating}|${c.special ? "sp" : ""}`;
const salesOf = (name, rating, special) => S.data.cards.filter(c => isSold(c) && cardKey(c) === cardKey({ name, rating, special }));
const avgVk = (name, rating, special) => { const s = salesOf(name, rating, special); return s.length ? roundPrice(sum(s.map(c => c.vk)) / s.length) : null; };
const holdOf = c => daysBetween(parseDay(c.ekDate), parseDay(c.vkDate));

/// Verkauft-Tab: alle Verkäufe einer Karte zu einer Zeile zusammengefasst
function soldGroupsHtml(list) {
  const groups = new Map();
  for (const c of list) { const k = cardKey(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  const gs = [...groups.entries()].map(([key, items]) => {
    items.sort((a, b) => b.vkDate.localeCompare(a.vkDate) || (b.soldAt || 0) - (a.soldAt || 0));
    return { key, items, name: items[0].name, rating: items[0].rating, special: !!items[0].special, last: items[0].vkDate,
      profit: sum(items.map(c => profitOf(c.ek, c.vk))), avgEk: sum(items.map(c => c.ek)) / items.length,
      avgVk: roundPrice(sum(items.map(c => c.vk)) / items.length), hold: sum(items.map(holdOf)) / items.length };
  });
  const key = { newest: g => -parseDay(g.last), profit: g => -g.profit, rating: g => -g.rating, price: g => -g.avgEk, hold: g => -g.hold };
  gs.sort((a, b) => key[ui.sort](a) - key[ui.sort](b) || a.name.localeCompare(b.name));
  return gs.map(g => `<div class="item" tabindex="0" data-sgroup="${esc(g.key)}">${badge(g.rating, 0, g.special)}
      <div class="grow" style="min-width:0"><div class="name">${esc(g.name)}${g.items.length > 1 ? ` <span class="gold-text">×${g.items.length}</span>` : ""}</div>
        <div class="meta">${spMeta(g.special)}${g.items.length > 1 ? `${g.items.length} Verkäufe · zuletzt ` : `${esc(g.items[0].chem)} · `}${fmtDate(parseDay(g.last))}</div></div>
      <div class="right">${profitHtml(g.profit)}<div class="meta num">Ø VK ${compact(g.avgVk)}</div></div></div>`).join("");
}
function openSoldGroup(key) {
  const items = S.data.cards.filter(c => isSold(c) && cardKey(c) === key)
    .sort((a, b) => b.vkDate.localeCompare(a.vkDate) || (b.soldAt || 0) - (a.soldAt || 0));
  if (!items.length) return;
  const n = items.length, profit = sum(items.map(c => profitOf(c.ek, c.vk)));
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(items[0].rating, 0, items[0].special)}<div class="grow" style="min-width:0"><div class="name">${esc(items[0].name)}${spTag(items[0].special)}</div>
      <div class="meta">${n} ${n === 1 ? "Verkauf" : "Verkäufe"} · Gewinn ${profitHtml(profit)}</div></div></div></div>
    <section class="tiles">
      <div class="tile"><div class="t">Ø VK</div><div class="v num">${fmt(roundPrice(sum(items.map(c => c.vk)) / n))}</div><div class="d">Ø EK ${fmt(Math.round(sum(items.map(c => c.ek)) / n))}</div></div>
      <div class="tile"><div class="t">Ø Gewinn</div><div class="v num">${signed(Math.round(profit / n))}</div><div class="d">Ø ${holdText(sum(items.map(holdOf)) / n)} gehalten</div></div></section>
    <div class="list">${items.map(c => `<div class="item" tabindex="0" data-edit="${c.id}">
      <div class="grow" style="min-width:0"><div class="name" style="font-size:14px">${fmtDate(parseDay(c.vkDate))}</div>
        <div class="meta">${esc(c.chem)} · ${holdText(holdOf(c))} gehalten</div></div>
      <div class="right">${profitHtml(profitOf(c.ek, c.vk))}<div class="meta num">${compact(c.ek)} → ${compact(c.vk)}</div></div></div>`).join("")}</div>
    <p class="hint">Einen Verkauf antippen, um ihn zu bearbeiten.</p></div>`;
  sheet(items[0].name, body);
  layer.querySelector(".sheet").addEventListener("click", e => {
    const ed = e.target.closest("[data-edit]"); if (ed) openAdd(S.data.cards.find(c => c.id === ed.dataset.edit));
  });
}

function listHtml() {
  const cards = S.data.cards;
  const today = toISODate(new Date());
  // Zeitraum: Verkaufte nach Verkaufsdatum, offene nach Kaufdatum
  const inR = c => I.inRange(c.vkDate || c.ekDate, ui.range);
  const pool = cards.filter(inR);
  const counts = { open: pool.filter(c => !isSold(c)).length,
    sold: pool.filter(isSold).length, all: pool.length };
  const list = pool.filter(c => ui.filter === "all" || (ui.filter === "open") !== isSold(c))
    .filter(c => !ui.q || (c.name + " " + c.chem).toLowerCase().includes(ui.q.toLowerCase()));
  const key = { newest: c => -parseDay(c.vkDate || c.ekDate), profit: c => isSold(c) ? -profitOf(c.ek, c.vk) : 1e12,
    rating: c => -c.rating, price: c => -c.ek, hold: c => -daysBetween(parseDay(c.ekDate), parseDay(c.vkDate || today)) };
  list.sort((a, b) => key[ui.sort](a) - key[ui.sort](b));
  const shown = list.slice(0, 200);
  return `${seg([["open", `Offen (${counts.open})`], ["sold", `Verkauft (${counts.sold})`], ["all", `Alle (${counts.all})`]], ui.filter, "filter")}
    <div class="search"><input id="q" type="search" placeholder="Spieler oder Chemistry Style" value="${esc(ui.q)}" aria-label="Suchen">
      <select id="sort" aria-label="Sortierung">${[["newest", "Neueste"], ["profit", "Gewinn"], ["rating", "Rating"], ["price", "Preis"], ["hold", "Haltedauer"]]
        .map(([k, l]) => `<option value="${k}" ${k === ui.sort ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <select id="range" class="range" aria-label="Zeitraum">${I.ranges(cards).map(([k, l]) => `<option value="${k}" ${k === ui.range ? "selected" : ""}>${l}</option>`).join("")}</select>
    <div class="list">${ui.filter === "sold" ? soldGroupsHtml(list) || '<div class="empty">Keine Spieler gefunden.</div>' : shown.map(c => {
      const p = isSold(c) ? profitOf(c.ek, c.vk) : null;
      return `<div class="item" tabindex="0" data-edit="${c.id}">${badge(c.rating, 0, c.special)}
        <div class="grow" style="min-width:0"><div class="name">${esc(c.name)}${staleTag(c)}</div><div class="meta">${spMeta(c.special)}${esc(c.chem)} · ${fmtDate(parseDay(isSold(c) ? c.vkDate : c.ekDate))}</div></div>
        <div class="right">${p != null ? `${profitHtml(p)}<div class="meta num">${compact(c.ek)} → ${compact(c.vk)}</div>`
          : `<div class="num" style="font-weight:700">${fmt(c.ek)}</div><div class="meta num">${c.targetVk ? `Angebot ~${compact(c.targetVk)}` : `kalk. VK ${compact(target(c.ek))}`} · ${heldSince(c.ekDate)}</div>${(av => av ? `<div class="meta num">Ø VK ${compact(av)}</div>` : "")(avgVk(c.name, c.rating, c.special))}`}</div>
        ${p == null ? `<button class="mini gold" data-sell="${c.id}">VK</button>` : ""}</div>`;
    }).join("") || '<div class="empty">Keine Spieler gefunden.</div>'}</div>
    ${ui.filter !== "sold" && list.length > shown.length ? `<div class="hint">Die ersten ${shown.length} von ${list.length}. Suche oder Filter grenzt weiter ein.</div>` : ""}
    ${list.length ? `<div class="sumbar"><span>${ui.filter === "sold" ? `${list.length} Verkäufe` : `${list.length} Spieler`}</span><span class="num">${ui.filter === "open"
      ? `EK ${compact(sum(list.map(c => c.ek)))} · kalk. VK ${compact(sum(list.map(c => target(c.ek))))}`
      : `Gewinn ${profitHtml(sum(list.filter(isSold).map(c => profitOf(c.ek, c.vk))))}`}</span></div>` : ""}`;
}
function bindListInputs() {
  const q = document.getElementById("q");
  q.oninput = () => { ui.q = q.value; const pos = q.selectionStart; render(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); };
  document.getElementById("sort").onchange = e => { ui.sort = e.target.value; render(); };
  document.getElementById("range").onchange = e => { ui.range = e.target.value; render(); };
}

function buyHtml() {
  const groups = sortedBuyGroups(), parts = groups.flatMap(g => g.parts), restock = parts.filter(g => !g.wish), planned = parts.filter(g => g.wish);
  const addBtn = `<div style="display:flex;gap:8px"><button class="secondary" data-act="wish" style="flex:1">+ Spieler hinzufügen</button>
    <label class="secondary" for="wishScanInput" style="flex:1;text-align:center">Screenshot hochladen</label></div>
    <input class="hidden" type="file" id="wishScanInput" accept="image/*" multiple>`;
  const watch = watchList();
  const watchHtml = `<section class="card" style="padding:0;gap:0"><div class="head" style="padding:12px 14px"><h2>Merkliste</h2><span class="hint">${watch.length ? watch.length + " gemerkt" : "zum Beobachten"}</span></div>
      <div class="list" style="border:0;border-top:1px solid var(--line);border-radius:0 0 var(--radius) var(--radius)">${watch.map(w => `<div class="item" style="cursor:default">${badge(w.rating, 0, w.special)}
        <div class="grow" style="min-width:0;cursor:pointer" data-wish="${esc(w.id)}"><div class="name">${esc(w.name)}</div>
          <div class="meta">${spMeta(w.special)}${esc(w.chem)}${w.price ? ` · Preis ${fmt(w.price)}` : ""}${w.offer ? ` · Angebot ~${fmt(w.offer)}` : ""}</div></div>
        <div class="right" style="display:flex;gap:6px"><button class="mini" data-wdel="${esc(w.id)}" aria-label="Löschen" title="Löschen">✕</button>
          <button class="mini gold" data-tobuy="${esc(w.id)}">→ Einkaufsliste</button></div></div>`).join("") || '<div class="empty">Noch nichts gemerkt.</div>'}</div></section>`;
  if (!groups.length && !replaceSlots().length && !watch.length) return `<section class="card"><h2>Alles nachgekauft</h2>
    <p class="meta" style="white-space:normal;margin:0">Sobald ihr eine Karte als verkauft markiert, erscheint sie hier mit Name, Rating, Chemistry Style und letztem EK – zum Nachkaufen.
      Spieler, die ihr noch kaufen wollt, könnt ihr auch selbst hinzufügen.</p></section>${addBtn}${watchHtml}`;
  const { minProfit } = cfg();
  groups.forEach(g => { g.st = I.flipStats(S.data.cards, g.name, g.rating, g.chem, minProfit, g.special); });
  const count = sum(restock.map(g => g.items.length)), pcount = sum(planned.map(g => g.items.length));
  const budget = sum(parts.map(g => g.lastEk * g.items.length));
  const freeSlots = replaceSlots().length, usedSlots = sum(planned.map(g => g.replaces.length));
  const row = g => `<div class="item" style="cursor:default">
      ${badge(g.rating, 0, g.special)}
      <div class="grow" style="min-width:0;${g.wish ? "cursor:pointer" : ""}" ${g.wish ? `data-wish="${esc(g.wish.id)}"` : ""}><div class="name">${esc(g.name)}${g.items.length > 1 ? ` <span class="gold-text">×${g.items.length}</span>` : ""}${g.wish ? '<span class="tag listed">geplant</span>' : ""}${tlTag(g)}</div>
        <div class="meta">${spMeta(g.special)}${g.wish ? `${esc(g.chem)} · EK ${fmt(g.lastEk)}` : `${esc(g.chem)} · ${g.planned ? "geplanter " : ""}EK ${fmt(g.lastEk)}${g.offer ? ` · Angebot ~${compact(g.offer)}` : ""} · VK ${compact(g.lastVk)} am ${fmtShort(parseDay(g.soldOn))}`}</div>
        <div class="stat-line">${turnText(g.turn)}</div>
        ${g.parts.length > 1 ? `<div class="stat-line">zusammengefasst: ${partsText(g)}</div>` : ""}
        ${g.wish?.offer ? `<div class="stat-line">Angebot ~<b>${fmt(g.wish.offer)}</b> · Gewinn ${signed(profitOf(g.lastEk, g.wish.offer))}</div>` : ""}
        ${g.wish ? `<div class="stat-line">${g.replaces.length ? `ersetzt <b>${g.replaces.map(c => esc(c.name)).join(", ")}</b> (kein Nachkauf)` : "bereit als Ersatz"} · geplant von ${esc(g.wish.owner || "euch")}</div>` : ""}
        ${g.st ? `<div class="stat-line">${g.st.n}× gedreht · Ø <b>${signed(g.st.avg)}</b> · ${holdText(g.st.hold)}${g.st.maxEk ? ` · max. EK <b>${fmt(g.st.maxEk)}</b>` : ""}${g.st.maxEk && g.lastEk > g.st.maxEk ? '<span class="tag alert">teuer</span>' : ""}</div>` : ""}</div>
      <div class="right" style="display:flex;gap:6px">
        <button class="mini" data-skip="${esc(g.key)}" aria-label="Überspringen" title="Überspringen">✕</button>
        <button class="mini gold" data-buy="${esc(g.key)}">Gekauft</button></div></div>`;
  return `<section class="tiles">
      <div class="tile"><div class="t">Einkaufsliste</div><div class="v num">${count + pcount}</div><div class="d">${count} Nachkauf · ${pcount} Ersatz</div></div>
      <div class="tile"><div class="t">Budget (EK)</div><div class="v num">${fmt(budget)}</div><div class="d">inkl. ${pcount} Ersatzspieler</div></div></section>
    <section class="card" style="padding:0;gap:0"><div class="head" style="padding:12px 14px"><h2>Einkaufsliste</h2><span class="hint">nach Drehungen (${TURN_DAYS} Tage)</span></div>
      ${freeSlots > usedSlots ? `<div class="warn" style="padding:0 14px 10px">${freeSlots - usedSlots} Ladenhüter ohne Ersatz – plane weitere Spieler.</div>` : ""}
      <div class="list" style="border:0;border-top:1px solid var(--line);border-radius:0 0 var(--radius) var(--radius)">${groups.map(row).join("") || '<div class="empty">Alles nachgekauft.</div>'}</div></section>
    ${addBtn}
    ${watchHtml}
    <p class="hint">Reihenfolge: Karten, die sich in den letzten ${TURN_DAYS} Tagen mehrfach gedreht haben (die häufigste oben), dann neue Spieler (noch nie gekauft),
      dann Karten mit nur 1 Drehung in ${TURN_DAYS} Tagen, ganz unten Karten ohne Drehung in ${TURN_DAYS} Tagen. Bei Gleichstand steht der ältere Eintrag oben.
      Karten, die sich schlecht verkaufen (kein Nachkauf), werden durch geplante Spieler („geplant“) ersetzt – der älteste Plan zuerst.
      Die <b>Merkliste</b> ist nur zum Beobachten – mit „→ Einkaufsliste“ kommt ein Spieler auf die Liste.
      <b>Lila</b> Rating = Special-Karte (Special und Gold desselben Spielers werden getrennt gezählt).
      <b>TL</b> = diese Karte habt ihr noch aktiv (gekauft, nicht verkauft) – Vorsicht vor Doppelkäufen.
      „Gekauft“ speichert den Kauf, geplante Spieler antippen zum Bearbeiten. Käufe über + oder per Screenshot haken passende Einträge automatisch ab.
      max. EK = Ø VK aller Verkäufe dieser Karte − 5 % Tax − Mindestgewinn (${fmt(minProfit)}, änderbar unter Einstellungen).</p>`;
}

/// Spieler von Hand auf die Einkaufsliste setzen bzw. bearbeiten
function openWish(existing) {
  const w = existing || { name: "", rating: "", chem: "Basic", price: "", offer: "", qty: 1, list: "buy" };
  let list = w.list || "buy";
  const body = `<form class="form" id="wf" autocomplete="off">
    <div id="w-list">${seg([["buy", "Einkaufsliste"], ["watch", "Merkliste"]], list, "wl")}</div>
    <div class="group">
      <div class="field"><label for="w-name">Name</label><input id="w-name" value="${esc(w.name)}" list="known-names" placeholder="z. B. Musiala"></div>
      <div class="field"><label for="w-rating">Rating</label><input id="w-rating" inputmode="numeric" value="${w.rating}" placeholder="z. B. 84"></div>
      <div class="field"><label for="w-chem">Chemistry Style</label><select id="w-chem">${chemOptions(w.chem)}</select></div>
      ${specialCheck("w-sp", w.special)}
      <div class="field"><label for="w-price">Preis (EK)</label><input id="w-price" inputmode="decimal" value="${w.price}" placeholder="0"></div>
      <div class="field"><label for="w-offer">Vorauss. Angebotspreis</label><input id="w-offer" inputmode="decimal" value="${w.offer || ""}" placeholder="optional"></div>
      <div class="field"><label for="w-qty">Anzahl</label><select id="w-qty">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option ${n === (w.qty || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div id="w-calc"></div></div>
    <datalist id="known-names">${knownNames().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    ${existing ? '<button type="button" class="mini" id="w-del" style="align-self:flex-start;color:var(--bad)">Von der Liste löschen</button>' : ""}
    <p class="hint"><b>Einkaufsliste</b>: wird gekauft (Ersatzspieler) und beim Kauf automatisch abgehakt. <b>Merkliste</b>: nur zum Beobachten, zählt nicht zur Einkaufsliste.</p></form>`;
  const valid = () => $("w-name").value.trim() && +$("w-rating").value >= 1 && +$("w-rating").value <= 99 && (list === "watch" || parseCoins($("w-price").value) > 0);
  const refresh = sheet(existing ? "Spieler bearbeiten" : "Spieler hinzufügen", body, "Sichern", async () => {
    const name = $("w-name").value.trim(), rating = +$("w-rating").value;
    const data = { rating, chem: $("w-chem").value, special: $("w-sp").checked, price: parseCoins($("w-price").value) || 0, offer: parseCoins($("w-offer").value) || null, qty: +$("w-qty").value };
    // Schon auf einer Liste? Nur bei neuen Einträgen oder geändertem Spieler nachfragen
    const changed = !existing || !sameName(existing.name, name) || existing.rating !== rating;
    const on = changed ? listsWith(name, rating, existing?.id) : [];
    if (on.length && !await askYesNo(`<b>${esc(name)} ${rating}</b> steht schon auf der ${on.join(" und der ")}. Soll der Spieler ein zweites Mal auf die ${list === "watch" ? "Merkliste" : "Einkaufsliste"}?`)) return;
    S.saveWish({ id: existing ? existing.id : S.newId(), name, ...data, list, owner: existing?.owner || settings.name, createdAt: existing?.createdAt || Date.now() });
    closeSheet(); toast(existing ? "Gespeichert" : `${name} steht auf der ${list === "watch" ? "Merkliste" : "Einkaufsliste"}`);
  }, valid);
  $("w-list").addEventListener("click", e => { const b = e.target.closest("[data-wl]"); if (!b) return; list = b.dataset.wl; $("w-list").innerHTML = seg([["buy", "Einkaufsliste"], ["watch", "Merkliste"]], list, "wl"); refresh(); });
  const upd = () => { $("w-calc").innerHTML = calcHtml(parseCoins($("w-price").value), parseCoins($("w-offer").value) || null); refresh(); };
  $("w-name").addEventListener("change", () => { const l = lastCard($("w-name").value); if (l) { if (!$("w-rating").value) $("w-rating").value = l.rating; $("w-chem").value = l.chem; } upd(); });
  $("wf").addEventListener("input", upd); $("wf").addEventListener("submit", e => e.preventDefault());
  if ($("w-del")) $("w-del").onclick = e => confirmButton(e.target, "Wirklich löschen?", () => { S.deleteWish(existing.id); closeSheet(); toast("Gelöscht"); });
  upd();
}

function openBuy(key) {
  const g = allBuyGroups().find(x => x.key === key); if (!g) return;
  const st = I.flipStats(S.data.cards, g.name, g.rating, g.chem, cfg().minProfit, g.special);
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(g.rating, 0, g.special)}<div class="grow" style="min-width:0"><div class="name">${esc(g.name)}${spTag(g.special)}</div>
      <div class="meta">${g.wish ? `geplant für ${fmt(g.lastEk)}${g.wish.offer ? ` · Angebot ~${fmt(g.wish.offer)}` : ""}${g.replaces?.length ? ` · ersetzt ${g.replaces.map(c => esc(c.name)).join(", ")}` : ""}` : g.planned ? `geplant für ${fmt(g.lastEk)}${g.offer ? ` · Angebot ~${fmt(g.offer)}` : ""} · verkauft für ${fmt(g.lastVk)}` : `zuletzt EK ${fmt(g.lastEk)} · VK ${fmt(g.lastVk)}`}</div></div></div></div>
    ${st ? `<div class="group"><div class="gh">Bisher ${st.n}× gedreht${st.sameStyle ? "" : " (alle Styles)"}</div>
      <div class="calc"><div class="l"><span>Ø Gewinn · Haltedauer</span><span class="num">${signed(st.avg)} · ${holdText(st.hold)}</span></div>
        <div class="l"><span>Erwarteter VK (Ø aller ${st.expN} Verkäufe)</span><span class="num">${fmt(st.expVk)}</span></div>
        ${st.maxEk ? `<div class="l"><span>max. EK (mind. ${fmt(cfg().minProfit)} Gewinn)</span><span class="num gold-text">${fmt(st.maxEk)}</span></div>` : ""}</div>
      <div class="hist"><span class="h">Verkauft</span><span class="h num">EK</span><span class="h num">VK</span><span class="h">Gewinn</span>
        ${st.history.map(h => `<span>${fmtShort(parseDay(h.date))}</span><span class="num">${fmt(h.ek)}</span><span class="num">${fmt(h.vk)}</span>${profitHtml(h.profit)}`).join("")}</div></div>` : ""}
    <div class="group"><div class="gh">Nachkauf</div>
      <div class="field"><label for="k-ek">Einkaufspreis</label><input id="k-ek" inputmode="decimal" value="${g.lastEk}"></div>
      <div class="chips"><button type="button" class="chip" data-d="-1">− Stufe</button><button type="button" class="chip" data-d="1">+ Stufe</button>
        <button type="button" class="chip" data-d="0">${g.wish || g.planned ? "Geplanter EK" : "Letzter EK"}</button>${st?.maxEk ? `<button type="button" class="chip" data-max="1">max. EK ${compact(st.maxEk)}</button>` : ""}<button type="button" class="chip" data-app="000">+000</button></div>
      <div id="k-warn"></div>
      ${g.items.length > 1 ? `<div class="field"><label for="k-qty">Anzahl</label><select id="k-qty">${g.items.map((_, i) => `<option ${i === 0 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>` : ""}
      <div class="field"><label for="k-chem">Chemistry Style</label><select id="k-chem">${chemOptions(g.chem)}</select></div>
      ${specialCheck("k-sp", g.special)}
      <div class="field"><label for="k-date">Kaufdatum</label><input id="k-date" type="date" value="${toISODate(new Date())}"></div>
      <div id="k-calc"></div></div></div>`;
  const qty = () => $("k-qty") ? +$("k-qty").value : 1;
  const refresh = sheet(g.wish ? "Kauf erfassen" : "Nachkauf erfassen", body, "Gekauft", () => {
    const ek = parseCoins($("k-ek").value), n = qty();
    // Stück für Stück abhaken: zuerst Nachkauf-Einträge, dann geplante Spieler (Reihenfolge der zusammengefassten Teile)
    let left = n, i = 0;
    for (const part of g.parts) {
      const k = Math.min(left, part.items.length), offer = part.wish?.offer || part.offer;
      for (let j = 0; j < k; j++, i++) {
        S.saveCard({ id: S.newId(), name: g.name, rating: g.rating, chem: $("k-chem").value, special: $("k-sp").checked, ek, ekDate: $("k-date").value || toISODate(new Date()),
          vk: null, vkDate: null, owner: settings.name, notes: "", createdAt: Date.now() + i, ...(offer ? { targetVk: offer } : {}) });
        if (!part.wish) S.saveCard({ ...part.items[j], restock: "done" });
      }
      if (part.wish && k) useWish(part.wish, k);
      if (!(left -= k)) break;
    }
    closeSheet(); toast(n > 1 ? `${n}× ${g.name} gekauft` : `${g.name} gekauft`);
  }, () => parseCoins($("k-ek").value) > 0);
  const upd = () => {
    const ek = parseCoins($("k-ek").value);
    const offer = g.wish?.offer || g.offer || null, kvk = ek ? target(ek) : 0;
    // kalk. VK groß hervorgehoben, darunter die Rechnung (mit Angebotspreis) bzw. der Break-even
    $("k-calc").innerHTML = ek ? `<div class="kvk"><div><div class="t">kalk. VK</div><div class="v num">${fmt(kvk)}</div></div>
      <div class="right"><div class="t">Gewinn bei kalk. VK</div>${profitHtml(profitOf(ek, kvk))}</div></div>`
      + (offer ? calcHtml(ek, offer) : `<div class="calc"><div class="l"><span>Break-even nach Tax</span><span class="num">${fmt(breakEven(ek))}</span></div></div>`) : "";
    $("k-warn").innerHTML = st?.maxEk && ek > st.maxEk ? `<div class="warn">Über max. EK – beim üblichen VK von ${fmt(st.expVk)} bleiben nur ${signed(profitOf(ek, st.expVk))}.</div>` : "";
    refresh();
  };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const d = e.target.closest("[data-d]"), a = e.target.closest("[data-app]"), mx = e.target.closest("[data-max]");
    if (mx) { $("k-ek").value = st.maxEk; upd(); }
    if (d) { const v = parseCoins($("k-ek").value) || g.lastEk; $("k-ek").value = +d.dataset.d === 0 ? g.lastEk : stepPrice(v, +d.dataset.d); }
    if (a) $("k-ek").value += a.dataset.app;
    if (d || a) upd();
  });
  $("k-ek").addEventListener("input", upd);
  upd();
}

function wealthHtml() {
  const snaps = [...S.data.snaps].sort((a, b) => b.date.localeCompare(a.date));
  const total = s => s.team + s.tl + s.coins;
  const latest = snaps[0], prev = snaps[1];
  const cell = (t, v, p, plain) => `<div class="cell"><div class="t">${t}</div><div class="v num">${plain ? v : compact(v)}</div>
    ${p != null ? `<div class="dl num" style="color:${v - p >= 0 ? "var(--good)" : "var(--bad)"}">${plain ? (v - p > 0 ? "+" : "") + (v - p) : signed(v - p)}</div>` : ""}</div>`;
  return `${latest ? `<section class="hero" style="background:radial-gradient(120% 140% at 0% 0%,#2a4a8f 0%,#1c3264 50%,#131f3d 100%);border-color:#34579f">
      <div class="lbl" style="color:#d6e0f7">ges. Vermögen · ${fmtDate(parseDay(latest.date))}</div>
      <div class="big num">${fmt(total(latest))}</div>
      <div class="sub" style="color:#d6e0f7">${prev ? signed(total(latest) - total(prev)) + " zur Vorwoche" : "Erster Wochenstand"}</div></section>` : ""}
    <button class="primary" data-act="snap">Wochenstand eintragen</button>
    <div class="list">${snaps.map((s, i) => { const p = snaps[i + 1];
      return `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px" data-snap="${s.id}" tabindex="0">
        <div class="row"><div class="grow name">bis ${fmtDate(parseDay(s.date))}</div><div class="right"><div class="num" style="font-weight:700">${fmt(total(s))}</div>${p ? profitHtml(total(s) - total(p)) : ""}</div></div>
        <div class="grid3">${cell("Teamwert", s.team, p && p.team)}${cell("TL (ESBC)", s.tl, p && p.tl)}${cell("Coins", s.coins, p && p.coins)}${cell("TL (eigen)", s.tlOwn, p && p.tlOwn)}
        ${cell("VK ÜV", s.sold, p && p.sold, 1)}${cell("ÜV a. Liste", s.listed, p && p.listed, 1)}${cell("Gewinn ÜV", s.profit, p && p.profit)}</div>
        ${s.notes ? `<div class="meta" style="white-space:normal">${esc(s.notes)}</div>` : ""}</div>`; }).join("")
      || '<div class="empty">Noch kein Wochenstand.</div>'}</div>`;
}

function moreHtml() {
  const demo = S.data.mode === "demo";
  return `<section class="card"><h2>Du</h2>
      <div class="group" style="border:0"><div class="field" style="padding:0"><label for="m-name">Name</label><input id="m-name" value="${esc(settings.name)}"></div></div></section>
    <section class="card"><h2>Gemeinsames Depot</h2>
      ${demo ? `<p class="meta" style="white-space:normal;margin:0">Demo-Modus: Die Daten liegen nur in diesem Browser.</p>`
        : `<div class="codebox">${esc(settings.depot)}</div>
      <p class="meta" style="white-space:normal;margin:0">Alle, die diesen Code eingeben, sehen und bearbeiten dieselben Spieler in Echtzeit.</p>
      <button class="mini" data-act="share">Code teilen</button>`}
      <button class="mini" data-act="leave" style="color:var(--bad)">${demo ? "Demo beenden" : "Anderes Depot verwenden"}</button></section>
    <section class="card"><h2>Trading-Ziele</h2>
      <p class="meta" style="white-space:normal;margin:0">Gilt für das ganze Depot – dein Freund sieht dieselben Werte.</p>
      <div class="group" style="border:0">
        <div class="field"><label for="c-goal">Wochenziel Gewinn</label><input id="c-goal" data-cfg="weeklyGoal" inputmode="decimal" value="${cfg().weeklyGoal || ""}" placeholder="aus"></div>
        <div class="field"><label for="c-min">Mindestgewinn pro Karte</label><input id="c-min" data-cfg="minProfit" inputmode="decimal" value="${cfg().minProfit}"></div>
        <div class="field"><label for="c-stale">Preisanpassung nach Tagen</label><input id="c-stale" data-cfg="staleDays" inputmode="numeric" value="${cfg().staleDays}"></div>
        <div class="field"><label for="c-lock">Kein Nachkauf, wenn danach noch Tage unverkauft</label><input id="c-lock" data-cfg="lockDays" inputmode="numeric" value="${cfg().lockDays}"></div>
        <div class="field"><label for="c-readj">Erneut anpassen nach Tagen</label><input id="c-readj" data-cfg="readjustDays" inputmode="numeric" value="${cfg().readjustDays}"></div></div>
      <p class="hint" style="padding:0">Der Mindestgewinn bestimmt den „max. EK“ auf der Einkaufsliste.</p></section>
    <section class="card"><h2>Daten</h2>
      <button class="secondary" data-act="backup">Backup herunterladen (alles)</button>
      <label class="secondary" for="restore-file" style="text-align:center">Backup wiederherstellen</label>
      <input class="hidden" type="file" id="restore-file" accept=".json,application/json">
      <p class="meta" style="white-space:normal;margin:0">Letzte Sicherung auf diesem Gerät: ${backupAge()}. Das Backup enthält Spieler, Wochenstände, gelernte Symbole und Einstellungen.</p>
      <button class="secondary" data-act="import">Aus Excel importieren (.xlsx oder .csv)</button>
      <button class="secondary" data-act="export">Als CSV exportieren</button>
      ${demo ? `<button class="mini" data-act="reset">Demo-Daten zurücksetzen</button>` : ""}</section>
    <section class="card"><h2>Auf dem iPhone installieren</h2>
      <p class="meta" style="white-space:normal;margin:0">In Safari unten auf <strong>Teilen</strong> tippen und <strong>„Zum Home-Bildschirm“</strong> wählen. Danach startet FC Trader wie eine App.</p></section>
    <section class="card"><h2>Berechnung</h2>
      <div class="calc" style="padding:0"><div class="l"><span>Gewinn</span><span>VK − 5 % EA Tax − EK</span></div><div class="l"><span>Marge</span><span>Gewinn / VK</span></div>
      <div class="l"><span>Gesamtvermögen</span><span>Teamwert + TL (ESBC) + Coins</span></div></div></section>
    <section class="card" style="padding:0;gap:0"><h2 style="padding:14px 14px 8px">Kalk. VK – Aufschlag auf den EK</h2>
      <div style="overflow-x:auto"><table class="tiers num">${TIERS.map((t, i) => `<tr><td>${fmt(i ? TIERS[i - 1][0] + 1 : 0)} – ${fmt(t[0])}</td><td>+ ${fmt(t[1])}</td></tr>`).join("")}
      <tr><td>ab ${fmt(TIERS[TIERS.length - 1][0] + 1)}</td><td>+ ${fmt(MARKUP_ABOVE)}</td></tr></table></div></section>
    <section class="card"><h2>Chemistry Styles</h2><p class="meta" style="white-space:normal;margin:0">${STYLES.join(" · ")}</p>
      <p class="meta" style="white-space:normal;margin:0">${S.data.icons.length} vom Nutzer gelernte Symbole</p></section>
    <p class="hint">FC Trader ${VERSION} · ${demo ? "Demo" : "Cloud"}</p>`;
}

// ---------- Update-Prüfung ----------
// version.json wird bei jeder neuen Version mit hochgezählt; die installierte App prüft beim Öffnen/Zurückkehren.
let newVersion = null;
async function checkUpdate() {
  try {
    const v = (await (await fetch("version.json", { cache: "no-store" })).json()).version;
    if (v && v !== VERSION && v !== newVersion) { newVersion = v; render(); }
  } catch (e) { /* offline */ }
}
async function applyUpdate() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.update().catch(() => {})));
    const keys = await caches?.keys?.() || [];
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch (e) { /* egal */ }
  location.reload();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(); });
setTimeout(checkUpdate, 1500);

function onViewClick(e) {
  const t = e.target;
  const sell = t.closest("[data-sell]"); if (sell) { e.stopPropagation(); return openSell(S.data.cards.find(c => c.id === sell.dataset.sell)); }
  const p = t.closest("[data-period]"); if (p) { ui.period = p.dataset.period; return render(); }
  const f = t.closest("[data-filter]"); if (f) { ui.filter = f.dataset.filter; return render(); }
  const d = t.closest("[data-day]"); if (d) { ui.sel = +d.dataset.day; return render(); }
  const wk = t.closest("[data-week]"); if (wk) { ui.wsel = +wk.dataset.week; return render(); }
  const dm = t.closest("[data-dim]"); if (dm) { ui.dim = dm.dataset.dim; LS.set("fct-dim", ui.dim); return render(); }
  const adj = t.closest("[data-adjust]"); if (adj) { e.stopPropagation(); return openAdjust(S.data.cards.find(c => c.id === adj.dataset.adjust)); }
  const sg = t.closest("[data-sgroup]"); if (sg) return openSoldGroup(sg.dataset.sgroup);
  const ed = t.closest("[data-edit]"); if (ed) return openAdd(S.data.cards.find(c => c.id === ed.dataset.edit));
  const sn = t.closest("[data-snap]"); if (sn) return openSnap(S.data.snaps.find(s => s.id === sn.dataset.snap));
  const wi = t.closest("[data-wish]"); if (wi) return openWish(S.data.wishes.find(w => w.id === wi.dataset.wish));
  const tb = t.closest("[data-tobuy]"); if (tb) { const w = S.data.wishes.find(x => x.id === tb.dataset.tobuy);
    if (w) { S.saveWish({ ...w, list: "buy" }); toast(`${w.name} steht auf der Einkaufsliste${w.price ? "" : " – Preis noch eintragen"}`); if (!w.price) openWish({ ...w, list: "buy" }); } return; }
  const wd = t.closest("[data-wdel]"); if (wd) return confirmButton(wd, "Löschen?", () => { S.deleteWish(wd.dataset.wdel); toast("Von der Merkliste gelöscht"); });
  const buy = t.closest("[data-buy]"); if (buy) return openBuy(buy.dataset.buy);
  const skip = t.closest("[data-skip]");
  if (skip) return confirmButton(skip, "Überspringen?", () => {
    const g = allBuyGroups().find(x => x.key === skip.dataset.skip);
    if (g?.wish) { S.deleteWish(g.wish.id); toast(`${g.name} von der Liste genommen`); }
    else if (g) { S.saveCard({ ...g.items[0], restock: "skip" }); toast(`${g.name} von der Liste genommen`); }
  });
  const a = t.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (act === "ranking") openRanking();
  if (act === "wish") openWish();
  if (act === "update") applyUpdate();
  if (act === "goal") openGoal();
  if (act === "backup") downloadBackup();
  if (act === "snap") openSnap();
  if (act === "import") openImport();
  if (act === "export") download(`FC-Trader-Export-${toISODate(new Date())}.csv`, exportCSV());
  if (act === "share") {
    const text = `Tritt meinem FC Trader Depot bei – Code: ${settings.depot}\n${location.href}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast("Code kopiert"), () => {});
  }
  if (act === "reset") confirmButton(a, "Wirklich zurücksetzen?", () => { S.resetDemo(); toast("Zurückgesetzt"); });
  if (act === "leave") confirmButton(a, "Wirklich?", () => { settings.depot = ""; LS.set("fct-depot", null); start(); });
}
function confirmButton(btn, text, fn) {
  if (btn.dataset.armed) return fn();
  btn.dataset.armed = 1; btn.textContent = text;
}
document.addEventListener("change", e => {
  if (e.target.id === "m-name") { settings.name = e.target.value.trim(); LS.set("fct-name", settings.name); toast("Name gespeichert"); }
  if (e.target.dataset.cfg) {
    const k = e.target.dataset.cfg, v = Math.max(0, parseCoins(e.target.value) || 0);
    S.saveSettings({ [k]: ["staleDays", "lockDays", "readjustDays"].includes(k) ? Math.max(1, v || I.DEFAULTS[k]) : k === "minProfit" && !e.target.value.trim() ? I.DEFAULTS.minProfit : v });
    toast("Gespeichert");
  }
  if (e.target.id === "restore-file" && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ""; restoreBackup(f); }
});

// ---------- Sheets ----------
function sheet(title, body, actionLabel, onAction, canAct) {
  layer.innerHTML = `<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="grab"></div>
    <div class="bar"><button class="link" data-close>${actionLabel ? "Abbrechen" : "Schließen"}</button><h3>${esc(title)}</h3>
    <button class="link" id="act" ${actionLabel ? "" : "hidden"}>${actionLabel || ""}</button></div>${body}</div></div>`;
  const bg = layer.firstElementChild;
  bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-close]")) closeSheet(); });
  const act = document.getElementById("act");
  if (onAction) act.addEventListener("click", () => { if (!act.disabled) onAction(); });
  const refresh = () => { if (canAct) act.disabled = !canAct(); };
  bg.addEventListener("input", refresh); bg.addEventListener("change", refresh); refresh();
  return refresh;
}
const closeSheet = () => { layer.innerHTML = ""; };
const $ = id => document.getElementById(id);

function openAdd(existing) {
  const c = existing || { name: "", rating: "", chem: "Basic", ek: "", ekDate: toISODate(new Date()), vk: null, vkDate: null, notes: "" };
  const body = `<form class="form" id="f" autocomplete="off">
    <div class="group"><div class="gh">Spieler</div>
      <div class="field"><label for="f-name">Name</label><input id="f-name" value="${esc(c.name)}" placeholder="z. B. Musiala"></div>
      <div class="chips" id="sugg" hidden></div>
      <div class="field"><label for="f-rating">Rating</label><input id="f-rating" inputmode="numeric" value="${c.rating}" placeholder="z. B. 84"></div>
      <div class="field"><label for="f-chem">Chemistry Style</label><select id="f-chem">${chemOptions(c.chem)}</select></div>
      ${specialCheck("f-sp", c.special)}
      <div class="chips" id="rchem">${recentChems().map(s => `<button type="button" class="chip" data-chem="${s}">${s}</button>`).join("")}</div></div>
    <div class="group"><div class="gh">Kauf</div>
      <div class="field"><label for="f-ek">Einkaufspreis</label><input id="f-ek" inputmode="decimal" value="${c.ek}" placeholder="0"></div>
      <div class="chips"><button type="button" class="chip" data-app="000">+000</button><button type="button" class="chip" data-app="k">k</button></div>
      <div class="field"><label for="f-ekd">Kaufdatum</label><input id="f-ekd" type="date" value="${c.ekDate}"></div>
      <div id="f-calc-buy"></div></div>
    ${existing ? `<div class="group"><div class="gh">Verkauf</div>
      <div class="field"><label for="f-vk">Verkaufspreis</label><input id="f-vk" inputmode="decimal" value="${c.vk ?? ""}" placeholder="noch offen"></div>
      <div class="field"><label for="f-vkd">Verkaufsdatum</label><input id="f-vkd" type="date" value="${c.vkDate || toISODate(new Date())}"></div>
      <div id="f-calc-sell"></div></div>` : ""}
    <div class="group"><div class="field"><label for="f-notes">Notiz</label><textarea id="f-notes" rows="1" placeholder="optional">${esc(c.notes || "")}</textarea></div></div>
    ${existing && isSold(existing) && !onRestock(existing) ? `<button type="button" class="mini" id="f-restock" style="align-self:flex-start">Auf die Einkaufsliste setzen</button>` : ""}
    ${existing ? `<button type="button" class="mini" id="f-del" style="align-self:flex-start;color:var(--bad)">Eintrag löschen</button>`
      : '<button type="button" class="primary" id="f-next">Sichern &amp; nächste Karte</button>'}
  </form>`;
  const valid = () => $("f-name").value.trim() && +$("f-rating").value >= 1 && +$("f-rating").value <= 99 && parseCoins($("f-ek").value) > 0;
  const refresh = sheet(existing ? "Spieler bearbeiten" : "Kauf erfassen", body, "Sichern", () => { save(); closeSheet(); toast("Gespeichert"); }, valid);
  function update() {
    const ek = parseCoins($("f-ek").value);
    $("f-calc-buy").innerHTML = calcHtml(ek, null);
    if (existing) $("f-calc-sell").innerHTML = calcHtml(ek, parseCoins($("f-vk").value));
    const q = $("f-name").value.trim().toLowerCase();
    const names = q.length >= 2 ? knownNames().filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 5) : [];
    $("sugg").innerHTML = names.map(n => `<button type="button" class="chip" data-name="${esc(n)}">↺ ${esc(n)}</button>`).join("");
    $("sugg").hidden = !names.length;
    layer.querySelectorAll("#rchem .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.chem === $("f-chem").value));
    if ($("f-next")) $("f-next").disabled = !valid();
    refresh();
  }
  function save() {
    const card = existing ? { ...existing } : { id: S.newId(), owner: settings.name, createdAt: Date.now() };
    Object.assign(card, { name: $("f-name").value.trim(), rating: +$("f-rating").value, chem: $("f-chem").value, special: $("f-sp").checked,
      ek: parseCoins($("f-ek").value), ekDate: $("f-ekd").value || toISODate(new Date()), notes: $("f-notes").value.trim() });
    if (existing) {
      const vk = parseCoins($("f-vk").value); card.vk = vk || null; card.vkDate = vk ? ($("f-vkd").value || toISODate(new Date())) : null;
      if (vk && !existing.vk) { card.restock = "open"; card.soldAt = Date.now(); } // hier verkauft → auf die Einkaufsliste
      if (vk) card.marketEk = null;
      if (!vk) card.restock = null;                  // Verkauf entfernt → von der Liste
    }
    else { card.vk = null; card.vkDate = null; }
    existing && card.vk && !existing.vk ? saveSale(card) : S.saveCard(card);
    if (!existing && consumeRestock(card)) toast(`${card.name} auf der Einkaufsliste abgehakt`);
  }
  layer.querySelector(".sheet").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t || !$("f")) return; // Formular schon geschlossen (z. B. nach „Sichern“)
    if (t.dataset.name) { const l = lastCard(t.dataset.name); $("f-name").value = t.dataset.name; if (l) { $("f-rating").value = l.rating; $("f-chem").value = l.chem; } $("f-ek").focus(); }
    if (t.dataset.chem) $("f-chem").value = t.dataset.chem;
    if (t.dataset.app) { $("f-ek").value += t.dataset.app; $("f-ek").focus(); }
    if (t.id === "f-next") { save(); toast("Gespeichert – nächste Karte"); ["f-name", "f-rating", "f-ek", "f-notes"].forEach(i => $(i).value = ""); $("f-name").focus(); }
    if (t.id === "f-restock") { S.saveCard({ ...existing, restock: "manual" }); closeSheet(); return toast(`${existing.name} steht auf der Einkaufsliste`); }
    if (t.id === "f-del") return confirmButton(t, "Wirklich löschen?", () => { S.deleteCard(existing.id); closeSheet(); toast("Gelöscht"); });
    update();
  });
  $("f").addEventListener("input", update);
  $("f").addEventListener("change", update);
  $("f").addEventListener("submit", e => e.preventDefault());
  update();
}

function openSell(card, presetPrice = card.targetVk) {
  const av = avgVk(card.name, card.rating, card.special);
  const chips = [["ziel", "kalk. VK " + compact(target(card.ek))], ...(av ? [["avg", "Ø VK " + compact(av)]] : []), ["0", "Break-even"], ["0.1", "+10 %"], ["0.2", "+20 %"]];
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(card.rating, 0, card.special)}<div class="grow" style="min-width:0"><div class="name">${esc(card.name)}${spTag(card.special)}</div>
      <div class="meta">${esc(card.chem)} · EK ${fmt(card.ek)} · ${fmtDate(parseDay(card.ekDate))}</div></div></div></div>
    <div class="group"><div class="gh">Verkauf</div>
      <div class="field"><label for="s-vk">Verkaufspreis</label><input id="s-vk" inputmode="decimal" placeholder="0" value="${presetPrice ?? ""}"></div>
      <div class="chips">${chips.map(([k, l]) => `<button type="button" class="chip" data-m="${k}">${l}</button>`).join("")}<button type="button" class="chip" data-app="000">+000</button></div>
      <div class="field"><label for="s-date">Verkaufsdatum</label><input id="s-date" type="date" value="${toISODate(new Date())}"></div></div>
    <div class="group"><div class="gh">Abrechnung</div><div id="s-calc"></div></div>
    <p class="hint">kalk. VK = kalkulierter VK laut eurer Aufschlagstabelle. Ø VK = Durchschnitt eurer bisherigen Verkäufe dieser Karte (gleicher Spieler & Rating). Die %-Chips setzen den Preis, der nach 5 % Tax die Marge bringt.</p></div>`;
  const refresh = sheet("Verkaufen", body, "Verkauft", () => {
    const vk = parseCoins($("s-vk").value);
    const plan = saveSale({ ...card, vk, vkDate: $("s-date").value || toISODate(new Date()), soldAt: Date.now(), restock: "open", marketEk: null });
    const date = $("s-date").value || toISODate(new Date());
    closeSheet(); toast("Verkauft: " + signed(profitOf(card.ek, vk)) + (plan ? " · Ersatzspieler übernommen" : slowSeller({ ...card, vkDate: date }) ? " · Ladenhüter, kein Nachkauf" : ""));
  }, () => parseCoins($("s-vk").value) > 0);
  const upd = () => { $("s-calc").innerHTML = calcHtml(card.ek, parseCoins($("s-vk").value)) || '<div class="calc"><div class="l">Preis eingeben</div></div>'; refresh(); };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const m = e.target.closest("[data-m]"), a = e.target.closest("[data-app]");
    if (m) $("s-vk").value = m.dataset.m === "ziel" ? target(card.ek) : m.dataset.m === "avg" ? av : breakEven(card.ek, +m.dataset.m);
    if (a) $("s-vk").value += a.dataset.app;
    if (m || a) upd();
  });
  $("s-vk").addEventListener("input", upd);
  upd(); if (presetPrice == null) $("s-vk").focus();
}

function openSnap(existing) {
  const snaps = [...S.data.snaps].sort((a, b) => b.date.localeCompare(a.date));
  const base = existing || snaps[0] || {};
  const s = existing || { date: toISODate(new Date()) };
  const f = (id, label, v, mode = "decimal") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" inputmode="${mode}" value="${v ?? ""}" placeholder="0"></div>`;
  const body = `<form class="form" id="w" autocomplete="off">
    <div class="group"><div class="field"><label for="w-date">Stichtag</label><input id="w-date" type="date" value="${s.date}"></div></div>
    <div class="group"><div class="gh">Werte</div>${f("w-team", "Teamwert (ESBC)", base.team)}${f("w-tl", "TL-Wert (ESBC)", base.tl)}${f("w-coins", "Coins Bank", base.coins)}${f("w-own", "TL-Wert (eigen)", base.tlOwn)}</div>
    <div class="group"><div class="gh">ÜV-Karten</div>${f("w-sold", "VK ÜV-Karten", s.sold, "numeric")}${f("w-listed", "ÜV-Karten a. Liste", s.listed, "numeric")}${f("w-profit", "Gewinn ÜV", s.profit, "text")}</div>
    <div class="group"><div class="field"><label for="w-notes">Notiz</label><textarea id="w-notes" rows="1" placeholder="optional">${esc(s.notes || "")}</textarea></div></div>
    <div class="group"><div class="calc"><div class="total"><span>ges. Vermögen</span><span class="num" id="w-total"></span></div></div></div>
    <p class="hint">Werte sind mit dem letzten Stand vorausgefüllt. Gesamtvermögen = Teamwert + TL (ESBC) + Coins.</p>
    ${existing ? '<button type="button" class="mini" id="w-del" style="align-self:flex-start;color:var(--bad)">Stand löschen</button>' : ""}</form>`;
  const tot = () => (parseCoins($("w-team").value) || 0) + (parseCoins($("w-tl").value) || 0) + (parseCoins($("w-coins").value) || 0);
  const refresh = sheet(existing ? "Stand bearbeiten" : "Wochenstand", body, "Sichern", () => {
    S.saveSnap({ id: existing ? existing.id : S.newId(), date: $("w-date").value, team: parseCoins($("w-team").value) || 0,
      tl: parseCoins($("w-tl").value) || 0, coins: parseCoins($("w-coins").value) || 0, tlOwn: parseCoins($("w-own").value) || 0,
      sold: parseInt($("w-sold").value, 10) || 0, listed: parseInt($("w-listed").value, 10) || 0,
      profit: parseCoins($("w-profit").value) || 0, notes: $("w-notes").value.trim() });
    closeSheet(); toast("Wochenstand gespeichert");
  }, () => tot() > 0 && $("w-date").value);
  const upd = () => { $("w-total").textContent = fmt(tot()); refresh(); };
  $("w").addEventListener("input", upd); $("w").addEventListener("submit", e => e.preventDefault());
  if ($("w-del")) $("w-del").onclick = e => confirmButton(e.target, "Wirklich löschen?", () => { S.deleteSnap(existing.id); closeSheet(); });
  upd();
}

function openGoal() {
  const body = `<div class="form"><div class="group">
    <div class="field"><label for="g-v">Gewinn pro Woche</label><input id="g-v" inputmode="decimal" value="${cfg().weeklyGoal || ""}" placeholder="z. B. 50.000"></div></div>
    <div class="chips" style="padding:0">${[25000, 50000, 100000, 150000, 200000].map(v => `<button type="button" class="chip" data-gv="${v}">${compact(v)}</button>`).join("")}</div>
    <p class="hint">Gilt für das ganze Depot. Leer lassen = kein Ziel.</p></div>`;
  sheet("Wochenziel", body, "Sichern", () => { S.saveSettings({ weeklyGoal: parseCoins($("g-v").value) || 0 }); closeSheet(); toast("Wochenziel gespeichert"); });
  layer.querySelector(".sheet").addEventListener("click", e => { const b = e.target.closest("[data-gv]"); if (b) $("g-v").value = b.dataset.gv; });
}

// ---------- Backup ----------
const backupAge = () => {
  const t = +LS.get("fct-backup");
  if (!t) return "noch nie";
  const d = daysBetween(new Date(t), new Date());
  return d <= 0 ? "heute" : d === 1 ? "gestern" : `vor ${d} Tagen`;
};
const backupDue = () => S.data.mode === "cloud" && S.data.cards.length > 0 && (!+LS.get("fct-backup") || Date.now() - +LS.get("fct-backup") > 7 * DAY);
function downloadBackup() {
  const payload = { app: "FC Trader", version: VERSION, depot: settings.depot, created: new Date().toISOString(),
    cards: S.data.cards, snaps: S.data.snaps, wishes: S.data.wishes, icons: S.data.icons.map(({ id, style, hex }) => ({ id, style, hex })), settings: S.data.settings };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `FC-Trader-Backup-${toISODate(new Date())}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  LS.set("fct-backup", String(Date.now())); toast(`Backup mit ${S.data.cards.length} Spielern gespeichert`); render();
}
async function restoreBackup(file) {
  let b;
  try { b = JSON.parse(await file.text()); } catch (e) { return toast("Das ist keine Backup-Datei", true); }
  if (b?.app !== "FC Trader" || !Array.isArray(b.cards)) return toast("Das ist keine FC-Trader-Sicherung", true);
  const body = `<div class="form"><div class="group"><div class="calc">
    <div class="l"><span>Erstellt</span><span>${esc(new Date(b.created).toLocaleString("de-DE"))}</span></div>
    <div class="l"><span>Spieler</span><span class="num">${b.cards.length}</span></div>
    <div class="l"><span>Wochenstände</span><span class="num">${(b.snaps || []).length}</span></div></div></div>
    <p class="hint">Einträge aus dem Backup überschreiben gleiche Einträge im Depot. Spieler, die es erst nach dem Backup gab, bleiben erhalten –
      mit „Exakt wie im Backup“ werden sie gelöscht.</p>
    <label class="check" style="border:0"><input type="checkbox" id="r-exact"> Exakt wie im Backup (neuere Spieler löschen)</label></div>`;
  sheet("Backup wiederherstellen", body, "Wiederherstellen", async () => {
    const exact = $("r-exact").checked;
    $("act").disabled = true; $("act").textContent = "Läuft …";
    if (exact) { const keep = new Set(b.cards.map(c => c.id)); for (const c of S.data.cards.filter(c => !keep.has(c.id))) await S.deleteCard(c.id); }
    await S.saveCards(b.cards);
    for (const sn of b.snaps || []) await S.saveSnap(sn);
    for (const w of b.wishes || []) await S.saveWish(w);
    const known = new Set(S.data.icons.map(i => i.id));
    for (const i of b.icons || []) if (i.id && !known.has(i.id)) await S.saveIcon(i);
    if (b.settings && Object.keys(b.settings).length) await S.saveSettings(b.settings);
    closeSheet(); toast(`${b.cards.length} Spieler wiederhergestellt`);
  }, () => true);
}

function openRanking() {
  const s = stats(S.data.cards, ui.period);
  sheet("Spieler-Ranking", `<div class="form"><div class="list">${s.players.map((p, i) => `<div class="item" style="cursor:default">
    <span class="meta num" style="width:22px;text-align:right">${i + 1}</span>${badge(p.rating, 1, p.special)}
    <div class="grow" style="min-width:0"><div class="name">${esc(p.name)}</div><div class="meta">${p.n}× · VK ${compact(p.vk)} · Ø ${signed(p.avg)} · ${holdText(p.hold)}${p.open ? " · " + p.open + " im Club" : ""}</div></div>
    ${profitHtml(p.profit)}</div>`).join("")}</div></div>`);
}

// ---------- Import / Export ----------
function openImport() {
  const body = `<div class="form">
    <p class="meta" style="white-space:normal;margin:0">Wähle eure Excel-Datei (.xlsx) oder eine CSV des Reiters „Spieler“. Erkannt werden die Spalten Name, Rating, ChemieStyle, EK, EK Datum, VK und VK Datum.</p>
    <label class="secondary" for="imp-file" style="text-align:center">Datei auswählen</label>
    <input class="hidden" type="file" id="imp-file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
    <div id="imp-result"></div></div>`;
  sheet("Excel importieren", body);
  let parsed = null;
  $("imp-file").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    $("imp-result").innerHTML = '<div class="empty">Datei wird gelesen …</div>';
    try {
      const { readFile } = await import("./importer.js");
      parsed = await readFile(file, settings.name);
      const sold = parsed.cards.filter(isSold);
      $("imp-result").innerHTML = parsed.cards.length ? `<div class="group"><div class="gh">Vorschau – ${esc(file.name)}${parsed.sheet ? " · " + esc(parsed.sheet) : ""}</div>
        <div class="calc"><div class="l"><span>Spieler gesamt</span><span class="num">${parsed.cards.length}</span></div>
        <div class="l"><span>Davon verkauft</span><span class="num">${sold.length}</span></div>
        <div class="l"><span>Davon offen</span><span class="num">${parsed.cards.length - sold.length}</span></div>
        <div class="total"><span>Gewinn (verkauft)</span>${profitHtml(sum(sold.map(c => profitOf(c.ek, c.vk))))}</div></div></div>
        ${parsed.skipped.length ? `<div class="group"><div class="gh">${parsed.skipped.length} Zeilen übersprungen</div><div class="calc">${parsed.skipped.slice(0, 15).map(s => `<div class="l"><span>Zeile ${s.line}</span><span>${esc(s.reason)}</span></div>`).join("")}</div></div>` : ""}
        <button class="primary" id="imp-go">${parsed.cards.length} Spieler importieren</button>
        <p class="hint">Ein erneuter Import derselben Datei überschreibt die Einträge, statt sie zu verdoppeln.</p>`
        : '<div class="err">In der Datei wurden keine Spieler gefunden. Erwartet wird der Reiter „Spieler“ mit den Spalten Name und EK.</div>';
      if ($("imp-go")) $("imp-go").onclick = async () => {
        $("imp-go").disabled = true; $("imp-go").textContent = "Wird importiert …";
        // Einkaufslisten-Status bereits vorhandener Karten beim erneuten Import behalten
        const prev = new Map(S.data.cards.map(c => [c.id, c]));
        await S.saveCards(parsed.cards.map(c => prev.get(c.id)?.restock ? { ...c, restock: prev.get(c.id).restock } : c)); closeSheet(); toast(`${parsed.cards.length} Spieler importiert`);
      };
    } catch (err) { $("imp-result").innerHTML = `<div class="err">Import fehlgeschlagen: ${esc(err.message)}</div>`; }
  };
}
function exportCSV() {
  const d = iso => iso ? fmtDate(parseDay(iso)).replace(/\.(\d\d)$/, ".20$1") : "";
  const lines = ["Name;Rating;Karte;ChemieStyle;EK;EK Datum;kalk. VK;VK;VK Datum;EA Tax;Gewinn;Marge %;Notiz"];
  for (const c of [...S.data.cards].sort((a, b) => a.ekDate.localeCompare(b.ekDate))) {
    const p = isSold(c) ? profitOf(c.ek, c.vk) : null;
    lines.push([c.name, c.rating, c.special ? "Special" : "Gold", c.chem, c.ek, d(c.ekDate), target(c.ek), c.vk ?? "", d(c.vkDate), isSold(c) ? tax(c.vk) : "",
      p ?? "", p != null ? (p / c.vk * 100).toFixed(1).replace(".", ",") : "", (c.notes || "").replace(/[\n;]/g, " ")].join(";"));
  }
  return lines.join("\n");
}

// ---------- Scan ----------
let scanTitle = "Screenshot wird ausgewertet";
function progress(text, frac) {
  let el = document.getElementById("progress");
  if (!el) { el = document.createElement("div"); el.id = "progress"; el.className = "progress";
    el.innerHTML = '<div class="box"><strong>' + scanTitle + '</strong><span class="meta" id="pg-text"></span><div class="track"><div class="fill" id="pg-fill"></div></div><span class="hint">Die Erkennung läuft auf deinem Gerät. Beim ersten Mal wird sie einmalig geladen.</span></div>';
    document.body.appendChild(el); }
  document.getElementById("pg-text").textContent = text;
  document.getElementById("pg-fill").style.width = Math.round(frac * 100) + "%";
}
const hideProgress = () => document.getElementById("progress")?.remove();

// ---------- Spieler per Screenshot auf Einkaufs-/Merkliste ----------
async function runWishScan(files) {
  scanTitle = "Spieler werden erkannt"; progress("Wird vorbereitet …", 0);
  try {
    const { scanWishFiles } = await import("./ocr.js");
    const found = await scanWishFiles(files, progress);
    hideProgress();
    if (!found.length) return toast("Auf dem Bild wurden keine Spieler erkannt", true);
    const known = knownNames();
    openWishScan(found.map(f => {
      const name = f.name ? canonicalName(f.name, known) : "";
      const last = name ? lastCard(name) : null;
      return { include: !!name, name, rating: f.rating ?? last?.rating ?? "", chem: last?.chem || "Basic", price: f.price ?? "" };
    }));
  } catch (e) { hideProgress(); toast("Erkennung fehlgeschlagen: " + e.message, true); }
}
function openWishScan(drafts) {
  let list = "buy";
  const dupText = d => { const on = d.name ? listsWith(d.name, +d.rating) : []; return on.length ? `<div class="warn">Steht schon auf der ${on.join(" und der ")}.</div>` : ""; };
  const draw = () => drafts.map((d, i) => `<div class="group ws-row" data-i="${i}">
    <div class="ws-line"><input type="checkbox" data-k="include" ${d.include ? "checked" : ""} aria-label="Übernehmen">
      <input data-k="name" value="${esc(d.name)}" list="known-names" placeholder="Name" aria-label="Name" class="ws-name"></div>
    <div class="ws-line"><input data-k="rating" inputmode="numeric" value="${d.rating}" placeholder="Rat." aria-label="Rating" class="ws-rat">
      <select data-k="chem" aria-label="Chemistry Style">${chemOptions(d.chem)}</select>
      <input data-k="price" inputmode="decimal" value="${d.price}" placeholder="Preis" aria-label="Preis" class="ws-price"></div>
    <label class="ws-line ws-sp"><input type="checkbox" data-k="special" ${d.special ? "checked" : ""}>Special-Karte</label>
    ${dupText(d)}</div>`).join("");
  const valid = d => d.name.trim() && +d.rating >= 1 && +d.rating <= 99 && (list === "watch" || parseCoins(d.price) > 0);
  const ready = () => drafts.filter(d => d.include && valid(d));
  const body = `<div class="form">
    <div id="ws-list">${seg([["buy", "Einkaufsliste"], ["watch", "Merkliste"]], list, "wl")}</div>
    <div class="chips" style="padding:0"><button type="button" class="chip" data-all="1">Alle auswählen</button><button type="button" class="chip" data-all="0">Keine</button></div>
    <div id="ws-rows">${draw()}</div>
    <datalist id="known-names">${knownNames().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <p class="hint">Bitte kurz prüfen: Name, Rating und Preis werden aus dem Bild gelesen, der Chemistry Style steht dort nicht – vorbelegt ist der zuletzt genutzte Style.
      Für die Einkaufsliste ist ein Preis nötig, für die Merkliste nicht.</p></div>`;
  const refresh = sheet(`${drafts.length} Spieler erkannt`, body, "Hinzufügen", async () => {
    let added = 0, skipped = 0;
    for (const d of ready()) {
      const on = listsWith(d.name.trim(), +d.rating);
      if (on.length && !await askYesNo(`<b>${esc(d.name)} ${d.rating}</b> steht schon auf der ${on.join(" und der ")}. Soll der Spieler ein zweites Mal auf die ${list === "watch" ? "Merkliste" : "Einkaufsliste"}?`)) { skipped++; continue; }
      S.saveWish({ id: S.newId(), name: d.name.trim(), rating: +d.rating, chem: d.chem, special: !!d.special, price: parseCoins(d.price) || 0, offer: null, qty: 1, list,
        owner: settings.name, createdAt: Date.now() + added });
      added++;
    }
    closeSheet();
    toast(`${added} Spieler auf die ${list === "watch" ? "Merkliste" : "Einkaufsliste"} gesetzt${skipped ? ` · ${skipped} übersprungen` : ""}`);
  }, () => ready().length > 0);
  const sheetEl = layer.querySelector(".sheet");
  sheetEl.addEventListener("click", e => {
    const b = e.target.closest("[data-wl]"), all = e.target.closest("[data-all]");
    if (b) { list = b.dataset.wl; $("ws-list").innerHTML = seg([["buy", "Einkaufsliste"], ["watch", "Merkliste"]], list, "wl"); refresh(); }
    if (all) { drafts.forEach(d => d.include = all.dataset.all === "1"); $("ws-rows").innerHTML = draw(); refresh(); }
  });
  $("ws-rows").addEventListener("input", e => {
    const g = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!g || !k) return;
    const d = drafts[+g.dataset.i]; d[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "name") { const l = lastCard(d.name); if (l) { if (!d.rating) d.rating = l.rating; d.chem = l.chem; } }
    refresh();
  });
  $("ws-rows").addEventListener("change", e => { if (["chem", "include", "name", "rating"].includes(e.target.dataset.k)) { $("ws-rows").innerHTML = draw(); refresh(); } });
}

async function runScan(files) {
  files = [...files];
  scanTitle = files.some(f => f.type.startsWith("video") || /\.(mov|mp4|m4v|webm)$/i.test(f.name || "")) ? "Video wird ausgewertet" : files.length > 1 ? "Screenshots werden ausgewertet" : "Screenshot wird ausgewertet";
  progress("Wird vorbereitet …", 0);
  try {
    const { scanFiles } = await import("./ocr.js");
    const res = await scanFiles(files, knownNames(), S.data.icons, progress);
    hideProgress();
    if (!res.items.length) { toast("Auf dem Bild wurden keine Spielerdaten erkannt", true); return openAdd(); }
    if (res.kind === "sale") openBulkSell(res.items); else openBulkAdd(res.items);
  } catch (e) { hideProgress(); toast("Scan fehlgeschlagen: " + e.message, true); }
}

function learnIcon(bits, style, recognized) {
  if (!bits || recognized === style) return;
  if (S.data.icons.filter(i => i.style === style).length >= 30) return;
  S.saveIcon({ id: S.newId(), style, hex: toHex(bits) });
}

function openBulkAdd(items) {
  const drafts = items.map(it => {
    const last = it.name ? lastCard(it.name) : null;
    const dup = it.name && it.price ? S.data.cards.find(c => sameName(c.name, it.name) && c.ek === it.price && daysBetween(parseDay(c.ekDate), new Date()) <= 1) : null;
    return { include: true, name: it.name || "", rating: it.rating ?? last?.rating ?? "", chem: it.chemistryStyle || last?.chem || "Basic", special: !!last?.special,
      price: it.price ?? "", recognized: it.chemistryStyle || null, bits: it.iconPrint || null, dup };
  });
  const draw = () => drafts.map((d, i) => `<div class="group" data-i="${i}">
    <label class="check"><input type="checkbox" data-k="include" ${d.include ? "checked" : ""}>${badge(+d.rating || 0, 1, d.special)}
      <div class="grow" style="min-width:0"><div class="name">${esc(d.name || "Name fehlt")}</div><div class="meta">${d.price ? "EK " + fmt(parseCoins(d.price) || 0) : "Preis fehlt"}</div></div></label>
    ${d.dup ? `<div class="warn">Heute schon erfasst: ${esc(d.dup.name)} zu ${fmt(d.dup.ek)} – bitte prüfen.</div>` : ""}
    <div class="field"><label>Name</label><input data-k="name" value="${esc(d.name)}" list="known-names"></div>
    <div class="field"><label>Rating</label><input data-k="rating" inputmode="numeric" value="${d.rating}"></div>
    <div class="field"><label>Chemistry Style</label><select data-k="chem">${chemOptions(d.chem)}</select></div>
    <label class="check"><input type="checkbox" data-k="special" ${d.special ? "checked" : ""}><span>Special-Karte</span><span class="hint" style="margin-left:auto">sonst Gold</span></label>
    ${d.bits ? (d.recognized && d.recognized === d.chem ? '<div class="ok">✓ Am Symbol auf der Karte erkannt</div>'
      : !d.recognized ? '<div class="warn">Symbol nicht sicher erkannt – bitte prüfen. Deine Auswahl wird gelernt.</div>' : "") : ""}
    <div class="field"><label>Einkaufspreis</label><input data-k="price" inputmode="decimal" value="${d.price}"></div>
    <div data-calc>${calcHtml(parseCoins(d.price), null)}</div></div>`).join("");
  const valid = d => d.name.trim() && +d.rating >= 1 && +d.rating <= 99 && parseCoins(d.price) > 0;
  const ready = () => drafts.filter(d => d.include && valid(d));
  const body = `<div class="form">
    <div class="group"><div class="field"><label for="b-date">Kaufdatum</label><input id="b-date" type="date" value="${toISODate(new Date())}"></div></div>
    <div id="b-list">${draw()}</div>
    <datalist id="known-names">${knownNames().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <p class="hint">Chemistry Style wird am Symbol erkannt. Ist das unsicher, ist der zuletzt genutzte Stil des Spielers vorbelegt.</p></div>`;
  const refresh = sheet(drafts.length === 1 ? "Kauf prüfen" : `${drafts.length} Käufe prüfen`, body, "Sichern", () => {
    const date = $("b-date").value || toISODate(new Date());
    let ticked = 0;
    for (const d of ready()) {
      learnIcon(d.bits, d.chem, d.recognized);
      const card = { id: S.newId(), name: d.name.trim(), rating: +d.rating, chem: d.chem, special: !!d.special, ek: parseCoins(d.price), ekDate: date,
        vk: null, vkDate: null, owner: settings.name, notes: "", createdAt: Date.now() };
      S.saveCard(card);
      if (consumeRestock(card)) ticked++;
    }
    closeSheet();
    toast((ready().length > 1 ? `${ready().length} Käufe gespeichert` : "Kauf gespeichert") + (ticked ? ` · ${ticked} auf der Einkaufsliste abgehakt` : ""));
  }, () => ready().length > 0);
  $("b-list").addEventListener("input", e => {
    const g = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!g || !k) return;
    const d = drafts[+g.dataset.i];
    d[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "name") { const l = lastCard(d.name); if (l && !d.rating) d.rating = l.rating; }
    if (k === "price") g.querySelector("[data-calc]").innerHTML = calcHtml(parseCoins(d.price), null);
    refresh();
  });
  $("b-list").addEventListener("change", e => { if (["chem", "include", "special"].includes(e.target.dataset.k)) { $("b-list").innerHTML = draw(); refresh(); } });
}

function openBulkSell(items) {
  const used = new Set();
  const drafts = items.map(it => {
    const name = it.name || "";
    const card = openCardsFor(name, it.rating).find(c => !used.has(c.id));
    if (card) used.add(card.id);
    const dup = it.price ? S.data.cards.find(c => isSold(c) && c.vk === it.price && sameName(c.name, name) && daysBetween(parseDay(c.vkDate), new Date()) <= 1) : null;
    return { include: !!card && !dup, name, rating: it.rating, price: it.price ?? "", cardId: card?.id || null, dup };
  });
  const cardOf = d => S.data.cards.find(c => c.id === d.cardId);
  const draw = () => drafts.map((d, i) => {
    const m = cardOf(d), cands = openCardsFor(d.name, d.rating);
    return `<div class="group" data-i="${i}">
      <label class="check"><input type="checkbox" data-k="include" ${d.include ? "checked" : ""} ${m ? "" : "disabled"}>${badge(m?.rating || d.rating || 0, 1, m?.special)}
        <div class="grow" style="min-width:0"><div class="name">${esc(m?.name || d.name || "Name fehlt")}</div>
        <div class="meta" style="${m ? "" : "color:var(--warn)"}">${m ? `${esc(m.chem)} · EK ${fmt(m.ek)} · ${fmtDate(parseDay(m.ekDate))}` : "Kein offener Kauf gefunden"}</div></div></label>
      ${d.dup ? `<div class="warn">Evtl. schon verbucht: ${esc(d.dup.name)} zu ${fmt(d.dup.vk)} am ${fmtDate(parseDay(d.dup.vkDate))}.</div>` : ""}
      ${m && cands.length > 1 ? `<div class="field"><label>Kauf</label><select data-k="cardId">${cands.map(c =>
        `<option value="${c.id}" ${c.id === d.cardId ? "selected" : ""}>${c.rating} · EK ${fmt(c.ek)} · ${fmtDate(parseDay(c.ekDate))}</option>`).join("")}</select></div>` : ""}
      ${m ? `<div class="field"><label>Verkaufspreis</label><input data-k="price" inputmode="decimal" value="${d.price}"></div>
      ${calcHtml(m.ek, parseCoins(d.price))}` : ""}</div>`;
  }).join("");
  const ready = () => drafts.filter(d => d.include && cardOf(d) && parseCoins(d.price) > 0);
  const body = `<div class="form">
    <div class="group"><div class="field"><label for="v-date">Verkaufsdatum</label><input id="v-date" type="date" value="${toISODate(new Date())}"></div></div>
    <div id="v-list">${draw()}</div>
    <p class="hint">Jeder Verkauf wird dem ältesten offenen Kauf dieses Spielers zugeordnet. Chemistry Style und EK kommen aus dem Kauf.</p></div>`;
  const refresh = sheet(drafts.length === 1 ? "Verkauf prüfen" : `${drafts.length} Verkäufe prüfen`, body, "Verbuchen", () => {
    const date = $("v-date").value || toISODate(new Date());
    let total = 0, at = Date.now();
    for (const d of ready()) { const c = cardOf(d), vk = parseCoins(d.price); total += profitOf(c.ek, vk); saveSale({ ...c, vk, vkDate: date, soldAt: at++, restock: "open", marketEk: null }); }
    closeSheet(); toast(`Verbucht · Gewinn ${signed(total)}`);
  }, () => ready().length > 0);
  $("v-list").addEventListener("input", e => {
    const g = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!g || !k) return;
    const d = drafts[+g.dataset.i];
    d[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "price") { const box = g.querySelector(".calc"); const m = cardOf(d); if (box && m) box.outerHTML = calcHtml(m.ek, parseCoins(d.price)) || "<div class='calc'></div>"; }
    refresh();
  });
  $("v-list").addEventListener("change", e => { if (e.target.dataset.k === "cardId") { $("v-list").innerHTML = draw(); refresh(); } });
}

// ---------- Start ----------
let unsub = null;
async function start() {
  if (unsub) { unsub(); unsub = null; }
  closeSheet();
  if (!settings.name || !settings.depot) return renderOnboarding();
  renderShell();
  let mergeTimer = 0; // erst nach dem laufenden Speichervorgang abgleichen
  unsub = S.subscribe(() => { clearTimeout(mergeTimer); mergeTimer = setTimeout(mergePlannedRestock, 50); render(); });
  await S.connect({ config: CLOUD ? window.FIREBASE_CONFIG : null, depot: settings.depot, demoSeed });
  render();
}
start();
