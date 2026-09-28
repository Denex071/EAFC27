import Foundation

/// Auswählbare Chemiestile.
/// PLATZHALTER: Die finale Liste für EA FC 27 wird hier eingetragen, sobald sie vorliegt.
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
}
