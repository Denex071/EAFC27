// FC Trader – Web-App (Oberfläche)

import * as S from "./store.js";
import { STYLES, TIERS, MARKUP_ABOVE, tax, profitOf, target, breakEven, fmt, signed, compact, pct, parseCoins,
  DAY, dOnly, toISODate, parseDay, fmtDate, fmtShort, daysBetween, holdText, isoWeek } from "./calc.js";
import { nameKey, similarKeys } from "./parser.js";
import { toHex } from "./chemicons.js";

const VERSION = "1.1.4";

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
    ["Osimhen", 86, "Finisher", 3100, 1, null, null], ["Kimmich", 88, "Shadow", 9600, 1, null, null], ["Katoto", 86, "Hawk", 5800, 0, null, null],
  ];
  return {
    cards: rows.map((r, i) => ({ id: "demo" + i, name: r[0], rating: r[1], chem: r[2], ek: r[3], ekDate: d(r[4]),
      vk: r[5], vkDate: r[6] != null ? d(r[6]) : null, owner: "Demo", notes: "", createdAt: Date.now() - r[4] * DAY })),
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
    const s = byName[c.name] || (byName[c.name] = { name: c.name, rating: 0, n: 0, vk: 0, profit: 0, hold: 0 });
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
const restockOpen = () => S.data.cards.filter(c => isSold(c) && !c.restock && !String(c.id).startsWith("import-"));
const restockKey = c => `${nameKey(c.name)}|${c.rating}|${c.chem}`;
function restockGroups() {
  const groups = new Map();
  for (const c of restockOpen().sort((a, b) => a.vkDate.localeCompare(b.vkDate))) {
    const k = restockKey(c);
    if (!groups.has(k)) groups.set(k, { key: k, items: [] });
    groups.get(k).items.push(c);
  }
  return [...groups.values()].map(g => {
    const newest = g.items[g.items.length - 1];
    return { ...g, name: newest.name, rating: newest.rating, chem: newest.chem, lastEk: newest.ek, lastVk: newest.vk, soldOn: newest.vkDate };
  }).sort((a, b) => b.soldOn.localeCompare(a.soldOn) || a.name.localeCompare(b.name));
}
/// Neuer Kauf erfasst → passenden offenen Listeneintrag (gleicher Spieler & Rating, bevorzugt gleicher Stil) abhaken.
function consumeRestock(card) {
  const match = restockOpen().filter(c => sameName(c.name, card.name) && c.rating === card.rating)
    .sort((a, b) => (a.chem !== card.chem) - (b.chem !== card.chem) || a.vkDate.localeCompare(b.vkDate))[0];
  if (match) S.saveCard({ ...match, restock: "done" });
  return !!match;
}

// ---------- Bausteine ----------
const badgeClass = r => r >= 86 ? "b-special" : r >= 75 ? "b-gold" : r >= 65 ? "b-silver" : "b-bronze";
const badge = (r, sm) => `<div class="badge ${sm ? "sm" : ""} ${badgeClass(r)} num">${r || "–"}</div>`;
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
const ui = { tab: LS.get("fct-tab") || "dash", period: "all", filter: "open", sort: "newest", q: "", sel: 9 };
const TITLES = { dash: "Übersicht", list: "Spieler", buy: "Einkauf", wealth: "Vermögen", more: "Einstellungen" };
const TABS = ["dash", "list", "buy", "wealth", "more"];
const ICONS = {
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  buy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
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
  document.getElementById("view").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".item[tabindex]")) e.target.click(); });
}

