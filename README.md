# FC Trader – EA FC 27 Trading-Tracker

App für euer gemeinsames EA FC Konto: Käufe und Verkäufe von Spielerkarten erfassen – per Hand oder per
Screenshot –, Gewinn automatisch berechnen, alles in Echtzeit zwischen euren iPhones synchronisiert.

Das Projekt gibt es in zwei Varianten:

| | **Web-App** (`web/`) – empfohlen | iOS-App (`FCTrader/`) |
|---|---|---|
| Installation | Safari → „Zum Home-Bildschirm“ | Xcode auf einem Mac |
| Kosten | keine | kostenlos (7 Tage gültig) oder 99 €/Jahr |
| Gemeinsame Daten | Firebase | Firebase (gleiche Datenbank) |
| Texterkennung | Tesseract, läuft im Browser auf dem iPhone | Apple Vision |

Beide Varianten nutzen dasselbe Datenmodell und können parallel verwendet werden.

---

## Web-App einrichten (ca. 20 Minuten, kein Mac nötig)

### 1. Firebase (gemeinsame Datenbank)
1. <https://console.firebase.google.com> → **Projekt hinzufügen** (Google Analytics nicht nötig).
2. **Build → Authentication → Jetzt starten → Anmeldemethode → Anonym** aktivieren.
3. **Build → Firestore Database → Datenbank erstellen** (Standort z. B. `eur3`, *Produktionsmodus*).
4. Firestore → **Regeln**: Inhalt von [`firestore.rules`](firestore.rules) einfügen → **Veröffentlichen**.
5. **Projekteinstellungen (Zahnrad) → Allgemein → Deine Apps → Web-App `</>`** hinzufügen (Name z. B. „FC Trader“,
   *kein* Firebase Hosting nötig). Den angezeigten `firebaseConfig`-Block kopieren.
6. Den Block in [`web/config.js`](web/config.js) eintragen (auf GitHub: Datei öffnen → Stift-Symbol → einfügen →
   *Commit changes*) – oder einfach an Claude schicken, der trägt ihn ein.
   Die Werte sind nicht geheim; der Zugriff wird über die Regeln und den Depot-Code geschützt.

### 2. Veröffentlichen (Netlify, kostenlos)
1. <https://app.netlify.com> → mit GitHub anmelden.
2. **Add new site → Import an existing project → GitHub** → Repository `EAFC27` wählen.
3. Branch wählen (aktuell `claude/ea-fc-player-tracker-da0of6`, später `main`). Die restlichen Einstellungen kommen
   aus [`netlify.toml`](netlify.toml) (Ordner `web`, kein Build) → **Deploy**.
4. Unter *Site configuration → Change site name* eine Adresse wählen, z. B. `fc-trader-denis.netlify.app`.
   Jede Änderung im Repository wird ab jetzt automatisch veröffentlicht.

### 3. Auf die iPhones
1. Die Netlify-Adresse in **Safari** öffnen.
2. **Teilen → „Zum Home-Bildschirm“**. Ab jetzt startet FC Trader wie eine App (Vollbild, eigenes Symbol).
3. Du: Namen eingeben → **Neues Depot erstellen** → unter *Einstellungen* **Code teilen**.
4. Freund: Namen eingeben → Code bei **Depot beitreten** eintragen.
5. Unter *Einstellungen → Aus Excel importieren* einmalig eure Excel-Datei (`.xlsx`) wählen.

> Ohne Firebase-Konfiguration startet die App im **Demo-Modus** – zum Ausprobieren, Daten bleiben dann nur im Browser.

---

## Funktionen

### Erfassung – so wenige Taps wie möglich
- **Kauf erfassen** (+): Name, Rating, Chemistry Style (Dropdown + zuletzt genutzte als Schnellauswahl),
  Einkaufspreis, Kaufdatum (heute vorausgefüllt), Notiz.
