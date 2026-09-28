// Denex Trading – Web-App (Oberfläche)

import * as S from "./store.js";
import * as cloud from "./cloud.js";
import { STYLES, TIERS, MARKUP_ABOVE, tax, profitOf, target, breakEven, fmt, signed, compact, pct, parseCoins,
  DAY, dOnly, toISODate, parseDay, fmtDate, fmtShort, daysBetween, holdText, isoWeek, priceStep, setTiers, DEFAULT_TIERS, DEFAULT_ABOVE } from "./calc.js";
import * as I from "./insights.js";
import { nameKey, similarKeys } from "./parser.js";
import { toHex } from "./chemicons.js";

const VERSION = "0.2.0-beta";
const APP = "Denex Trading";

// ---------- Einstellungen (pro Gerät) ----------
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
};
const settings = { name: LS.get("dxt-name") || "", depot: "" };
const CLOUD = cloud.enabled();
/// Angemeldetes Konto: { user, profile: { depotId, ownDepotId, name, email, depot } }
const account = { user: null, profile: null };

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
// Auf der Einkaufsliste: in der App verkaufte Karten ("open")
const onRestock = c => isSold(c) && (c.restock === "open" || (!c.restock && !String(c.id).startsWith("import-")));
const restockOpen = () => S.data.cards.filter(onRestock);
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
    <div class="l"><span>Tax (5 %)</span><span class="num">−${fmt(tax(vk))}</span></div>
    <div class="l"><span>Einkaufspreis</span><span class="num">−${fmt(ek)}</span></div>
    <div class="total"><span>Gewinn</span>${profitHtml(p)}</div>
    <div class="l"><span></span><span class="num">${pct(p / ek)} auf EK</span></div></div>`;
}

// ---------- Onboarding ----------
const legalLinks = `<p class="hint" style="text-align:center"><a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></p>`;
function renderAuth(mode = "login", note = "") {
  const reg = mode === "register", reset = mode === "reset";
  root.innerHTML = `<div class="onb">
    <img src="icons/icon-192.png" alt="" width="72" height="72" style="border-radius:18px">
    <h1>${APP}</h1>
    <p class="lead">Dein Trading-Tracker: Käufe und Verkäufe per Screenshot erfassen, Gewinn nach Tax, Nachkauf-Liste und Statistiken.</p>
    ${CLOUD ? "" : `<div class="banner">Konten sind noch nicht eingerichtet. Du kannst die App im Demo-Modus ausprobieren; Daten bleiben dann nur in diesem Browser.</div>`}
    ${note ? `<div class="banner" style="border-style:solid">${esc(note)}</div>` : ""}
    ${CLOUD ? `<form id="a-form" class="form" autocomplete="on">
      <div class="group">
        ${reg ? `<div class="field"><label for="a-name">Name</label><input id="a-name" autocomplete="nickname" placeholder="z. B. Denis" required></div>` : ""}
        <div class="field"><label for="a-mail">E-Mail</label><input id="a-mail" type="email" autocomplete="email" inputmode="email" required></div>
        ${reset ? "" : `<div class="field"><label for="a-pw">Passwort</label><input id="a-pw" type="password" autocomplete="${reg ? "new-password" : "current-password"}" minlength="6" required></div>`}</div>
      ${reg ? `<label class="check" style="border:0;padding:0 4px"><input type="checkbox" id="a-ok" required><span class="meta" style="white-space:normal">Ich habe die <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a> gelesen.</span></label>` : ""}
      <button class="primary" type="submit" id="a-go">${reg ? "Konto erstellen" : reset ? "Link zum Zurücksetzen senden" : "Anmelden"}</button>
      <div id="a-err"></div></form>
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        ${reg || reset ? `<button class="link" data-mode="login">Schon ein Konto? Anmelden</button>` : `<button class="link" data-mode="register">Neues Konto erstellen</button><button class="link" data-mode="reset">Passwort vergessen?</button>`}</div>` : ""}
    <button class="${CLOUD ? "link" : "primary"}" id="a-demo" style="align-self:center">Ohne Konto ausprobieren (Beispieldaten)</button>
    ${legalLinks}
  </div>`;
  root.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => renderAuth(b.dataset.mode));
  document.getElementById("a-demo").onclick = () => { LS.set("dxt-demo", "1"); if (!settings.name) settings.name = "Ich"; openApp("DEMO"); };
  const form = document.getElementById("a-form"); if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById("a-go"), err = document.getElementById("a-err"), label = btn.textContent;
    const mail = document.getElementById("a-mail").value, pw = document.getElementById("a-pw")?.value || "";
    btn.disabled = true; btn.textContent = "Einen Moment …"; err.innerHTML = "";
    try {
      if (reset) { await cloud.resetPassword(mail); return renderAuth("login", "Falls ein Konto existiert, ist eine E-Mail zum Zurücksetzen unterwegs."); }
      if (reg) {
        const name = document.getElementById("a-name").value.trim();
        if (!name) throw new Error("Bitte einen Namen eingeben.");
        settings.name = name; LS.set("dxt-name", name); pendingName = name;
        await cloud.register(mail, pw, name);
      } else await cloud.login(mail, pw);
      // weiter geht es in onUser → ensureProfile
    } catch (x) { err.innerHTML = `<div class="err">${esc(cloud.message(x))}</div>`; btn.disabled = false; btn.textContent = label; }
  };
}
let pendingName = "";

// ---------- Hauptansicht ----------
const ui = { tab: LS.get("dxt-tab") || "dash", period: "all", filter: "open", sort: "newest", q: "", sel: 9, wsel: 7,
  dim: LS.get("dxt-dim") || "price", range: "all" };
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
    ui.tab = b.dataset.tab; LS.set("dxt-tab", ui.tab); render(); scrollTo(0, 0);
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
  document.getElementById("title").textContent = ui.tab === "dash" ? APP : TITLES[ui.tab];
  root.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === ui.tab ? "page" : "false"));
  const badge = root.querySelector('[data-badge="buy"]');
  const openBuys = restockOpen().length;
  badge.hidden = !openBuys; badge.textContent = openBuys > 99 ? "99+" : openBuys;
  const top = [];
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
  view.innerHTML = top.join("") + ({ dash: dashHtml, list: listHtml, buy: buyHtml, wealth: wealthHtml, more: moreHtml })[ui.tab || "dash"]();
  if (ui.tab === "list") bindListInputs();
}

function dashHtml() {
  const s = stats(S.data.cards, ui.period);
  const tile = (t, v, d) => `<div class="tile"><div class="t">${t}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`;
  const per = PERIODS.find(p => p[0] === ui.period)[1];
  if (!S.data.cards.length) return firstStepsHtml();
  return `${seg(PERIODS, ui.period, "period")}
    ${backupDue() ? `<div class="banner" style="display:flex;gap:10px;align-items:center;border-style:solid"><span class="grow" style="flex:1">Letzte Sicherung ${backupAge()}. Einmal pro Woche ein Backup herunterladen.</span>
      <button class="mini gold" data-act="backup">Backup</button></div>` : ""}
    <section class="hero ${s.realized < 0 ? "neg" : ""}"><div class="lbl">Gesamtgewinn · ${per}</div>
      <div class="big num">${signed(s.realized)}</div><div class="sub">aus ${s.sold.length} Verkäufen · ${s.open.length} Spieler offen</div></section>
    ${goalHtml()}
    ${staleHtml()}
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
      ${tile("Tax bezahlt", fmt(s.taxPaid), "5 % auf Verkäufe")}
    </section>
    <section class="card"><div class="head"><h2>Gewinn pro Tag</h2><span class="hint">letzte 10 Tage</span></div>${dayChart(s.days)}</section>
    ${trendHtml()}
    ${breakdownHtml(s.sold, per)}
    ${lossHtml(s.sold, per)}
    <section class="card"><div class="head"><h2>Top-Spieler · ${per}</h2>${s.players.length ? `<button class="mini" data-act="ranking">Alle ${s.players.length}</button>` : ""}</div>
      ${s.players.slice(0, 5).map((p, i) => playerRow(p, i + 1)).join("") || '<div class="empty">Keine Verkäufe im Zeitraum.</div>'}</section>
    ${s.best ? `<section class="card"><h2>Top &amp; Flop</h2>${flip(s.best, "Bester Verkauf")}${s.worst ? '<div class="divider"></div>' + flip(s.worst, "Schwächster Verkauf") : ""}</section>` : ""}
    ${!I.staleCards(S.data.cards, cfg().staleDays).length && s.longest.length ? `<section class="card"><h2>Am längsten im Club</h2>${s.longest.map(c => `
      <div class="row">${badge(c.rating, 1)}<div class="grow"><div class="name">${esc(c.name)}</div>
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

// ---------- Ladenhüter ----------
function staleHtml() {
  const days = cfg().staleDays, list = I.staleCards(S.data.cards, days);
  if (!list.length) return "";
  return `<section class="card"><div class="head"><h2>Ladenhüter</h2><span class="tag alert">${list.length} ≥ ${days} Tage</span></div>
    <div class="stat-line"><b>${fmt(sum(list.map(c => c.ek)))}</b> Coins gebunden · Break-even gesamt ${fmt(sum(list.map(c => breakEven(c.ek))))}</div>
    ${list.slice(0, 5).map(c => `<div class="row">${badge(c.rating, 1)}<div class="grow"><div class="name">${esc(c.name)}${c.listPrice ? `<span class="tag listed">gelistet ${compact(c.listPrice)}</span>` : ""}</div>
      <div class="meta">${heldSince(c.ekDate)} · EK ${fmt(c.ek)} · BE ${fmt(breakEven(c.ek))}</div></div>
      <button class="mini" data-listp="${c.id}">Preis</button><button class="mini gold" data-sell="${c.id}">VK</button></div>`).join("")}
    ${list.length > 5 ? `<button class="mini" data-act="stale" style="align-self:flex-start">Alle ${list.length} anzeigen</button>` : ""}</section>`;
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
const DIMS = [["price", "Preis"], ["chem", "Style"], ["rating", "Rating"], ["weekday", "Tag"]];
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
      ${l.worst.map(w => `<div class="row">${badge(w.rating, 1)}<div class="grow"><div class="name">${esc(w.name)}</div><div class="meta">${w.n}× mit Verlust</div></div>${profitHtml(w.loss)}</div>`).join("")}`
      : '<div class="ok" style="padding:0">Keine Verluste im Zeitraum ✓</div>'}</section>`;
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

/// Säulen mit einer Nulllinie; antippbar (data-<attr>=index).
function barChart(items, selIdx, attr, label) {
  const W = 340, H = 150, L = 44, B = 22, T = 10;
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
  const W = 340, H = 130, L = 44, B = 22, T = 10;
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

function listHtml() {
  const cards = S.data.cards;
  const today = toISODate(new Date());
  // Zeitraum: Verkaufte nach Verkaufsdatum, offene nach Kaufdatum
  const inR = c => I.inRange(c.vkDate || c.ekDate, ui.range);
  const pool = cards.filter(inR);
  const counts = { open: pool.filter(c => !isSold(c)).length, listed: pool.filter(c => !isSold(c) && c.listPrice).length,
    sold: pool.filter(isSold).length, all: pool.length };
  const list = pool.filter(c => ui.filter === "all" || (ui.filter === "listed" ? !isSold(c) && c.listPrice : (ui.filter === "open") !== isSold(c)))
    .filter(c => !ui.q || (c.name + " " + c.chem).toLowerCase().includes(ui.q.toLowerCase()));
  const key = { newest: c => -parseDay(c.vkDate || c.ekDate), profit: c => isSold(c) ? -profitOf(c.ek, c.vk) : 1e12,
    rating: c => -c.rating, price: c => -c.ek, hold: c => -daysBetween(parseDay(c.ekDate), parseDay(c.vkDate || today)) };
  list.sort((a, b) => key[ui.sort](a) - key[ui.sort](b));
  const shown = list.slice(0, 200);
  return `${seg([["open", `Offen ${counts.open}`], ["listed", `Gelistet ${counts.listed}`], ["sold", `Verkauft ${counts.sold}`], ["all", `Alle ${counts.all}`]], ui.filter, "filter")}
    <div class="search"><input id="q" type="search" placeholder="Spieler oder Chemistry Style" value="${esc(ui.q)}" aria-label="Suchen">
      <select id="sort" aria-label="Sortierung">${[["newest", "Neueste"], ["profit", "Gewinn"], ["rating", "Rating"], ["price", "Preis"], ["hold", "Haltedauer"]]
        .map(([k, l]) => `<option value="${k}" ${k === ui.sort ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <select id="range" class="range" aria-label="Zeitraum">${I.ranges(cards).map(([k, l]) => `<option value="${k}" ${k === ui.range ? "selected" : ""}>${l}</option>`).join("")}</select>
    <div class="list">${shown.map(c => {
      const p = isSold(c) ? profitOf(c.ek, c.vk) : null;
      return `<div class="item" tabindex="0" data-edit="${c.id}">${badge(c.rating)}
        <div class="grow" style="min-width:0"><div class="name">${esc(c.name)}${!isSold(c) && c.listPrice ? `<span class="tag listed">gelistet ${compact(c.listPrice)}</span>` : ""}</div><div class="meta">${esc(c.chem)} · ${fmtDate(parseDay(isSold(c) ? c.vkDate : c.ekDate))}</div></div>
        <div class="right">${p != null ? `${profitHtml(p)}<div class="meta num">${compact(c.ek)} → ${compact(c.vk)}</div>`
          : `<div class="num" style="font-weight:700">${fmt(c.ek)}</div><div class="meta num">kalk. VK ${compact(target(c.ek))} · ${heldSince(c.ekDate)}</div>`}</div>
        ${p == null ? `<button class="mini gold" data-sell="${c.id}">VK</button>` : ""}</div>`;
    }).join("") || '<div class="empty">Keine Spieler gefunden.</div>'}</div>
    ${list.length > shown.length ? `<div class="hint">Die ersten ${shown.length} von ${list.length}. Suche oder Filter grenzt weiter ein.</div>` : ""}
    ${list.length ? `<div class="sumbar"><span>${list.length} Spieler</span><span class="num">${ui.filter === "open" || ui.filter === "listed"
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
  const groups = restockGroups();
  if (!groups.length) return `<section class="card"><h2>Alles nachgekauft</h2>
    <p class="meta" style="white-space:normal;margin:0">Sobald ihr eine Karte als verkauft markiert, erscheint sie hier mit Name, Rating, Chemistry Style und letztem EK – zum Nachkaufen.</p></section>`;
  const { minProfit } = cfg();
  groups.forEach(g => { g.st = I.flipStats(S.data.cards, g.name, g.rating, g.chem, minProfit); });
  const count = sum(groups.map(g => g.items.length));
  const budget = sum(groups.map(g => g.lastEk * g.items.length));
  return `<section class="tiles">
      <div class="tile"><div class="t">Nachzukaufen</div><div class="v num">${count}</div><div class="d">${groups.length} verschiedene Karten</div></div>
      <div class="tile"><div class="t">Budget (letzter EK)</div><div class="v num">${fmt(budget)}</div><div class="d">Coins für alle Käufe</div></div></section>
    <div class="list">${groups.map(g => `<div class="item" style="cursor:default">
      ${badge(g.rating)}
      <div class="grow" style="min-width:0"><div class="name">${esc(g.name)}${g.items.length > 1 ? ` <span class="gold-text">×${g.items.length}</span>` : ""}</div>
        <div class="meta">${esc(g.chem)} · EK ${fmt(g.lastEk)} · VK ${compact(g.lastVk)} am ${fmtShort(parseDay(g.soldOn))}</div>
        ${g.st ? `<div class="stat-line">${g.st.n}× gedreht · Ø <b>${signed(g.st.avg)}</b> · ${holdText(g.st.hold)}${g.st.maxEk ? ` · max. EK <b>${fmt(g.st.maxEk)}</b>` : ""}${g.st.maxEk && g.lastEk > g.st.maxEk ? '<span class="tag alert">teuer</span>' : ""}</div>` : ""}</div>
      <div class="right" style="display:flex;gap:6px">
        <button class="mini" data-skip="${esc(g.key)}" aria-label="Überspringen" title="Überspringen">✕</button>
        <button class="mini gold" data-buy="${esc(g.key)}">Gekauft</button></div></div>`).join("")}</div>
    <p class="hint">„Gekauft“ speichert die Karte als neuen Kauf – nur den EK anpassen. Käufe über + oder per Screenshot haken passende Einträge automatisch ab.
      max. EK = mittlerer VK der letzten 3 Verkäufe − 5 % Tax − Mindestgewinn (${fmt(minProfit)}, änderbar unter Einstellungen).</p>`;
}

function openBuy(key) {
  const g = restockGroups().find(x => x.key === key); if (!g) return;
  const step = priceStep;
  const st = I.flipStats(S.data.cards, g.name, g.rating, g.chem, cfg().minProfit);
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(g.rating)}<div class="grow" style="min-width:0"><div class="name">${esc(g.name)}</div>
      <div class="meta">zuletzt EK ${fmt(g.lastEk)} · VK ${fmt(g.lastVk)}</div></div></div></div>
    ${st ? `<div class="group"><div class="gh">Bisher ${st.n}× gedreht${st.sameStyle ? "" : " (alle Styles)"}</div>
      <div class="calc"><div class="l"><span>Ø Gewinn · Haltedauer</span><span class="num">${signed(st.avg)} · ${holdText(st.hold)}</span></div>
        <div class="l"><span>Erwarteter VK (Mittel letzte 3)</span><span class="num">${fmt(st.expVk)}</span></div>
        ${st.maxEk ? `<div class="l"><span>max. EK (mind. ${fmt(cfg().minProfit)} Gewinn)</span><span class="num gold-text">${fmt(st.maxEk)}</span></div>` : ""}</div>
      <div class="hist"><span class="h">Verkauft</span><span class="h num">EK</span><span class="h num">VK</span><span class="h">Gewinn</span>
        ${st.history.map(h => `<span>${fmtShort(parseDay(h.date))}</span><span class="num">${fmt(h.ek)}</span><span class="num">${fmt(h.vk)}</span>${profitHtml(h.profit)}`).join("")}</div></div>` : ""}
    <div class="group"><div class="gh">Nachkauf</div>
      <div class="field"><label for="k-ek">Einkaufspreis</label><input id="k-ek" inputmode="decimal" value="${g.lastEk}"></div>
      <div class="chips"><button type="button" class="chip" data-d="-1">− Stufe</button><button type="button" class="chip" data-d="1">+ Stufe</button>
        <button type="button" class="chip" data-d="0">Letzter EK</button>${st?.maxEk ? `<button type="button" class="chip" data-max="1">max. EK ${compact(st.maxEk)}</button>` : ""}<button type="button" class="chip" data-app="000">+000</button></div>
      <div id="k-warn"></div>
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
  const upd = () => {
    const ek = parseCoins($("k-ek").value);
    $("k-calc").innerHTML = calcHtml(ek, null);
    $("k-warn").innerHTML = st?.maxEk && ek > st.maxEk ? `<div class="warn">Über max. EK – beim üblichen VK von ${fmt(st.expVk)} bleiben nur ${signed(profitOf(ek, st.expVk))}.</div>` : "";
    refresh();
  };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const d = e.target.closest("[data-d]"), a = e.target.closest("[data-app]"), mx = e.target.closest("[data-max]");
    if (mx) { $("k-ek").value = st.maxEk; upd(); }
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
  return `<section class="card"><h2>Hilfe</h2>
      <p class="meta" style="white-space:normal;margin:0">Alle Funktionen kurz erklärt – vom ersten Kauf bis zu den Statistiken.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini gold" data-act="help">Anleitung öffnen</button><button class="mini" data-act="tour">Einführung erneut zeigen</button></div></section>
    ${accountHtml(demo)}
    ${demo ? "" : teamHtml()}
    <section class="card"><h2>Trading-Ziele</h2>
      <p class="meta" style="white-space:normal;margin:0">Gilt für das ganze Depot – ein eingeladener Partner sieht dieselben Werte.</p>
      <div class="group" style="border:0">
        <div class="field"><label for="c-goal">Wochenziel Gewinn</label><input id="c-goal" data-cfg="weeklyGoal" inputmode="decimal" value="${cfg().weeklyGoal || ""}" placeholder="aus"></div>
        <div class="field"><label for="c-min">Mindestgewinn pro Karte</label><input id="c-min" data-cfg="minProfit" inputmode="decimal" value="${cfg().minProfit}"></div>
        <div class="field"><label for="c-stale">Ladenhüter ab Tagen</label><input id="c-stale" data-cfg="staleDays" inputmode="numeric" value="${cfg().staleDays}"></div></div>
      <p class="hint" style="padding:0">Der Mindestgewinn bestimmt den „max. EK“ auf der Einkaufsliste.</p></section>
    <section class="card"><h2>Daten</h2>
      <button class="secondary" data-act="backup">Backup herunterladen (alles)</button>
      <label class="secondary" for="restore-file" style="text-align:center">Backup wiederherstellen</label>
      <input class="hidden" type="file" id="restore-file" accept=".json,application/json">
      <p class="meta" style="white-space:normal;margin:0">Letzte Sicherung auf diesem Gerät: ${backupAge()}. Das Backup enthält Spieler, Wochenstände, gelernte Symbole und Einstellungen.</p>
      <button class="secondary" data-act="export">Als CSV exportieren</button>
      ${demo ? `<button class="mini" data-act="reset">Demo-Daten zurücksetzen</button>` : ""}</section>
    <section class="card"><h2>Auf dem iPhone installieren</h2>
      <p class="meta" style="white-space:normal;margin:0">In Safari unten auf <strong>Teilen</strong> tippen und <strong>„Zum Home-Bildschirm“</strong> wählen. Danach startet ${APP} wie eine App.</p></section>
    <section class="card"><h2>Berechnung</h2>
      <div class="calc" style="padding:0"><div class="l"><span>Gewinn</span><span>VK − 5 % Tax − EK</span></div><div class="l"><span>Marge</span><span>Gewinn / VK</span></div>
      <div class="l"><span>Gesamtvermögen</span><span>Teamwert + TL (ESBC) + Coins</span></div></div></section>
    ${tiersHtml()}
    <section class="card"><h2>Chemistry Styles</h2><p class="meta" style="white-space:normal;margin:0">${STYLES.join(" · ")}</p>
      <p class="meta" style="white-space:normal;margin:0">${S.data.icons.length} vom Nutzer gelernte Symbole</p></section>
    <section class="card"><h2>Rechtliches</h2>
      <p class="meta" style="white-space:normal;margin:0">${APP} ist ein unabhängiges Fan-Projekt und steht in keiner Verbindung zu Electronic Arts Inc.
        Alle Marken gehören ihren jeweiligen Inhabern.</p>
      <div style="display:flex;gap:8px"><a class="mini" href="impressum.html">Impressum</a><a class="mini" href="datenschutz.html">Datenschutz</a></div></section>
    <p class="hint">${APP} ${VERSION} · ${demo ? "Demo" : "Cloud"}</p>`;
}

// ---------- Hilfe ----------
function firstStepsHtml() {
  const step = (n, title, text, btn) => `<div class="row" style="align-items:flex-start"><span class="badge sm b-gold num">${n}</span>
    <div class="grow"><div class="name">${title}</div><div class="stat-line">${text}</div>${btn || ""}</div></div>`;
  return `<section class="card"><h2>Erste Schritte</h2>
    ${step(1, "Ersten Kauf erfassen", "Tippe oben auf <b>+</b> und gib Name, Rating, Chemistry Style und Einkaufspreis ein.",
      '<button class="mini gold" data-act="add" style="margin-top:6px">Kauf erfassen</button>')}
    ${step(2, "Oder per Screenshot", "Nach einem Kauf im Spiel einen Screenshot der Item-Details machen und über das <b>Scan-Symbol</b> neben dem + hochladen. Die App liest Name, Rating, Style und Preis selbst.",
      '<label class="mini" for="scanInput" style="display:inline-block;margin-top:6px">Screenshot wählen</label>')}
    ${step(3, "Verkaufen", "In der Spielerliste bei der Karte auf <b>VK</b> tippen und den Verkaufspreis eintragen – der Gewinn nach 5 % Tax wird sofort berechnet.")}
    ${step(4, "Nachkaufen", "Verkaufte Karten landen im Tab <b>Einkauf</b>. Dort siehst du den letzten EK und den maximalen EK, der sich noch lohnt.")}
    <button class="secondary" data-act="help">Ausführliche Anleitung</button></section>`;
}

const TOUR = [
  ["📈", "Willkommen bei Denex Trading", "Die Tracking-App für Verkäufe! Alle Daten & Informationen an einem Ort!"],
  ["＋", "Käufe erfassen", "Oben rechts auf <b>+</b> tippen – oder das <b>Scan-Symbol</b> daneben nutzen und einen Screenshot bzw. ein Bildschirmvideo aus dem Spiel hochladen. Die App erkennt Name, Rating, Chemistry Style und Preis."],
  ["💰", "Verkaufen", "Im Tab <b>Spieler</b> auf den verkauften Spieler tippen und den Verkaufspreis eingeben. Alternativ einen <b>Screenshot</b> oder ein <b>Video</b> von den verkauften Spielern hochladen!"],
  ["🛒", "Einkaufsliste", "Jede verkaufte Karte erscheint im Tab <b>Einkauf</b> zum Nachkaufen – mit letztem EK, bisherigen Gewinnen und dem <b>max. EK</b>, bis zu dem sich der Nachkauf noch lohnt."],
  ["📊", "Statistiken", "Die <b>Übersicht</b> zeigt Gewinn, Wochenziel, Ladenhüter und was sich am meisten lohnt. Ziele und Aufschläge stellst du unter <b>Einstellungen</b> ein – dort findest du auch jederzeit die Anleitung."],
];
function openTour(i = 0) {
  const [icon, title, text] = TOUR[i], last = i === TOUR.length - 1;
  const body = `<div class="form" style="text-align:center;gap:14px;padding:6px 4px 4px">
    <div style="font-size:46px;line-height:1">${icon}</div>
    <h2 style="font:700 24px/1.15 var(--display);margin:0">${title}</h2>
    <p class="meta" style="white-space:normal;margin:0;font-size:15px;color:var(--text)">${text}</p>
    <div style="display:flex;justify-content:center;gap:6px" aria-hidden="true">${TOUR.map((_, k) => `<span style="width:8px;height:8px;border-radius:50%;background:${k === i ? "var(--gold)" : "var(--line)"}"></span>`).join("")}</div>
    <button class="primary" id="tour-next">${last ? "Los geht’s" : "Weiter"}</button>
    ${last ? "" : '<button class="link" id="tour-skip" style="align-self:center">Überspringen</button>'}</div>`;
  sheet(`${i + 1} / ${TOUR.length}`, body);
  const done = () => { LS.set("dxt-tour", "1"); closeSheet(); };
  $("tour-next").onclick = () => last ? done() : openTour(i + 1);
  if ($("tour-skip")) $("tour-skip").onclick = done;
  layer.querySelector("[data-close]").addEventListener("click", () => LS.set("dxt-tour", "1"));
}
const maybeTour = () => { if (!LS.get("dxt-tour") && !layer.innerHTML) openTour(); };

const HELP = [
  ["Kauf erfassen", `<p>Oben rechts auf <b>+</b> tippen. Name, Rating, Chemistry Style und Einkaufspreis eingeben – das Kaufdatum ist mit heute vorbelegt.</p>
    <ul><li>Bekannte Spieler werden beim Tippen vorgeschlagen; Rating und Style werden übernommen.</li>
    <li>Preise gehen auch kurz: <b>12500</b>, <b>12.500</b>, <b>12,5k</b> oder <b>1.2m</b>.</li>
    <li>Mehrere Käufe hintereinander: <b>„Sichern & nächste Karte“</b>.</li></ul>`],
  ["Screenshot oder Video scannen", `<p>Das <b>Scan-Symbol</b> neben dem + öffnet deine Fotos. Die Erkennung läuft komplett auf deinem Handy – Bilder werden nicht hochgeladen.</p>
    <ul><li><b>Kauf:</b> Item-Details nach dem Kauf („Item gekauft für …“ bzw. „… ergattert“) oder die Liste „Ersteigerte Items“.</li>
    <li><b>Verkauf:</b> Transferliste → „Verk. Items“ oder Item-Details mit „Endpreis“.</li>
    <li><b>Video:</b> Bildschirmaufnahme starten und langsam durch mehrere Karten wischen – jede Karte wird erfasst.</li>
    <li>Den Chemistry Style erkennt die App am Symbol. Ist sie unsicher, ist der Stil markiert – deine Korrektur wird gelernt.</li>
    <li>Die Erkennung ist aktuell auf die <b>deutsche Spielsprache</b> ausgelegt. Beim ersten Scan wird sie einmalig geladen (~9 MB).</li></ul>`],
  ["Verkaufen & Gewinn", `<p>Im Tab <b>Spieler</b> bei der Karte auf <b>VK</b> tippen, Verkaufspreis eintragen, fertig.</p>
    <ul><li><b>Gewinn = VK − 5 % Tax − EK.</b></li>
    <li>Schnellwahl: <b>kalk. VK</b> (dein Zielpreis), <b>Break-even</b> (kleinster Preis ohne Verlust), +10 % / +20 %.</li>
    <li>Einen Verkauf rückgängig machen: Karte antippen und den Verkaufspreis leeren.</li></ul>`],
  ["Transferliste („gelistet“)", `<p>Offene Karte antippen → <b>Transferliste → Listen</b> und den Angebotspreis eintragen. Gelistete Karten findest du in der Spielerliste unter <b>Gelistet</b>; beim Verkaufen ist der Preis schon vorbelegt.</p>`],
  ["Einkaufsliste & max. EK", `<p>Jede verkaufte Karte erscheint im Tab <b>Einkauf</b> mit Name, Rating, Style und letztem EK. Gleiche Karten werden zusammengefasst.</p>
    <ul><li><b>Gekauft</b> speichert den Nachkauf – meist nur den EK anpassen.</li>
    <li><b>max. EK</b> = mittlerer Verkaufspreis der letzten 3 Verkäufe − 5 % Tax − dein Mindestgewinn. Liegt dein Preis darüber, warnt die App.</li>
    <li><b>✕</b> nimmt eine Karte ohne Nachkauf von der Liste.</li></ul>`],
  ["Übersicht & Statistiken", `<ul><li>Oben den <b>Zeitraum</b> wählen: Heute, 7 Tage, 30 Tage, Gesamt.</li>
    <li><b>Wochenziel</b> mit Fortschritt und Vergleich zur Vorwoche.</li>
    <li><b>Ladenhüter:</b> Karten, die schon lange im Club liegen – direkt Preis anpassen oder verkaufen.</li>
    <li><b>Was lohnt sich?</b> Gewinn pro Tag nach Preisklasse, Style, Rating und Wochentag – zeigt, womit deine Coins am schnellsten arbeiten.</li>
    <li>Diagramme lassen sich antippen.</li></ul>`],
  ["Vermögen", `<p>Einmal pro Woche unter <b>Vermögen</b> deinen Stand eintragen (Teamwert, Transferliste, Coins). Die App zeigt das Gesamtvermögen und die Veränderung zur Vorwoche.</p>`],
  ["Mit einem Partner zusammen traden", `<p>Unter <b>Einstellungen → Team → Partner einladen</b> einen Code erzeugen und teilen. Dein Partner legt ein eigenes Konto an und tritt mit dem Code bei – ihr seht dann dieselben Daten in Echtzeit.</p>`],
  ["Einstellungen", `<ul><li><b>Wochenziel</b>, <b>Mindestgewinn</b> (für den max. EK) und ab wann eine Karte als <b>Ladenhüter</b> gilt.</li>
    <li><b>kalk. VK – Aufschläge:</b> wie viel du je Preisklasse auf den EK aufschlägst.</li>
    <li><b>Backup</b> einmal pro Woche herunterladen; <b>CSV-Export</b> für Excel.</li></ul>`],
  ["Als App auf dem Handy", `<ul><li><b>iPhone:</b> in Safari auf <b>Teilen</b> → <b>„Zum Home-Bildschirm“</b>.</li>
    <li><b>Android:</b> in Chrome im Menü (⋮) → <b>„App installieren“</b> bzw. „Zum Startbildschirm hinzufügen“.</li></ul>
    <p>Danach startet Denex Trading im Vollbild wie eine normale App.</p>`],
];
function openHelp() {
  sheet("Anleitung", `<div class="form help">${HELP.map(([t, h], i) => `<details class="group" ${i ? "" : "open"}><summary>${t}</summary><div class="help-body">${h}</div></details>`).join("")}
    <button class="secondary" data-tour-again>Einführung erneut zeigen</button></div>`);
  layer.querySelector("[data-tour-again]").onclick = () => openTour();
}

function accountHtml(demo) {
  if (demo) return `<section class="card"><h2>Demo-Modus</h2>
    <p class="meta" style="white-space:normal;margin:0">Die Beispieldaten liegen nur in diesem Browser. ${CLOUD ? "Mit einem kostenlosen Konto werden deine Daten sicher gespeichert und sind auf allen Geräten da." : ""}</p>
    <button class="primary" data-act="leave">${CLOUD ? "Konto erstellen / anmelden" : "Demo beenden"}</button></section>`;
  const p = account.profile || {};
  return `<section class="card"><h2>Konto</h2>
    <div class="group" style="border:0">
      <div class="field"><label for="m-name">Name</label><input id="m-name" value="${esc(settings.name)}" autocomplete="nickname"></div>
      <div class="field"><label>E-Mail</label><span class="grow meta" style="text-align:right">${esc(account.user?.email || p.email || "")}</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini" data-act="pwreset">Passwort ändern</button><button class="mini" data-act="logout">Abmelden</button>
      <button class="mini" data-act="delete" style="color:var(--bad)">Konto löschen</button></div></section>`;
}

function teamHtml() {
  const p = account.profile; if (!p?.depot) return "";
  const d = p.depot, uid = account.user.uid, owner = d.owner === uid;
  const others = (d.members || []).filter(m => m !== uid);
  const nameOf = m => esc(d.names?.[m] || "Partner");
  return `<section class="card"><h2>Team</h2>
    <p class="meta" style="white-space:normal;margin:0">Du kannst mit einem Partner auf demselben Konto im Spiel traden – beide sehen und bearbeiten dieselben Daten in Echtzeit.</p>
    ${owner ? `${others.length ? others.map(m => `<div class="row"><span class="grow name">${nameOf(m)}</span><button class="mini" data-kick="${m}" style="color:var(--bad)">Entfernen</button></div>`).join("")
        : '<div class="meta">Noch niemand eingeladen.</div>'}
      ${d.invite ? `<div class="codebox">${esc(d.invite)}</div>
        <div style="display:flex;gap:8px"><button class="mini gold" data-act="share">Code teilen</button><button class="mini" data-act="revoke">Code zurückziehen</button></div>`
        : `<button class="secondary" data-act="invite">Partner einladen</button>`}
      ${!others.length ? `<div class="group" style="border:0"><div class="field" style="padding:0"><label for="m-join">Code erhalten?</label><input id="m-join" placeholder="K7RM-2XQP" autocapitalize="characters" autocomplete="off"></div></div>
        <button class="mini" data-act="join" style="align-self:flex-start">Depot beitreten</button>
        <p class="hint" style="padding:0">Beim Beitreten siehst du die Daten des Partners. Deine bisherigen Daten bleiben gespeichert und kommen zurück, wenn du das Depot wieder verlässt.</p>` : ""}`
      : `<div class="row"><span class="grow">Du bist im Depot von <strong>${nameOf(d.owner)}</strong>${others.length > 1 ? ` mit ${others.filter(m => m !== d.owner).map(nameOf).join(", ")}` : ""}.</span></div>
        <button class="mini" data-act="leaveteam" style="align-self:flex-start;color:var(--bad)">Depot verlassen</button>`}</section>`;
}

function tiersHtml() {
  const t = savedTiers() || DEFAULT_TIERS, above = S.data.settings.markupAbove ?? DEFAULT_ABOVE;
  const custom = !!S.data.settings.tiers;
  return `<section class="card"><div class="head"><h2>kalk. VK – Aufschläge</h2>${custom ? '<span class="tag listed">eigene</span>' : '<span class="hint">Standard</span>'}</div>
    <p class="meta" style="white-space:normal;margin:0">kalk. VK = EK + Aufschlag. Lege fest, wie viel du je Preisklasse draufschlägst.</p>
    <div class="group" id="tiers" style="border:0">${t.map((r, i) => `<div class="field" data-tier="${i}">
      <label>bis</label><input data-t="0" inputmode="decimal" value="${r[0]}" style="text-align:left" aria-label="EK bis">
      <label>+</label><input data-t="1" inputmode="decimal" value="${r[1]}" aria-label="Aufschlag">
      <button class="mini" data-deltier="${i}" aria-label="Zeile löschen">✕</button></div>`).join("")}
      <div class="field"><label>darüber +</label><input id="t-above" inputmode="decimal" value="${above}" aria-label="Aufschlag darüber"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini" data-act="addtier">+ Zeile</button><button class="mini gold" data-act="savetiers">Speichern</button>
      ${custom ? '<button class="mini" data-act="resettiers">Standard wiederherstellen</button>' : ""}</div></section>`;
}
// Firestore kennt keine verschachtelten Listen → gespeichert als [{ upTo, add }]
const savedTiers = () => S.data.settings.tiers?.map(t => Array.isArray(t) ? t : [t.upTo, t.add]) || null;
const readTiers = () => [...document.querySelectorAll("#tiers [data-tier]")].map(r => [parseCoins(r.querySelector('[data-t="0"]').value), parseCoins(r.querySelector('[data-t="1"]').value)])
  .filter(r => r[0] > 0 && r[1] >= 0);

function onViewClick(e) {
  const t = e.target;
  const sell = t.closest("[data-sell]"); if (sell) { e.stopPropagation(); return openSell(S.data.cards.find(c => c.id === sell.dataset.sell)); }
  const p = t.closest("[data-period]"); if (p) { ui.period = p.dataset.period; return render(); }
  const f = t.closest("[data-filter]"); if (f) { ui.filter = f.dataset.filter; return render(); }
  const d = t.closest("[data-day]"); if (d) { ui.sel = +d.dataset.day; return render(); }
  const wk = t.closest("[data-week]"); if (wk) { ui.wsel = +wk.dataset.week; return render(); }
  const dm = t.closest("[data-dim]"); if (dm) { ui.dim = dm.dataset.dim; LS.set("dxt-dim", ui.dim); return render(); }
  const dt = t.closest("[data-deltier]"); if (dt) { const rows = readTiers(); rows.splice(+dt.dataset.deltier, 1); return saveTiers(rows); }
  const kick = t.closest("[data-kick]"); if (kick) return confirmButton(kick, "Sicher?", () => teamAction("kick", kick, kick.dataset.kick));
  const lp = t.closest("[data-listp]"); if (lp) { e.stopPropagation(); return openList(S.data.cards.find(c => c.id === lp.dataset.listp)); }
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
  if (act === "goal") openGoal();
  if (act === "stale") openStale();
  if (act === "backup") downloadBackup();
  if (act === "snap") openSnap();
  if (act === "help") openHelp();
  if (act === "tour") openTour();
  if (act === "add") openAdd();
  if (act === "export") download(`Denex-Trading-Export-${toISODate(new Date())}.csv`, exportCSV());
  if (act === "share") {
    const text = `Tritt meinem ${APP}-Depot bei – Code: ${account.profile?.depot?.invite}\n${location.origin}${location.pathname}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast("Code kopiert"), () => {});
  }
  if (act === "reset") confirmButton(a, "Wirklich zurücksetzen?", () => { S.resetDemo(); toast("Zurückgesetzt"); });
  if (act === "leave") { LS.set("dxt-demo", null); location.reload(); }
  if (act === "logout") confirmButton(a, "Wirklich abmelden?", async () => { await cloud.logout(); location.reload(); });
  if (act === "pwreset") cloud.resetPassword(account.user.email).then(() => toast("E-Mail zum Ändern des Passworts gesendet"), x => toast(cloud.message(x), true));
  if (act === "delete") openDelete();
  if (act === "invite" || act === "revoke" || act === "join" || act === "leaveteam") teamAction(act, a);
  if (act === "addtier") { const rows = readTiers(); const last = rows[rows.length - 1] || [0, 0]; saveTiers([...rows, [last[0] * 2 || 1000, last[1] || 500]]); }
  if (act === "savetiers") saveTiers(readTiers());
  if (act === "resettiers") { S.saveSettings({ tiers: null, markupAbove: null }); toast("Standard-Aufschläge wiederhergestellt"); }
}
function saveTiers(rows) {
  if (!rows.length) return toast("Mindestens eine Zeile nötig", true);
  const above = parseCoins(document.getElementById("t-above")?.value);
  S.saveSettings({ tiers: rows.sort((x, y) => x[0] - y[0]).map(([upTo, add]) => ({ upTo, add })), markupAbove: above >= 0 ? above : DEFAULT_ABOVE });
  toast("Aufschläge gespeichert");
}
async function teamAction(act, btn, arg) {
  const p = account.profile, uid = account.user.uid;
  btn.disabled = true;
  try {
    if (act === "invite") { await cloud.createInvite(uid, p.depotId); toast("Code erstellt – jetzt teilen"); }
    if (act === "revoke") { await cloud.revokeInvite(p.depotId); toast("Code ist ungültig"); }
    if (act === "kick") { await cloud.removeMember(p.depotId, arg); toast("Entfernt"); }
    if (act === "join") {
      const code = document.getElementById("m-join").value; if (code.trim().length < 8) throw new Error("Der Code hat 8 Zeichen, z. B. K7RM-2XQP.");
      await cloud.joinDepot(uid, code, settings.name); toast("Beigetreten");
    }
    if (act === "leaveteam") { await cloud.leaveDepot(account.user, p.depotId); toast("Depot verlassen"); }
    const before = p.depotId;
    await refreshProfile();
    if (account.profile.depotId !== before) openApp(account.profile.depotId); else render();
  } catch (x) { toast(cloud.message(x), true); btn.disabled = false; }
}
function openDelete() {
  const d = account.profile?.depot, owner = d?.owner === account.user.uid, others = (d?.members || []).length - 1;
  const body = `<div class="form">
    <p class="meta" style="white-space:normal;margin:0">${owner ? `Dein Konto und <strong>alle Daten deines Depots</strong> (${S.data.cards.length} Spieler, Wochenstände, Einstellungen) werden endgültig gelöscht.${others > 0 ? ` ${others} Partner verliert damit ebenfalls den Zugriff.` : ""}`
      : "Dein Konto wird gelöscht und du verlässt das geteilte Depot. Die Daten des Depots bleiben beim Besitzer."}
      Tipp: vorher unter „Daten“ ein Backup herunterladen.</p>
    <div class="group"><div class="field"><label for="d-pw">Passwort</label><input id="d-pw" type="password" autocomplete="current-password"></div></div>
    <div id="d-err"></div></div>`;
  sheet("Konto löschen", body, "Endgültig löschen", async () => {
    const act = document.getElementById("act"); act.disabled = true; act.textContent = "Wird gelöscht …";
    try { await cloud.deleteAccount(account.user, $("d-pw").value, account.profile); LS.set("dxt-name", null); location.reload(); }
    catch (x) { $("d-err").innerHTML = `<div class="err">${esc(cloud.message(x))}</div>`; act.disabled = false; act.textContent = "Endgültig löschen"; }
  }, () => $("d-pw").value.length >= 6);
}
function confirmButton(btn, text, fn) {
  if (btn.dataset.armed) return fn();
  btn.dataset.armed = 1; btn.textContent = text;
}
document.addEventListener("change", e => {
  if (e.target.id === "m-name") {
    settings.name = e.target.value.trim(); LS.set("dxt-name", settings.name);
    if (account.user) cloud.saveName(account.user.uid, settings.name, account.profile?.depotId).then(refreshProfile).catch(() => {});
    toast("Name gespeichert");
  }
  if (e.target.dataset.cfg) {
    const k = e.target.dataset.cfg, v = Math.max(0, parseCoins(e.target.value) || 0);
    S.saveSettings({ [k]: k === "staleDays" ? Math.max(1, v || I.DEFAULTS.staleDays) : k === "minProfit" && !e.target.value.trim() ? I.DEFAULTS.minProfit : v });
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
    ${existing && !isSold(existing) ? `<div class="group"><div class="gh">Transferliste</div>
      <div class="field"><label>Angebot</label><span class="grow" style="text-align:right">${existing.listPrice ? `${fmt(existing.listPrice)} seit ${fmtShort(parseDay(existing.listDate || existing.ekDate))}` : "nicht gelistet"}</span>
      <button type="button" class="mini" id="f-list">${existing.listPrice ? "Ändern" : "Listen"}</button></div></div>` : ""}
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
    Object.assign(card, { name: $("f-name").value.trim(), rating: +$("f-rating").value, chem: $("f-chem").value,
      ek: parseCoins($("f-ek").value), ekDate: $("f-ekd").value || toISODate(new Date()), notes: $("f-notes").value.trim() });
    if (existing) {
      const vk = parseCoins($("f-vk").value); card.vk = vk || null; card.vkDate = vk ? ($("f-vkd").value || toISODate(new Date())) : null;
      if (vk && !existing.vk) card.restock = "open"; // hier verkauft → auf die Einkaufsliste
      if (vk) { card.listPrice = null; card.listDate = null; }
      if (!vk) card.restock = null;                  // Verkauf entfernt → von der Liste
    }
    else { card.vk = null; card.vkDate = null; }
    S.saveCard(card);
    if (!existing && consumeRestock(card)) toast(`${card.name} auf der Einkaufsliste abgehakt`);
  }
  layer.querySelector(".sheet").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t || !$("f")) return; // Formular schon geschlossen (z. B. nach „Sichern“)
    if (t.dataset.name) { const l = lastCard(t.dataset.name); $("f-name").value = t.dataset.name; if (l) { $("f-rating").value = l.rating; $("f-chem").value = l.chem; } $("f-ek").focus(); }
    if (t.dataset.chem) $("f-chem").value = t.dataset.chem;
    if (t.dataset.app) { $("f-ek").value += t.dataset.app; $("f-ek").focus(); }
    if (t.id === "f-next") { save(); toast("Gespeichert – nächste Karte"); ["f-name", "f-rating", "f-ek", "f-notes"].forEach(i => $(i).value = ""); $("f-name").focus(); }
    if (t.id === "f-list") return openList(existing);
    if (t.id === "f-restock") { S.saveCard({ ...existing, restock: "open" }); closeSheet(); return toast(`${existing.name} steht auf der Einkaufsliste`); }
    if (t.id === "f-del") return confirmButton(t, "Wirklich löschen?", () => { S.deleteCard(existing.id); closeSheet(); toast("Gelöscht"); });
    update();
  });
  $("f").addEventListener("input", update);
  $("f").addEventListener("change", update);
  $("f").addEventListener("submit", e => e.preventDefault());
  update();
}

function openSell(card, presetPrice = card.listPrice) {
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
    S.saveCard({ ...card, vk, vkDate: $("s-date").value || toISODate(new Date()), restock: "open", listPrice: null, listDate: null });
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

function openList(card) {
  const step = priceStep, start = card.listPrice || target(card.ek);
  const body = `<div class="form">
    <div class="group"><div class="field" style="border:0">${badge(card.rating)}<div class="grow" style="min-width:0"><div class="name">${esc(card.name)}</div>
      <div class="meta">${esc(card.chem)} · EK ${fmt(card.ek)} · seit ${heldSince(card.ekDate)}</div></div></div></div>
    <div class="group"><div class="gh">Sofortkauf-Preis</div>
      <div class="field"><label for="l-p">Angebot</label><input id="l-p" inputmode="decimal" value="${start}"></div>
      <div class="chips"><button type="button" class="chip" data-lp="-1">− Stufe</button><button type="button" class="chip" data-lp="1">+ Stufe</button>
        <button type="button" class="chip" data-lv="${target(card.ek)}">kalk. VK ${compact(target(card.ek))}</button>
        <button type="button" class="chip" data-lv="${breakEven(card.ek)}">Break-even ${compact(breakEven(card.ek))}</button></div>
      <div id="l-calc"></div></div>
    ${card.listPrice ? '<button type="button" class="mini" id="l-off" style="align-self:flex-start">Nicht mehr gelistet</button>' : ""}
    <p class="hint">Markiert die Karte als „gelistet“. Beim Verkaufen ist der Preis dann schon eingetragen.</p></div>`;
  const refresh = sheet(card.listPrice ? "Angebot ändern" : "Auf Transferliste", body, "Gelistet", () => {
    const price = parseCoins($("l-p").value);
    S.saveCard({ ...card, listPrice: price, listDate: toISODate(new Date()) });
    closeSheet(); toast(`${card.name} gelistet für ${fmt(price)}`);
  }, () => parseCoins($("l-p").value) > 0);
  const upd = () => { $("l-calc").innerHTML = calcHtml(card.ek, parseCoins($("l-p").value)); refresh(); };
  layer.querySelector(".sheet").addEventListener("click", e => {
    const d = e.target.closest("[data-lp]"), v = e.target.closest("[data-lv]");
    if (d) { const p = parseCoins($("l-p").value) || start; $("l-p").value = Math.max(150, p + +d.dataset.lp * step(p + (+d.dataset.lp < 0 ? -1 : 0))); upd(); }
    if (v) { $("l-p").value = v.dataset.lv; upd(); }
    if (e.target.id === "l-off") { S.saveCard({ ...card, listPrice: null, listDate: null }); closeSheet(); toast("Nicht mehr gelistet"); }
  });
  $("l-p").addEventListener("input", upd);
  upd();
}

function openGoal() {
  const body = `<div class="form"><div class="group">
    <div class="field"><label for="g-v">Gewinn pro Woche</label><input id="g-v" inputmode="decimal" value="${cfg().weeklyGoal || ""}" placeholder="z. B. 50k"></div></div>
    <div class="chips" style="padding:0">${[25000, 50000, 100000, 150000, 200000].map(v => `<button type="button" class="chip" data-gv="${v}">${compact(v)}</button>`).join("")}</div>
    <p class="hint">Gilt für das ganze Depot. Leer lassen = kein Ziel.</p></div>`;
  sheet("Wochenziel", body, "Sichern", () => { S.saveSettings({ weeklyGoal: parseCoins($("g-v").value) || 0 }); closeSheet(); toast("Wochenziel gespeichert"); });
  layer.querySelector(".sheet").addEventListener("click", e => { const b = e.target.closest("[data-gv]"); if (b) $("g-v").value = b.dataset.gv; });
}

function openStale() {
  const list = I.staleCards(S.data.cards, cfg().staleDays);
  sheet(`Ladenhüter (${list.length})`, `<div class="form"><div class="list">${list.map(c => `<div class="item" style="cursor:default">${badge(c.rating, 1)}
    <div class="grow" style="min-width:0"><div class="name">${esc(c.name)}${c.listPrice ? `<span class="tag listed">gelistet ${compact(c.listPrice)}</span>` : ""}</div>
    <div class="meta">${heldSince(c.ekDate)} · EK ${fmt(c.ek)} · BE ${fmt(breakEven(c.ek))}</div></div>
    <button class="mini" data-slist="${c.id}">Preis</button><button class="mini gold" data-ssell="${c.id}">VK</button></div>`).join("")}</div></div>`);
  layer.querySelector(".sheet").addEventListener("click", e => {
    const l = e.target.closest("[data-slist]"), v = e.target.closest("[data-ssell]");
    if (l) openList(S.data.cards.find(c => c.id === l.dataset.slist));
    if (v) openSell(S.data.cards.find(c => c.id === v.dataset.ssell));
  });
}

// ---------- Backup ----------
const backupAge = () => {
  const t = +LS.get("dxt-backup");
  if (!t) return "noch nie";
  const d = daysBetween(new Date(t), new Date());
  return d <= 0 ? "heute" : d === 1 ? "gestern" : `vor ${d} Tagen`;
};
const backupDue = () => S.data.mode === "cloud" && S.data.cards.length > 0 && (!+LS.get("dxt-backup") || Date.now() - +LS.get("dxt-backup") > 7 * DAY);
function downloadBackup() {
  const payload = { app: APP, version: VERSION, depot: settings.depot, created: new Date().toISOString(),
    cards: S.data.cards, snaps: S.data.snaps, icons: S.data.icons.map(({ id, style, hex }) => ({ id, style, hex })), settings: S.data.settings };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Denex-Trading-Backup-${toISODate(new Date())}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  LS.set("dxt-backup", String(Date.now())); toast(`Backup mit ${S.data.cards.length} Spielern gespeichert`); render();
}
async function restoreBackup(file) {
  let b;
  try { b = JSON.parse(await file.text()); } catch (e) { return toast("Das ist keine Backup-Datei", true); }
  if (![APP, "FC Trader"].includes(b?.app) || !Array.isArray(b.cards)) return toast("Das ist keine gültige Sicherung", true);
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
    const known = new Set(S.data.icons.map(i => i.id));
    for (const i of b.icons || []) if (i.id && !known.has(i.id)) await S.saveIcon(i);
    if (b.settings && Object.keys(b.settings).length) await S.saveSettings(b.settings);
    closeSheet(); toast(`${b.cards.length} Spieler wiederhergestellt`);
  }, () => true);
}