function render() {
  const view = document.getElementById("view");
  if (!view) return;
  document.getElementById("title").textContent = ui.tab === "dash" ? "EA FC 27 Trading" : TITLES[ui.tab];
  root.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === ui.tab ? "page" : "false"));
  const badge = root.querySelector('[data-badge="buy"]');
  const openBuys = restockOpen().length;
  badge.hidden = !openBuys; badge.textContent = openBuys > 99 ? "99+" : openBuys;
  const top = [];
  if (S.data.error) top.push(`<div class="err">${esc(S.data.error)}</div>`);
  if (S.data.mode === "demo") top.push(`<div class="banner">Demo-Modus – Daten bleiben nur in diesem Browser.</div>`);
  if (!S.data.ready) { view.innerHTML = top.join("") + `<div class="empty">Daten werden geladen …</div>`; return; }
  view.innerHTML = top.join("") + ({ dash: dashHtml, list: listHtml, buy: buyHtml, wealth: wealthHtml, more: moreHtml })[ui.tab || "dash"]();
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
    <section class="hero ${s.realized < 0 ? "neg" : ""}"><div class="lbl">Gesamtgewinn · ${per}</div>
      <div class="big num">${signed(s.realized)}</div><div class="sub">aus ${s.sold.length} Verkäufen · ${s.open.length} Spieler offen</div></section>
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
    <section class="card"><h2>Gewinn pro Woche</h2>${s.weeks.slice(0, 6).map((w, i) => `${i ? '<div class="divider"></div>' : ""}
      <div class="row"><div class="grow"><div class="name">KW ${isoWeek(w.start)}</div><div class="meta">${fmtShort(w.start)} – ${fmtShort(new Date(+w.start + 6 * DAY))}</div></div>
      <span class="meta">${w.n} VK</span>${profitHtml(w.profit)}</div>`).join("") || '<div class="empty">Noch keine Verkäufe.</div>'}</section>
    <section class="card"><div class="head"><h2>Top-Spieler · ${per}</h2>${s.players.length ? `<button class="mini" data-act="ranking">Alle ${s.players.length}</button>` : ""}</div>
      ${s.players.slice(0, 5).map((p, i) => playerRow(p, i + 1)).join("") || '<div class="empty">Keine Verkäufe im Zeitraum.</div>'}</section>
    ${s.best ? `<section class="card"><h2>Top &amp; Flop</h2>${flip(s.best, "Bester Verkauf")}${s.worst ? '<div class="divider"></div>' + flip(s.worst, "Schwächster Verkauf") : ""}</section>` : ""}
    ${s.longest.length ? `<section class="card"><h2>Am längsten im Club</h2>${s.longest.map(c => `
      <div class="row">${badge(c.rating, 1)}<div class="grow"><div class="name">${esc(c.name)}</div>
      <div class="meta">seit ${heldSince(c.ekDate)} · kalk. VK ${fmt(target(c.ek))} · BE ${fmt(breakEven(c.ek))}</div></div>
      <button class="mini gold" data-sell="${c.id}">Verkaufen</button></div>`).join("")}</section>` : ""}`;
}
const flip = (f, label) => `<div class="row">${badge(f.c.rating, 1)}<div class="grow"><div class="meta">${label}</div><div class="name">${esc(f.c.name)}</div></div>${profitHtml(f.p)}</div>`;
const playerRow = (p, rank) => `<div class="row"><span class="meta num" style="width:18px;text-align:right">${rank}</span>${badge(p.rating, 1)}
  <div class="grow"><div class="name">${esc(p.name)}</div><div class="meta">${p.n}× verkauft · VK ${compact(p.vk)} · Ø ${signed(p.avg)}</div></div>${profitHtml(p.profit)}</div>`;

function dayChart(days) {
  const W = 340, H = 170, L = 44, B = 22, T = 10;
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

function listHtml() {
  const cards = S.data.cards;
  const counts = { open: cards.filter(c => !isSold(c)).length, sold: cards.filter(isSold).length, all: cards.length };
  const today = toISODate(new Date());
  const list = cards.filter(c => ui.filter === "all" || (ui.filter === "open") !== isSold(c))
    .filter(c => !ui.q || (c.name + " " + c.chem).toLowerCase().includes(ui.q.toLowerCase()));
  const key = { newest: c => -parseDay(c.vkDate || c.ekDate), profit: c => isSold(c) ? -profitOf(c.ek, c.vk) : 1e12,
    rating: c => -c.rating, price: c => -c.ek, hold: c => -daysBetween(parseDay(c.ekDate), parseDay(c.vkDate || today)) };
  list.sort((a, b) => key[ui.sort](a) - key[ui.sort](b));
  const shown = list.slice(0, 200);
  return `${seg([["open", `Offen (${counts.open})`], ["sold", `Verkauft (${counts.sold})`], ["all", `Alle (${counts.all})`]], ui.filter, "filter")}
    <div class="search"><input id="q" type="search" placeholder="Spieler oder Chemistry Style" value="${esc(ui.q)}" aria-label="Suchen">
      <select id="sort" aria-label="Sortierung">${[["newest", "Neueste"], ["profit", "Gewinn"], ["rating", "Rating"], ["price", "Preis"], ["hold", "Haltedauer"]]
        .map(([k, l]) => `<option value="${k}" ${k === ui.sort ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="list">${shown.map(c => {
      const p = isSold(c) ? profitOf(c.ek, c.vk) : null;
      return `<div class="item" tabindex="0" data-edit="${c.id}">${badge(c.rating)}
        <div class="grow" style="min-width:0"><div class="name">${esc(c.name)}</div><div class="meta">${esc(c.chem)} · ${fmtDate(parseDay(c.ekDate))}</div></div>
        <div class="right">${p != null ? `${profitHtml(p)}<div class="meta num">${compact(c.ek)} → ${compact(c.vk)}</div>`
          : `<div class="num" style="font-weight:700">${fmt(c.ek)}</div><div class="meta num">kalk. VK ${compact(target(c.ek))} · ${heldSince(c.ekDate)}</div>`}</div>
        ${p == null ? `<button class="mini gold" data-sell="${c.id}">VK</button>` : ""}</div>`;
    }).join("") || '<div class="empty">Keine Spieler gefunden.</div>'}</div>
    ${list.length > shown.length ? `<div class="hint">Die ersten ${shown.length} von ${list.length}. Suche oder Filter grenzt weiter ein.</div>` : ""}
    ${list.length ? `<div class="sumbar"><span>${list.length} Spieler</span><span class="num">${ui.filter === "open"
      ? `EK ${compact(sum(list.map(c => c.ek)))} · kalk. VK ${compact(sum(list.map(c => target(c.ek))))}`
      : `Gewinn ${profitHtml(sum(list.filter(isSold).map(c => profitOf(c.ek, c.vk))))}`}</span></div>` : ""}`;
}
function bindListInputs() {
  const q = document.getElementById("q");
  q.oninput = () => { ui.q = q.value; const pos = q.selectionStart; render(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); };
  document.getElementById("sort").onchange = e => { ui.sort = e.target.value; render(); };
}

function buyHtml() {
  const groups = restockGroups();
  if (!groups.length) return `<section class="card"><h2>Alles nachgekauft</h2>
    <p class="meta" style="white-space:normal;margin:0">Sobald ihr eine Karte als verkauft markiert, erscheint sie hier mit Name, Rating, Chemistry Style und letztem EK – zum Nachkaufen.</p></section>`;
  const count = sum(groups.map(g => g.items.length));
  const budget = sum(groups.map(g => g.lastEk * g.items.length));
  return `<section class="tiles">
      <div class="tile"><div class="t">Nachzukaufen</div><div class="v num">${count}</div><div class="d">${groups.length} verschiedene Karten</div></div>
      <div class="tile"><div class="t">Budget (letzter EK)</div><div class="v num">${fmt(budget)}</div><div class="d">Coins für alle Käufe</div></div></section>
    <div class="list">${groups.map(g => `<div class="item" style="cursor:default">
      ${badge(g.rating)}
      <div class="grow" style="min-width:0"><div class="name">${esc(g.name)}${g.items.length > 1 ? ` <span class="gold-text">×${g.items.length}</span>` : ""}</div>
        <div class="meta">${esc(g.chem)} · EK ${fmt(g.lastEk)} · VK ${compact(g.lastVk)} am ${fmtShort(parseDay(g.soldOn))}</div></div>
      <div class="right" style="display:flex;gap:6px">
        <button class="mini" data-skip="${esc(g.key)}" aria-label="Überspringen" title="Überspringen">✕</button>
        <button class="mini gold" data-buy="${esc(g.key)}">Gekauft</button></div></div>`).join("")}</div>
    <p class="hint">„Gekauft“ speichert die Karte als neuen Kauf – nur den EK anpassen. Käufe über + oder per Screenshot haken passende Einträge automatisch ab.</p>`;
}

function openBuy(key) {
  const g = restockGroups().find(x => x.key === key); if (!g) return;
  const step = p => p < 1000 ? 50 : p < 10000 ? 100 : p < 50000 ? 250 : p < 100000 ? 500 : 1000;
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(g.rating)}<div class="grow" style="min-width:0"><div class="name">${esc(g.name)}</div>
      <div class="meta">zuletzt EK ${fmt(g.lastEk)} · VK ${fmt(g.lastVk)}</div></div></div></div>
    <div class="group"><div class="gh">Nachkauf</div>
      <div class="field"><label for="k-ek">Einkaufspreis</label><input id="k-ek" inputmode="decimal" value="${g.lastEk}"></div>
      <div class="chips"><button type="button" class="chip" data-d="-1">− Stufe</button><button type="button" class="chip" data-d="1">+ Stufe</button>
        <button type="button" class="chip" data-d="0">Letzter EK</button><button type="button" class="chip" data-app="000">+000</button></div>
      ${g.items.length > 1 ? `<div class="field"><label for="k-qty">Anzahl</label><select id="k-qty">${g.items.map((_, i) => `<option ${i === 0 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>` : ""}
      <div class="field"><label for="k-chem">Chemistry Style</label><select id="k-chem">${chemOptions(g.chem)}</select></div>
      <div class="field"><label for="k-date">Kaufdatum</label><input id="k-date" type="date" value="${toISODate(new Date())}"></div>
      <div id="k-calc"></div></div></div>`;
  const qty = () => $("k-qty") ? +$("k-qty").value : 1;
  const refresh = sheet("Nachkauf erfassen", body, "Gekauft", () => {
    const ek = parseCoins($("k-ek").value), n = qty();
    for (let i = 0; i < n; i++) {
      S.saveCard({ id: S.newId(), name: g.name, rating: g.rating, chem: $("k-chem").value, ek, ekDate: $("k-date").value || toISODate(new Date()),
        vk: null, vkDate: null, owner: settings.name, notes: "", createdAt: Date.now() + i });
      S.saveCard({ ...g.items[i], restock: "done" });
    }
    closeSheet(); toast(n > 1 ? `${n}× ${g.name} nachgekauft` : `${g.name} nachgekauft`);
  }, () => parseCoins($("k-ek").value) > 0);
  const upd = () => { $("k-calc").innerHTML = calcHtml(parseCoins($("k-ek").value), null); refresh(); };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const d = e.target.closest("[data-d]"), a = e.target.closest("[data-app]");
    if (d) { const v = parseCoins($("k-ek").value) || g.lastEk; $("k-ek").value = +d.dataset.d === 0 ? g.lastEk : Math.max(150, v + +d.dataset.d * step(v)); }
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
    <section class="card"><h2>Daten</h2>
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

function onViewClick(e) {
  const t = e.target;
  const sell = t.closest("[data-sell]"); if (sell) { e.stopPropagation(); return openSell(S.data.cards.find(c => c.id === sell.dataset.sell)); }
  const p = t.closest("[data-period]"); if (p) { ui.period = p.dataset.period; return render(); }
  const f = t.closest("[data-filter]"); if (f) { ui.filter = f.dataset.filter; return render(); }
  const d = t.closest("[data-day]"); if (d) { ui.sel = +d.dataset.day; return render(); }
  const ed = t.closest("[data-edit]"); if (ed) return openAdd(S.data.cards.find(c => c.id === ed.dataset.edit));
  const sn = t.closest("[data-snap]"); if (sn) return openSnap(S.data.snaps.find(s => s.id === sn.dataset.snap));
  const buy = t.closest("[data-buy]"); if (buy) return openBuy(buy.dataset.buy);
  const skip = t.closest("[data-skip]");
  if (skip) return confirmButton(skip, "Überspringen?", () => {
    const g = restockGroups().find(x => x.key === skip.dataset.skip);
    if (g) { S.saveCard({ ...g.items[0], restock: "skip" }); toast(`${g.name} von der Liste genommen`); }
  });
  const a = t.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (act === "ranking") openRanking();
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
    Object.assign(card, { name: $("f-name").value.trim(), rating: +$("f-rating").value, chem: $("f-chem").value,
      ek: parseCoins($("f-ek").value), ekDate: $("f-ekd").value || toISODate(new Date()), notes: $("f-notes").value.trim() });
    if (existing) { const vk = parseCoins($("f-vk").value); card.vk = vk || null; card.vkDate = vk ? ($("f-vkd").value || toISODate(new Date())) : null; }
    else { card.vk = null; card.vkDate = null; }
    S.saveCard(card);
    if (!existing && consumeRestock(card)) toast(`${card.name} auf der Einkaufsliste abgehakt`);
  }
  layer.querySelector(".sheet").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.name) { const l = lastCard(t.dataset.name); $("f-name").value = t.dataset.name; if (l) { $("f-rating").value = l.rating; $("f-chem").value = l.chem; } $("f-ek").focus(); }
    if (t.dataset.chem) $("f-chem").value = t.dataset.chem;
    if (t.dataset.app) { $("f-ek").value += t.dataset.app; $("f-ek").focus(); }
    if (t.id === "f-next") { save(); toast("Gespeichert – nächste Karte"); ["f-name", "f-rating", "f-ek", "f-notes"].forEach(i => $(i).value = ""); $("f-name").focus(); }
    if (t.id === "f-del") return confirmButton(t, "Wirklich löschen?", () => { S.deleteCard(existing.id); closeSheet(); toast("Gelöscht"); });
    update();
  });
  $("f").addEventListener("input", update);
  $("f").addEventListener("change", update);
  $("f").addEventListener("submit", e => e.preventDefault());
  update();
}

