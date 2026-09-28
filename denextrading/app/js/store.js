// Datenablage: Firebase Firestore (Konto-Depot, Echtzeit) oder Demo (nur dieser Browser).
// Datenmodell identisch mit der iOS-Version:
//   depots/{code}/players/{id}   – Karten
//   depots/{code}/snapshots/{id} – Wochenstände
//   depots/{code}/chemIcons/{id} – gelernte Chemiestil-Symbole
//   depots/{code}/settings/main  – gemeinsame Einstellungen (Wochenziel, Mindestgewinn, Ladenhüter-Tage)

import { toISODate, parseDay } from "./calc.js";
import * as cloud from "./cloud.js";

const listeners = new Set();
export const data = { cards: [], snaps: [], icons: [], settings: {}, ready: false, mode: "demo", error: null };
const emit = () => listeners.forEach(fn => fn(data));
export const subscribe = fn => { listeners.add(fn); fn(data); return () => listeners.delete(fn); };

let backend = null;

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase();

// ---------- Demo (localStorage) ----------

const DEMO_KEY = "denextrading-demo-v1";
function demoBackend(seed) {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { db = null; }
  if (!db) db = { cards: seed.cards, snaps: seed.snaps, icons: [] };
  db.settings ||= {};
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) {} };
  const publish = () => { data.cards = [...db.cards]; data.snaps = [...db.snaps]; data.icons = [...db.icons]; data.settings = { ...db.settings }; data.ready = true; emit(); };
  const upsert = (list, item) => { const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); };
  publish();
  return {
    async saveCard(c) { upsert(db.cards, c); save(); publish(); },
    async saveCards(cs) { cs.forEach(c => upsert(db.cards, c)); save(); publish(); },
    async deleteCard(id) { db.cards = db.cards.filter(c => c.id !== id); save(); publish(); },
    async saveSnap(s) { upsert(db.snaps, s); save(); publish(); },
    async deleteSnap(id) { db.snaps = db.snaps.filter(s => s.id !== id); save(); publish(); },
    async saveIcon(i) { db.icons.push(i); save(); publish(); },
    async saveSettings(v) { db.settings = { ...db.settings, ...v }; save(); publish(); },
    reset() { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} db = { cards: seed.cards, snaps: seed.snaps, icons: [], settings: {} }; publish(); },
    stop() {},
  };
}

// ---------- Firestore ----------

