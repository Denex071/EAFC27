import Foundation

/// Wöchentlicher Stand – alle Werte sind händische Eingaben wie im Reiter "Wochenübersicht" der Excel.
struct WealthSnapshot: Identifiable, Hashable {
    var id: String = UUID().uuidString
    var date: Date
    /// Teamwert (lt. ESBC)
    var teamValue: Int
    /// TL-Wert (lt. ESBC)
    var transferListValue: Int
    /// Coins Bank
    var coins: Int
    /// TL-Wert (lt. Excel / eigene Rechnung)
    var ownTransferListValue: Int = 0
    /// VK ÜV-Karten
    var soldCards: Int = 0
    /// ÜV-Karten a. Liste
    var listedCards: Int = 0
    /// Gewinn ÜV
    var tradingProfit: Int = 0
    var notes: String = ""

    /// ges. Vermögen = Teamwert + TL-Wert (ESBC) + Coins – wie in der Excel.
    var total: Int { teamValue + transferListValue + coins }
}
