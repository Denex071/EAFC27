# FC Trader – EA FC 27 Trading-Tracker (iOS)

Gemeinsame iPhone-App für euer gemeinsames EA FC Konto: Käufe und Verkäufe von Spielerkarten erfassen,
Gewinn automatisch berechnen, alles in Echtzeit zwischen den iPhones synchronisiert.

## Funktionen (Version 0.1)

### Erfassung – so wenige Taps wie möglich
- **Kauf erfassen**: Name, Rating, Chemiestil (Dropdown), Einkaufspreis, Kaufdatum (vorausgefüllt mit „jetzt“).
- **Screenshot / Bildschirmvideo scannen** (Symbol ⌗ oben rechts in Übersicht und Spielerliste):
  Texterkennung auf dem iPhone (Apple Vision), abgestimmt auf die deutsche Spieloberfläche.
  Die App erkennt selbst, ob es ein **Kauf** oder ein **Verkauf** ist:

  | Ansicht im Spiel | Erkannt | Aktion in der App |
  |---|---|---|
  | Item-Details „…ergattert f. 1.000“ | Name, Rating, Kaufpreis | Kauf prüfen & speichern |
  | Kandidatenliste → Ersteigerte Items | alle Karten mit Name, Rating, „Verkauft für“ (= Kaufpreis) | mehrere Käufe auf einmal |
  | Transferliste → Verk. Items | alle verkauften Karten mit „Verkauft für“ (= Verkaufspreis) | Verkäufe werden dem ältesten offenen Kauf zugeordnet |
  | Item-Details „Endpreis 2.100“ | Name, Rating, Verkaufspreis | Verkauf verbuchen |
  | Bildschirmvideo | ca. 3 Bilder/Sek., Ergebnis per Mehrheitsentscheid | wie oben |

  - Kontostand oben und Tab-Leiste unten werden ignoriert, „Startpreis“, „Sofortkauf“ und „Schnellverkauf“ ebenfalls.
  - Der **Chemiestil** wird am **Symbol auf der Karte** erkannt (alle 23 Stile, Detailseite und Listen).
    Ist die Erkennung unsicher, wird der zuletzt genutzte Stil des Spielers vorbelegt und markiert.
    Korrigierte Stile werden als zusätzliche Vorlage gespeichert (gemeinsam im Depot) – die Erkennung lernt mit.
    Beim Verkauf kommt der Stil aus dem Kauf (EA zeigt ihn nach dem Verkauf nicht mehr).
  - Doppelt gescannte Verkäufe (gleicher Spieler & Preis in den letzten 36 Std.) werden markiert und nicht automatisch verbucht.
  - Namen werden tolerant abgeglichen: „Fiamma Benítez“ im Spiel passt zu „Benitez“ aus der Excel.
- **Autovervollständigung**: Bereits gehandelte Spieler werden beim Tippen vorgeschlagen und füllen
  Rating + Chemiestil automatisch.
- **Zuletzt genutzte Chemiestile** als Schnellauswahl neben dem Dropdown.
- **Preiseingabe**: `12500`, `12.500`, `12,5k` oder `1.2m` – plus `000`- und `k`-Taste über der Tastatur.
- **Automatischer Fokus**: Nach 2 Ziffern Rating springt der Cursor direkt zum Preis.
- **„Sichern & nächste Karte“** für mehrere Käufe hintereinander.
- **Verkaufen per Wischgeste** (nach rechts wischen): nur Preis eintippen, Gewinn wird live berechnet.
  Chips „Break-even / +5 % / +10 % / +20 %“ setzen den passenden Preis (inkl. Preisstufen des Marktes).
- **„Nochmal gekauft“**: gleiche Karte mit einem Tap erneut erfassen.

### Gewinnberechnung
```
Gewinn = Verkaufspreis − 5 % EA Tax − Einkaufspreis
Marge  = Gewinn / Verkaufspreis
```
Zusätzlich zeigt die App für jede offene Karte:
- **Kalk. VK / Ziel**: EK + Aufschlag laut eurer bisherigen Excel-Tabelle (Spalte „kalk. VK“)

  | EK bis | 2.000 | 4.000 | 6.000 | 10.000 | 15.000 | 25.000 | 50.000 | 100.000 | 200.000 | darüber |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Aufschlag | 1.000 | 1.500 | 2.000 | 2.500 | 3.000 | 4.000 | 6.000 | 10.000 | 20.000 | 60.000 |

- **Break-even**: kleinster Marktpreis ohne Verlust nach Tax (auf gültige Preisstufe gerundet)

### Übersicht (Dashboard)
Zeitraum wählbar (Heute / 7 Tage / 30 Tage / Gesamt) – alles, was die Excel-Seite „Dashboard“ hatte, plus mehr:
- Gesamtgewinn, Anzahl Verkäufe
- Unverkaufte Spieler, aktuell investiert, **kalkulierter VK-Wert** der offenen Spieler inkl. erwartetem Gewinn
- Ø Gewinn pro Verkauf, Ø Marge, Trefferquote, Rendite
- Gesamt EK / Gesamt VK, Ø Haltedauer, bezahlte EA Tax
- **Gewinn pro Tag** (letzte 10 Tage, Balkendiagramm) oder **Gewinnverlauf** (Linie) – antippen für Details
- **Gewinn pro Kalenderwoche**
- **Top-Spieler** (summiert je Spieler) mit vollständigem **Spieler-Ranking** (sortierbar nach Gewinn, Anzahl, Ø Gewinn, Haltedauer)
- Bester und schwächster Verkauf
- „Am längsten im Club“ – Ladenhüter mit Ziel-VK und Direkt-Verkaufen-Button

