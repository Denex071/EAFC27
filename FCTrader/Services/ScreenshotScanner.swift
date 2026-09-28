import Foundation
import AVFoundation
import Vision
import UIKit

/// Ergebnis eines Scans. Alle Felder sind Vorschläge – der Nutzer bestätigt im Formular.
struct ScanResult {
    var name: String?
    var rating: Int?
    var chemistryStyle: String?
    var price: Int?
    /// Alle erkannten Textzeilen zum manuellen Antippen.
    var tokens: [String] = []

    var isEmpty: Bool { name == nil && rating == nil && chemistryStyle == nil && price == nil && tokens.isEmpty }
}

/// Texterkennung auf dem Gerät (Apple Vision) – keine Daten verlassen das iPhone.
enum TextRecognizer {
    static func lines(in image: CGImage) async throws -> [String] {
        try await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false
            request.recognitionLanguages = ["de-DE", "en-US"]
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
            let observations = request.results ?? []
            // Von oben nach unten, dann links nach rechts sortieren.
            return observations
                .sorted {
                    abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.01
                        ? $0.boundingBox.midY > $1.boundingBox.midY
                        : $0.boundingBox.minX < $1.boundingBox.minX
                }
                .compactMap { $0.topCandidates(1).first?.string }
        }.value
    }

    /// Nimmt bis zu 12 gleichmäßig verteilte Einzelbilder aus einem Bildschirmvideo.
    static func lines(inVideoAt url: URL) async throws -> [String] {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 1920, height: 1920)

        let frameCount = max(1, min(12, Int(duration / 0.75)))
        var result: [String] = []
        var seen = Set<String>()
        for i in 0..<frameCount {
            let seconds = frameCount == 1 ? 0 : duration * Double(i) / Double(frameCount - 1)
            let time = CMTime(seconds: min(seconds, max(duration - 0.05, 0)), preferredTimescale: 600)
            guard let frame = try? await generator.image(at: time).image else { continue }
            for line in try await lines(in: frame) where seen.insert(line).inserted {
                result.append(line)
            }
        }
        return result
    }
}

/// Heuristik, die aus den Textzeilen eines EA FC Screenshots die Kartendaten zieht.
enum ScreenshotParser {
    /// Preis-Stichwörter der deutschen Spieloberfläche, nach Priorität sortiert
    /// (eindeutige Kauf-/Verkaufsangaben zuerst, Gebote zuletzt).
    private static let priceKeywords = [
        "gekauft für", "verkauft für", "kaufpreis", "verkaufspreis",
        "sofortkaufpreis", "sofortkauf", "gekauft", "verkauft",
        "preis", "münzen", "startpreis", "aktuelles gebot", "gebot",
        // Englische Oberfläche als Rückfall
        "bought for", "sold for", "buy now", "price",
    ]

    private static let ignoredWords: Set<String> = [
        // Positionen (deutsch)
        "TW", "RV", "IV", "LV", "RAV", "LAV", "ZDM", "ZM", "ZOM", "RM", "LM", "RF", "LF", "MS", "ST",
        // Positionen (englisch)
        "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RW", "LW", "CF",
        // Werte-Kürzel und -Namen
        "TEM", "SCH", "PAS", "DRI", "VER", "PHY", "KÖR", "HEC", "BAL", "ABS", "REF", "GES", "STE",
        "PAC", "SHO", "DEF", "DIV", "HAN", "KIC", "SPD", "POS",
        "TEMPO", "SCHIESSEN", "SCHUSS", "PASSEN", "DRIBBLING", "VERTEIDIGUNG", "PHYSIS",
        // Oberfläche
        "SOFORTKAUF", "SOFORTKAUFPREIS", "GEBOT", "MINDESTGEBOT", "STARTPREIS", "AKTUELLES GEBOT",
        "KAUFEN", "VERKAUFEN", "SCHNELLVERKAUF", "BIETEN", "AUF TRANSFERMARKT ANBIETEN",
        "TRANSFERMARKT", "TRANSFERLISTE", "TRANSFERZIELE", "BEOBACHTUNGSLISTE", "TRANSFERS",
        "PREISVERGLEICH", "VERGLEICHEN", "PREISSPANNE", "VERBLEIBENDE ZEIT", "LAUFZEIT",
        "VEREIN", "KADER", "MEIN VEREIN", "ULTIMATE TEAM", "CHEMIE", "CHEMIESTIL", "CHEMIESTILE",
        "SPIELERBIOGRAFIE", "SPIELERINFO", "ATTRIBUTE", "DETAILS", "ZURÜCK", "SCHLIESSEN",
        "BESTÄTIGEN", "ABBRECHEN", "OPTIONEN", "WEITER", "FERTIG", "ERFOLGREICH", "GEKAUFT",
        "VERKAUFT", "ABGELAUFEN", "NATION", "LIGA", "NATIONALITÄT", "SKILLMOVES", "SCHWACHER FUSS",
        "BUY NOW", "BID", "TRANSFER MARKET", "TRANSFER LIST", "WATCH LIST", "CLUB", "SQUAD",
        "CHEMISTRY", "CHEMISTRY STYLE", "COMPARE PRICE", "BACK",
    ]

