import Foundation
import AVFoundation
import Vision
import UIKit

/// Ein erkannter Spieler auf einem Screenshot.
struct ScannedItem: Identifiable, Hashable {
    var id = UUID()
    var name: String?
    var rating: Int?
    var price: Int?

    var isEmpty: Bool { name == nil && rating == nil && price == nil }
}

/// Welche Art von Bildschirm gescannt wurde.
enum ScanKind {
    /// Kandidatenliste / „Item ergattert“ – Preis ist der Einkaufspreis.
    case purchase
    /// Transferliste „Verk. Items“ / „Endpreis“ – Preis ist der Verkaufspreis.
    case sale
    case unknown
}

/// Ergebnis eines Scans. Alle Felder sind Vorschläge – der Nutzer bestätigt sie.
struct ScanResult {
    var kind: ScanKind = .unknown
    /// Erkannte Spieler (Kandidatenliste kann mehrere enthalten).
    var items: [ScannedItem] = []
    /// Nur gesetzt, wenn der Stil als Text im Bild steht (auf der Karte ist er nur ein Symbol).
    var chemistryStyle: String?
    /// Alle erkannten Textzeilen zum manuellen Antippen.
    var tokens: [String] = []

    var name: String? { items.first?.name }
    var rating: Int? { items.first?.rating }
    var price: Int? { items.first?.price }

    var isEmpty: Bool { items.isEmpty && chemistryStyle == nil && tokens.isEmpty }
}

/// Eine erkannte Textzeile mit Position (normiert 0…1, Ursprung oben links).
struct TextLine {
    let text: String
    let rect: CGRect

    /// Kleingeschrieben und ohne Akzente/Umlaute ("Verkauft für" → "verkauft fur"),
    /// weil die Texterkennung Umlaute nicht immer zuverlässig liefert.
    var lower: String { ScreenshotParser.fold(text) }

    /// Wie `lower`, aber ohne Leerzeichen – die Erkennung verschluckt sie manchmal ("Verkauftfur:").
    var compact: String { lower.filter { !$0.isWhitespace } }

    func contains(_ keyword: String) -> Bool {
        compact.contains(keyword.filter { !$0.isWhitespace })
    }
}

/// Texterkennung auf dem Gerät (Apple Vision) – keine Daten verlassen das iPhone.
enum TextRecognizer {
    static func lines(in image: CGImage) async throws -> [TextLine] {
        try await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false
            request.recognitionLanguages = ["de-DE", "en-US"]
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
            let lines = (request.results ?? []).compactMap { observation -> TextLine? in
                guard let text = observation.topCandidates(1).first?.string else { return nil }
                let box = observation.boundingBox
                return TextLine(
                    text: text.trimmingCharacters(in: .whitespacesAndNewlines),
                    rect: CGRect(x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
                )
            }
            // Von oben nach unten, innerhalb einer Zeile von links nach rechts.
            return lines.sorted {
                abs($0.rect.midY - $1.rect.midY) > 0.008 ? $0.rect.midY < $1.rect.midY : $0.rect.minX < $1.rect.minX
            }
        }.value
    }

    /// Einzelbilder (ca. 3 pro Sekunde, max. 20) aus einem Bildschirmvideo.
    static func frames(inVideoAt url: URL) async throws -> [[TextLine]] {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 1400, height: 3000)

        let frameCount = max(1, min(20, Int(duration * 3)))
        var result: [[TextLine]] = []
        for i in 0..<frameCount {
            let seconds = frameCount == 1 ? 0 : duration * Double(i) / Double(frameCount - 1)
            let time = CMTime(seconds: min(seconds, max(duration - 0.05, 0)), preferredTimescale: 600)
            guard let frame = try? await generator.image(at: time).image else { continue }
            result.append(try await lines(in: frame))
        }
        return result
    }
}

