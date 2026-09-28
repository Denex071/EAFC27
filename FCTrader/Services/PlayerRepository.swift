import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore

/// Speicherort der Karten. Firestore für den gemeinsamen Betrieb, Demo für Tests ohne Cloud.
protocol PlayerRepository: AnyObject {
    func startListening(onChange: @escaping ([PlayerCard]) -> Void, onError: @escaping (Error) -> Void)
    func stopListening()
    func save(_ card: PlayerCard) async throws
    func delete(id: String) async throws
}

// MARK: - Firestore

/// Pfad: depots/{depotCode}/players/{cardId}
/// Beide Nutzer mit demselben Depot-Code sehen dieselben Daten in Echtzeit.
final class FirestoreRepository: PlayerRepository {
    static var isAvailable: Bool { FirebaseApp.app() != nil }

    static func signIn() async throws {
        if Auth.auth().currentUser == nil {
            _ = try await Auth.auth().signInAnonymously()
        }
    }

    private let collection: CollectionReference
    private var listener: ListenerRegistration?

    init(depotCode: String) {
        collection = Firestore.firestore()
            .collection("depots").document(depotCode)
            .collection("players")
    }

    func startListening(onChange: @escaping ([PlayerCard]) -> Void, onError: @escaping (Error) -> Void) {
        listener = collection.addSnapshotListener { snapshot, error in
            if let error {
                onError(error)
                return
            }
            let cards = snapshot?.documents.compactMap { PlayerCard(id: $0.documentID, data: $0.data()) } ?? []
            onChange(cards)
        }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }

    func save(_ card: PlayerCard) async throws {
        try await collection.document(card.id).setData(card.firestoreData)
    }

    func delete(id: String) async throws {
        try await collection.document(id).delete()
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
    private var onChange: (([PlayerCard]) -> Void)?

    init() {
        for card in Self.sampleData() { cards[card.id] = card }
    }

    func startListening(onChange: @escaping ([PlayerCard]) -> Void, onError: @escaping (Error) -> Void) {
        self.onChange = onChange
        publish()
    }

    func stopListening() { onChange = nil }

    func save(_ card: PlayerCard) async throws {
        cards[card.id] = card
        publish()
    }

    func delete(id: String) async throws {
        cards[id] = nil
        publish()
    }

    private func publish() {
        onChange?(Array(cards.values))
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
