# FC Trader – EA FC 27 Trading-Tracker (iOS)

Gemeinsame iPhone-App für zwei (oder mehr) Trader: Käufe und Verkäufe von Spielerkarten erfassen,
Gewinn automatisch berechnen, alles in Echtzeit zwischen den iPhones synchronisiert.

## Funktionen (Version 0.1)

### Erfassung – so wenige Taps wie möglich
- **Kauf erfassen**: Name, Rating, Chemiestil (Dropdown), Einkaufspreis, Kaufdatum (vorausgefüllt mit „jetzt“), Käufer.
- **Screenshot / Bildschirmvideo scannen**: Bild oder Aufnahme aus der Mediathek wählen → Name, Rating,
  Chemiestil und Preis werden per Texterkennung (Apple Vision, läuft auf dem iPhone) vorausgefüllt.
  Alle erkannten Texte erscheinen als Chips – Feld antippen, Chip antippen, fertig.
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
```
Zusätzlich zeigt die App für jede offene Karte den **Break-even-Preis** (kleinster Marktpreis ohne Verlust
nach Tax, aufgerundet auf die nächste gültige Preisstufe).

### Übersicht (Dashboard)
Zeitraum wählbar (Heute / 7 Tage / 30 Tage / Gesamt) und filterbar nach Person:
- Realisierter Gesamtgewinn
- Anzahl unverkaufter Karten + Break-even-Summe
- Gebundenes Kapital (EK aller offenen Karten)
- Ø Gewinn pro Trade, Rendite (ROI), Trefferquote
- Ø Haltedauer, Umsatz, bezahlte EA Tax
- Gewinnverlauf als Diagramm (antippen/ziehen für Details)
- Bester und schwächster Flip
- „Am längsten im Club“ – Ladenhüter mit Direkt-Verkaufen-Button
- „Wer liegt vorne?“ – Vergleich zwischen dir und deinem Freund

### Kartenliste
Filter Offen / Verkauft / Alle, Suche, Sortierung (Neueste, Gewinn, Rating, Preis, Haltedauer),
Filter nach Person, Summenleiste unten. CSV-Export für Excel in den Einstellungen.

## Technik

| Baustein | Lösung |
|---|---|
| App | SwiftUI, iOS 17+ |
| Gemeinsame Daten | Firebase Firestore (kostenloser Spark-Plan reicht), Echtzeit-Sync + Offline-Cache |
| Anmeldung | Firebase anonyme Anmeldung, Zugriff über gemeinsamen **Depot-Code** |
| Texterkennung | Apple Vision (on-device, kostenlos, keine Daten verlassen das Gerät) |

Datenstruktur: `depots/{Depot-Code}/players/{Karten-ID}`

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

- **Chemiestile**: `FCTrader/Models/ChemistryStyles.swift` – aktuell ein Platzhalter mit den bekannten Stilen,
  wird durch eure FC 27 Liste ersetzt.
- **Steuersatz**: `EATax.rate` in `FCTrader/Models/PlayerCard.swift`.

## Ideen für die nächsten Schritte
- Chemiestil-Liste aus FC 27 übernehmen
- Scan-Erkennung mit echten FC 27 Screenshots feinjustieren (deutsche/englische Spielsprache)
- Share-Extension: Screenshot direkt aus der Fotos-App an FC Trader senden
- Zielpreis pro Karte + Push-Benachrichtigung / Erinnerung für Ladenhüter
- Kartenversion (TOTW, Promo …) und Position als zusätzliche Felder
- Widget für den Homescreen (Tagesgewinn, offene Karten)
- Wochen-/Monatsauswertung und Rangliste zwischen euch beiden
- Import bestehender Daten aus Excel/CSV
