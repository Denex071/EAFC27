import SwiftUI
import CoreTransferable
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject private var store: PlayerStore
    @AppStorage(AppSettings.depotCodeKey) private var depotCode = ""
    @AppStorage(AppSettings.userNameKey) private var userName = ""
    @State private var confirmLeave = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Du") {
                    TextField("Dein Name", text: $userName)
                        .textInputAutocapitalization(.words)
                }

                Section {
                    HStack {
                        Text("Depot-Code")
                        Spacer()
                        Text(depotCode).font(.body.monospaced()).textSelection(.enabled)
                    }
                    if !store.isDemo {
                        ShareLink(item: "Tritt meinem FC Trader Depot bei – Code: \(depotCode)") {
                            Label("Code mit Freund teilen", systemImage: "person.badge.plus")
                        }
                    }
                    Button("Anderes Depot verwenden", role: .destructive) { confirmLeave = true }
                } header: {
                    Text("Gemeinsames Depot")
                } footer: {
                    Text(store.isDemo
                         ? "Demo-Modus: Daten liegen nur im Speicher und gehen beim Beenden verloren."
                         : "Alle, die diesen Code eingeben, sehen und bearbeiten dieselben Karten in Echtzeit.")
                }

                Section("Daten") {
                    ShareLink(item: CSVFile(text: store.csvExport()), preview: SharePreview("FC-Trader-Export.csv")) {
                        Label("Als CSV exportieren (Excel)", systemImage: "tablecells")
                    }
                }

                Section("Berechnung") {
                    LabeledContent("Gewinn", value: "VK − 5 % EA Tax − EK")
                    LabeledContent("Chemiestile", value: "\(ChemistryStyles.all.count)")
                }

                Section {
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "–")
                }
            }
            .navigationTitle("Einstellungen")
            .confirmationDialog("Depot verlassen?", isPresented: $confirmLeave) {
                Button("Depot verlassen", role: .destructive) { depotCode = "" }
            } message: {
                Text("Die Daten bleiben in der Cloud gespeichert. Mit dem Code kommst du jederzeit zurück.")
            }
        }
    }
}

struct CSVFile: Transferable {
    let text: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .commaSeparatedText) { file in
            // BOM, damit Excel Umlaute korrekt erkennt.
            Data("\u{FEFF}".utf8) + Data(file.text.utf8)
        }
        .suggestedFileName("FC-Trader-Export.csv")
    }
}
