# Denex Trading – öffentliche Version (Beta)

Eigenständige Version des Trading-Trackers für fremde Nutzer. **Komplett getrennt** von der privaten App in `web/`:
eigener Ordner, eigenes Firebase-Projekt, eigene Netlify-Seite. Änderungen hier wirken sich nicht auf die private App aus.

| | Private App (`web/`) | Denex Trading (`denextrading/app/`) |
|---|---|---|
| Zugang | Depot-Code (anonym) | Konto mit E-Mail & Passwort |
| Daten | Firebase-Projekt `eafc27-8f2a4` | **eigenes** Firebase-Projekt |
| Teilen | alle mit dem Code | Partner per Einladungscode (max. 5 im Depot) |
| kalk. VK | feste Aufschläge | pro Depot einstellbar |
| Rechtliches | – | Impressum, Datenschutz, EA-Hinweis |

## Ordner
- `app/` – die Web-App (wird veröffentlicht)
- `branding/` – Logo, TikTok-Profilbilder, App-Symbol (SVG + PNG)
- `firestore.rules` – Sicherheitsregeln für das neue Firebase-Projekt
- `netlify.toml` – Einstellungen für die eigene Netlify-Seite

## Einrichten
### 1. Neues Firebase-Projekt
1. <https://console.firebase.google.com> → **Projekt hinzufügen**, z. B. `denextrading` (Analytics nicht nötig).
2. **Authentication → Jetzt starten → E-Mail/Passwort** aktivieren. Unter *Vorlagen* die Sprache auf **Deutsch** stellen.
3. **Firestore Database → Datenbank erstellen**, Standort **europe-west3 (Frankfurt)**, *Produktionsmodus*.
4. Firestore → **Regeln**: Inhalt von [`firestore.rules`](firestore.rules) einfügen → **Veröffentlichen**.
5. **Projekteinstellungen → Deine Apps → Web-App `</>`** anlegen, den `firebaseConfig`-Block in
   [`app/config.js`](app/config.js) eintragen (statt `null`). Nicht die Werte der privaten App verwenden!

### 2. Eigene Netlify-Seite
1. Netlify → **Add new site → Import an existing project → GitHub** → dasselbe Repository.
2. **Base directory: `denextrading`** (Publish directory ergibt sich aus `denextrading/netlify.toml`: `app`).
3. Site-Namen wählen, z. B. `denextrading.netlify.app`. In Firebase unter *Authentication → Einstellungen →
   Autorisierte Domains* diese Adresse hinzufügen.

### 3. Vor dem öffentlichen Start
- In `app/impressum.html` und `app/datenschutz.html` alle **gelb markierten Platzhalter** ersetzen und die Texte
  prüfen lassen (Vorlagen, keine Rechtsberatung).
- In der Firebase- und Netlify-Konsole jeweils den Vertrag zur Auftragsverarbeitung (DPA) akzeptieren.
- `<meta name="robots" content="noindex">` in `index.html` entfernen, sobald die Seite in Suchmaschinen erscheinen soll.

## Datenmodell
```
users/{uid}                 { depotId, ownDepotId, name, email }
depots/{id}                 { owner, members[], names{uid: Name}, name, invite }
depots/{id}/players|snapshots|chemIcons|settings   – wie in der privaten App
invites/{code}              { depotId, owner }
```
- Beim Registrieren bekommt jeder automatisch ein eigenes Depot.
- **Partner einladen**: Besitzer erzeugt einen Code; der Partner tritt damit bei und sieht dieselben Daten.
  Beim Verlassen kommt er zurück in sein eigenes Depot.
- **Konto löschen** (Einstellungen): löscht Konto und – als Besitzer – das Depot mit allen Daten.

## Lokal testen (mit Firebase-Emulator)
In einer Kopie von `app/config.js` zusätzlich `window.FIREBASE_EMULATOR = "127.0.0.1";` setzen und
`firebase emulators:start --only auth,firestore` mit `firestore.rules` starten.

## Hinweis
Denex Trading ist ein unabhängiges Fan-Projekt und steht in keiner Verbindung zu Electronic Arts Inc.
Die Scan-Erkennung ist aktuell auf die **deutsche** Spielsprache ausgelegt.
