import Foundation

/// Vergleicht Spielernamen tolerant: Groß-/Kleinschreibung, Akzente und Vor-/Nachname.
/// "Fiamma Benítez" (Spiel) passt zu "Benitez" (Excel).
enum NameMatching {
    static func key(_ name: String) -> String {
        name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "de_DE"))
            .lowercased()
            .filter(\.isLetter)
    }

    static func lastNameKey(_ name: String) -> String {
        key(name.split(separator: " ").last.map(String.init) ?? name)
    }

    static func matches(_ a: String, _ b: String) -> Bool {
        let ka = key(a), kb = key(b)
        guard !ka.isEmpty, !kb.isEmpty else { return false }
        if ka == kb { return true }
        // Einer der beiden ist nur der Nachname des anderen
        return ka == lastNameKey(b) || kb == lastNameKey(a)
    }
}