- **Vorschläge beim Tippen**: bekannte Spieler füllen Rating und Chemistry Style automatisch.
- **Preiseingabe**: `12500`, `12.500`, `12,5k` oder `1.2m`, dazu Schnelltasten `+000` und `k`.
- **„Sichern & nächste Karte“** für mehrere Käufe hintereinander.
- **Verkaufen** (Knopf „VK“): nur Preis eintippen, Gewinn wird live berechnet. Schnellauswahl
  „kalk. VK“, „Break-even“, „+10 %“, „+20 %“ (inkl. Preisstufen des Transfermarkts).

### Einkaufsliste (Tab „Einkauf“)
- Jede als verkauft markierte Karte erscheint automatisch mit **Name, Rating, Chemistry Style und letztem EK** –
  gleiche Karten zusammengefasst („Amani 78 Basic ×3“), dazu Anzahl und Budget (Summe letzter EK).
- **„Gekauft“**: EK ist mit dem letzten Wert vorausgefüllt (± Preisstufe, Anzahl wählbar) → wird als neuer Kauf gespeichert.
- **✕** nimmt eine Karte ohne Nachkauf von der Liste.
- Zwei Bereiche: **Nachkauf** (verkaufte Karten, Vorrang) und **Ersatzspieler** (von Hand geplant).
- **„+ Ersatzspieler planen“**: Name, Rating, Chemistry Style, Preis (EK), voraussichtlicher Angebotspreis, Anzahl
  (`depots/{Code}/wishes`). Ladenhüter ohne Nachkauf werden der Reihe nach durch geplante Ersatzspieler ersetzt.
- Der voraussichtliche Angebotspreis wird beim Kauf übernommen und beim Verkaufen vorbelegt.
- **Einkaufsliste oder Merkliste**: beim Hinzufügen wählbar. Die Merkliste ist nur zum Beobachten (zählt nicht zur Einkaufsliste);
  „→ Einkaufsliste“ verschiebt einen Spieler.
- **Screenshot hochladen** (Tab Einkauf): liest Spieler aus Listen (Zeilen mit grünem „+“, Name(Position), Rating-Abzeichen, Preis)
  oder aus einer Einzelkarte mit Preis. Ratings der Abzeichen per Mustervergleich (`web/js/digit-templates.js`).
  Vor dem Speichern Prüffenster mit Wahl Einkaufsliste/Merkliste.
- Steht ein Spieler schon auf einer Liste, fragt die App vor dem erneuten Hinzufügen nach (Ja/Nein).
- Käufe über **+** oder **per Screenshot** haken passende Einträge (gleicher Spieler & Rating) automatisch ab.
- Alte Verkäufe aus dem Excel-Import erscheinen nicht auf der Liste – importierte Karten, die ihr in der App verkauft, schon.
- Im Bearbeiten-Fenster einer verkauften Karte: **„Auf die Einkaufsliste setzen“**, falls eine Karte fehlt.

### Nachkauf-Bewertung
- Jede Karte auf der Einkaufsliste zeigt, wie oft ihr sie schon gedreht habt, Ø Gewinn, Ø Haltedauer und den **max. EK**
  (mittlerer VK der letzten 3 Verkäufe − 5 % Tax − Mindestgewinn). Liegt der letzte EK darüber, erscheint „teuer“.
- Beim „Gekauft“ zusätzlich die letzten Verkäufe (EK/VK/Gewinn), ein Chip „max. EK“ und eine Warnung bei zu hohem Preis.

### Preisanpassung (Ladenhüter)
- Offene Karten, die länger als **7 Tage** nicht verkauft sind, erscheinen in der Übersicht mit „Preis anpassen“.
- **„Angepasst“** bestätigt die Anpassung. Dabei kann der **aktuelle EK** (Marktpreis) eingetragen werden – daraus wird der
  neue VK (EK + Aufschlag) berechnet. Der gespeicherte EK der Karte bleibt unverändert; der neue VK ist beim Verkaufen vorbelegt.
- Ist die Karte **3 Tage** nach der Anpassung noch unverkauft, kommt sie nach dem Verkauf **nicht** auf die Einkaufsliste
  („kein Nachkauf“). Bei Bedarf: verkaufte Karte antippen → „Auf die Einkaufsliste setzen“. Beide Fristen unter Einstellungen.

