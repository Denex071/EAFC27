import Foundation

/// Zentrale Datenquelle für alle Views.
@MainActor
final class PlayerStore: ObservableObject {
    @Published private(set) var players: [PlayerCard] = []
    @Published private(set) var isDemo = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private var repository: PlayerRepository?

    func connect(depotCode: String) async {
        repository?.stopListening()
        players = []
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
        } onError: { [weak self] error in
            Task { @MainActor in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        }
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

    var knownNames: [String] { Array(Set(players.map(\.name))) }

    func csvExport() -> String {
        let df = ISO8601DateFormatter()
        var lines = ["Name;Rating;Chemiestil;EK;Kaufdatum;VK;Verkaufsdatum;EA Tax;Gewinn;Erfasst von;Notiz"]
        for c in players.sorted(by: { $0.buyDate < $1.buyDate }) {
            let fields: [String] = [
                c.name, "\(c.rating)", c.chemistryStyle, "\(c.buyPrice)", df.string(from: c.buyDate),
                c.sellPrice.map(String.init) ?? "", c.sellDate.map(df.string(from:)) ?? "",
                c.eaTax.map(String.init) ?? "", c.profit.map(String.init) ?? "",
                c.owner, c.notes.replacingOccurrences(of: "\n", with: " "),
            ]
            lines.append(fields.map { $0.replacingOccurrences(of: ";", with: ",") }.joined(separator: ";"))
        }
        return lines.joined(separator: "\n")
    }
}
