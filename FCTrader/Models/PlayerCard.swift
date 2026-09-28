import Foundation

/// Eine gekaufte Spielerkarte – offen (noch im Club) oder verkauft.
struct PlayerCard: Identifiable, Hashable {
    var id: String = UUID().uuidString
    var name: String
    var rating: Int
    var chemistryStyle: String
    var buyPrice: Int
    var buyDate: Date
    var sellPrice: Int?
    var sellDate: Date?
    /// Wer die Karte erfasst hat (nur zur Info, nicht in der Oberfläche).
    var owner: String
    var notes: String = ""
    var createdAt: Date = .now

    var isSold: Bool { sellPrice != nil }

    /// 5 % EA Tax auf den Verkaufspreis.
    var eaTax: Int? { sellPrice.map(EATax.tax(for:)) }

    /// Gewinn = Verkaufspreis − 5 % EA Tax − Einkaufspreis.
    var profit: Int? { sellPrice.map { EATax.profit(buy: buyPrice, sell: $0) } }

    /// Marge wie in der Excel: Gewinn / Verkaufspreis.
    var margin: Double? {
        guard let sellPrice, sellPrice > 0, let profit else { return nil }
        return Double(profit) / Double(sellPrice)
    }

    /// Kalkulierter Verkaufspreis ("kalk. VK") nach eurer Aufschlagstabelle.
    var targetPrice: Int { TargetPrice.forBuyPrice(buyPrice) }

    /// Gewinn, wenn die Karte zum kalkulierten VK verkauft wird.
    var expectedProfit: Int { EATax.profit(buy: buyPrice, sell: targetPrice) }

    /// Kleinster gültiger Marktpreis, ab dem nach Tax kein Verlust entsteht.
    var breakEvenPrice: Int { EATax.breakEven(buy: buyPrice) }

    /// Haltedauer bis zum Verkauf bzw. bis jetzt.
    var holdDuration: TimeInterval { (sellDate ?? .now).timeIntervalSince(buyDate) }
}

enum EATax {
    static let rate = 0.05

    static func tax(for sellPrice: Int) -> Int {
        Int((Double(sellPrice) * rate).rounded())
    }

    static func netProceeds(_ sellPrice: Int) -> Int {
        sellPrice - tax(for: sellPrice)
    }

    static func profit(buy: Int, sell: Int) -> Int {
        netProceeds(sell) - buy
    }

    /// Verkaufspreis, der nach Tax mindestens `buy * (1 + margin)` einbringt –
    /// aufgerundet auf die nächste gültige Preisstufe des Transfermarkts.
    static func breakEven(buy: Int, margin: Double = 0) -> Int {
        let target = Double(buy) * (1 + margin)
        var price = PriceTicks.roundUp(Int((target / (1 - rate)).rounded(.up)))
        while netProceeds(price) < Int(target.rounded(.up)) {
            price = PriceTicks.next(after: price)
        }
        return price
    }
}

/// Preisstufen des EA FC Transfermarkts.
enum PriceTicks {
    static func step(for price: Int) -> Int {
        switch price {
        case ..<1_000: return 50
        case ..<10_000: return 100
        case ..<50_000: return 250
        case ..<100_000: return 500
        default: return 1_000
        }
    }

    static func roundUp(_ price: Int) -> Int {
        let step = step(for: price)
        let rounded = ((price + step - 1) / step) * step
        return max(rounded, 150)
    }

    static func next(after price: Int) -> Int {
        roundUp(price + 1)
    }
}

/// Aufschlag auf den Einkaufspreis – übernommen aus der Spalte "kalk. VK" der Excel.
enum TargetPrice {
    /// (EK bis einschließlich, Aufschlag)
    static let tiers: [(upTo: Int, markup: Int)] = [
        (2_000, 1_000),
        (4_000, 1_500),
        (6_000, 2_000),
        (10_000, 2_500),
        (15_000, 3_000),
        (25_000, 4_000),
        (50_000, 6_000),
        (100_000, 10_000),
        (200_000, 20_000),
    ]
    static let markupAbove = 60_000

    static func markup(for buyPrice: Int) -> Int {
        tiers.first { buyPrice <= $0.upTo }?.markup ?? markupAbove
    }

    static func forBuyPrice(_ buyPrice: Int) -> Int {
        buyPrice + markup(for: buyPrice)
    }
}
