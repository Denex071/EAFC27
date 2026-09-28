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

                Section("Wochenstände") {
                    if snapshots.isEmpty {
                        Text("Noch kein Stand erfasst. Tippe einmal pro Woche auf +, um die Werte deiner Wochenübersicht einzutragen.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(snapshots.enumerated()), id: \.element.id) { index, snapshot in
                        let previous = index + 1 < snapshots.count ? snapshots[index + 1] : nil
                        Button { editing = snapshot } label: {
                            SnapshotRow(snapshot: snapshot, previous: previous)
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
}

struct SnapshotRow: View {
    let snapshot: WealthSnapshot
    let previous: WealthSnapshot?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(period).font(.headline)
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text(Coins.format(snapshot.total)).font(.headline.monospacedDigit())
                    if let previous {
                        ProfitText(value: snapshot.total - previous.total, font: .caption.bold())
                    }
                }
            }

            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow {
                    cell("Teamwert", snapshot.teamValue, previous?.teamValue)
                    cell("TL (ESBC)", snapshot.transferListValue, previous?.transferListValue)
                    cell("Coins", snapshot.coins, previous?.coins)
                    cell("TL (eigen)", snapshot.ownTransferListValue, previous?.ownTransferListValue)
                }
                GridRow {
                    cell("VK ÜV", snapshot.soldCards, previous?.soldCards, plain: true)
                    cell("ÜV a. Liste", snapshot.listedCards, previous?.listedCards, plain: true)
                    cell("Gewinn ÜV", snapshot.tradingProfit, previous?.tradingProfit)
                        .gridCellColumns(2)
                }
            }

            if !snapshot.notes.isEmpty {
                Text(snapshot.notes).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private var period: String {
        let end = snapshot.date.formatted(.dateTime.day().month(.twoDigits).year(.twoDigits))
        guard let previous else { return "bis \(end)" }
        let start = Calendar.current.date(byAdding: .day, value: 1, to: previous.date) ?? previous.date
        return "\(start.formatted(.dateTime.day().month(.twoDigits))) – \(end)"
    }

    /// Wert mit Veränderung zur Vorwoche ("Plus z. Vorw.").
    private func cell(_ title: String, _ value: Int, _ previous: Int?, plain: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            Text(plain ? "\(value)" : Coins.compact(value)).font(.caption.monospacedDigit())
            if let previous {
                let delta = value - previous
                Text(plain ? (delta > 0 ? "+\(delta)" : "\(delta)") : Coins.signed(delta))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(delta >= 0 ? Color.green : Color.red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
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
    @State private var ownTransferText: String
    @State private var soldText: String
    @State private var listedText: String
    @State private var profitText: String
    @State private var notes: String

    init(existing: WealthSnapshot?, template: WealthSnapshot?) {
        self.existing = existing
        let base = existing ?? template
        _date = State(initialValue: existing?.date ?? .now)
        _teamText = State(initialValue: base.map { "\($0.teamValue)" } ?? "")
        _transferText = State(initialValue: base.map { "\($0.transferListValue)" } ?? "")
        _coinsText = State(initialValue: base.map { "\($0.coins)" } ?? "")
        _ownTransferText = State(initialValue: base.map { "\($0.ownTransferListValue)" } ?? "")
        // Wochenwerte beginnen bei einem neuen Stand leer.
        _soldText = State(initialValue: existing.map { "\($0.soldCards)" } ?? "")
        _listedText = State(initialValue: existing.map { "\($0.listedCards)" } ?? "")
        _profitText = State(initialValue: existing.map { "\($0.tradingProfit)" } ?? "")
        _notes = State(initialValue: existing?.notes ?? "")
    }

    private var total: Int {
        (Coins.parse(teamText) ?? 0) + (Coins.parse(transferText) ?? 0) + (Coins.parse(coinsText) ?? 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Stichtag", selection: $date, displayedComponents: .date)
                }
                Section {
                    CoinField(title: "Teamwert (ESBC)", text: $teamText)
                    CoinField(title: "TL-Wert (ESBC)", text: $transferText)
                    CoinField(title: "Coins Bank", text: $coinsText)
                    CoinField(title: "TL-Wert (eigen)", text: $ownTransferText)
                } header: {
                    Text("Werte")
                } footer: {
                    Text("Vorausgefüllt mit dem letzten Stand.")
                }
                Section("ÜV-Karten") {
                    countField("VK ÜV-Karten", text: $soldText)
                    countField("ÜV-Karten a. Liste", text: $listedText)
                    CoinField(title: "Gewinn ÜV", text: $profitText)
                }
                Section {
                    LabeledContent("ges. Vermögen") {
                        Text(Coins.format(total)).font(.headline.monospacedDigit())
                    }
                } footer: {
                    Text("Teamwert + TL-Wert (ESBC) + Coins Bank")
                }
                Section("Notiz") {
                    TextField("optional", text: $notes, axis: .vertical)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(existing == nil ? "Wochenstand" : "Stand bearbeiten")
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
                        snapshot.ownTransferListValue = Coins.parse(ownTransferText) ?? 0
                        snapshot.soldCards = Int(soldText) ?? 0
                        snapshot.listedCards = Int(listedText) ?? 0
                        snapshot.tradingProfit = Coins.parse(profitText) ?? 0
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

    private func countField(_ title: String, text: Binding<String>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .font(.body.monospacedDigit())
        }
    }
}