async function firestoreBackend(depot) {
  const { fb, db } = await cloud.init(); // angemeldet ist man zu diesem Zeitpunkt bereits (app.js)
  const base = fb.doc(db, "depots", depot);
  const col = name => fb.collection(base, name);
  const ts = s => fb.Timestamp.fromDate(parseDay(s));
  const day = t => t && t.toDate ? toISODate(t.toDate()) : null;

  const cardTo = c => {
    const d = { name: c.name, rating: c.rating, chemistryStyle: c.chem, buyPrice: c.ek, buyDate: ts(c.ekDate),
      owner: c.owner || "", notes: c.notes || "", createdAt: fb.Timestamp.fromMillis(c.createdAt || Date.now()) };
    if (c.vk != null) { d.sellPrice = c.vk; d.sellDate = ts(c.vkDate); }
    if (c.restock) d.restock = c.restock; // Einkaufsliste: "open", "done" (nachgekauft) oder "skip" (übersprungen)
    if (c.listPrice != null && c.vk == null) { d.listPrice = c.listPrice; d.listDate = ts(c.listDate || toISODate(new Date())); } // auf der Transferliste
    return d;
  };
  const cardFrom = (id, d) => (d.name && d.buyPrice != null && d.buyDate) ? {
    id, name: d.name, rating: d.rating || 0, chem: d.chemistryStyle || "Basic", ek: d.buyPrice, ekDate: day(d.buyDate),
    vk: d.sellPrice ?? null, vkDate: d.sellPrice != null ? day(d.sellDate) || day(d.buyDate) : null,
    owner: d.owner || "", notes: d.notes || "", createdAt: d.createdAt ? d.createdAt.toMillis() : 0, restock: d.restock || null,
    listPrice: d.sellPrice == null ? d.listPrice ?? null : null, listDate: d.sellPrice == null ? day(d.listDate) : null } : null;
  const snapTo = s => ({ date: ts(s.date), teamValue: s.team, transferListValue: s.tl, coins: s.coins,
    ownTransferListValue: s.tlOwn, soldCards: s.sold, listedCards: s.listed, tradingProfit: s.profit, notes: s.notes || "" });
  const snapFrom = (id, d) => d.date ? { id, date: day(d.date), team: d.teamValue || 0, tl: d.transferListValue || 0,
    coins: d.coins || 0, tlOwn: d.ownTransferListValue || 0, sold: d.soldCards || 0, listed: d.listedCards || 0,
    profit: d.tradingProfit || 0, notes: d.notes || "" } : null;

  const onErr = e => { data.error = e.message; emit(); };
  const unsubs = [
    fb.onSnapshot(col("players"), s => { data.cards = s.docs.map(x => cardFrom(x.id, x.data())).filter(Boolean); data.ready = true; emit(); }, onErr),
    fb.onSnapshot(col("snapshots"), s => { data.snaps = s.docs.map(x => snapFrom(x.id, x.data())).filter(Boolean); emit(); }, onErr),
    fb.onSnapshot(fb.doc(col("settings"), "main"), s => { data.settings = s.exists() ? s.data() : {}; emit(); }, onErr),
    fb.onSnapshot(col("chemIcons"), s => { data.icons = s.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.style && x.hex); emit(); }, onErr),
  ];
  return {
    saveCard: c => fb.setDoc(fb.doc(col("players"), c.id), cardTo(c)),
    async saveCards(cs) {
      for (let i = 0; i < cs.length; i += 400) {
        const batch = fb.writeBatch(db);
        cs.slice(i, i + 400).forEach(c => batch.set(fb.doc(col("players"), c.id), cardTo(c)));
        await batch.commit();
      }
    },
    deleteCard: id => fb.deleteDoc(fb.doc(col("players"), id)),
    saveSnap: s => fb.setDoc(fb.doc(col("snapshots"), s.id), snapTo(s)),
    deleteSnap: id => fb.deleteDoc(fb.doc(col("snapshots"), id)),
    saveIcon: i => fb.setDoc(fb.doc(col("chemIcons"), i.id), { style: i.style, hex: i.hex, createdAt: fb.Timestamp.now() }),
    saveSettings: v => fb.setDoc(fb.doc(col("settings"), "main"), v, { merge: true }),
    stop() { unsubs.forEach(u => u()); },
  };
}

// ---------- Öffentliche API ----------

export async function connect({ depot, demoSeed }) {
  if (backend) backend.stop();
  data.cards = []; data.snaps = []; data.icons = []; data.settings = {}; data.ready = false; data.error = null;
  if (depot && depot !== "DEMO") {
    data.mode = "cloud"; emit();
    try { backend = await firestoreBackend(depot); }
    catch (e) { data.error = "Verbindung fehlgeschlagen: " + e.message; data.ready = true; emit(); backend = null; }
  } else {
    data.mode = "demo";
    backend = demoBackend(demoSeed());
  }
}

const run = p => Promise.resolve(p).catch(e => { data.error = "Speichern fehlgeschlagen: " + e.message; emit(); });
const optimistic = (list, item) => { const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); emit(); };

export const saveCard = c => { optimistic(data.cards, c); return run(backend?.saveCard(c)); };
export const saveCards = cs => run(backend?.saveCards(cs));
export const deleteCard = id => { data.cards = data.cards.filter(c => c.id !== id); emit(); return run(backend?.deleteCard(id)); };
export const saveSnap = s => { optimistic(data.snaps, s); return run(backend?.saveSnap(s)); };
export const deleteSnap = id => { data.snaps = data.snaps.filter(s => s.id !== id); emit(); return run(backend?.deleteSnap(id)); };
export const saveIcon = i => run(backend?.saveIcon(i));
export const saveSettings = v => { data.settings = { ...data.settings, ...v }; emit(); return run(backend?.saveSettings(v)); };
export const resetDemo = () => backend?.reset && backend.reset();
