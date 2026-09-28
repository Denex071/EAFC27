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
        case .today: return calendar.isDate(date, inSameDayAs: now)
        case .week: return date >= calendar.date(byAdding: .day, value: -7, to: now)!
        case .month: return date >= calendar.date(byAdding: .day, value: -30, to: now)!
        case .all: return true
        }
    }
}

extension Calendar {
    /// Deutscher Kalender: Woche beginnt am Montag.
    static let trading: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.locale = Locale(identifier: "de_DE")
        c.firstWeekday = 2
        c.minimumDaysInFirstWeek = 4
        return c
    }()
}

/// Alle Kennzahlen für das Dashboard.
struct TradingStats {
    struct ProfitPoint: Identifiable {
        let id: String
        let date: Date
        let cumulative: Int
    }

    struct DayStat: Identifiable {
        let day: Date
        let profit: Int
        let sales: Int
        var id: Date { day }
        var averageProfit: Int { sales == 0 ? 0 : profit / sales }
    }

    struct WeekStat: Identifiable {
        let start: Date
        let profit: Int
        let sales: Int
        let turnover: Int
        var id: Date { start }
        var end: Date { Calendar.trading.date(byAdding: .day, value: 6, to: start)! }
    }

    struct PlayerStat: Identifiable {
        let name: String
        let rating: Int
        let sales: Int
        let turnover: Int
        let profit: Int
        let averageHold: TimeInterval
        let openCount: Int
        var id: String { name }
        var averageProfit: Int { sales == 0 ? 0 : profit / sales }
    }

    // Verkäufe im Zeitraum
    let sold: [PlayerCard]
    let realizedProfit: Int
    let turnover: Int
    let totalBuy: Int
    let taxPaid: Int
    let averageProfit: Int
    let averageMargin: Double
    let roi: Double
    let winRate: Double
    let averageHold: TimeInterval
    let bestFlip: PlayerCard?
    let worstFlip: PlayerCard?
    let profitCurve: [ProfitPoint]
    let players: [PlayerStat]

    // Aktueller Bestand (unabhängig vom Zeitraum)
    let open: [PlayerCard]
    let capitalBound: Int
    let openTargetValue: Int
    let openExpectedProfit: Int
    let longestHeld: [PlayerCard]

    // Zeitreihen (unabhängig vom Zeitraum)
    let lastDays: [DayStat]
    let weeks: [WeekStat]

    init(players cards: [PlayerCard], period: StatsPeriod, now: Date = .now) {
        let calendar = Calendar.trading
        let allSold = cards.filter(\.isSold)

        sold = allSold
            .filter { period.contains($0.sellDate ?? $0.buyDate, now: now) }
            .sorted { ($0.sellDate ?? .distantPast) < ($1.sellDate ?? .distantPast) }
        open = cards.filter { !$0.isSold }

        let profits = sold.compactMap(\.profit)
        realizedProfit = profits.reduce(0, +)
        turnover = sold.compactMap(\.sellPrice).reduce(0, +)
        totalBuy = sold.map(\.buyPrice).reduce(0, +)
        taxPaid = sold.compactMap(\.eaTax).reduce(0, +)
        averageProfit = sold.isEmpty ? 0 : realizedProfit / sold.count
        let margins = sold.compactMap(\.margin)
        averageMargin = margins.isEmpty ? 0 : margins.reduce(0, +) / Double(margins.count)
        roi = totalBuy == 0 ? 0 : Double(realizedProfit) / Double(totalBuy)
        winRate = sold.isEmpty ? 0 : Double(profits.filter { $0 > 0 }.count) / Double(sold.count)
        averageHold = sold.isEmpty ? 0 : sold.map(\.holdDuration).reduce(0, +) / Double(sold.count)
        bestFlip = sold.max { ($0.profit ?? 0) < ($1.profit ?? 0) }
        worstFlip = sold.count > 1 ? sold.min { ($0.profit ?? 0) < ($1.profit ?? 0) } : nil

        var running = 0
        profitCurve = sold.map { card in
            running += card.profit ?? 0
            return ProfitPoint(id: card.id, date: card.sellDate ?? card.buyDate, cumulative: running)
        }

        // Ranking je Spieler (wie "Top-Verkäufe summiert" in der Excel)
        let openByName = Dictionary(grouping: open, by: \.name)
        players = Dictionary(grouping: sold, by: \.name)
            .map { name, group in
                PlayerStat(
                    name: name,
                    rating: group.map(\.rating).max() ?? 0,
                    sales: group.count,
                    turnover: group.compactMap(\.sellPrice).reduce(0, +),
                    profit: group.compactMap(\.profit).reduce(0, +),
                    averageHold: group.map(\.holdDuration).reduce(0, +) / Double(group.count),
                    openCount: openByName[name]?.count ?? 0
                )
            }
            .sorted { $0.profit > $1.profit }

        capitalBound = open.map(\.buyPrice).reduce(0, +)
        openTargetValue = open.map(\.targetPrice).reduce(0, +)
        openExpectedProfit = open.map(\.expectedProfit).reduce(0, +)
        longestHeld = Array(open.sorted { $0.buyDate < $1.buyDate }.prefix(3))

        // Gewinn pro Tag, letzte 10 Tage
        let today = calendar.startOfDay(for: now)
        let byDay = Dictionary(grouping: allSold) { calendar.startOfDay(for: $0.sellDate ?? $0.buyDate) }
        lastDays = (0..<10).reversed().map { offset in
            let day = calendar.date(byAdding: .day, value: -offset, to: today)!
            let group = byDay[day] ?? []
            return DayStat(day: day, profit: group.compactMap(\.profit).reduce(0, +), sales: group.count)
        }

        // Gewinn pro Kalenderwoche (Mo–So), neueste zuerst
        let byWeek = Dictionary(grouping: allSold) { card -> Date in
            let date = card.sellDate ?? card.buyDate
            return calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
        }
        weeks = byWeek
            .map { start, group in
                WeekStat(
                    start: start,
                    profit: group.compactMap(\.profit).reduce(0, +),
                    sales: group.count,
                    turnover: group.compactMap(\.sellPrice).reduce(0, +)
                )
            }
            .sorted { $0.start > $1.start }
    }

    /// Gewinn aus Verkäufen zwischen zwei Zeitpunkten (für die Vermögens-Snapshots).
    static func profit(of cards: [PlayerCard], after start: Date?, upTo end: Date) -> Int {
        cards
            .filter { card in
                guard let date = card.sellDate else { return false }
                return date <= end && (start.map { date > $0 } ?? true)
            }
            .compactMap(\.profit)
            .reduce(0, +)
    }
}
