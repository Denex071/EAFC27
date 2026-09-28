import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore

/// Speicherort der Daten. Firestore für den gemeinsamen Betrieb, Demo für Tests ohne Cloud.
protocol PlayerRepository: AnyObject {
    func startListening(
        onCards: @escaping ([PlayerCard]) -> Void,
        onSnapshots: @escaping ([WealthSnapshot]) -> Void,
        onError: @escaping (Error) -> Void
    )
    func stopListening()
    func save(_ card: PlayerCard) async throws
    func saveAll(_ cards: [PlayerCard]) async throws
    func delete(id: String) async throws
    func save(_ snapshot: WealthSnapshot) async throws
    func deleteSnapshot(id: String) async throws
}

// MARK: - Firestore

/// Pfade: depots/{depotCode}/players/{cardId} und depots/{depotCode}/snapshots/{id}
/// Beide Nutzer mit demselben Depot-Code sehen dieselben Daten in Echtzeit.
final class FirestoreRepository: PlayerRepository {
    static var isAvailable: Bool { FirebaseApp.app() != nil }

    static func signIn() async throws {
        if Auth.auth().currentUser == nil {
            _ = try await Auth.auth().signInAnonymously()
        }
    }

    private let db: Firestore
    private let cards: CollectionReference
    private let snapshots: CollectionReference
    private var listeners: [ListenerRegistration] = []

    init(depotCode: String) {
        let db = Firestore.firestore()
        self.db = db
        let depot = db.collection("depots").document(depotCode)
        cards = depot.collection("players")
        snapshots = depot.collection("snapshots")
    }

    func startListening(
        onCards: @escaping ([PlayerCard]) -> Void,
        onSnapshots: @escaping ([WealthSnapshot]) -> Void,
        onError: @escaping (Error) -> Void
    ) {
        listeners.append(cards.addSnapshotListener { snapshot, error in
            if let error { onError(error); return }
            onCards(snapshot?.documents.compactMap { PlayerCard(id: $0.documentID, data: $0.data()) } ?? [])
        })
        listeners.append(snapshots.addSnapshotListener { snapshot, error in
            if let error { onError(error); return }
            onSnapshots(snapshot?.documents.compactMap { WealthSnapshot(id: $0.documentID, data: $0.data()) } ?? [])
        })
    }

    func stopListening() {
        listeners.forEach { $0.remove() }
        listeners = []
    }

    func save(_ card: PlayerCard) async throws {
        try await cards.document(card.id).setData(card.firestoreData)
    }

    /// Schreibt viele Karten in Paketen (Firestore erlaubt max. 500 pro Batch).
    func saveAll(_ all: [PlayerCard]) async throws {
        for start in stride(from: 0, to: all.count, by: 400) {
            let batch = db.batch()
            for card in all[start..<min(start + 400, all.count)] {
                batch.setData(card.firestoreData, forDocument: cards.document(card.id))
            }
            try await batch.commit()
        }
    }

    func delete(id: String) async throws {
        try await cards.document(id).delete()
    }

    func save(_ snapshot: WealthSnapshot) async throws {
        try await snapshots.document(snapshot.id).setData(snapshot.firestoreData)
    }

    func deleteSnapshot(id: String) async throws {
        try await snapshots.document(id).delete()
    }
}

extension WealthSnapshot {
    var firestoreData: [String: Any] {
        [
            "date": Timestamp(date: date),
            "teamValue": teamValue,
            "transferListValue": transferListValue,
            "coins": coins,
            "notes": notes,
        ]
    }

    init?(id: String, data: [String: Any]) {
        guard let date = (data["date"] as? Timestamp)?.dateValue() else { return nil }
        self.init(
            id: id,
            date: date,
            teamValue: (data["teamValue"] as? NSNumber)?.intValue ?? 0,
            transferListValue: (data["transferListValue"] as? NSNumber)?.intValue ?? 0,
            coins: (data["coins"] as? NSNumber)?.intValue ?? 0,
            notes: data["notes"] as? String ?? ""
        )
    }
}

extension PlayerCard {
    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            "name": name,
            "rating": rating,
            "chemistryStyle": chemistryStyle,
            "buyPrice": buyPrice,
            "buyDate": Timestamp(date: buyDate),
            "owner": owner,
            "notes": notes,
            "createdAt": Timestamp(date: createdAt),
        ]
        if let sellPrice { data["sellPrice"] = sellPrice }
        if let sellDate { data["sellDate"] = Timestamp(date: sellDate) }
        return data
    }

    init?(id: String, data: [String: Any]) {
        guard
            let name = data["name"] as? String,
            let buyPrice = (data["buyPrice"] as? NSNumber)?.intValue,
            let buyDate = (data["buyDate"] as? Timestamp)?.dateValue()
        else { return nil }

        self.init(
            id: id,
            name: name,
            rating: (data["rating"] as? NSNumber)?.intValue ?? 0,
            chemistryStyle: data["chemistryStyle"] as? String ?? ChemistryStyles.none,
            buyPrice: buyPrice,
            buyDate: buyDate,
            sellPrice: (data["sellPrice"] as? NSNumber)?.intValue,
            sellDate: (data["sellDate"] as? Timestamp)?.dateValue(),
            owner: data["owner"] as? String ?? "",
            notes: data["notes"] as? String ?? "",
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue() ?? buyDate
        )
    }
}

