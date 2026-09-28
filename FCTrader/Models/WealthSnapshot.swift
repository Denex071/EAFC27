import Foundation

/// Wöchentlicher Vermögensstand (ersetzt den Reiter "Wochenübersicht" der Excel).
struct WealthSnapshot: Identifiable, Hashable {
    var id: String = UUID().uuidString
    var date: Date
    /// Teamwert, z. B. laut ESBC.
    var teamValue: Int
    /// Wert der Transferliste, z. B. laut ESBC.
    var transferListValue: Int
    /// Coins auf dem Konto.
    var coins: Int
    var notes: String = ""

    /// Gesamtvermögen = Teamwert + Transferliste + Coins.
    var total: Int { teamValue + transferListValue + coins }
}
