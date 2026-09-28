import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject private var store: PlayerStore
    @State private var period: StatsPeriod = .all
    @State private var ownerFilter: String?
    @State private var selling: PlayerCard?
    @State private var chartSelection: Date?

    private var currentStats: TradingStats {
        TradingStats(players: store.players, period: period, owner: ownerFilter)
    }

    var body: some View {
        let stats = currentStats
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    Picker("Zeitraum", selection: $period) {
                        ForEach(StatsPeriod.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    if store.owners.count > 1 {
                        ChipRow(items: [nil] + store.owners.map(Optional.some), title: { $0 ?? "Gemeinsam" }, isSelected: { $0 == ownerFilter }) {
                            ownerFilter = $0
                        }
                    }

                    hero(stats)
                    tiles(stats)
                    if stats.profitCurve.count >= 2 { chart(stats) }
                    flips(stats)
                    if !stats.longestHeld.isEmpty { longestHeld(stats) }
                    if store.owners.count > 1 && ownerFilter == nil { perOwner(stats) }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Übersicht")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { AddCardButton() }
            }
            .overlay {
                if store.isLoading { ProgressView() }
            }
            .sheet(item: $selling) { SellPlayerView(card: $0) }
        }
    }

    // MARK: - Bausteine

    private func hero(_ stats: TradingStats) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Realisierter Gewinn · \(period.rawValue)")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
            Text(Coins.signed(stats.realizedProfit))
                .font(.system(size: 40, weight: .heavy, design: .rounded).monospacedDigit())
                .foregroundStyle(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text("aus \(stats.sold.count) Verkäufen · \(stats.open.count) Karten offen")
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
            StatTile(title: "Unverkaufte Karten", value: "\(stats.open.count)",
                     detail: "Break-even gesamt \(Coins.compact(stats.breakEvenTotal))", systemImage: "tray.full")
            StatTile(title: "Gebundenes Kapital", value: Coins.compact(stats.capitalBound),
                     detail: "Summe EK offener Karten", systemImage: "lock")
            StatTile(title: "Ø Gewinn / Trade", value: Coins.signed(stats.averageProfit),
                     detail: "\(stats.sold.count) Verkäufe", systemImage: "divide")
            StatTile(title: "Rendite (ROI)", value: String(format: "%+.1f %%", stats.roi * 100),
                     detail: "Gewinn / eingesetztes EK", systemImage: "percent")
            StatTile(title: "Trefferquote", value: String(format: "%.0f %%", stats.winRate * 100),
                     detail: "Trades mit Gewinn", systemImage: "target")
            StatTile(title: "Ø Haltedauer", value: stats.averageHold.holdText,
                     detail: "Kauf bis Verkauf", systemImage: "hourglass")
            StatTile(title: "Umsatz", value: Coins.compact(stats.turnover),
                     detail: "Summe Verkaufspreise", systemImage: "arrow.left.arrow.right")
            StatTile(title: "EA Tax bezahlt", value: Coins.compact(stats.taxPaid),
                     detail: "5 % auf Verkäufe", systemImage: "building.columns")
        }
    }

    private func chart(_ stats: TradingStats) -> some View {
        CardSection(title: "Gewinnverlauf") {
            let selected = chartSelection.flatMap { date in
                stats.profitCurve.min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }
            }
            Chart {
                ForEach(stats.profitCurve) { point in
                    AreaMark(x: .value("Datum", point.date), y: .value("Gewinn", point.cumulative))
                        .foregroundStyle(Color.accentColor.opacity(0.12))
                        .interpolationMethod(.monotone)
                    LineMark(x: .value("Datum", point.date), y: .value("Gewinn", point.cumulative))
                        .foregroundStyle(Color.accentColor)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.monotone)
                }
                RuleMark(y: .value("Null", 0))
                    .foregroundStyle(Color.secondary.opacity(0.4))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
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
    }

    @ViewBuilder
    private func flips(_ stats: TradingStats) -> some View {
        if stats.bestFlip != nil || stats.worstFlip != nil {
            CardSection(title: "Top & Flop") {
                if let best = stats.bestFlip {
                    flipRow(best, label: "Bester Flip", systemImage: "trophy.fill", color: .yellow)
                }
                if let worst = stats.worstFlip {
                    Divider()
                    flipRow(worst, label: "Schwächster Flip", systemImage: "arrow.down.circle.fill", color: .secondary)
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
                        Text("seit \(card.holdDuration.holdText) · BE \(Coins.format(card.breakEvenPrice))")
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

    private func perOwner(_ stats: TradingStats) -> some View {
        CardSection(title: "Wer liegt vorne?") {
            ForEach(stats.perOwner.sorted { $0.profit > $1.profit }) { summary in
                HStack {
                    Text(summary.owner).font(.subheadline.bold())
                    Text("\(summary.sold) verkauft · \(summary.open) offen")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    ProfitText(value: summary.profit)
                }
            }
        }
    }
}
