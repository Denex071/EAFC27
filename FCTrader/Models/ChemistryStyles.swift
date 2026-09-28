import Foundation

/// Auswählbare Chemiestile (EA FC 27).
enum ChemistryStyles {
    static let none = "Basic"

    static let all: [String] = [
        "Basic",
        // Angriff
        "Sniper", "Finisher", "Deadeye", "Marksman", "Hawk",
        // Mittelfeld
        "Artist", "Architect", "Powerhouse", "Maestro", "Engine",
        // Verteidigung
        "Sentinel", "Guardian", "Gladiator", "Backbone", "Anchor",
        // Allrounder
        "Hunter", "Catalyst", "Shadow",
        // Torhüter
        "Wall", "Shield", "Cat", "Glove",
    ]

    /// Findet den passenden Stil unabhängig von Groß-/Kleinschreibung ("anchor" → "Anchor").
    /// "GK Basic" (Torhüter) ist derselbe Stil wie "Basic".
    static func match(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.caseInsensitiveCompare("GK Basic") == .orderedSame { return none }
        return all.first { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
    }
}
