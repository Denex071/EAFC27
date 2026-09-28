import SwiftUI

/// Erster Start: Namen eingeben und Depot erstellen oder beitreten.
struct OnboardingView: View {
    @AppStorage(AppSettings.depotCodeKey) private var depotCode = ""
    @AppStorage(AppSettings.userNameKey) private var userName = ""

    @State private var name = ""
    @State private var joinCode = ""

    private var nameValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }
    private var joinValid: Bool { AppSettings.normalize(joinCode).count >= 6 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 8) {
                        Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.green)
                        Text("FC Trader").font(.largeTitle.bold())
                        Text("Käufe & Verkäufe gemeinsam tracken")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical)
                    .listRowBackground(Color.clear)
                }

                Section("Wie heißt du?") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.words)
                }

                Section {
                    Button {
                        finish(code: AppSettings.generateDepotCode())
                    } label: {
                        Label("Neues Depot erstellen", systemImage: "plus.circle.fill")
                    }
                    .disabled(!nameValid)
                } footer: {
                    Text("Du bekommst einen Code, den du deinem Freund schickst.")
                }

                Section {
                    TextField("Code, z. B. K7RM-2XQP", text: $joinCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.body.monospaced())
                    Button {
                        finish(code: AppSettings.normalize(joinCode))
                    } label: {
                        Label("Depot beitreten", systemImage: "person.2.fill")
                    }
                    .disabled(!nameValid || !joinValid)
                } header: {
                    Text("Code vom Freund erhalten?")
                }

                Section {
                    Button("Mit Beispieldaten ausprobieren") {
                        if !nameValid { name = "Ich" }
                        finish(code: AppSettings.demoCode)
                    }
                } footer: {
                    Text("Demo-Modus – nichts wird gespeichert.")
                }
            }
        }
    }

    private func finish(code: String) {
        userName = name.trimmingCharacters(in: .whitespaces)
        depotCode = code
    }
}