/// Liest Kaufdaten aus Screenshots der deutschen EA FC Oberfläche.
///
/// Unterstützte Ansichten (Stand: Screenshots vom 28.09.2026):
/// - **Item-Details** nach einem Kauf: „Glückwunsch, du hast dieses Item ergattert f. 1.000“
/// - **Kandidatenliste → Ersteigerte Items**: je Karte Name, „Startpreis“, „Sofortkauf“, „Verkauft für“
///   (bei ersteigerten Items ist „Verkauft für“ der bezahlte Preis). Mehrere Karten werden einzeln erkannt.
enum ScreenshotParser {
    /// Oberer Bildschirmrand (Statusleiste, Titel, Kontostand) und Tab-Leiste unten werden ignoriert.
    private static let contentTop: CGFloat = 0.14
    private static let contentBottom: CGFloat = 0.9

    /// Beschriftungen, unter denen der bezahlte bzw. erzielte Preis steht.
    private static let paidLabels = ["verkauft fur", "gekauft fur", "sold for", "bought for"]
    /// Detailseite: Satz nach einem Kauf bzw. Endpreis eines verkauften Items.
    private static let wonPhrases = ["ergattert", "erworben"]
    private static let soldPhrases = ["endpreis"]

    /// Erkennungsmerkmale der Ansicht (inkl. Titelzeile).
    private static let purchaseMarkers = ["kandidatenliste", "ersteigerte items", "ergattert", "transfer targets", "items won"]
    private static let saleMarkers = ["transferliste", "verk. items", "verkaufte loschen", "nicht verk. items", "endpreis",
                                      "alle neu anbieten", "transfer list", "sold items"]

    /// Allgemeine Preis-Stichwörter für andere Ansichten, nach Priorität.
    private static let priceKeywords = [
        "ergattert", "verkauft fur", "gekauft fur", "kaufpreis", "verkaufspreis",
        "sofortkauf", "preis", "bought for", "sold for", "buy now", "price",
    ]

    private static let statLabels: Set<String> = [
        "TEM", "SCH", "PAS", "DRI", "DEF", "PHY", "VER", "KÖR", "HEC", "BAL", "ABS", "REF", "GES", "STE",
        "PAC", "SHO", "DIV", "HAN", "KIC", "SPD", "POS",
    ]

    private static let positions: Set<String> = [
        "TW", "RV", "IV", "LV", "RAV", "LAV", "ZDM", "ZM", "ZOM", "RM", "LM", "RF", "LF", "MS", "ST",
        "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RW", "LW", "CF",
    ]

    /// Enthält eine Zeile eines dieser Wörter, ist sie kein Spielername.
    private static let uiFragments = [
        "item", "details", "biografie", "verein", "mannschaft", "transfer", "preisvergleich",
        "schnellverkauf", "sofortkauf", "startpreis", "startseite", "shop", "gebot", "jagd", "winde",
        "kandidat", "abgelaufen", "zeit", "verkauft", "gekauft", "gluckwunsch", "ergattert", "senden",
        "liste", "beobachtet", "aktive", "chemie", "attribute", "vergleich", "zuruck", "schliessen",
        "bestatigen", "abbrechen", "optionen", "weiter", "fertig", "voll", "ultimate", "kader",
        "anbieten", "entfernen", "loschen", "restzeit", "endpreis", "verk.",
        "buy now", "bid", "club", "squad", "market", "compare", "back",
    ]

    // MARK: - Einstieg

    static func parse(frames: [[TextLine]], knownNames: [String]) -> ScanResult {
        var result = ScanResult()
        var perFrame: [[ScannedItem]] = []
        var tokens: [String] = []
        var seen = Set<String>()

        var kindVotes: [ScanKind: Int] = [:]
        for frame in frames {
            let frameKind = kind(of: frame)
            if frameKind != .unknown { kindVotes[frameKind, default: 0] += 1 }
            let content = frame.filter { $0.rect.midY > contentTop && $0.rect.midY < contentBottom && !$0.text.isEmpty }
            perFrame.append(items(in: content, knownNames: knownNames))
            if result.chemistryStyle == nil { result.chemistryStyle = findChemistryStyle(in: content) }
            for line in content where line.text.count >= 2 && line.text.count <= 40 && seen.insert(line.lower).inserted {
                tokens.append(line.text)
            }
        }

        result.kind = kindVotes.max { $0.value < $1.value }?.key ?? .unknown
        result.items = merge(perFrame)
        result.tokens = Array(tokens.prefix(40))
        return result
    }

