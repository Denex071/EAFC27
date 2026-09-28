import SwiftUI

/// Schnellverkauf: nur Preis eintippen, Gewinn wird live berechnet.
struct SellPlayerView: View {
    let card: PlayerCard

    @EnvironmentObject private var store: PlayerStore
    @Environment(\.dismiss) private var dismiss
    @State private var priceText = ""
    @State private var date = Date()
    @FocusState private var priceFocused: Bool

    private var price: Int? { Coins.parse(priceText) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PlayerHeader(card: card)
                }

                Section {
                    CoinField(title: "Verkaufspreis", text: $priceText)
                        .focused($priceFocused)
                    ChipRow(items: [-1.0, 0.0, 0.10, 0.20], title: { margin in
                        switch margin {
                        case -1: return "Ziel \(Coins.compact(card.targetPrice))"
                        case 0: return "Break-even"
                        default: return "+\(Int(margin * 100)) %"
                        }
                    }, isSelected: { margin in
                        guard let price else { return false }
                        return price == (margin == -1 ? card.targetPrice : EATax.breakEven(buy: card.buyPrice, margin: margin))
                    }) { margin in
                        let target = margin == -1 ? card.targetPrice : EATax.breakEven(buy: card.buyPrice, margin: margin)
                        priceText = "\(target)"
                    }
                    DatePicker("Verkaufsdatum", selection: $date)
                } header: {
                    Text("Verkauf")
                } footer: {
                    Text("Ziel = kalkulierter VK (EK + Aufschlag laut eurer Tabelle). Die %-Chips setzen den Preis, der nach 5 % EA Tax die gewünschte Marge bringt.")
                }

                Section("Abrechnung") {
                    ProfitBreakdown(buyPrice: card.buyPrice, sellPrice: price)
                }

                Section {
                    ScanButton(title: "Verkaufspreis aus Screenshot", knownNames: [card.name]) { result in
                        if let p = result.price { priceText = "\(p)" }
                    }
                }
            }
            .navigationTitle("Verkaufen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Verkauft") {
                        if let price {
                            store.sell(card, price: price, date: date)
                            dismiss()
                        }
                    }
                    .bold()
                    .disabled((price ?? 0) <= 0)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Button("000") { priceText += "000" }
                    Button("k") { priceText += "k" }
                    Spacer()
                    Button("Fertig") { priceFocused = false }
                }
            }
            .onAppear { priceFocused = true }
        }
    }
}

struct PlayerHeader: View {
    let card: PlayerCard

    var body: some View {
        HStack(spacing: 14) {
            RatingBadge(rating: card.rating, size: 48)
            VStack(alignment: .leading, spacing: 3) {
                Text(card.name).font(.headline)
                Text(card.chemistryStyle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("EK \(Coins.format(card.buyPrice)) · \(card.buyDate.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