function openSell(card, presetPrice) {
  const chips = [["ziel", "kalk. VK " + compact(target(card.ek))], ["0", "Break-even"], ["0.1", "+10 %"], ["0.2", "+20 %"]];
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(card.rating)}<div class="grow" style="min-width:0"><div class="name">${esc(card.name)}</div>
      <div class="meta">${esc(card.chem)} · EK ${fmt(card.ek)} · ${fmtDate(parseDay(card.ekDate))}</div></div></div></div>
    <div class="group"><div class="gh">Verkauf</div>
      <div class="field"><label for="s-vk">Verkaufspreis</label><input id="s-vk" inputmode="decimal" placeholder="0" value="${presetPrice ?? ""}"></div>
      <div class="chips">${chips.map(([k, l]) => `<button type="button" class="chip" data-m="${k}">${l}</button>`).join("")}<button type="button" class="chip" data-app="000">+000</button></div>
      <div class="field"><label for="s-date">Verkaufsdatum</label><input id="s-date" type="date" value="${toISODate(new Date())}"></div></div>
    <div class="group"><div class="gh">Abrechnung</div><div id="s-calc"></div></div>
    <p class="hint">kalk. VK = kalkulierter VK laut eurer Aufschlagstabelle. Die %-Chips setzen den Preis, der nach 5 % Tax die Marge bringt.</p></div>`;
  const refresh = sheet("Verkaufen", body, "Verkauft", () => {
    const vk = parseCoins($("s-vk").value);
    S.saveCard({ ...card, vk, vkDate: $("s-date").value || toISODate(new Date()) });
    closeSheet(); toast("Verkauft: " + signed(profitOf(card.ek, vk)));
  }, () => parseCoins($("s-vk").value) > 0);
  const upd = () => { $("s-calc").innerHTML = calcHtml(card.ek, parseCoins($("s-vk").value)) || '<div class="calc"><div class="l">Preis eingeben</div></div>'; refresh(); };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const m = e.target.closest("[data-m]"), a = e.target.closest("[data-app]");
    if (m) $("s-vk").value = m.dataset.m === "ziel" ? target(card.ek) : breakEven(card.ek, +m.dataset.m);
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

function openRanking() {
  const s = stats(S.data.cards, ui.period);
  sheet("Spieler-Ranking", `<div class="form"><div class="list">${s.players.map((p, i) => `<div class="item" style="cursor:default">
    <span class="meta num" style="width:22px;text-align:right">${i + 1}</span>${badge(p.rating, 1)}
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
        await S.saveCards(parsed.cards); closeSheet(); toast(`${parsed.cards.length} Spieler importiert`);
      };
    } catch (err) { $("imp-result").innerHTML = `<div class="err">Import fehlgeschlagen: ${esc(err.message)}</div>`; }
  };
}
function exportCSV() {
  const d = iso => iso ? fmtDate(parseDay(iso)).replace(/\.(\d\d)$/, ".20$1") : "";
  const lines = ["Name;Rating;ChemieStyle;EK;EK Datum;kalk. VK;VK;VK Datum;EA Tax;Gewinn;Marge %;Notiz"];
  for (const c of [...S.data.cards].sort((a, b) => a.ekDate.localeCompare(b.ekDate))) {
    const p = isSold(c) ? profitOf(c.ek, c.vk) : null;
    lines.push([c.name, c.rating, c.chem, c.ek, d(c.ekDate), target(c.ek), c.vk ?? "", d(c.vkDate), isSold(c) ? tax(c.vk) : "",
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
    return { include: true, name: it.name || "", rating: it.rating ?? last?.rating ?? "", chem: it.chemistryStyle || last?.chem || "Basic",
      price: it.price ?? "", recognized: it.chemistryStyle || null, bits: it.iconPrint || null, dup };
  });
  const draw = () => drafts.map((d, i) => `<div class="group" data-i="${i}">
    <label class="check"><input type="checkbox" data-k="include" ${d.include ? "checked" : ""}>${badge(+d.rating || 0, 1)}
      <div class="grow" style="min-width:0"><div class="name">${esc(d.name || "Name fehlt")}</div><div class="meta">${d.price ? "EK " + fmt(parseCoins(d.price) || 0) : "Preis fehlt"}</div></div></label>
    ${d.dup ? `<div class="warn">Heute schon erfasst: ${esc(d.dup.name)} zu ${fmt(d.dup.ek)} – bitte prüfen.</div>` : ""}
    <div class="field"><label>Name</label><input data-k="name" value="${esc(d.name)}" list="known-names"></div>
    <div class="field"><label>Rating</label><input data-k="rating" inputmode="numeric" value="${d.rating}"></div>
    <div class="field"><label>Chemistry Style</label><select data-k="chem">${chemOptions(d.chem)}</select></div>
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
      const card = { id: S.newId(), name: d.name.trim(), rating: +d.rating, chem: d.chem, ek: parseCoins(d.price), ekDate: date,
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
  $("b-list").addEventListener("change", e => { if (e.target.dataset.k === "chem" || e.target.dataset.k === "include") { $("b-list").innerHTML = draw(); refresh(); } });
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
      <label class="check"><input type="checkbox" data-k="include" ${d.include ? "checked" : ""} ${m ? "" : "disabled"}>${badge(m?.rating || d.rating || 0, 1)}
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
    let total = 0;
    for (const d of ready()) { const c = cardOf(d), vk = parseCoins(d.price); total += profitOf(c.ek, vk); S.saveCard({ ...c, vk, vkDate: date }); }
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
  unsub = S.subscribe(() => render());
  await S.connect({ config: CLOUD ? window.FIREBASE_CONFIG : null, depot: settings.depot, demoSeed });
  render();
}
start();