    static func parse(lines: [TextLine], knownNames: [String]) -> ScanResult {
        parse(frames: [lines], knownNames: knownNames)
    }

    // MARK: - Ansichten

    private static func kind(of lines: [TextLine]) -> ScanKind {
        // Eindeutige Detailseiten zuerst ("Transferliste voll" steht auch auf der Kauf-Detailseite).
        if lines.contains(where: { line in wonPhrases.contains { line.contains($0) } }) { return .purchase }
        if lines.contains(where: { line in soldPhrases.contains { line.contains($0) } }) { return .sale }
        let purchase = lines.filter { line in purchaseMarkers.contains { line.contains($0) } }.count
        let sale = lines.filter { line in saleMarkers.contains { line.contains($0) } }.count
        if purchase == sale { return .unknown }
        return purchase > sale ? .purchase : .sale
    }

    private static func items(in lines: [TextLine], knownNames: [String]) -> [ScannedItem] {
        if let detail = parseDetailPage(lines, knownNames: knownNames) { return [detail] }
        let listItems = parseItemList(lines, knownNames: knownNames)
        if !listItems.isEmpty { return listItems }
        let fallback = parseGeneric(lines, knownNames: knownNames)
        return fallback.isEmpty ? [] : [fallback]
    }

    /// „Item-Details“: Karte oben, darunter „… ergattert f. 1.000“ (Kauf) bzw. „Endpreis 2.100“ (Verkauf).
    private static func parseDetailPage(_ lines: [TextLine], knownNames: [String]) -> ScannedItem? {
        var item = ScannedItem()
        let anchor: TextLine
        if let won = lines.first(where: { line in wonPhrases.contains { line.contains($0) } }) {
            anchor = won
            item.price = number(below: won, in: lines, maxDistance: 0.08, alignX: false)
        } else if let sold = lines.first(where: { line in soldPhrases.contains { line.contains($0) } }) {
            anchor = sold
            item.price = number(below: sold, in: lines, maxDistance: 0.05, alignX: true)
        } else {
            return nil
        }

        // Name steht auf der Karte direkt über der Werte-Zeile (TEM SCH PAS …).
        let cardLines = lines.filter { $0.rect.midY < anchor.rect.midY }
        let statsRow = cardLines.first(where: isStatLabelRow)
        let nameLine = cardLines
            .filter { line in isNameCandidate(line.text) && (statsRow.map { line.rect.midY < $0.rect.midY } ?? true) }
            .last
        item.name = nameLine.map { canonicalName($0.text, knownNames: knownNames) }

        let ratingLimit = nameLine?.rect.midY ?? anchor.rect.midY
        item.rating = cardLines
            .filter { $0.rect.midY < ratingLimit }
            .compactMap { line in rating(in: line.text).map { (line, $0) } }
            .last?.1
        return item.isEmpty ? nil : item
    }

    /// „Kandidatenliste“ / Transferliste: je Karte ein „Verkauft für“-Block.
    private static func parseItemList(_ lines: [TextLine], knownNames: [String]) -> [ScannedItem] {
        let labels = lines.filter { line in paidLabels.contains { line.contains($0) } }
        return labels.compactMap { label in
            var item = ScannedItem()
            item.price = number(below: label, in: lines, maxDistance: 0.05, alignX: true, preferLast: labelIsSecondColumn(label))

            // Name: oberhalb des Labels (Kartenkopf), links davon beginnend.
            let nameLine = lines
                .filter {
                    isNameCandidate($0.text)
                        && $0.rect.midY < label.rect.midY
                        && label.rect.midY - $0.rect.midY < 0.06
                        && $0.rect.minX < label.rect.minX
                }
                .max { $0.rect.midY < $1.rect.midY }
            item.name = nameLine.map { canonicalName($0.text, knownNames: knownNames) }

            // Rating: im Kartenbild links neben dem Namen.
            let reference = nameLine ?? label
            item.rating = lines
                .filter { $0.rect.maxX <= reference.rect.minX + 0.01 && abs($0.rect.midY - reference.rect.midY) < 0.05 }
                .compactMap { line in rating(in: line.text).map { (abs(line.rect.midY - reference.rect.midY), $0) } }
                .min { $0.0 < $1.0 }?.1
            return item.isEmpty ? nil : item
        }
    }

