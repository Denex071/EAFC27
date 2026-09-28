import SwiftUI
import FirebaseCore

@main
struct FCTraderApp: App {
    @StateObject private var store = PlayerStore()

    init() {
        // Ohne GoogleService-Info.plist startet die App automatisch im Demo-Modus.
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}
