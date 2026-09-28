import SwiftUI

struct PlayerListView: View {
    enum Filter: String, CaseIterable, Identifiable {
        case open = "Offen", sold = "Verkauft", all = "Alle"
        var id: String { rawValue }
    }

    enum Sort: String, CaseIterable, Identifiable {
        case newest = "Neueste", profit = "Gewinn", rating = "Rating", price = "Preis", holding = "Haltedauer"
        var id: String { rawValue }
    }

    @EnvironmentObject private var store: PlayerStore
    @AppStorage(AppSettings.userNameKey) private var userName = ""

    @State private var filter: Filter = .open
    @State private var sort: Sort = .newest
    @State private var search = ""
    @State private var editing: PlayerCard?
    @State private var selling: PlayerCard?
    @State private var deleting: PlayerCard?

    private var visible: [PlayerCard] {
        store.players
            .filter { card in
                switch filter {
                case .open: return !card.isSold
                case .sold: return card.isSold
                case .all: return true
                }
            }
            .filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) || $0.chemistryStyle.localizedCaseInsensitiveContains(search) }
            .sorted { a, b in
                switch sort {
                case .newest: return (a.sellDate ?? a.buyDate) > (b.sellDate ?? b.buyDate)
                case .profit: return (a.profit ?? Int.min) > (b.profit ?? Int.min)
                case .rating: return a.rating > b.rating
                case .price: return a.buyPrice > b.buyPrice
                case .holding: return a.holdDuration > b.holdDuration
                }
            }
    }

    var body: some View {
        NavigationStack {
            List {
                if visible.isEmpty {
                    ContentUnavailableView(
                        search.isEmpty ? "Keine Karten" : "Keine Treffer",
                        systemImage: "person.crop.rectangle.stack",
                        description: Text(search.isEmpty ? "Tippe auf +, um einen Kauf zu erfassen." : "Suche anpassen.")
                    )
                    .listRowBackground(Color.clear)
                }
                ForEach(visible) { card in
                    Button { editing = card } label: { PlayerRow(card: card) }
                        .tint(.primary)
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            if card.isSold {
                                Button { store.undoSell(card) } label: { Label("Zurück", systemImage: "arrow.uturn.backward") }
                                    .tint(.orange)
                            } else {
                                Button { selling = card } label: { Label("Verkaufen", systemImage: "banknote") }
                                    .tint(.green)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) { deleting = card } label: { Label("Löschen", systemImage: "trash") }
                            Button { store.duplicate(card, recordedBy: userName) } label: { Label("Nochmal", systemImage: "plus.square.on.square") }
                                .tint(.blue)
                        }
                        .contextMenu {
                            if !card.isSold {
                                Button { selling = card } label: { Label("Verkaufen", systemImage: "banknote") }
                            } else {
                                Button { store.undoSell(card) } label: { Label("Verkauf rückgängig", systemImage: "arrow.uturn.backward") }
                            }
                            Button { editing = card } label: { Label("Bearbeiten", systemImage: "pencil") }
                            Button { store.duplicate(card, recordedBy: userName) } label: { Label("Nochmal gekauft", systemImage: "plus.square.on.square") }
                            Button(role: .destructive) { deleting = card } label: { Label("Löschen", systemImage: "trash") }
                        }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $search, prompt: "Spieler oder Chemiestil")
            .safeAreaInset(edge: .top) { filterBar }
            .safeAreaInset(edge: .bottom) { summaryBar }
            .navigationTitle("Spieler")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { sortMenu }
                ToolbarItem(placement: .topBarTrailing) { AddCardButton() }
            }
            .sheet(item: $editing) { AddPlayerView(existing: $0) }
            .sheet(item: $selling) { card in
                SellPlayerView(card: card).presentationDetents([.large])
            }
            .confirmationDialog("Karte löschen?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), presenting: deleting) { card in
                Button("\(card.name) löschen", role: .destructive) { store.delete(card) }
            }
        }
    }

    private var filterBar: some View {
        Picker("Filter", selection: $filter) {
            ForEach(Filter.allCases) { f in
                Text(label(for: f)).tag(f)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
        .padding(.bottom, 8)
        .background(.bar)
    }

    private func label(for f: Filter) -> String {
        let count: Int
        switch f {
        case .open: count = store.players.filter { !$0.isSold }.count
        case .sold: count = store.players.filter(\.isSold).count
        case .all: count = store.players.count
        }
        return "\(f.rawValue) (\(count))"
    }

    @ViewBuilder
    private var summaryBar: some View {
        let cards = visible
        if !cards.isEmpty {
            HStack {
                Text("\(cards.count) Karten")
                Spacer()
                if filter == .open {
                    Text("EK \(Coins.compact(cards.map(\.buyPrice).reduce(0, +))) · Ziel \(Coins.compact(cards.map(\.targetPrice).reduce(0, +)))")
                } else {
                    Text("Gewinn")
                    ProfitText(value: cards.compactMap(\.profit).reduce(0, +), font: .subheadline.bold(), compact: true)
                }
            }
            .font(.subheadline)
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(.bar)
        }
    }

    private var sortMenu: some View {
        Menu {
            Picker("Sortierung", selection: $sort) {
                ForEach(Sort.allCases) { Text($0.rawValue).tag($0) }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down.circle")
        }
    }
}

struct PlayerRow: View {
    let card: PlayerCard

    var body: some View {
        HStack(spacing: 12) {
            RatingBadge(rating: card.rating)
            VStack(alignment: .leading, spacing: 2) {
                Text(card.name)
                    .font(.headline)
                    .lineLimit(1)
                Text("\(card.chemistryStyle) · \(card.buyDate.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                if let profit = card.profit {
                    ProfitText(value: profit)
                    Text("\(Coins.compact(card.buyPrice)) → \(Coins.compact(card.sellPrice ?? 0))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(Coins.format(card.buyPrice))
                        .font(.body.bold().monospacedDigit())
                    Text("Ziel \(Coins.compact(card.targetPrice)) · \(card.holdDuration.holdText)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .contentShape(Rectangle())
    }
}

/// "+" in der Navigationsleiste – öffnet das Kaufformular.
struct AddCardButton: View {
    @State private var showAdd = false

    var body: some View {
        Button { showAdd = true } label: {
            Image(systemName: "plus.circle.fill").font(.title3)
        }
        .sheet(isPresented: $showAdd) { AddPlayerView() }
    }
}
