import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: PlayerStore
    @AppStorage(AppSettings.depotCodeKey) private var depotCode = ""
    @AppStorage(AppSettings.userNameKey) private var userName = ""

    var body: some View {
        if depotCode.isEmpty || userName.isEmpty {
            OnboardingView()
        } else {
            TabView {
                DashboardView()
                    .tabItem { Label("Übersicht", systemImage: "chart.bar.xaxis") }
                PlayerListView()
                    .tabItem { Label("Spieler", systemImage: "person.crop.rectangle.stack") }
                WealthView()
                    .tabItem { Label("Vermögen", systemImage: "banknote") }
                SettingsView()
                    .tabItem { Label("Einstellungen", systemImage: "gearshape") }
            }
            .task(id: depotCode) {
                await store.connect(depotCode: depotCode)
            }
            .alert("Fehler", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(store.errorMessage ?? "")
            }
        }
    }
}
