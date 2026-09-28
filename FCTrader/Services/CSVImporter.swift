import Foundation

/// Liest den Reiter "Spieler" der bisherigen Excel (als CSV exportiert) sowie den App-eigenen CSV-Export.
///
/// Erwartete Spalten (Reihenfolge egal, erkannt über die Überschrift):
/// Name · Rating · ChemieStyle · EK · EK Datum · (kalk. VK) · VK · VK Datum · (Gewinn) · (%)
enum CSVImporter {
    struct Result {
        var cards: [PlayerCard] = []
        var skipped: [(line: Int, reason: String)] = []

        var soldCount: Int { cards.filter(\.isSold).count }
        var openCount: Int { cards.count - soldCount }
        var totalProfit: Int { cards.compactMap(\.profit).reduce(0, +) }
    }

    private enum Column: CaseIterable {
        case name, rating, chemistry, buyPrice, buyDate, sellPrice, sellDate, notes

        var headers: [String] {
            switch self {
            case .name: return ["name", "spieler"]
            case .rating: return ["rating", "bewertung", "ovr"]
            case .chemistry: return ["chemiestyle", "chemiestil", "chemie", "chemistry", "chemistrystyle"]
            case .buyPrice: return ["ek", "einkaufspreis", "einkauf", "ekpreis", "kaufpreis"]
            case .buyDate: return ["ekdatum", "kaufdatum", "einkaufsdatum"]
            case .sellPrice: return ["vk", "verkaufspreis", "verkauf", "vkpreis"]
            case .sellDate: return ["vkdatum", "verkaufsdatum"]
            case .notes: return ["notiz", "notizen", "bemerkung"]
            }
        }

        /// Spaltenposition im Reiter "Spieler", falls keine Überschrift erkannt wird.
        var excelIndex: Int? {
            switch self {
            case .name: return 0
            case .rating: return 1
            case .chemistry: return 2
            case .buyPrice: return 3
            case .buyDate: return 4
            case .sellPrice: return 6
            case .sellDate: return 7
            case .notes: return nil
            }
        }
    }

    static func parse(_ text: String, recordedBy: String) -> Result {
        let rows = parseRows(text)
        guard let first = rows.first else { return Result() }

        // Spalten über die Überschrift zuordnen
        let normalizedHeader = first.map(normalizeHeader)
        var mapping: [Column: Int] = [:]
        for column in Column.allCases {
            if let index = normalizedHeader.firstIndex(where: { column.headers.contains($0) }) {
                mapping[column] = index
            }
        }
        let hasHeader = mapping[.name] != nil && mapping[.buyPrice] != nil
        if !hasHeader {
            for column in Column.allCases { mapping[column] = column.excelIndex }
        }

        var result = Result()
        var occurrences: [String: Int] = [:]
        let dataRows = rows.enumerated().dropFirst(hasHeader ? 1 : 0)

        for (index, row) in dataRows {
            let lineNumber = index + 1
            func value(_ column: Column) -> String {
                guard let i = mapping[column], i < row.count else { return "" }
                return row[i].trimmingCharacters(in: .whitespacesAndNewlines)
            }

            let name = value(.name)
            if name.isEmpty { continue } // Leere Zeilen still überspringen

            guard let buyPrice = parseAmount(value(.buyPrice)), buyPrice > 0 else {
                result.skipped.append((lineNumber, "\(name): EK fehlt oder ist ungültig"))
                continue
            }
            guard let buyDate = parseDate(value(.buyDate)) else {
                result.skipped.append((lineNumber, "\(name): EK-Datum fehlt oder ist ungültig"))
                continue
            }

            let sellPrice = parseAmount(value(.sellPrice)).flatMap { $0 > 0 ? $0 : nil }
            var sellDate = parseDate(value(.sellDate))
            if sellPrice != nil && sellDate == nil {
                sellDate = buyDate
            }

            let chemistryRaw = value(.chemistry)
            let chemistry = ChemistryStyles.match(chemistryRaw)
                ?? (chemistryRaw.isEmpty ? ChemistryStyles.none : chemistryRaw)

            // Stabile ID: gleicher Spieler + EK + Kaufdatum (+ laufende Nummer bei identischen Zeilen).
            // So überschreibt ein erneuter Import die Einträge, statt sie zu verdoppeln.
            let key = "\(name.lowercased())|\(buyPrice)|\(dayKey(buyDate))"
            let occurrence = occurrences[key, default: 0]
            occurrences[key] = occurrence + 1

            result.cards.append(PlayerCard(
                id: "import-" + stableHash("\(key)|\(occurrence)"),
                name: name,
                rating: Int(value(.rating).filter(\.isNumber)) ?? 0,
                chemistryStyle: chemistry,
                buyPrice: buyPrice,
                buyDate: buyDate,
                sellPrice: sellPrice,
                sellDate: sellPrice == nil ? nil : sellDate,
                owner: recordedBy,
                notes: value(.notes),
                createdAt: buyDate
            ))
        }
        return result
    }

