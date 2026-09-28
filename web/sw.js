// Offline-Fähigkeit: App-Dateien aus dem Cache, Firebase/Schriften aus dem Netz.
const VERSION = "fctrader-v1.2.4";
const SHELL = ["./", "index.html", "css/app.css", "config.js", "manifest.webmanifest",
  "js/app.js", "js/calc.js", "js/store.js", "js/parser.js", "js/ocr-lines.js", "js/chemicons.js", "js/chem-templates.js",
  "js/importer.js", "js/ocr.js", "js/insights.js", "vendor/firebase.js", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Firebase, Google Fonts: direkt ins Netz
  const isCode = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");
  if (isCode && !url.pathname.includes("/vendor/")) {
    // App-Code: zuerst Netz (für Updates), sonst Cache
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request)));
  } else {
    // Bibliotheken, Sprachdaten, Bilder: Cache zuerst (groß, ändern sich selten)
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
    })));
  }
});
