import Foundation

enum AppSettings {
    static let depotCodeKey = "depotCode"
    static let userNameKey = "userName"

    /// Spezieller Code, der die App ohne Cloud mit Beispieldaten startet.
    static let demoCode = "DEMO"

    /// Zufälliger, gut lesbarer Code (ohne 0/O/1/I), z. B. "K7RM-2XQP".
    static func generateDepotCode() -> String {
        let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        let part = { String((0..<4).map { _ in alphabet.randomElement()! }) }
        return "\(part())-\(part())"
    }

    static func normalize(_ code: String) -> String {
        code.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
