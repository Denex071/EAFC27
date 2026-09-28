// Konten & Depots (Firebase Auth mit E-Mail/Passwort, Firestore).
//   users/{uid}            – { depotId, name, email }
//   depots/{id}            – { owner, members: [uid], names: {uid: Name}, name, invite, created }
//   depots/{id}/players …  – Daten (siehe store.js)
//   invites/{code}         – { depotId, owner } – Einladungscode für Partner

let fbPromise = null;
let ctx = null; // { fb, app, auth, db }

export const enabled = () => !!window.FIREBASE_CONFIG;

export function init() {
  if (!fbPromise) fbPromise = (async () => {
    const fb = await import("../vendor/firebase.js");
    const app = fb.initializeApp(window.FIREBASE_CONFIG);
    const auth = fb.getAuth(app);
    let db;
    try { db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) }); }
    catch (e) { db = fb.getFirestore(app); }
    // Nur für lokale Tests: window.FIREBASE_EMULATOR = "localhost" in config.js
    if (window.FIREBASE_EMULATOR) {
      fb.connectAuthEmulator(auth, `http://${window.FIREBASE_EMULATOR}:9099`, { disableWarnings: true });
      fb.connectFirestoreEmulator(db, window.FIREBASE_EMULATOR, 8080);
    }
    ctx = { fb, app, auth, db };
    return ctx;
  })();
  return fbPromise;
}
export const context = () => ctx;

/// Wartet auf den ersten Anmeldestatus und meldet danach jede Änderung.
export async function onUser(fn) {
  const { fb, auth } = await init();
  return fb.onAuthStateChanged(auth, fn);
}

const MESSAGES = {
  "auth/invalid-email": "Die E-Mail-Adresse ist ungültig.",
  "auth/missing-password": "Bitte ein Passwort eingeben.",
  "auth/weak-password": "Das Passwort muss mindestens 6 Zeichen haben.",
  "auth/email-already-in-use": "Für diese E-Mail gibt es schon ein Konto – bitte anmelden.",
  "auth/invalid-credential": "E-Mail oder Passwort stimmt nicht.",
  "auth/wrong-password": "E-Mail oder Passwort stimmt nicht.",
  "auth/user-not-found": "E-Mail oder Passwort stimmt nicht.",
  "auth/too-many-requests": "Zu viele Versuche. Bitte kurz warten.",
  "auth/network-request-failed": "Keine Verbindung zum Internet.",
  "auth/requires-recent-login": "Bitte zur Sicherheit dein Passwort erneut eingeben.",
  "permission-denied": "Keine Berechtigung.",
};
export const message = e => MESSAGES[e?.code] || e?.message || String(e);

export async function register(email, password, name) {
  const { fb, auth } = await init();
  const cred = await fb.createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name) await fb.updateProfile(cred.user, { displayName: name }).catch(() => {});
  return cred.user;
}
export async function login(email, password) {
  const { fb, auth } = await init();
  return (await fb.signInWithEmailAndPassword(auth, email.trim(), password)).user;
}
export async function resetPassword(email) {
  const { fb, auth } = await init();
  await fb.sendPasswordResetEmail(auth, email.trim());
}
/// Abmelden und den lokalen Zwischenspeicher leeren (wichtig auf geteilten Geräten).
export async function logout() {
  const { fb, auth, db } = await init();
  await fb.signOut(auth);
  try { await fb.terminate(db); await fb.clearIndexedDbPersistence(db); } catch (e) { /* egal */ }
}

// ---------- Depot ----------

const newCode = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(8));
  return [...r].map(x => a[x % a.length]).join("").replace(/^(.{4})/, "$1-");
};
const newId = () => crypto.randomUUID().replace(/-/g, "");

export async function loadDepot(depotId) {
  const { fb, db } = await init();
  const d = await fb.getDoc(fb.doc(db, "depots", depotId));
  return d.exists() ? d.data() : null;
}

/// Profil des angemeldeten Nutzers laden; beim ersten Mal eigenes Depot anlegen.
export async function ensureProfile(user, name) {
  const { fb, db } = await init();
  const ref = fb.doc(db, "users", user.uid);
  const snap = await fb.getDoc(ref);
  let profile = snap.exists() ? snap.data() : null;
  if (profile?.depotId) {
    // Depot noch erreichbar? (z. B. vom Besitzer gelöscht oder man wurde entfernt)
    const d = await fb.getDoc(fb.doc(db, "depots", profile.depotId)).catch(() => null);
    if (d && d.exists()) return { ...profile, depot: d.data() };
  }
  if (profile?.ownDepotId) {
    // aus einem geteilten Depot entfernt → zurück ins eigene
    const d = await fb.getDoc(fb.doc(db, "depots", profile.ownDepotId)).catch(() => null);
    if (d && d.exists()) { await fb.setDoc(ref, { depotId: profile.ownDepotId }, { merge: true }); return { ...profile, depotId: profile.ownDepotId, depot: d.data() }; }
  }
  const depotId = await createDepot(user, name || profile?.name || user.displayName || "");
  profile = { depotId, ownDepotId: depotId, name: name || profile?.name || user.displayName || "", email: user.email || "" };
  await fb.setDoc(ref, profile);
  const d = await fb.getDoc(fb.doc(db, "depots", depotId));
  return { ...profile, depot: d.data() };
}
async function createDepot(user, name) {
  const { fb, db } = await init();
  const id = newId();
  await fb.setDoc(fb.doc(db, "depots", id), { owner: user.uid, members: [user.uid], names: { [user.uid]: name || "" },
    name: name ? `Depot von ${name}` : "Mein Depot",
    invite: null, created: fb.serverTimestamp() });
  return id;
}
export async function saveName(uid, name, depotId) {
  const { fb, db, auth } = await init();
  await fb.setDoc(fb.doc(db, "users", uid), { name }, { merge: true });
  if (depotId) await fb.updateDoc(fb.doc(db, "depots", depotId), { [`names.${uid}`]: name }).catch(() => {});
  if (auth.currentUser) await fb.updateProfile(auth.currentUser, { displayName: name }).catch(() => {});
}