// MARK: - Demo

/// Nur im Speicher – zum Ausprobieren ohne Firebase-Setup.
final class DemoRepository: PlayerRepository {
    private var cards: [String: PlayerCard] = [:]
    private var snapshots: [String: WealthSnapshot] = [:]
    private var onCards: (([PlayerCard]) -> Void)?
    private var onSnapshots: (([WealthSnapshot]) -> Void)?

    init() {
        for card in Self.sampleData() { cards[card.id] = card }
        let week: TimeInterval = 7 * 86_400
        for (i, s) in [(92_000, 170_000, 35_000), (98_000, 185_000, 61_000)].enumerated() {
            let snapshot = WealthSnapshot(
                date: Date().addingTimeInterval(-Double(1 - i) * week - 3_600),
                teamValue: s.0, transferListValue: s.1, coins: s.2
            )
            snapshots[snapshot.id] = snapshot
        }
    }

    func startListening(
        onCards: @escaping ([PlayerCard]) -> Void,
        onSnapshots: @escaping ([WealthSnapshot]) -> Void,
        onError: @escaping (Error) -> Void
    ) {
        self.onCards = onCards
        self.onSnapshots = onSnapshots
        publish()
    }

    func stopListening() {
        onCards = nil
        onSnapshots = nil
    }

    func save(_ card: PlayerCard) async throws {
        cards[card.id] = card
        publish()
    }

    func saveAll(_ all: [PlayerCard]) async throws {
        for card in all { cards[card.id] = card }
        publish()
    }

    func delete(id: String) async throws {
        cards[id] = nil
        publish()
    }

    func save(_ snapshot: WealthSnapshot) async throws {
        snapshots[snapshot.id] = snapshot
        publish()
    }

    func deleteSnapshot(id: String) async throws {
        snapshots[id] = nil
        publish()
    }

    private func publish() {
        onCards?(Array(cards.values))
        onSnapshots?(Array(snapshots.values))
    }

    private static func sampleData() -> [PlayerCard] {
        let day: TimeInterval = 86_400
        let now = Date()
        func card(_ name: String, _ rating: Int, _ chem: String, _ buy: Int, daysAgo: Double,
                  sell: Int? = nil, soldDaysAgo: Double? = nil, owner: String) -> PlayerCard {
            PlayerCard(
                name: name, rating: rating, chemistryStyle: chem,
                buyPrice: buy, buyDate: now.addingTimeInterval(-daysAgo * day),
                sellPrice: sell, sellDate: soldDaysAgo.map { now.addingTimeInterval(-$0 * day) },
                owner: owner
            )
        }
        return [
            card("Kylian Mbappé", 91, "Hunter", 1_250_000, daysAgo: 12, sell: 1_390_000, soldDaysAgo: 9, owner: "Ich"),
            card("Jude Bellingham", 90, "Engine", 610_000, daysAgo: 10, sell: 655_000, soldDaysAgo: 8, owner: "Kumpel"),
            card("Florian Wirtz", 89, "Maestro", 182_000, daysAgo: 6, sell: 176_000, soldDaysAgo: 5, owner: "Ich"),
            card("Jamal Musiala", 88, "Artist", 94_500, daysAgo: 4, sell: 112_000, soldDaysAgo: 2, owner: "Kumpel"),
            card("Virgil van Dijk", 89, "Anchor", 71_000, daysAgo: 3, sell: 79_500, soldDaysAgo: 1, owner: "Ich"),
            card("Rodri", 90, "Anchor", 214_000, daysAgo: 1.5, sell: 236_000, soldDaysAgo: 0.2, owner: "Ich"),
            card("Alisson", 89, "Glove", 38_750, daysAgo: 0.8, sell: 43_500, soldDaysAgo: 0.1, owner: "Kumpel"),
            card("Lamine Yamal", 89, "Hunter", 305_000, daysAgo: 2, owner: "Ich"),
            card("Joshua Kimmich", 87, "Shadow", 27_250, daysAgo: 5, owner: "Kumpel"),
            card("Harry Kane", 90, "Marksman", 118_000, daysAgo: 0.3, owner: "Ich"),
        ]
    }
}
