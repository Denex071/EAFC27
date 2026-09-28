import SwiftUI

/// Kleiner antippbarer Vorschlag. `.borderless`, damit mehrere Chips in einer Form-Zeile funktionieren.
struct Chip: View {
    let title: String
    var systemImage: String?
    var isSelected = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let systemImage { Image(systemName: systemImage).font(.caption2) }
                Text(title).lineLimit(1)
            }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color(.tertiarySystemFill), in: Capsule())
            .foregroundStyle(isSelected ? Color.white : Color.primary)
        }
        .buttonStyle(.borderless)
    }
}

struct ChipRow<Item: Hashable>: View {
    let items: [Item]
    let title: (Item) -> String
    var isSelected: (Item) -> Bool = { _ in false }
    let action: (Item) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items, id: \.self) { item in
                    Chip(title: title(item), isSelected: isSelected(item)) { action(item) }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

/// Rating-Plakette im Stil der Kartenfarben.
struct RatingBadge: View {
    let rating: Int
    var size: CGFloat = 40

    private var colors: [Color] {
        switch rating {
        case 86...: return [Color(red: 0.36, green: 0.20, blue: 0.62), Color(red: 0.62, green: 0.38, blue: 0.86)]
        case 75...: return [Color(red: 0.78, green: 0.62, blue: 0.22), Color(red: 0.95, green: 0.83, blue: 0.45)]
        case 65...: return [Color(red: 0.55, green: 0.57, blue: 0.60), Color(red: 0.80, green: 0.82, blue: 0.85)]
        default: return [Color(red: 0.55, green: 0.36, blue: 0.22), Color(red: 0.78, green: 0.56, blue: 0.38)]
        }
    }

    var body: some View {
        Text(rating > 0 ? "\(rating)" : "–")
            .font(.system(size: size * 0.42, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 1, y: 1)
            .frame(width: size, height: size)
            .background(
                LinearGradient(colors: colors, startPoint: .bottomLeading, endPoint: .topTrailing),
                in: RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
            )
    }
}

/// Eingabefeld für Münzbeträge mit Live-Vorschau ("12,5k" → 12.500).
struct CoinField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            VStack(alignment: .trailing, spacing: 0) {
                TextField("0", text: $text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .font(.body.monospacedDigit())
                if let value = Coins.parse(text), text != Coins.format(value), text != "\(value)" {
                    Text("= \(Coins.format(value))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Image(systemName: "bitcoinsign.circle.fill")
                .foregroundStyle(.yellow)
        }
    }
}

/// Dropdown aller Chemiestile + Schnellauswahl der zuletzt genutzten.
struct ChemistryPicker: View {
    @Binding var selection: String
    let recent: [String]

    private var options: [String] {
        ChemistryStyles.all.contains(selection) ? ChemistryStyles.all : [selection] + ChemistryStyles.all
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Chemiestil", selection: $selection) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.menu)
            if !recent.isEmpty {
                ChipRow(items: recent, title: { $0 }, isSelected: { $0 == selection }) { selection = $0 }
            }
        }
    }
}

/// Rechenweg: VK − 5 % EA Tax − EK = Gewinn.
struct ProfitBreakdown: View {
    let buyPrice: Int
    let sellPrice: Int?

    var body: some View {
        if let sellPrice, sellPrice > 0 {
            let tax = EATax.tax(for: sellPrice)
            let profit = EATax.profit(buy: buyPrice, sell: sellPrice)
            VStack(spacing: 6) {
                row("Verkaufspreis", Coins.format(sellPrice))
                row("EA Tax (5 %)", "−" + Coins.format(tax), secondary: true)
                row("Einkaufspreis", "−" + Coins.format(buyPrice), secondary: true)
                Divider()
                HStack {
                    Text("Gewinn").font(.headline)
                    Spacer()
                    ProfitText(value: profit, font: .title3.bold())
                }
                if buyPrice > 0 {
                    HStack {
                        Spacer()
                        Text(String(format: "%+.1f %%", Double(profit) / Double(buyPrice) * 100))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        } else {
            HStack {
                Text("Break-even")
                Spacer()
                Text(Coins.format(EATax.breakEven(buy: buyPrice)))
                    .font(.body.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func row(_ title: String, _ value: String, secondary: Bool = false) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).monospacedDigit()
        }
        .font(.subheadline)
        .foregroundStyle(secondary ? .secondary : .primary)
    }
}

struct ProfitText: View {
    let value: Int
    var font: Font = .body.bold()
    var compact = false

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: value >= 0 ? "arrow.up.right" : "arrow.down.right")
                .font(.caption2.bold())
            Text(compact ? (value > 0 ? "+" : "") + Coins.compact(value) : Coins.signed(value))
                .monospacedDigit()
        }
        .font(font)
        .foregroundStyle(value >= 0 ? Color.green : Color.red)
    }
}

/// Kachel für eine Kennzahl im Dashboard.
struct StatTile: View {
    let title: String
    let value: String
    var detail: String?
    var systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let detail {
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct CardSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