/// Einladungscode für das eigene Depot erzeugen (ersetzt einen alten Code).
export async function createInvite(uid, depotId) {
  const { fb, db } = await init();
  const dref = fb.doc(db, "depots", depotId);
  const old = (await fb.getDoc(dref)).data()?.invite;
  if (old) await fb.deleteDoc(fb.doc(db, "invites", old)).catch(() => {});
  const code = newCode();
  await fb.setDoc(fb.doc(db, "invites", code), { depotId, owner: uid, created: fb.serverTimestamp() });
  await fb.updateDoc(dref, { invite: code });
  return code;
}
export async function revokeInvite(depotId) {
  const { fb, db } = await init();
  const dref = fb.doc(db, "depots", depotId);
  const old = (await fb.getDoc(dref)).data()?.invite;
  if (old) await fb.deleteDoc(fb.doc(db, "invites", old)).catch(() => {});
  await fb.updateDoc(dref, { invite: null });
}

/// Mit Code einem Depot beitreten. Das eigene (leere) Depot bleibt bestehen, wird aber nicht mehr angezeigt.
export async function joinDepot(uid, code, name) {
  const { fb, db } = await init();
  const inv = await fb.getDoc(fb.doc(db, "invites", code.trim().toUpperCase()));
  if (!inv.exists()) throw new Error("Dieser Code ist ungültig oder abgelaufen.");
  const { depotId } = inv.data();
  await fb.updateDoc(fb.doc(db, "depots", depotId), { members: fb.arrayUnion(uid), [`names.${uid}`]: name || "" }).catch(e => {
    throw new Error(e.code === "permission-denied" ? "Beitritt nicht möglich (Depot voll oder schon Mitglied)." : message(e));
  });
  await fb.setDoc(fb.doc(db, "users", uid), { depotId }, { merge: true });
  return depotId;
}
/// Ein geteiltes Depot verlassen und wieder ein eigenes bekommen.
export async function leaveDepot(user, depotId) {
  const { fb, db } = await init();
  await fb.updateDoc(fb.doc(db, "depots", depotId), { members: fb.arrayRemove(user.uid), [`names.${user.uid}`]: fb.deleteField() });
  // zurück ins eigene Depot (falls noch vorhanden), sonst legt ensureProfile ein neues an
  const own = (await fb.getDoc(fb.doc(db, "users", user.uid))).data()?.ownDepotId || null;
  await fb.setDoc(fb.doc(db, "users", user.uid), { depotId: own !== depotId ? own : null }, { merge: true });
}
/// Besitzer entfernt ein Mitglied.
export async function removeMember(depotId, uid) {
  const { fb, db } = await init();
  await fb.updateDoc(fb.doc(db, "depots", depotId), { members: fb.arrayRemove(uid), [`names.${uid}`]: fb.deleteField() });
}

// ---------- Konto löschen ----------

const COLLECTIONS = ["players", "snapshots", "chemIcons", "settings"];
async function deleteDepotData(depotId) {
  const { fb, db } = await init();
  for (const name of COLLECTIONS) {
    const docs = (await fb.getDocs(fb.collection(db, "depots", depotId, name))).docs;
    for (let i = 0; i < docs.length; i += 400) {
      const b = fb.writeBatch(db);
      docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
      await b.commit();
    }
  }
}
/// Löscht Konto und – als Besitzer – das Depot mit allen Daten. Mitglieder verlassen nur das Depot.
export async function deleteAccount(user, password, profile) {
  const { fb, db } = await init();
  if (password) await fb.reauthenticateWithCredential(user, fb.EmailAuthProvider.credential(user.email, password));
  const depot = profile?.depot, depotId = profile?.depotId;
  if (depotId && depot) {
    if (depot.owner === user.uid) {
      await deleteDepotData(depotId);
      if (depot.invite) await fb.deleteDoc(fb.doc(db, "invites", depot.invite)).catch(() => {});
      await fb.deleteDoc(fb.doc(db, "depots", depotId));
    } else {
      await leaveDepot(user, depotId).catch(() => {});
    }
  }
  // eigenes, früher angelegtes Depot (falls man später einem anderen beigetreten ist) ebenfalls löschen
  if (profile?.ownDepotId && profile.ownDepotId !== depotId) {
    const own = await fb.getDoc(fb.doc(db, "depots", profile.ownDepotId)).catch(() => null);
    if (own?.exists() && own.data().owner === user.uid) {
      await deleteDepotData(profile.ownDepotId);
      await fb.deleteDoc(fb.doc(db, "depots", profile.ownDepotId));
    }
  }
  await fb.deleteDoc(fb.doc(db, "users", user.uid));
  await fb.deleteUser(user);
  try { await fb.terminate(db); await fb.clearIndexedDbPersistence(db); } catch (e) { /* egal */ }
}