### Vermögen (ersetzt die „Wochenübersicht“)
Einmal pro Woche einen Stand mit denselben Werten wie in der Excel eintragen (alles händisch):
Teamwert (ESBC), TL-Wert (ESBC), Coins Bank, TL-Wert (eigen), VK ÜV-Karten, ÜV-Karten a. Liste, Gewinn ÜV.

- Wertefelder sind mit dem letzten Stand vorausgefüllt, die ÜV-Felder starten leer.
- Automatisch: **ges. Vermögen** (Teamwert + TL-Wert ESBC + Coins) und **Plus z. Vorw.** bei jedem Wert.
- Verlaufsdiagramm des Gesamtvermögens.

### Spielerliste
Filter Offen / Verkauft / Alle, Suche, Sortierung (Neueste, Gewinn, Rating, Preis, Haltedauer),
Summenleiste unten (EK und Ziel-VK bzw. Gewinn).

### Excel-Import & -Export
- **Import** (Einstellungen → „Aus Excel importieren“): Reiter „Spieler“ als CSV.
  - Google Tabellen: *Datei → Herunterladen → CSV (aktuelles Tabellenblatt)*
  - Excel: *Datei → Speichern unter → CSV UTF-8*
  - Spalten werden über die Überschrift erkannt (Name, Rating, ChemieStyle, EK, EK Datum, VK, VK Datum).
  - Ein erneuter Import überschreibt die bereits importierten Einträge, statt sie zu verdoppeln.
- **Export** als CSV im gleichen Aufbau (inkl. kalk. VK, Tax, Gewinn, Marge).

## Technik

| Baustein | Lösung |
|---|---|
| App | SwiftUI, iOS 17+ |
| Gemeinsame Daten | Firebase Firestore (kostenloser Spark-Plan reicht), Echtzeit-Sync + Offline-Cache |
| Anmeldung | Firebase anonyme Anmeldung, Zugriff über gemeinsamen **Depot-Code** |
| Texterkennung | Apple Vision (on-device, kostenlos, keine Daten verlassen das Gerät) |

Datenstruktur: `depots/{Depot-Code}/players/{ID}` und `depots/{Depot-Code}/snapshots/{ID}`

## Einrichtung

Voraussetzung: Mac mit **Xcode 15 oder neuer**.

### 1. Projekt erzeugen
Das Xcode-Projekt wird mit [XcodeGen](https://github.com/yonaskolb/XcodeGen) aus `project.yml` erzeugt:
```bash
brew install xcodegen
xcodegen
open FCTrader.xcodeproj
```
Xcode lädt das Firebase-Paket beim ersten Öffnen automatisch herunter.

**Ohne weitere Einrichtung startet die App im Demo-Modus mit Beispieldaten** – ideal zum ersten Durchklicken
im Simulator.

### 2. Firebase einrichten (für den gemeinsamen Betrieb)
1. Auf <https://console.firebase.google.com> ein Projekt anlegen (Google Analytics nicht nötig).
2. **iOS-App hinzufügen** mit Bundle-ID `com.fctrader.app` (oder die in `project.yml` geänderte).
3. `GoogleService-Info.plist` herunterladen und in den Ordner `FCTrader/` legen, danach erneut `xcodegen` ausführen.
4. **Build → Authentication → Anmeldemethode → Anonym** aktivieren.
5. **Build → Firestore Database → Datenbank erstellen** (Region z. B. `eur3`, Produktionsmodus).
6. Unter **Regeln** den Inhalt von [`firestore.rules`](firestore.rules) einfügen und veröffentlichen.

### 3. Auf die iPhones bringen
- In Xcode unter *Signing & Capabilities* dein Team auswählen (kostenlose Apple-ID reicht).
- iPhone per Kabel anschließen und starten. Das funktioniert auch für das iPhone deines Freundes.
  - Mit kostenloser Apple-ID läuft die App 7 Tage und muss dann neu installiert werden.
  - Mit dem Apple Developer Program (99 €/Jahr) geht die Verteilung bequem über **TestFlight**.

### 4. Loslegen
1. Du: Namen eingeben → **Neues Depot erstellen** → in den Einstellungen **Code mit Freund teilen**.
2. Freund: Namen eingeben → Code bei **Depot beitreten** eintragen.
3. Ab jetzt seht ihr beide dieselben Karten live.

## Anpassen

- **Chemiestile**: `FCTrader/Models/ChemistryStyles.swift`.
- **Steuersatz**: `EATax.rate` in `FCTrader/Models/PlayerCard.swift`.
- **Aufschläge für den kalk. VK**: `TargetPrice.tiers` in `FCTrader/Models/PlayerCard.swift`.
- **Chemiestil-Symbole**: Vorlagen in `FCTrader/Models/ChemistryIconTemplates.swift`, neu erzeugen mit
  `python3 Tools/chem_icons/build_templates.py <Ordner mit Item-Details-Screenshots, benannt nach Stil>`.
  `Tools/chem_icons/iconlib.py` ist die Referenz-Implementierung von `ChemistryIconMatcher.swift`.

## Ideen für die nächsten Schritte
- Share-Extension: Screenshot direkt aus der Fotos-App an FC Trader senden
- Zielpreis pro Karte + Push-Benachrichtigung / Erinnerung für Ladenhüter
- Kartenversion (TOTW, Promo …) und Position als zusätzliche Felder
- Widget für den Homescreen (Tagesgewinn, offene Karten)