    // MARK: - CSV

    /// Einfacher CSV-Parser mit Anführungszeichen; Trennzeichen (; , Tab) wird automatisch erkannt.
    static func parseRows(_ text: String) -> [[String]] {
        let cleaned = text.replacingOccurrences(of: "\u{FEFF}", with: "")
        let firstLine = cleaned.prefix { $0 != "\n" && $0 != "\r" }
        let delimiter: Character = [";", "\t", ","].max { a, b in
            firstLine.filter { $0 == a }.count < firstLine.filter { $0 == b }.count
        } ?? ";"

        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var inQuotes = false
        var iterator = cleaned.makeIterator()
        var pending: Character? = nil

        while let char = pending ?? iterator.next() {
            pending = nil
            if inQuotes {
                if char == "\"" {
                    if let next = iterator.next() {
                        if next == "\"" { field.append("\"") } else { inQuotes = false; pending = next }
                    } else {
                        inQuotes = false
                    }
                } else {
                    field.append(char)
                }
                continue
            }
            switch char {
            case "\"": inQuotes = true
            case delimiter:
                row.append(field); field = ""
            case "\n", "\r", "\r\n":
                row.append(field); field = ""
                if row.contains(where: { !$0.isEmpty }) { rows.append(row) }
                row = []
            default:
                field.append(char)
            }
        }
        row.append(field)
        if row.contains(where: { !$0.isEmpty }) { rows.append(row) }
        return rows
    }

    private static func normalizeHeader(_ header: String) -> String {
        header.lowercased().filter { $0.isLetter }
    }

    // MARK: - Werte

    /// "1100", "1.100", "1,100", "1.100,00", "1100.0", "12,5k"
    static func parseAmount(_ text: String) -> Int? {
        var s = text.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
        guard !s.isEmpty else { return nil }
        if s.lowercased().hasSuffix("k") || s.lowercased().hasSuffix("m") { return Coins.parse(s) }

        // Dezimalteil (1–2 Stellen nach dem letzten Trennzeichen) abschneiden
        if let lastSeparator = s.lastIndex(where: { $0 == "." || $0 == "," }) {
            let decimals = s[s.index(after: lastSeparator)...]
            if (1...2).contains(decimals.count) && decimals.allSatisfy(\.isNumber) {
                let fraction = Double("0." + decimals) ?? 0
                s = String(s[..<lastSeparator])
                let whole = s.filter(\.isNumber)
                guard let value = Int(whole.isEmpty ? "0" : whole) else { return nil }
                return value + (fraction >= 0.5 ? 1 : 0)
            }
        }
        return Coins.parse(s)
    }

    private static let dateFormats = [
        "dd.MM.yyyy HH:mm:ss", "dd.MM.yyyy HH:mm", "dd.MM.yyyy", "dd.MM.yy", "d.M.yyyy", "d.M.yy",
        "yyyy-MM-dd'T'HH:mm:ssZ", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd",
        "MM/dd/yyyy", "M/d/yyyy",
    ]

    private static let formatters: [DateFormatter] = dateFormats.map { format in
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = format
        f.isLenient = false
        return f
    }

    static func parseDate(_ text: String) -> Date? {
        let s = text.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        for formatter in formatters {
            if let date = formatter.date(from: s) { return date }
        }
        if let date = ISO8601DateFormatter().date(from: s) { return date }
        // Excel-Seriennummer (Tage seit 30.12.1899)
        if let serial = Double(s.replacingOccurrences(of: ",", with: ".")), serial > 30_000, serial < 80_000 {
            var components = DateComponents()
            components.year = 1899; components.month = 12; components.day = 30
            let base = Calendar.current.date(from: components)!
            return base.addingTimeInterval(serial * 86_400)
        }
        return nil
    }

    private static func dayKey(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return "\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)"
    }

    /// FNV-1a – über App-Starts hinweg stabil (anders als `hashValue`).
    private static func stableHash(_ text: String) -> String {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100000001b3
        }
        return String(hash, radix: 16)
    }
}
