import Foundation

/// Zentrale Datenquelle für alle Views.
@MainActor
final class PlayerStore: ObservableObject {
    @Published private(set) var players: [PlayerCard] = []
    @Published private(set) var snapshots: [WealthSnapshot] = []
    @Published private(set) var isDemo = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private var repository: PlayerRepository?

    func connect(depotCode: String) async {
        repository?.stopListening()
        players = []
        snapshots = []
        isLoading = true

        let repo: PlayerRepository
        if depotCode == AppSettings.demoCode || !FirestoreRepository.isAvailable {
            repo = DemoRepository()
            isDemo = true
        } else {
            do {
                try await FirestoreRepository.signIn()
            } catch {
                errorMessage = "Anmeldung fehlgeschlagen: \(error.localizedDescription)"
            }
            repo = FirestoreRepository(depotCode: depotCode)
            isDemo = false
        }

        repository = repo
        repo.startListening { [weak self] cards in
            Task { @MainActor in
                self?.players = cards
                self?.isLoading = false
            }
        } onSnapshots: { [weak self] snapshots in
            Task { @MainActor in
                self?.snapshots = snapshots.sorted { $0.date > $1.date }
            }
        } onError: { [weak self] error in
            Task { @MainActor in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        }
        repo.startListeningIcons { [weak self] samples in
            Task { @MainActor in
                self?.learnedIcons = Dictionary(grouping: samples.compactMap { sample in
                    IconPrint(hex: sample.hex).map { (sample.style, $0) }
                }, by: \.0).mapValues { $0.map(\.1) }
            }
        }
    }

    // MARK: - Chemiestil-Symbole lernen

    /// Vom Nutzer bestätigte Symbole je Stil – ergänzen die mitgelieferten Vorlagen.
    @Published private(set) var learnedIcons: [String: [IconPrint]] = [:]

    /// Merkt sich das Symbol, wenn die Erkennung unsicher war oder sich geirrt hat.
    func learnIcon(_ print: IconPrint?, style: String, recognized: String?) {
        guard let print, recognized != style, (learnedIcons[style]?.count ?? 0) < 30 else { return }
        learnedIcons[style, default: []].append(print)
        let sample = IconSample(style: style, hex: print.hex)
        perform { try await $0.save(sample) }
    }

    // MARK: - Aktionen

    func save(_ card: PlayerCard) {
        // Sofort lokal anzeigen, Cloud synchronisiert im Hintergrund.
        if let index = players.firstIndex(where: { $0.id == card.id }) {
            players[index] = card
        } else {
            players.append(card)
        }
        perform { try await $0.save(card) }
    }

    func sell(_ card: PlayerCard, price: Int, date: Date) {
        var updated = card
        updated.sellPrice = price
        updated.sellDate = date
        save(updated)
    }

    func undoSell(_ card: PlayerCard) {
        var updated = card
        updated.sellPrice = nil
        updated.sellDate = nil
        save(updated)
    }

    /// Gleiche Karte nochmal gekauft (neuer Eintrag, gleicher Preis, jetzt).
    func duplicate(_ card: PlayerCard, recordedBy: String) {
        save(PlayerCard(
            name: card.name, rating: card.rating, chemistryStyle: card.chemistryStyle,
            buyPrice: card.buyPrice, buyDate: .now, owner: recordedBy
        ))
    }

    func delete(_ card: PlayerCard) {
        players.removeAll { $0.id == card.id }
        perform { try await $0.delete(id: card.id) }
    }

    /// Import aus Excel/CSV. Bereits importierte Zeilen werden überschrieben, nicht verdoppelt.
    func importCards(_ cards: [PlayerCard]) async throws {
        guard let repository else { return }
        try await repository.saveAll(cards)
    }

    func save(_ snapshot: WealthSnapshot) {
        if let index = snapshots.firstIndex(where: { $0.id == snapshot.id }) {
            snapshots[index] = snapshot
        } else {
            snapshots.append(snapshot)
            snapshots.sort { $0.date > $1.date }
        }
        perform { try await $0.save(snapshot) }
    }

    func delete(_ snapshot: WealthSnapshot) {
        snapshots.removeAll { $0.id == snapshot.id }
        perform { try await $0.deleteSnapshot(id: snapshot.id) }
    }

    private func perform(_ operation: @escaping (PlayerRepository) async throws -> Void) {
        guard let repository else { return }
        Task {
            do {
                try await operation(repository)
            } catch {
                errorMessage = "Speichern fehlgeschlagen: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - Abgeleitete Daten für schnelle Eingabe

    /// Zuletzt verwendete Chemiestile (max. 5) für die Schnellauswahl.
    var recentChemistryStyles: [String] {
        var seen = Set<String>()
        return players
            .sorted { $0.createdAt > $1.createdAt }
            .map(\.chemistryStyle)
            .filter { seen.insert($0).inserted }
            .prefix(5)
            .map { $0 }
    }

    /// Bekannte Spieler (jeweils letzter Eintrag), passend zur Eingabe.
    func suggestions(for query: String) -> [PlayerCard] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 2 else { return [] }
        var latestByName: [String: PlayerCard] = [:]
        for card in players where card.name.lowercased().contains(q) {
            if let existing = latestByName[card.name], existing.createdAt > card.createdAt { continue }
            latestByName[card.name] = card
        }
        return latestByName.values
            .filter { $0.name.lowercased() != q }
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(4)
            .map { $0 }
    }

    /// Letzter Eintrag eines Spielers (für Rating & Chemiestil als Vorbelegung).
    func lastCard(named name: String) -> PlayerCard? {
        players
            .filter { NameMatching.matches($0.name, name) }
            .max { $0.createdAt < $1.createdAt }
    }

    /// Offene Käufe zu einem gescannten Spieler, älteste zuerst (so wird zuerst verkauft, was am längsten liegt).
    /// Passt das Rating, werden diese Karten bevorzugt.
    func openCards(matching name: String, rating: Int?) -> [PlayerCard] {
        players
            .filter { !$0.isSold && NameMatching.matches($0.name, name) }
            .sorted { a, b in
                let aFits = rating == nil || a.rating == rating
                let bFits = rating == nil || b.rating == rating
                if aFits != bFits { return aFits }
                return a.buyDate < b.buyDate
            }
    }

    /// Wurde dieser Verkauf vermutlich schon erfasst? (gleicher Spieler & Preis in den letzten 36 Stunden)
    func recentSale(named name: String, price: Int) -> PlayerCard? {
        let since = Date().addingTimeInterval(-36 * 3_600)
        return players.first {
            $0.sellPrice == price && ($0.sellDate ?? .distantPast) > since && NameMatching.matches($0.name, name)
        }
    }

    var knownNames: [String] { Array(Set(players.map(\.name))) }

    /// Export im Aufbau des Excel-Reiters "Spieler" – kann auch wieder importiert werden.
    func csvExport() -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "dd.MM.yyyy HH:mm"
        var lines = ["Name;Rating;ChemieStyle;EK;EK Datum;kalk. VK;VK;VK Datum;EA Tax;Gewinn;Marge %;Notiz"]
        for c in players.sorted(by: { $0.buyDate < $1.buyDate }) {
            let fields: [String] = [
                c.name, "\(c.rating)", c.chemistryStyle, "\(c.buyPrice)", df.string(from: c.buyDate),
                "\(c.targetPrice)",
                c.sellPrice.map(String.init) ?? "", c.sellDate.map(df.string(from:)) ?? "",
                c.eaTax.map(String.init) ?? "", c.profit.map(String.init) ?? "",
                c.margin.map { String(format: "%.1f", $0 * 100).replacingOccurrences(of: ".", with: ",") } ?? "",
                c.notes.replacingOccurrences(of: "\n", with: " "),
            ]
            lines.append(fields.map { $0.replacingOccurrences(of: ";", with: ",") }.joined(separator: ";"))
        }
        return lines.joined(separator: "\n")
    }
}