function openRanking() {
  const s = stats(S.data.cards, ui.period);
  sheet("Spieler-Ranking", `<div class="form"><div class="list">${s.players.map((p, i) => `<div class="item" style="cursor:default">
    <span class="meta num" style="width:22px;text-align:right">${i + 1}</span>${badge(p.rating, 1)}
    <div class="grow" style="min-width:0"><div class="name">${esc(p.name)}</div><div class="meta">${p.n}× · VK ${compact(p.vk)} · Ø ${signed(p.avg)} · ${holdText(p.hold)}${p.open ? " · " + p.open + " im Club" : ""}</div></div>
    ${profitHtml(p.profit)}</div>`).join("")}</div></div>`);
}

// ---------- Import / Export ----------
function exportCSV() {
  const d = iso => iso ? fmtDate(parseDay(iso)).replace(/\.(\d\d)$/, ".20$1") : "";
  const lines = ["Name;Rating;Chemistry Style;EK;EK Datum;kalk. VK;VK;VK Datum;Tax;Gewinn;Marge %;Notiz"];
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
    for (const d of ready()) { const c = cardOf(d), vk = parseCoins(d.price); total += profitOf(c.ek, vk); S.saveCard({ ...c, vk, vkDate: date, restock: "open", listPrice: null, listDate: null }); }
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
async function openApp(depot) {
  if (unsub) { unsub(); unsub = null; }
  closeSheet();
  settings.depot = depot;
  renderShell();
  unsub = S.subscribe(() => { setTiers(savedTiers(), S.data.settings.markupAbove); render(); });
  await S.connect({ depot, demoSeed });
  render();
  setTimeout(maybeTour, 400);
}
async function refreshProfile() {
  account.profile = await cloud.ensureProfile(account.user, pendingName);
  settings.name = account.profile.name || settings.name;
  return account.profile;
}
async function start() {
  if (unsub) { unsub(); unsub = null; }
  closeSheet();
  if (!CLOUD) return LS.get("dxt-demo") ? openApp("DEMO") : renderAuth();
  root.innerHTML = '<div class="onb"><div class="empty">Wird geladen …</div></div>';
  let current = null;
  await cloud.onUser(async user => {
    account.user = user;
    if (!user) { account.profile = null; current = null; return LS.get("dxt-demo") ? openApp("DEMO") : renderAuth(); }
    LS.set("dxt-demo", null);
    try {
      const p = await refreshProfile();
      if (current !== p.depotId) { current = p.depotId; openApp(p.depotId); }
    } catch (e) { renderAuth("login", "Anmeldung fehlgeschlagen: " + cloud.message(e)); }
  }).catch(e => renderAuth("login", "Keine Verbindung: " + cloud.message(e)));
}
start();