    /// Rückfall für unbekannte Ansichten: Stichwörter + einfache Heuristik.
    private static func parseGeneric(_ lines: [TextLine], knownNames: [String]) -> ScannedItem {
        var item = ScannedItem()
        for keyword in priceKeywords {
            guard let label = lines.first(where: { $0.contains(keyword) }) else { continue }
            if let inline = coinNumbers(in: label.text).first(where: { $0 >= 100 }) {
                item.price = inline
            } else {
                item.price = number(below: label, in: lines, maxDistance: 0.08, alignX: false)
            }
            if item.price != nil { break }
        }
        let nameLine = lines.first { isNameCandidate($0.text) }
        item.name = nameLine.map { canonicalName($0.text, knownNames: knownNames) }
        item.rating = lines.lazy.compactMap { rating(in: $0.text) }.first
        return item
    }

    // MARK: - Mehrere Einzelbilder zusammenführen (Video)

    /// Pro Spielername zählt die höchste Anzahl in einem Einzelbild; Werte per Mehrheitsentscheid.
    private static func merge(_ frames: [[ScannedItem]]) -> [ScannedItem] {
        guard frames.count > 1 else { return frames.first ?? [] }

        var order: [String] = []
        var occurrences: [String: [[ScannedItem]]] = [:] // Schlüssel → je Vorkommen alle Beobachtungen
        for items in frames {
            var countInFrame: [String: Int] = [:]
            for item in items {
                let key = item.name.map(normalizedKey) ?? "?"
                let index = countInFrame[key, default: 0]
                countInFrame[key] = index + 1
                if occurrences[key] == nil { order.append(key); occurrences[key] = [] }
                if occurrences[key]!.count <= index { occurrences[key]!.append([]) }
                occurrences[key]![index].append(item)
            }
        }

        // Unbenannte Einträge nur behalten, wenn gar nichts anderes erkannt wurde.
        let keys = order.count > 1 ? order.filter { $0 != "?" } : order
        return keys.flatMap { key in
            occurrences[key, default: []].map { observations in
                ScannedItem(
                    name: mostCommon(observations.compactMap(\.name)),
                    rating: mostCommon(observations.compactMap(\.rating)),
                    price: mostCommon(observations.compactMap(\.price))
                )
            }
        }
    }

    private static func mostCommon<T: Hashable>(_ values: [T]) -> T? {
        let counts = Dictionary(values.map { ($0, 1) }, uniquingKeysWith: +)
        return values.max { counts[$0]! < counts[$1]! }
    }