### Screenshot / Bildschirmvideo scannen (Symbol neben dem +)
Die Erkennung läuft komplett auf dem Gerät. Die App erkennt selbst, ob es ein **Kauf** oder ein **Verkauf** ist:

| Ansicht im Spiel | Erkannt | Aktion in der App |
|---|---|---|
| Item-Details „…ergattert f. 1.000“ / „Item gekauft für“ | Name, Rating, Chemistry Style, Kaufpreis | Kauf prüfen & speichern |
| Kandidatenliste → Ersteigerte Items | alle Karten mit „Verkauft für“ (= bezahlter Preis) | mehrere Käufe auf einmal |
| Transferliste → Verk. Items | alle verkauften Karten mit „Verkauft für“ | Verkäufe dem ältesten offenen Kauf zuordnen |
| Item-Details „Endpreis 2.100“ | Name, Rating, Verkaufspreis | Verkauf verbuchen |
| Bildschirmvideo | alle 0,5 s ein ruhiges Einzelbild (gleiche und Wisch-Übergänge übersprungen, max. 12) – jede durchgewischte Karte wird erfasst | wie oben |

- Kontostand, „Startpreis“, „Sofortkauf“ und „Schnellverkauf“ werden ignoriert.
- **Chemistry Style am Kartensymbol** (alle 23 Stile). Ist die Erkennung unsicher, wird der zuletzt genutzte Stil des
  Spielers vorbelegt und markiert. Korrekturen werden als Vorlage gespeichert (gemeinsam im Depot) – die Erkennung lernt mit.
- Beim Verkauf kommen Chemistry Style und EK aus dem Kauf (EA zeigt den Stil nach dem Verkauf nicht mehr).
- Doppelte Scans (gleicher Spieler & Preis am selben Tag) werden markiert.
- Namen werden tolerant abgeglichen: „Fiamma Benítez“ im Spiel passt zu „Benitez“ aus der Excel.
- Dauer: ca. 3–8 Sekunden pro Screenshot. Beim ersten Scan wird die Texterkennung einmalig geladen (~9 MB).

### Gewinnberechnung
```
Gewinn = Verkaufspreis − 5 % EA Tax − Einkaufspreis
Marge  = Gewinn / Verkaufspreis
```
- **Kalk. VK / Ziel**: EK + Aufschlag laut eurer bisherigen Excel-Tabelle (Spalte „kalk. VK“)

  | EK bis | 2.000 | 4.000 | 6.000 | 10.000 | 15.000 | 25.000 | 50.000 | 100.000 | 200.000 | darüber |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Aufschlag | 1.000 | 1.500 | 2.000 | 2.500 | 3.000 | 4.000 | 6.000 | 10.000 | 20.000 | 60.000 |

- **Break-even**: kleinster Marktpreis ohne Verlust nach Tax (auf gültige Preisstufe gerundet)

### Übersicht
- **Wochenziel** mit Fortschrittsbalken und Vergleich zur Vorwoche (bis zum gleichen Wochentag)
- **Ladenhüter**: offene Karten ab X Tagen, gebundenes Kapital, direkt Preis anpassen oder verkaufen
- **Gewinn pro Woche** (8 Wochen, antippbar) mit gebundenem Kapital und Rendite, **Gewinnverlauf** kumuliert
- **Was lohnt sich?** – Gewinn, Marge, Haltedauer und **Gewinn pro Tag Haltedauer** nach Preisklasse, Style, Rating, Wochentag
- **Verluste**: Anteil, Summe, größte Verlustbringer

Zeitraum wählbar (Heute / 7 Tage / 30 Tage / Gesamt):
- Gesamtgewinn, unverkaufte Spieler, aktuell investiert, kalk. VK-Wert der offenen Spieler inkl. erwartetem Gewinn
- Ø Gewinn pro Verkauf, Ø Marge, Trefferquote, Rendite, Gesamt EK / VK, Ø Haltedauer, bezahlte EA Tax
- **Gewinn pro Tag** (letzte 10 Tage, antippbar) und **pro Kalenderwoche**
- **Top-Spieler** und vollständiges **Spieler-Ranking**
- Bester / schwächster Verkauf, „Am längsten im Club“ mit Ziel-VK und Verkaufen-Knopf

