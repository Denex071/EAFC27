// Firebase-Konfiguration des eigenen Projekts „denextrading“ (NICHT das private Depot-Projekt).
// Die Werte sind nicht geheim; der Zugriff wird über Konten und die Regeln in firestore.rules geschützt.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDYE6w-98jpmvOJugZ89Ktmoml0R6lD2tM",
  authDomain: "denextrading.firebaseapp.com",
  projectId: "denextrading",
  storageBucket: "denextrading.firebasestorage.app",
  messagingSenderId: "252983943486",
  appId: "1:252983943486:web:555287e078c9744397cc6f",
};

// Beta-Zugang: Dauer ab Registrierung (Stunden) und maximale Anzahl Einträge (Spieler) pro Depot.
// Die Dauer ist zusätzlich in firestore.rules festgelegt (dort ebenfalls anpassen).
window.BETA = { hours: 24, maxEntries: 50 };