    /// "Fiamma Benítez" → "fiammabenitez"
    private static func normalizedKey(_ name: String) -> String {
        name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current).filter(\.isLetter)
    }

    // MARK: - Bausteine

    /// Nächste Zahl unterhalb einer Beschriftung.
    private static func number(below label: TextLine, in lines: [TextLine], maxDistance: CGFloat,
                               alignX: Bool, preferLast: Bool = false) -> Int? {
        lines
            .filter { line in
                let dy = line.rect.midY - label.rect.midY
                return dy > 0.002 && dy < maxDistance
                    && (!alignX || abs(line.rect.minX - label.rect.minX) < 0.12)
            }
            .compactMap { line -> (CGFloat, Int)? in
                let numbers = coinNumbers(in: line.text).filter { $0 >= 100 }
                guard let value = preferLast ? numbers.last : numbers.first else { return nil }
                return (line.rect.midY - label.rect.midY, value)
            }
            .min { $0.0 < $1.0 }?.1
    }

    /// Falls "Startpreis: Verkauft für:" als eine Zeile erkannt wurde, gehört die zweite Zahl zum Label.
    private static func labelIsSecondColumn(_ label: TextLine) -> Bool {
        let compact = label.compact
        let keywords = paidLabels.map { $0.filter { !$0.isWhitespace } }
        guard let range = keywords.lazy.compactMap({ compact.range(of: $0) }).first else { return false }
        return range.lowerBound != compact.startIndex
    }

    /// "TEM SCH PAS DRI DEF PHY" – auch ohne Leerzeichen erkannt ("TEMSCHPASDRIDEFPHY").
    private static func isStatLabelRow(_ line: TextLine) -> Bool {
        isStatLabels(line.text)
    }

    private static func isStatLabels(_ text: String) -> Bool {
        let letters = Array(text.uppercased().filter { !$0.isWhitespace })
        guard !letters.isEmpty, letters.count % 3 == 0 else { return false }
        return stride(from: 0, to: letters.count, by: 3).allSatisfy { statLabels.contains(String(letters[$0..<$0 + 3])) }
    }

    static func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "de_DE")).lowercased()
    }

    private static func isNameCandidate(_ text: String) -> Bool {
        let compact = fold(text).filter { !$0.isWhitespace }
        let words = text.uppercased().split(separator: " ").map(String.init)
        guard text.count >= 3, text.count <= 30,
              !text.contains(where: \.isNumber),
              text.allSatisfy({ $0.isLetter || $0 == " " || $0 == "-" || $0 == "'" || $0 == "." }),
              text.filter(\.isLetter).count >= 3,
              !words.allSatisfy({ statLabels.contains($0) || positions.contains($0) }),
              !isStatLabels(text),
              !uiFragments.contains(where: { compact.contains($0.filter { !$0.isWhitespace }) }),
              ChemistryStyles.match(text) == nil
        else { return false }
        return true
    }

    /// "84", "84 ZOM" → 84
    private static func rating(in text: String) -> Int? {
        let parts = text.split(separator: " ")
        guard let first = parts.first, first.count == 2, let value = Int(first), (40...99).contains(value) else { return nil }
        if parts.count == 1 { return value }
        if parts.count == 2, positions.contains(parts[1].uppercased()) { return value }
        return nil
    }

    /// Bekannten Namen bevorzugen (gleiche Schreibweise wie in der Datenbank).
    private static func canonicalName(_ text: String, knownNames: [String]) -> String {
        let key = normalizedKey(text)
        if let known = knownNames.first(where: { normalizedKey($0) == key }) { return known }
        // Excel-Namen sind oft nur Nachnamen ("Benitez" für "Fiamma Benítez").
        let lastWord = text.split(separator: " ").last.map(String.init) ?? text
        if let known = knownNames.first(where: { normalizedKey($0) == normalizedKey(lastWord) }) { return known }
        return prettify(text)
    }

    /// "KYLIAN MBAPPÉ" → "Kylian Mbappé", "FiammaBenítez" → "Fiamma Benítez"
    private static func prettify(_ text: String) -> String {
        if text == text.uppercased() { return text.capitalized }
        var result = ""
        var previous: Character?
        for char in text {
            if let previous, previous.isLowercase, char.isUppercase { result.append(" ") }
            result.append(char)
            previous = char
        }
        return result
    }

    private static func findChemistryStyle(in lines: [TextLine]) -> String? {
        for line in lines {
            if let exact = ChemistryStyles.match(line.text), exact != ChemistryStyles.none { return exact }
        }
        return nil
    }

    private static let numberRegex = try! NSRegularExpression(pattern: #"\d{1,3}(?:[.,]\d{3})+|\d{3,8}"#)

    static func coinNumbers(in text: String) -> [Int] {
        let range = NSRange(text.startIndex..., in: text)
        return numberRegex.matches(in: text, range: range).compactMap { match in
            guard let r = Range(match.range, in: text) else { return nil }
            return Int(text[r].filter(\.isNumber))
        }
    }
}
