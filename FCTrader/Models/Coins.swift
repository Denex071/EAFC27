import Foundation

/// Formatieren und Parsen von Münzbeträgen.
enum Coins {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "de_DE")
        f.maximumFractionDigits = 0
        return f
    }()

    /// 12500 → "12.500"
    static func format(_ value: Int) -> String {
        formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// 12500 → "+12.500", −300 → "−300"
    static func signed(_ value: Int) -> String {
        if value > 0 { return "+" + format(value) }
        if value < 0 { return "−" + format(-value) }
        return "0"
    }

    /// 12500 → "12,5k", 1250000 → "1,25M"
    static func compact(_ value: Int) -> String {
        let absValue = abs(value)
        let sign = value < 0 ? "−" : ""
        func trimmed(_ d: Double) -> String {
            let f = NumberFormatter()
            f.locale = Locale(identifier: "de_DE")
            f.maximumFractionDigits = d < 10 ? 2 : 1
            f.minimumFractionDigits = 0
            return f.string(from: NSNumber(value: d)) ?? "\(d)"
        }
        switch absValue {
        case 1_000_000...: return sign + trimmed(Double(absValue) / 1_000_000) + "M"
        case 10_000...: return sign + trimmed(Double(absValue) / 1_000) + "k"
        default: return sign + format(absValue)
        }
    }

    /// Versteht "12500", "12.500", "12,500", "12.5k", "12,5k", "1.2m", "15 250".
    static func parse(_ text: String) -> Int? {
        var s = text.lowercased()
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
        guard !s.isEmpty else { return nil }

        var multiplier = 1.0
        if s.hasSuffix("k") { multiplier = 1_000; s.removeLast() }
        else if s.hasSuffix("m") { multiplier = 1_000_000; s.removeLast() }

        if multiplier > 1 {
            s = s.replacingOccurrences(of: ",", with: ".")
            guard let d = Double(s) else { return nil }
            return Int((d * multiplier).rounded())
        }

        let digits = s.filter(\.isNumber)
        guard !digits.isEmpty, digits.count == s.filter({ $0 != "." && $0 != "," }).count else { return nil }
        return Int(digits)
    }
}

extension TimeInterval {
    /// 3,5 Tage → "3 T", 5 Std → "5 Std", 20 Min → "20 Min"
    var holdText: String {
        let minutes = Int(self / 60)
        if minutes < 60 { return "\(max(minutes, 0)) Min" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours) Std" }
        return "\(hours / 24) T"
    }
}
