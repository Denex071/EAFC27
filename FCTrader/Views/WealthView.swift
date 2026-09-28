import SwiftUI
import Charts

/// Vermögensentwicklung: wöchentliche Stände von Teamwert, Transferliste und Coins.
struct WealthView: View {
    @EnvironmentObject private var store: PlayerStore
    @State private var editing: WealthSnapshot?
    @State private var showAdd = false
    @State private var chartSelection: Date?

    private var snapshots: [WealthSnapshot] { store.snapshots } // neueste zuerst

    var body: some View {
        NavigationStack {
            List {
                if let latest = snapshots.first {
                    Section { hero(latest) }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }

                if snapshots.count >= 2 {
                    Section("Verlauf Gesamtvermögen") { chart }
                }

                Section {
                    appValues
                } header: {
                    Text("Laut App (live)")
                } footer: {
                    Text("Werte aus den erfassten Karten. Beim neuen Stand kannst du sie übernehmen.")
                }

                Section("Wochenstände") {
                    if snapshots.isEmpty {
                        Text("Noch kein Stand erfasst. Tippe auf +, um Teamwert, Transferlisten-Wert und Coins einzutragen.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(snapshots.enumerated()), id: \.element.id) { index, snapshot in
                        let previous = index + 1 < snapshots.count ? snapshots[index + 1] : nil
                        Button { editing = snapshot } label: {
                            SnapshotRow(
                                snapshot: snapshot,
                                previous: previous,
                                tradingProfit: TradingStats.profit(of: store.players, after: previous?.date, upTo: snapshot.date)
                            )
                        }
                        .tint(.primary)
                        .swipeActions {
                            Button(role: .destructive) { store.delete(snapshot) } label: { Label("Löschen", systemImage: "trash") }
                        }
                    }
                }
            }
            .navigationTitle("Vermögen")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAdd = true } label: { Image(systemName: "plus.circle.fill").font(.title3) }
                }
            }
            .sheet(isPresented: $showAdd) { SnapshotFormView(existing: nil, template: snapshots.first) }
            .sheet(item: $editing) { SnapshotFormView(existing: $0, template: nil) }
        }
    }

    private func hero(_ latest: WealthSnapshot) -> some View {
        let previous = snapshots.dropFirst().first
        return VStack(alignment: .leading, spacing: 6) {
            Text("Gesamtvermögen · \(latest.date.formatted(date: .abbreviated, time: .omitted))")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
            Text(Coins.format(latest.total))
                .font(.system(size: 38, weight: .heavy, design: .rounded).monospacedDigit())
                .foregroundStyle(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            if let previous {
                let delta = latest.total - previous.total
                Text("\(Coins.signed(delta)) zum Stand vom \(previous.date.formatted(date: .abbreviated, time: .omitted))")
                    .font(.footnote.bold())
                    .foregroundStyle(.white.opacity(0.9))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(
            LinearGradient(colors: [Color(red: 0.15, green: 0.25, blue: 0.55), Color(red: 0.30, green: 0.45, blue: 0.85)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
    }

    private var chart: some View {
        let points = Array(snapshots.reversed())
        let selected = chartSelection.flatMap { date in
            points.min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }
        }
        return Chart {
            ForEach(points) { s in
                LineMark(x: .value("Datum", s.date), y: .value("Vermögen", s.total))
                    .foregroundStyle(Color.accentColor)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                PointMark(x: .value("Datum", s.date), y: .value("Vermögen", s.total))
                    .foregroundStyle(Color.accentColor)
                    .symbolSize(40)
            }
            if let selected {
                RuleMark(x: .value("Auswahl", selected.date))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) {
                        VStack(spacing: 2) {
                            Text(Coins.format(selected.total)).font(.caption.bold().monospacedDigit())
                            Text(selected.date.formatted(date: .abbreviated, time: .omitted)).font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(6)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 8))
                        .shadow(radius: 2)
                    }
            }
        }
        .chartXSelection(value: $chartSelection)
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(Color.secondary.opacity(0.2))
                AxisValueLabel {
                    if let v = value.as(Int.self) { Text(Coins.compact(v)) }
                }
            }
        }
        .frame(height: 170)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var appValues: some View {
        let stats = TradingStats(players: store.players, period: .all)
        LabeledContent("Offene Karten", value: "\(stats.open.count)")
        LabeledContent("Kalk. VK-Wert offen", value: Coins.format(stats.openTargetValue))
        LabeledContent("Investiert (EK offen)", value: Coins.format(stats.capitalBound))
    }
}

struct SnapshotRow: View {
    let snapshot: WealthSnapshot
    let previous: WealthSnapshot?
    let tradingProfit: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(snapshot.date.formatted(date: .abbreviated, time: .omitted)).font(.headline)
                Spacer()
                Text(Coins.format(snapshot.total)).font(.headline.monospacedDigit())
            }
            HStack(spacing: 12) {
                part("Team", snapshot.teamValue, previous?.teamValue)
                part("TL", snapshot.transferListValue, previous?.transferListValue)
                part("Coins", snapshot.coins, previous?.coins)
            }
            HStack {
                if let previous {
                    Text("Veränderung").font(.caption).foregroundStyle(.secondary)
                    ProfitText(value: snapshot.total - previous.total, font: .caption.bold(), compact: true)
                }
                Spacer()
                Text("Trading-Gewinn").font(.caption).foregroundStyle(.secondary)
                ProfitText(value: tradingProfit, font: .caption.bold(), compact: true)
            }
            if !snapshot.notes.isEmpty {
                Text(snapshot.notes).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func part(_ title: String, _ value: Int, _ previous: Int?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(Coins.compact(value)).font(.caption.monospacedDigit())
            if let previous {
                Text(Coins.signed(value - previous))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(value >= previous ? Color.green : Color.red)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SnapshotFormView: View {
    @EnvironmentObject private var store: PlayerStore
    @Environment(\.dismiss) private var dismiss

    private let existing: WealthSnapshot?
    @State private var date: Date
    @State private var teamText: String
    @State private var transferText: String
    @State private var coinsText: String
    @State private var notes: String

    init(existing: WealthSnapshot?, template: WealthSnapshot?) {
        self.existing = existing
        let base = existing ?? template
        _date = State(initialValue: existing?.date ?? .now)
        _teamText = State(initialValue: base.map { "\($0.teamValue)" } ?? "")
        _transferText = State(initialValue: base.map { "\($0.transferListValue)" } ?? "")
        _coinsText = State(initialValue: base.map { "\($0.coins)" } ?? "")
        _notes = State(initialValue: existing?.notes ?? "")
    }

    private var total: Int {
        (Coins.parse(teamText) ?? 0) + (Coins.parse(transferText) ?? 0) + (Coins.parse(coinsText) ?? 0)
    }

    var body: some View {
        let stats = TradingStats(players: store.players, period: .all)
        NavigationStack {
            Form {
                Section {
                    DatePicker("Datum", selection: $date)
                }
                Section {
                    CoinField(title: "Teamwert", text: $teamText)
                    CoinField(title: "Transferliste", text: $transferText)
                    Button("Kalk. VK-Wert aus App übernehmen (\(Coins.compact(stats.openTargetValue)))") {
                        transferText = "\(stats.openTargetValue)"
                    }
                    .font(.footnote)
                    CoinField(title: "Coins", text: $coinsText)
                } header: {
                    Text("Werte")
                } footer: {
                    Text("Teamwert und Transferliste z. B. laut ESBC. Vorausgefüllt mit dem letzten Stand.")
                }
                Section {
                    LabeledContent("Gesamtvermögen") {
                        Text(Coins.format(total)).font(.headline.monospacedDigit())
                    }
                }
                Section("Notiz") {
                    TextField("optional", text: $notes, axis: .vertical)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(existing == nil ? "Neuer Stand" : "Stand bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") {
                        var snapshot = existing ?? WealthSnapshot(date: date, teamValue: 0, transferListValue: 0, coins: 0)
                        snapshot.date = date
                        snapshot.teamValue = Coins.parse(teamText) ?? 0
                        snapshot.transferListValue = Coins.parse(transferText) ?? 0
                        snapshot.coins = Coins.parse(coinsText) ?? 0
                        snapshot.notes = notes
                        store.save(snapshot)
                        dismiss()
                    }
                    .bold()
                    .disabled(total <= 0)
                }
            }
        }
    }
}