    static func parse(lines rawLines: [String], knownNames: [String]) -> ScanResult {
        let lines = rawLines
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        var result = ScanResult()
        result.tokens = uniqueTokens(lines)
        result.chemistryStyle = findChemistryStyle(in: lines)
        result.rating = findRating(in: lines)
        result.price = findPrice(in: lines)
        result.name = findName(in: lines, knownNames: knownNames, chemistry: result.chemistryStyle)
        return result
    }

    private static func uniqueTokens(_ lines: [String]) -> [String] {
        var seen = Set<String>()
        return lines
            .filter { $0.count >= 2 && $0.count <= 40 }
            .filter { seen.insert($0.lowercased()).inserted }
            .prefix(40)
            .map { $0 }
    }

    private static func findChemistryStyle(in lines: [String]) -> String? {
        for line in lines {
            let words = line.lowercased()
                .components(separatedBy: CharacterSet.letters.inverted)
                .filter { !$0.isEmpty }
            if let style = ChemistryStyles.all.first(where: {
                $0 != ChemistryStyles.none && words.contains($0.lowercased())
            }) {
                return style
            }
        }
        return nil
    }

    /// Erste allein stehende Zahl 40–99 (oft mit Position, z. B. "89 ST").
    private static func findRating(in lines: [String]) -> Int? {
        for line in lines {
            let parts = line.split(separator: " ")
            guard let first = parts.first, first.count == 2, let value = Int(first), (40...99).contains(value) else { continue }
            if parts.count == 1 || (parts.count == 2 && parts[1].count <= 3 && parts[1].allSatisfy(\.isLetter)) {
                return value
            }
        }
        return nil
    }

    private static func findPrice(in lines: [String]) -> Int? {
        // 1. Zahl in oder direkt nach einer Zeile mit Preis-Stichwort
        for keyword in priceKeywords {
            guard let index = lines.firstIndex(where: { $0.lowercased().contains(keyword) }) else { continue }
            for candidate in lines[index..<min(index + 3, lines.count)] {
                if let price = coinNumbers(in: candidate).first(where: { $0 >= 150 }) {
                    return price
                }
            }
        }
        // 2. Größte Zahl mit Tausendertrennzeichen
        return lines
            .flatMap { coinNumbers(in: $0, requireSeparator: true) }
            .filter { $0 >= 150 }
            .max()
    }

    private static let numberRegex = try! NSRegularExpression(pattern: #"\d{1,3}(?:[.,]\d{3})+|\d{3,8}"#)

    private static func coinNumbers(in line: String, requireSeparator: Bool = false) -> [Int] {
        let range = NSRange(line.startIndex..., in: line)
        return numberRegex.matches(in: line, range: range).compactMap { match in
            guard let r = Range(match.range, in: line) else { return nil }
            let text = String(line[r])
            if requireSeparator && !text.contains(where: { $0 == "." || $0 == "," }) { return nil }
            return Int(text.filter(\.isNumber))
        }
    }

    private static func findName(in lines: [String], knownNames: [String], chemistry: String?) -> String? {
        // 1. Bereits bekannter Spieler
        for line in lines {
            let lower = line.lowercased()
            if let known = knownNames.first(where: { lower.contains($0.lowercased()) || $0.lowercased().contains(lower) && lower.count >= 4 }) {
                return known
            }
        }
        // 2. Erste Zeile, die wie ein Name aussieht
        return lines.first { line in
            let upper = line.uppercased()
            guard line.count >= 3, line.count <= 28,
                  !ignoredWords.contains(upper),
                  upper != chemistry?.uppercased(),
                  !line.contains(where: \.isNumber),
                  line.allSatisfy({ $0.isLetter || $0 == " " || $0 == "-" || $0 == "'" || $0 == "." })
            else { return false }
            return line.filter(\.isLetter).count >= 3
        }.map(prettifyName)
    }

    /// "KYLIAN MBAPPÉ" → "Kylian Mbappé"
    private static func prettifyName(_ name: String) -> String {
        name == name.uppercased() ? name.capitalized : name
    }
}
