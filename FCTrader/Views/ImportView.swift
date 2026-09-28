import SwiftUI
import UniformTypeIdentifiers

/// Übernimmt die bisherige Excel-Datenbasis (Reiter "Spieler" als CSV).
struct ImportView: View {
    @EnvironmentObject private var store: PlayerStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppSettings.userNameKey) private var userName = ""

    @State private var showPicker = false
    @State private var result: CSVImporter.Result?
    @State private var fileName = ""
    @State private var isImporting = false
    @State private var errorText: String?
    @State private var done = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button {
                        showPicker = true
                    } label: {
                        Label(result == nil ? "CSV-Datei auswählen" : "Andere Datei wählen", systemImage: "doc.badge.plus")
                    }
                } footer: {
                    Text("""
                    So exportierst du den Reiter „Spieler“:
                    Google Tabellen: Datei → Herunterladen → CSV (aktuelles Tabellenblatt).
                    Excel: Datei → Speichern unter → CSV UTF-8.
                    Die Datei z. B. in iCloud Drive oder per AirDrop in „Dateien“ ablegen.
                    """)
                }

                if let result {
                    Section("Vorschau – \(fileName)") {
                        LabeledContent("Spieler gesamt", value: "\(result.cards.count)")
                        LabeledContent("Davon verkauft", value: "\(result.soldCount)")
                        LabeledContent("Davon offen", value: "\(result.openCount)")
                        LabeledContent("Gewinn (verkauft)") {
                            ProfitText(value: result.totalProfit)
                        }
                    }

                    if !result.skipped.isEmpty {
                        Section("\(result.skipped.count) Zeilen übersprungen") {
                            ForEach(Array(result.skipped.prefix(20).enumerated()), id: \.offset) { _, item in
                                Text("Zeile \(item.line): \(item.reason)")
                                    .font(.caption)
                            }
                        }
                    }

                    Section("Erste Einträge") {
                        ForEach(result.cards.prefix(5)) { PlayerRow(card: $0) }
                    }

                    Section {
                        Button {
                            Task { await runImport(result) }
                        } label: {
                            HStack {
                                Label(done ? "Importiert" : "\(result.cards.count) Spieler importieren",
                                      systemImage: done ? "checkmark.circle.fill" : "square.and.arrow.down")
                                Spacer()
                                if isImporting { ProgressView() }
                            }
                        }
                        .disabled(isImporting || done || result.cards.isEmpty)
                    } footer: {
                        Text("Ein erneuter Import derselben Datei überschreibt die Einträge, statt sie zu verdoppeln. Der Gewinn wird in der App ganzzahlig berechnet – dadurch kann er um wenige Coins von der Excel abweichen.")
                    }
                }
            }
            .navigationTitle("Excel importieren")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(done ? "Fertig" : "Schließen") { dismiss() }
                }
            }
            .fileImporter(isPresented: $showPicker, allowedContentTypes: [.commaSeparatedText, .tabSeparatedText, .plainText, .text]) { picked in
                load(picked)
            }
            .alert("Import fehlgeschlagen", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorText ?? "")
            }
        }
    }

    private func load(_ picked: Swift.Result<URL, Error>) {
        do {
            let url = try picked.get()
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let data = try Data(contentsOf: url)
            guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .windowsCP1252) else {
                throw CocoaError(.fileReadInapplicableStringEncoding)
            }
            let parsed = CSVImporter.parse(text, recordedBy: userName)
            if parsed.cards.isEmpty {
                errorText = "In der Datei wurden keine Spieler gefunden. Bitte den Reiter „Spieler“ als CSV exportieren."
                return
            }
            fileName = url.lastPathComponent
            result = parsed
            done = false
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func runImport(_ result: CSVImporter.Result) async {
        isImporting = true
        defer { isImporting = false }
        do {
            try await store.importCards(result.cards)
            done = true
        } catch {
            errorText = error.localizedDescription
        }
    }
}
