import Foundation

enum StatsPeriod: String, CaseIterable, Identifiable {
    case today = "Heute"
    case week = "7 Tage"
    case month = "30 Tage"
    case all = "Gesamt"

    var id: String { rawValue }

    func contains(_ date: Date, now: Date = .now) -> Bool {
        let calendar = Calendar.current
        switch self {
        case .today: return calendar.isDateInToday(date)
        case .week: return date >= calendar.date(byAdding: .day, value: -7, to: now)!
        case .month: return date >= calendar.date(byAdding: .day, value: -30, to: now)!
        case .all: return true
        }
    }
}

/// Alle Kennzahlen für das Dashboard.
struct TradingStats {
    struct ProfitPoint: Identifiable {
        let id: String
        let date: Date
        let cumulative: Int
    }

    // Verkäufe im Zeitraum
    let sold: [PlayerCard]
    let realizedProfit: Int
    let turnover: Int
    let taxPaid: Int
    let averageProfit: Int
    let roi: Double
    let winRate: Double
    let averageHold: TimeInterval
    let bestFlip: PlayerCard?
    let worstFlip: PlayerCard?
    let profitCurve: [ProfitPoint]

    // Aktueller Bestand (unabhängig vom Zeitraum)
    let open: [PlayerCard]
    let capitalBound: Int
    let breakEvenTotal: Int
    let longestHeld: [PlayerCard]

    init(players: [PlayerCard], period: StatsPeriod) {
        sold = players
            .filter { card in card.isSold && period.contains(card.sellDate ?? card.buyDate) }
            .sorted { ($0.sellDate ?? .distantPast) < ($1.sellDate ?? .distantPast) }
        open = players.filter { !$0.isSold }

        let profits = sold.compactMap(\.profit)
        realizedProfit = profits.reduce(0, +)
        turnover = sold.compactMap(\.sellPrice).reduce(0, +)
        taxPaid = sold.compactMap(\.eaTax).reduce(0, +)
        averageProfit = sold.isEmpty ? 0 : realizedProfit / sold.count
        let invested = sold.map(\.buyPrice).reduce(0, +)
        roi = invested == 0 ? 0 : Double(realizedProfit) / Double(invested)
        winRate = sold.isEmpty ? 0 : Double(profits.filter { $0 > 0 }.count) / Double(sold.count)
        averageHold = sold.isEmpty ? 0 : sold.map(\.holdDuration).reduce(0, +) / Double(sold.count)
        bestFlip = sold.max { ($0.profit ?? 0) < ($1.profit ?? 0) }
        worstFlip = sold.count > 1 ? sold.min { ($0.profit ?? 0) < ($1.profit ?? 0) } : nil

        var running = 0
        profitCurve = sold.map { card in
            running += card.profit ?? 0
            return ProfitPoint(id: card.id, date: card.sellDate ?? card.buyDate, cumulative: running)
        }

        capitalBound = open.map(\.buyPrice).reduce(0, +)
        breakEvenTotal = open.map(\.breakEvenPrice).reduce(0, +)
        longestHeld = Array(open.sorted { $0.buyDate < $1.buyDate }.prefix(3))
    }
}
