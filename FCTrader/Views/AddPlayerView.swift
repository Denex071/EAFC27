import SwiftUI

/// Erfassen oder Bearbeiten einer Karte – auf möglichst wenige Taps optimiert.
struct AddPlayerView: View {
    enum Field: Hashable { case name, rating, buyPrice, sellPrice }

    @EnvironmentObject private var store: PlayerStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppSettings.userNameKey) private var userName = ""

    private let existing: PlayerCard?

    @State private var name: String
    @State private var ratingText: String
    @State private var chemistryStyle: String
    @State private var buyPriceText: String
    @State private var buyDate: Date
    @State private var isSold: Bool
    @State private var sellPriceText: String
    @State private var sellDate: Date
    @State private var notes: String

    @State private var scanTokens: [String] = []
    @State private var pendingScan: PendingScan?
    @State private var savedCount = 0
    @State private var showSavedToast = false
    @FocusState private var focus: Field?

    init(existing: PlayerCard? = nil) {
        self.existing = existing
        _name = State(initialValue: existing?.name ?? "")
        _ratingText = State(initialValue: existing.map { "\($0.rating)" } ?? "")
        _chemistryStyle = State(initialValue: existing?.chemistryStyle ?? ChemistryStyles.none)
        _buyPriceText = State(initialValue: existing.map { "\($0.buyPrice)" } ?? "")
        _buyDate = State(initialValue: existing?.buyDate ?? .now)
        _isSold = State(initialValue: existing?.isSold ?? false)
        _sellPriceText = State(initialValue: existing?.sellPrice.map(String.init) ?? "")
        _sellDate = State(initialValue: existing?.sellDate ?? .now)
        _notes = State(initialValue: existing?.notes ?? "")
    }

    private var rating: Int? { Int(ratingText).flatMap { (1...99).contains($0) ? $0 : nil } }
    private var buyPrice: Int? { Coins.parse(buyPriceText) }
    private var sellPrice: Int? { isSold ? Coins.parse(sellPriceText) : nil }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && rating != nil
            && (buyPrice ?? 0) > 0
            && (!isSold || (sellPrice ?? 0) > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                scanSection
                playerSection
                buySection
                sellSection
                Section("Notiz") {
                    TextField("optional", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle(existing == nil ? "Kauf erfassen" : "Karte bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .safeAreaInset(edge: .bottom) {
                if existing == nil { bottomBar }
            }
            .overlay(alignment: .top) {
                if showSavedToast {
                    Label("\(savedCount) gespeichert – nächste Karte", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.bold())
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(.green, in: Capsule())
                        .foregroundStyle(.white)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .padding(.top, 8)
                }
            }
            .sheet(item: $pendingScan) { scan in
                PendingScanView(scan: scan) { dismiss() }
            }
            .onAppear {
                if existing == nil { focus = .name }
            }
        }
    }

    // MARK: - Abschnitte

    private var scanSection: some View {
        Section {
            ScanButton(knownNames: store.knownNames) { apply($0) }
            if !scanTokens.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(focusHint).font(.caption).foregroundStyle(.secondary)
                    ChipRow(items: scanTokens, title: { $0 }) { assignToken($0) }
                }
            }
        } footer: {
            if scanTokens.isEmpty {
                Text("Screenshot oder Bildschirmaufnahme aus EA FC wählen – Name, Rating, Chemiestil und Preis werden automatisch erkannt.")
            }
        }
    }

    private var playerSection: some View {
        Section("Spieler") {
            TextField("Name", text: $name)
                .focused($focus, equals: .name)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.next)
                .onSubmit { focus = .rating }

            let suggestions = existing == nil ? store.suggestions(for: name) : []
            if !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(suggestions) { card in
                            Chip(title: "\(card.rating) \(card.name)", systemImage: "clock.arrow.circlepath") {
                                applySuggestion(card)
                            }
                        }
                    }
                }
            }

            HStack {
                Text("Rating")
                Spacer()
                TextField("z. B. 87", text: $ratingText)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .focused($focus, equals: .rating)
                    .onChange(of: ratingText) { _, new in
                        // Nach zwei Ziffern direkt zum Preis springen.
                        if new.count == 2, rating != nil, focus == .rating { focus = .buyPrice }
                    }
                if let rating { RatingBadge(rating: rating, size: 28) }
            }

            ChemistryPicker(selection: $chemistryStyle, recent: store.recentChemistryStyles)
        }
    }

    private var buySection: some View {
        Section {
            CoinField(title: "Einkaufspreis", text: $buyPriceText)
                .focused($focus, equals: .buyPrice)
            DatePicker("Kaufdatum", selection: $buyDate)
        } header: {
            Text("Kauf")
        } footer: {
            if let buyPrice, buyPrice > 0 {
                Text("Kalk. VK: \(Coins.format(TargetPrice.forBuyPrice(buyPrice))) · Break-even nach 5 % Tax: \(Coins.format(EATax.breakEven(buy: buyPrice)))")
            }
        }
    }

    private var sellSection: some View {
        Section("Verkauf") {
            Toggle("Bereits verkauft", isOn: $isSold.animation())
            if isSold {
                CoinField(title: "Verkaufspreis", text: $sellPriceText)
                    .focused($focus, equals: .sellPrice)
                DatePicker("Verkaufsdatum", selection: $sellDate)
                if let buyPrice {
                    ProfitBreakdown(buyPrice: buyPrice, sellPrice: sellPrice)
                }
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Abbrechen") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
            Button("Sichern") {
                save()
                dismiss()
            }
            .bold()
            .disabled(!isValid)
        }
        ToolbarItemGroup(placement: .keyboard) {
            if focus == .buyPrice || focus == .sellPrice {
                Button("000") { appendThousands() }
                Button("k") { appendK() }
            }
            Spacer()
            Button("Fertig") { focus = nil }
        }
    }

    private var bottomBar: some View {
        Button {
            save()
            resetForNext()
        } label: {
            Label("Sichern & nächste Karte", systemImage: "plus.circle.fill")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .disabled(!isValid)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    // MARK: - Logik

    private var focusHint: String {
        switch focus {
        case .name: return "Antippen übernimmt Text als Name"
        case .rating: return "Antippen übernimmt Zahl als Rating"
        case .buyPrice: return "Antippen übernimmt Zahl als Einkaufspreis"
        case .sellPrice: return "Antippen übernimmt Zahl als Verkaufspreis"
        case nil: return "Erkannter Text – Feld wählen und Text antippen"
        }
    }

    private func apply(_ result: ScanResult) {
        // Verkaufs-Screenshot oder mehrere Karten (z. B. Kandidatenliste) → Sammelerfassung.
        if existing == nil && (result.kind == .sale || result.items.count > 1) {
            pendingScan = PendingScan(kind: result.kind, items: result.items)
            return
        }
        let last = result.name.flatMap(store.lastCard(named:))
        if let n = result.name { name = n }
        if let r = result.rating ?? last?.rating { ratingText = "\(r)" }
        if let c = result.chemistryStyle ?? last?.chemistryStyle { chemistryStyle = c }
        if let p = result.price {
            if isSold { sellPriceText = "\(p)" } else { buyPriceText = "\(p)" }
        }
        scanTokens = result.tokens
        focus = nil
    }

    private func assignToken(_ token: String) {
        let number = Coins.parse(token)
        switch focus {
        case .name: name = token
        case .rating: if let number { ratingText = "\(number)" }
        case .buyPrice: if let number { buyPriceText = "\(number)" }
        case .sellPrice: if let number { sellPriceText = "\(number)" }
        case nil:
            // Ohne Fokus: sinnvoll raten.
            if let number {
                if (40...99).contains(number) { ratingText = "\(number)" } else { buyPriceText = "\(number)" }
            } else if let style = ChemistryStyles.all.first(where: { $0.caseInsensitiveCompare(token) == .orderedSame }) {
                chemistryStyle = style
            } else {
                name = token.capitalized
            }
        }
    }

    private func applySuggestion(_ card: PlayerCard) {
        name = card.name
        ratingText = "\(card.rating)"
        chemistryStyle = card.chemistryStyle
        focus = .buyPrice
    }

    private func appendThousands() {
        if focus == .buyPrice { buyPriceText += "000" } else { sellPriceText += "000" }
    }

    private func appendK() {
        if focus == .buyPrice { buyPriceText += "k" } else { sellPriceText += "k" }
    }

    private func save() {
        guard isValid, let rating, let buyPrice else { return }
        var card = existing ?? PlayerCard(
            name: "", rating: 0, chemistryStyle: "", buyPrice: 0, buyDate: .now, owner: ""
        )
        card.name = name.trimmingCharacters(in: .whitespaces)
        card.rating = rating
        card.chemistryStyle = chemistryStyle
        card.buyPrice = buyPrice
        card.buyDate = buyDate
        if card.owner.isEmpty { card.owner = userName }
        card.sellPrice = sellPrice
        card.sellDate = isSold ? sellDate : nil
        card.notes = notes
        store.save(card)
    }

    private func resetForNext() {
        savedCount += 1
        name = ""
        ratingText = ""
        buyPriceText = ""
        buyDate = .now
        isSold = false
        sellPriceText = ""
        notes = ""
        scanTokens = []
        focus = .name
        withAnimation { showSavedToast = true }
        Task {
            try? await Task.sleep(for: .seconds(1.8))
            withAnimation { showSavedToast = false }
        }
    }
}
