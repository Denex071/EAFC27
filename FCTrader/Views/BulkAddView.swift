import SwiftUI

/// Prüfen & Speichern von per Scan erkannten Käufen – eine oder mehrere Karten auf einmal.
struct BulkAddView: View {
    struct Draft: Identifiable {
        let id = UUID()
        var include = true
        var name: String
        var ratingText: String
        var chemistry: String
        var priceText: String

        var rating: Int? { Int(ratingText).flatMap { (1...99).contains($0) ? $0 : nil } }
        var price: Int? { Coins.parse(priceText) }
        var isValid: Bool {
            !name.trimmingCharacters(in: .whitespaces).isEmpty && rating != nil && (price ?? 0) > 0
        }
    }

    let items: [ScannedItem]
    var onSaved: () -> Void = {}

    @EnvironmentObject private var store: PlayerStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppSettings.userNameKey) private var userName = ""
    @State private var drafts: [Draft] = []
    @State private var date = Date()

    private var readyCount: Int { drafts.filter { $0.include && $0.isValid }.count }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Kaufdatum", selection: $date)
                } header: {
                    Text(drafts.count == 1 ? "1 Kauf erkannt" : "\(drafts.count) Käufe erkannt")
                } footer: {
                    Text("Der Chemiestil ist auf der Karte nur als Symbol zu sehen und wird deshalb mit dem zuletzt genutzten Stil dieses Spielers vorbelegt – bitte kurz prüfen.")
                }

                ForEach($drafts) { $draft in
                    Section {
                        Toggle(isOn: $draft.include.animation()) {
                            HStack(spacing: 10) {
                                RatingBadge(rating: draft.rating ?? 0, size: 30)
                                VStack(alignment: .leading) {
                                    Text(draft.name.isEmpty ? "Name fehlt" : draft.name).font(.headline)
                                    Text(draft.price.map { "EK \(Coins.format($0))" } ?? "Preis fehlt")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        if draft.include {
                            TextField("Name", text: $draft.name)
                                .textInputAutocapitalization(.words)
                                .autocorrectionDisabled()
                            HStack {
                                Text("Rating")
                                Spacer()
                                TextField("z. B. 84", text: $draft.ratingText)
                                    .keyboardType(.numberPad)
                                    .multilineTextAlignment(.trailing)
                            }
                            ChemistryPicker(selection: $draft.chemistry, recent: store.recentChemistryStyles)
                            CoinField(title: "Einkaufspreis", text: $draft.priceText)
                            if let price = draft.price, price > 0 {
                                Text("Kalk. VK \(Coins.format(TargetPrice.forBuyPrice(price))) · Break-even \(Coins.format(EATax.breakEven(buy: price)))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section {
                    Button {
                        drafts.append(Draft(name: "", ratingText: "", chemistry: ChemistryStyles.none, priceText: ""))
                    } label: {
                        Label("Weitere Karte hinzufügen", systemImage: "plus")
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Käufe prüfen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(readyCount > 1 ? "\(readyCount) sichern" : "Sichern") { save() }
                        .bold()
                        .disabled(readyCount == 0)
                }
            }
            .onAppear {
                if drafts.isEmpty { drafts = makeDrafts() }
            }
        }
    }

    private func makeDrafts() -> [Draft] {
        let source = items.isEmpty ? [ScannedItem()] : items
        return source.map { item in
            let last = item.name.flatMap(store.lastCard(named:))
            return Draft(
                name: item.name ?? "",
                ratingText: (item.rating ?? last?.rating).map(String.init) ?? "",
                chemistry: last?.chemistryStyle ?? ChemistryStyles.none,
                priceText: item.price.map(String.init) ?? ""
            )
        }
    }

    private func save() {
        for draft in drafts where draft.include && draft.isValid {
            store.save(PlayerCard(
                name: draft.name.trimmingCharacters(in: .whitespaces),
                rating: draft.rating ?? 0,
                chemistryStyle: draft.chemistry,
                buyPrice: draft.price ?? 0,
                buyDate: date,
                owner: userName
            ))
        }
        dismiss()
        onSaved()
    }
}

/// Ergebnis eines Scans, das als Sheet geöffnet wird.
struct PendingScan: Identifiable {
    let id = UUID()
    let kind: ScanKind
    let items: [ScannedItem]
}

/// Öffnet je nach Bildschirm die Kauf- oder die Verkaufserfassung.
struct PendingScanView: View {
    let scan: PendingScan
    var onSaved: () -> Void = {}

    var body: some View {
        if scan.kind == .sale {
            BulkSellView(items: scan.items, onSaved: onSaved)
        } else {
            BulkAddView(items: scan.items, onSaved: onSaved)
        }
    }
}

/// Symbol in der Navigationsleiste: Screenshot/Video wählen → Käufe bzw. Verkäufe prüfen → speichern.
struct ScanAddButton: View {
    @EnvironmentObject private var store: PlayerStore
    @State private var scan: PendingScan?

    var body: some View {
        ScanButton(compact: true, knownNames: store.knownNames) { result in
            scan = PendingScan(kind: result.kind, items: result.items)
        }
        .sheet(item: $scan) { PendingScanView(scan: $0) }
    }
}