### Spielerliste
Filter Offen / Verkauft / Alle, Suche, Sortierung (Neueste, Gewinn, Rating, Preis, Haltedauer),
**Zeitraum** (diese/letzte Woche, einzelne KW, Monate), Summenleiste.
Antippen öffnet Bearbeiten (inkl. Verkauf rückgängig machen und Löschen).

### Vermögen (ersetzt die „Wochenübersicht“)
Einmal pro Woche eintragen (alles händisch, wie in der Excel): Teamwert (ESBC), TL-Wert (ESBC), Coins Bank,
TL-Wert (eigen), VK ÜV-Karten, ÜV-Karten a. Liste, Gewinn ÜV. Die App rechnet das **ges. Vermögen**
(Teamwert + TL-Wert ESBC + Coins) und bei jedem Wert **Plus z. Vorw.** aus.

### Trading-Ziele & Backup (Einstellungen)
- Wochenziel, Mindestgewinn pro Karte, Ladenhüter-Tage – gemeinsam für das Depot (`depots/{Code}/settings/main`).
- **Backup herunterladen**: alles (Spieler, Wochenstände, Symbole, Einstellungen) als JSON; die Übersicht erinnert nach 7 Tagen.
- **Backup wiederherstellen**: überschreibt gleiche Einträge; optional „exakt wie im Backup“.

### Excel-Import & -Export
- **Import**: eure `.xlsx` direkt (Reiter „Spieler“) oder eine `.csv`. Spalten werden über die Überschrift erkannt
  (Name, Rating, ChemieStyle, EK, EK Datum, VK, VK Datum). Ein erneuter Import überschreibt statt zu verdoppeln.
- **Export** als CSV im gleichen Aufbau (inkl. kalk. VK, Tax, Gewinn, Marge).

---

## Technik

| Baustein | Web-App | iOS-App |
|---|---|---|
| Oberfläche | HTML/CSS/JavaScript ohne Build-Schritt, installierbar (PWA, offline) | SwiftUI, iOS 17+ |
| Daten | Firebase Firestore + anonyme Anmeldung, Zugriff über **Depot-Code** | gleich |
| Texterkennung | Tesseract.js (deutsch), zwei Durchgänge (normal + invertiert) | Apple Vision |
| Chemistry Style | Symbolabgleich `web/js/chemicons.js` | `ChemistryIconMatcher.swift` |

Datenstruktur: `depots/{Code}/players/{ID}`, `depots/{Code}/snapshots/{ID}`, `depots/{Code}/chemIcons/{ID}`

Mitgelieferte Bibliotheken in `web/vendor/` (keine externen Server nötig): Tesseract.js 5.1 + deutsche Sprachdaten,
Firebase 10.14 (gebündelt), SheetJS 0.18 (Excel).

### Web-App lokal starten
```bash
cd web && python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

### iOS-App (optional, benötigt Mac mit Xcode 15+)
```bash
brew install xcodegen && xcodegen && open FCTrader.xcodeproj
```
Firebase: iOS-App in der Firebase-Konsole anlegen (Bundle-ID `com.fctrader.app`), `GoogleService-Info.plist`
nach `FCTrader/` legen, erneut `xcodegen`. Ohne die Datei startet die App im Demo-Modus.

## Anpassen

- **Chemistry Stylee**: `web/js/calc.js` (`STYLES`) bzw. `FCTrader/Models/ChemistryStyles.swift`.
- **Steuersatz / Aufschläge**: `TAX_RATE` und `TIERS` in `web/js/calc.js` bzw. `FCTrader/Models/PlayerCard.swift`.
- **Chemistry Style-Symbole**: Vorlagen neu erzeugen mit
  `python3 Tools/chem_icons/build_templates.py <Ordner mit Item-Details-Screenshots, benannt nach Stil>`
  (schreibt die Swift-Datei; für die Web-App anschließend `web/js/chem-templates.js` daraus übernehmen).

## Ideen für die nächsten Schritte
- Kartenversion (TOTW, Promo …) und Position als zusätzliche Felder
