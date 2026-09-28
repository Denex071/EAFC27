import SwiftUI
import Charts

struct DashboardView: View {
    enum ChartMode: String, CaseIterable, Identifiable {
        case daily = "Pro Tag"
        case cumulative = "Verlauf"
        var id: String { rawValue }
    }

    @EnvironmentObject private var store: PlayerStore
    @State private var period: StatsPeriod = .all
    @State private var chartMode: ChartMode = .daily
    @State private var selling: PlayerCard?
    @State private var chartSelection: Date?

    var body: some View {
        let stats = TradingStats(players: store.players, period: period)
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    Picker("Zeitraum", selection: $period) {
                        ForEach(StatsPeriod.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    hero(stats)
                    tiles(stats)
                    chart(stats)
                    if !stats.weeks.isEmpty { weeks(stats) }
                    if !stats.players.isEmpty { topPlayers(stats) }
                    flips(stats)
                    if !stats.longestHeld.isEmpty { longestHeld(stats) }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Übersicht")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    ScanAddButton()
                    AddCardButton()
                }
            }
            .overlay {
                if store.isLoading { ProgressView() }
            }
            .sheet(item: $selling) { SellPlayerView(card: $0) }
        }
    }

    // MARK: - Kopf & Kacheln

    private func hero(_ stats: TradingStats) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Gesamtgewinn · \(period.rawValue)")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
            Text(Coins.signed(stats.realizedProfit))
                .font(.system(size: 40, weight: .heavy, design: .rounded).monospacedDigit())
                .foregroundStyle(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text("aus \(stats.sold.count) Verkäufen · \(stats.open.count) Spieler offen")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(
            LinearGradient(
                colors: stats.realizedProfit >= 0
                    ? [Color(red: 0.05, green: 0.45, blue: 0.30), Color(red: 0.10, green: 0.65, blue: 0.45)]
                    : [Color(red: 0.55, green: 0.10, blue: 0.12), Color(red: 0.80, green: 0.25, blue: 0.22)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
    }

    private func tiles(_ stats: TradingStats) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            // Bestand
            StatTile(title: "Unverkaufte Spieler", value: "\(stats.open.count)",
                     detail: "aktueller Bestand", systemImage: "tray.full")
            StatTile(title: "Aktuell investiert", value: Coins.format(stats.capitalBound),
                     detail: "EK der offenen Spieler", systemImage: "lock")
            StatTile(title: "Kalk. VK-Wert offen", value: Coins.format(stats.openTargetValue),
                     detail: "erwarteter Gewinn \(Coins.signed(stats.openExpectedProfit))", systemImage: "scope")
            StatTile(title: "Ø Gewinn / Verkauf", value: Coins.signed(stats.averageProfit),
                     detail: "\(stats.sold.count) Verkäufe", systemImage: "divide")
            // Verkäufe im Zeitraum
            StatTile(title: "Ø Marge", value: percent(stats.averageMargin),
                     detail: "Gewinn / VK", systemImage: "percent")
            StatTile(title: "Trefferquote", value: String(format: "%.0f %%", stats.winRate * 100),
                     detail: "Verkäufe mit Gewinn", systemImage: "target")
            StatTile(title: "Gesamt EK", value: Coins.format(stats.totalBuy),
                     detail: "der verkauften Spieler", systemImage: "cart")
            StatTile(title: "Gesamt VK", value: Coins.format(stats.turnover),
                     detail: "Rendite \(percent(stats.roi))", systemImage: "banknote")
            StatTile(title: "Ø Haltedauer", value: stats.averageHold.holdText,
                     detail: "Kauf bis Verkauf", systemImage: "hourglass")
            StatTile(title: "EA Tax bezahlt", value: Coins.format(stats.taxPaid),
                     detail: "5 % auf Verkäufe", systemImage: "building.columns")
        }
    }

    private func percent(_ value: Double) -> String {
        String(format: "%+.1f %%", value * 100).replacingOccurrences(of: ".", with: ",")
    }

    // MARK: - Diagramm

    private func chart(_ stats: TradingStats) -> some View {
        CardSection(title: chartMode == .daily ? "Gewinn pro Tag · letzte 10 Tage" : "Gewinnverlauf · \(period.rawValue)") {
            Picker("Ansicht", selection: $chartMode) {
                ForEach(ChartMode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .onChange(of: chartMode) { _, _ in chartSelection = nil }

            switch chartMode {
            case .daily:
                dailyChart(stats.lastDays)
            case .cumulative:
                if stats.profitCurve.count >= 2 {
                    cumulativeChart(stats.profitCurve)
                } else {
                    Text("Noch zu wenige Verkäufe im Zeitraum.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 120)
                }
            }
        }
    }

    private func dailyChart(_ days: [TradingStats.DayStat]) -> some View {
        let calendar = Calendar.trading
        let selected = chartSelection.flatMap { date in days.first { calendar.isDate($0.day, inSameDayAs: date) } }
        let shown = selected ?? days.last
        return VStack(alignment: .leading, spacing: 8) {
            Chart {
                ForEach(days) { day in
                    BarMark(x: .value("Tag", day.day, unit: .day), y: .value("Gewinn", day.profit))
                        .foregroundStyle(day.profit >= 0 ? Color.green : Color.red)
                        .opacity(selected == nil || selected?.day == day.day ? 1 : 0.4)
                        .cornerRadius(4)
                }
            }
            .chartXSelection(value: $chartSelection)
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 2)) { _ in
                    AxisValueLabel(format: .dateTime.day().month(.twoDigits))
                }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisGridLine().foregroundStyle(Color.secondary.opacity(0.2))
                    AxisValueLabel {
                        if let v = value.as(Int.self) { Text(Coins.compact(v)) }
                    }
                }
            }
            .frame(height: 170)

            if let shown {
                HStack {
                    Text(shown.day.formatted(.dateTime.weekday(.wide).day().month()))
                        .font(.subheadline.bold())
                    Spacer()
                    Text("\(shown.sales) VK · Ø \(Coins.signed(shown.averageProfit))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ProfitText(value: shown.profit, font: .subheadline.bold())
                }
            }
        }
    }

    private func cumulativeChart(_ curve: [TradingStats.ProfitPoint]) -> some View {
        let selected = chartSelection.flatMap { date in
            curve.min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }
        }
        return Chart {
            ForEach(curve) { point in
                AreaMark(x: .value("Datum", point.date), y: .value("Gewinn", point.cumulative))
                    .foregroundStyle(Color.accentColor.opacity(0.12))
                    .interpolationMethod(.monotone)
                LineMark(x: .value("Datum", point.date), y: .value("Gewinn", point.cumulative))
                    .foregroundStyle(Color.accentColor)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    .interpolationMethod(.monotone)
            }
            if let selected {
                RuleMark(x: .value("Auswahl", selected.date))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                PointMark(x: .value("Datum", selected.date), y: .value("Gewinn", selected.cumulative))
                    .foregroundStyle(Color.accentColor)
                    .symbolSize(80)
                    .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) {
                        VStack(spacing: 2) {
                            Text(Coins.signed(selected.cumulative)).font(.caption.bold().monospacedDigit())
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
        .frame(height: 180)
    }

    // MARK: - Listen

    private func weeks(_ stats: TradingStats) -> some View {
        let recent = Array(stats.weeks.prefix(6))
        return CardSection(title: "Gewinn pro Woche") {
            ForEach(recent) { week in
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("KW \(Calendar.trading.component(.weekOfYear, from: week.start))")
                            .font(.subheadline.bold())
                        Text("\(week.start.formatted(.dateTime.day().month(.twoDigits))) – \(week.end.formatted(.dateTime.day().month(.twoDigits)))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(week.sales) VK")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ProfitText(value: week.profit)
                        .frame(minWidth: 90, alignment: .trailing)
                }
                if week.id != recent.last?.id { Divider() }
            }
        }
    }

    private func topPlayers(_ stats: TradingStats) -> some View {
        CardSection(title: "Top-Spieler · \(period.rawValue)") {
            ForEach(Array(stats.players.prefix(5).enumerated()), id: \.element.id) { index, player in
                PlayerStatRow(rank: index + 1, stat: player)
            }
            NavigationLink {
                PlayerRankingView(period: period)
            } label: {
                HStack {
                    Text("Alle \(stats.players.count) Spieler anzeigen")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.subheadline)
            }
            .padding(.top, 4)
        }
    }

    @ViewBuilder
    private func flips(_ stats: TradingStats) -> some View {
        if stats.bestFlip != nil || stats.worstFlip != nil {
            CardSection(title: "Top & Flop") {
                if let best = stats.bestFlip {
                    flipRow(best, label: "Bester Verkauf", systemImage: "trophy.fill", color: .yellow)
                }
                if let worst = stats.worstFlip {
                    Divider()
                    flipRow(worst, label: "Schwächster Verkauf", systemImage: "arrow.down.circle.fill", color: .secondary)
                }
            }
        }
    }

    private func flipRow(_ card: PlayerCard, label: String, systemImage: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage).foregroundStyle(color)
            RatingBadge(rating: card.rating, size: 32)
            VStack(alignment: .leading) {
                Text(label).font(.caption).foregroundStyle(.secondary)
                Text(card.name).font(.subheadline.bold())
            }
            Spacer()
            ProfitText(value: card.profit ?? 0)
        }
    }

    private func longestHeld(_ stats: TradingStats) -> some View {
        CardSection(title: "Am längsten im Club") {
            ForEach(stats.longestHeld) { card in
                HStack(spacing: 12) {
                    RatingBadge(rating: card.rating, size: 32)
                    VStack(alignment: .leading) {
                        Text(card.name).font(.subheadline.bold())
                        Text("seit \(card.holdDuration.holdText) · Ziel \(Coins.format(card.targetPrice)) · BE \(Coins.format(card.breakEvenPrice))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Verkaufen") { selling = card }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            }
        }
    }
}

struct PlayerStatRow: View {
    let rank: Int
    let stat: TradingStats.PlayerStat

    var body: some View {
        HStack(spacing: 10) {
            Text("\(rank)")
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 22)
            RatingBadge(rating: stat.rating, size: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(stat.name).font(.subheadline.bold()).lineLimit(1)
                Text("\(stat.sales)× verkauft · VK \(Coins.compact(stat.turnover)) · Ø \(Coins.signed(stat.averageProfit))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            ProfitText(value: stat.profit, font: .subheadline.bold(), compact: true)
        }
    }
}

/// Alle Spieler nach Gewinn (ersetzt "Top-Verkäufe summiert" der Excel).
struct PlayerRankingView: View {
    enum Sort: String, CaseIterable, Identifiable {
        case profit = "Gewinn", sales = "Anzahl", average = "Ø Gewinn", hold = "Haltedauer"
        var id: String { rawValue }
    }

    @EnvironmentObject private var store: PlayerStore
    @State private var period: StatsPeriod
    @State private var sort: Sort = .profit
    @State private var search = ""

    init(period: StatsPeriod) {
        _period = State(initialValue: period)
    }

    private var ranked: [TradingStats.PlayerStat] {
        TradingStats(players: store.players, period: period).players
            .filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) }
            .sorted { a, b in
                switch sort {
                case .profit: return a.profit > b.profit
                case .sales: return a.sales > b.sales
                case .average: return a.averageProfit > b.averageProfit
                case .hold: return a.averageHold < b.averageHold
                }
            }
    }

    var body: some View {
        List {
            Section {
                Picker("Zeitraum", selection: $period) {
                    ForEach(StatsPeriod.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            Section {
                ForEach(Array(ranked.enumerated()), id: \.element.id) { index, stat in
                    VStack(alignment: .leading, spacing: 4) {
                        PlayerStatRow(rank: index + 1, stat: stat)
                        Text("Ø Haltedauer \(stat.averageHold.holdText)" + (stat.openCount > 0 ? " · \(stat.openCount) aktuell im Club" : ""))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .padding(.leading, 32)
                    }
                }
            } footer: {
                Text("Sortiert nach \(sort.rawValue)\(sort == .hold ? " (kürzeste zuerst)" : "").")
            }
        }
        .searchable(text: $search, prompt: "Spieler suchen")
        .navigationTitle("Spieler-Ranking")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Sortierung", selection: $sort) {
                        ForEach(Sort.allCases) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down.circle")
                }
            }
        }
    }
}
