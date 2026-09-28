import SwiftUI

/// Gescannte Verkäufe (Transferliste „Verk. Items“ oder „Endpreis“) den offenen Käufen zuordnen und verbuchen.
/// Der Chemiestil kommt aus dem Kauf – EA zeigt nach dem Verkauf den ursprünglichen Stil nicht mehr an.
struct BulkSellView: View {
    struct Draft: Identifiable {
        let id = UUID()
        let scannedName: String
        let rating: Int?
        var include: Bool
        var cardID: String?
        var priceText: String
        let duplicate: PlayerCard?

        var price: Int? { Coins.parse(priceText) }
    }

    let items: [ScannedItem]
    var onSaved: () -> Void = {}

    @EnvironmentObject private var store: PlayerStore
    @Environment(\.dismiss) private var dismiss
    @State private var drafts: [Draft] = []
    @State private var date = Date()

    private func card(for draft: Draft) -> PlayerCard? {
        draft.cardID.flatMap { id in store.players.first { $0.id == id } }
    }

    private var ready: [(PlayerCard, Int)] {
        drafts.compactMap { draft in
            guard draft.include, let card = card(for: draft), let price = draft.price, price > 0 else { return nil }
            return (card, price)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Verkaufsdatum", selection: $date)
                    if !ready.isEmpty {
                        LabeledContent("Gewinn gesamt") {
                            ProfitText(value: ready.map { EATax.profit(buy: $0.0.buyPrice, sell: $0.1) }.reduce(0, +))
                        }
                    }
                } header: {
                    Text(drafts.count == 1 ? "1 Verkauf erkannt" : "\(drafts.count) Verkäufe erkannt")
                } footer: {
                    Text("Jeder Verkauf wird dem ältesten offenen Kauf dieses Spielers zugeordnet. Chemiestil und EK kommen aus dem Kauf.")
                }

                ForEach($drafts) { $draft in
                    Section {
                        row(for: $draft)
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Verkäufe prüfen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(ready.count > 1 ? "\(ready.count) verbuchen" : "Verbuchen") { save() }
                        .bold()
                        .disabled(ready.isEmpty)
                }
            }
            .onAppear {
                if drafts.isEmpty { drafts = makeDrafts() }
            }
        }
    }

    @ViewBuilder
    private func row(for draft: Binding<Draft>) -> some View {
        let value = draft.wrappedValue
        let candidates = store.openCards(matching: value.scannedName, rating: value.rating)
        let matched = card(for: value)

        Toggle(isOn: draft.include.animation()) {
            HStack(spacing: 10) {
                RatingBadge(rating: matched?.rating ?? value.rating ?? 0, size: 30)
                VStack(alignment: .leading) {
                    Text(matched?.name ?? value.scannedName).font(.headline)
                    Text(matched.map { "\($0.chemistryStyle) · EK \(Coins.format($0.buyPrice))" } ?? "Kein offener Kauf gefunden")
                        .font(.caption)
                        .foregroundStyle(matched == nil ? Color.orange : Color.secondary)
                }
            }
        }
        .disabled(matched == nil)

        if let duplicate = value.duplicate {
            Label("Evtl. schon verbucht: \(duplicate.name) am \(duplicate.sellDate?.formatted(date: .abbreviated, time: .shortened) ?? "") zu \(Coins.format(duplicate.sellPrice ?? 0))",
                  systemImage: "exclamationmark.triangle.fill")
                .font(.caption)
                .foregroundStyle(.orange)
        }

        if value.include, matched != nil {
            if candidates.count > 1 {
                Picker("Kauf", selection: draft.cardID) {
                    ForEach(candidates) { card in
                        Text("\(card.rating) · EK \(Coins.format(card.buyPrice)) · \(card.buyDate.formatted(date: .abbreviated, time: .omitted))")
                            .tag(Optional(card.id))
                    }
                }
            }
            CoinField(title: "Verkaufspreis", text: draft.priceText)
            if let matched {
                ProfitBreakdown(buyPrice: matched.buyPrice, sellPrice: value.price)
            }
        }
    }

    private func makeDrafts() -> [Draft] {
        var used = Set<String>()
        return items.map { item in
            let name = item.name ?? ""
            let card = store.openCards(matching: name, rating: item.rating).first { !used.contains($0.id) }
            if let card { used.insert(card.id) }
            let duplicate = item.price.flatMap { store.recentSale(named: name, price: $0) }
            return Draft(
                scannedName: name,
                rating: item.rating,
                include: card != nil && duplicate == nil,
                cardID: card?.id,
                priceText: item.price.map(String.init) ?? "",
                duplicate: duplicate
            )
        }
    }

    private func save() {
        for (card, price) in ready {
            store.sell(card, price: price, date: date)
        }
        dismiss()
        onSaved()
    }
}
