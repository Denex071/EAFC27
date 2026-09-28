import Foundation
import CoreGraphics

/// 24×24-Bit-Abdruck eines Chemiestil-Symbols.
struct IconPrint: Hashable {
    static let size = 24
    /// true = dunkles Pixel (Symbol), zeilenweise von oben links.
    let bits: [Bool]

    init(bits: [Bool]) {
        precondition(bits.count == Self.size * Self.size)
        self.bits = bits
    }

    init?(hex: String) {
        let chars = Array(hex)
        guard chars.count == Self.size * Self.size / 4 else { return nil }
        var bits: [Bool] = []
        bits.reserveCapacity(Self.size * Self.size)
        for char in chars {
            guard let nibble = char.hexDigitValue else { return nil }
            for shift in stride(from: 3, through: 0, by: -1) {
                bits.append((nibble >> shift) & 1 == 1)
            }
        }
        self.bits = bits
    }

    var hex: String {
        stride(from: 0, to: bits.count, by: 4).map { i in
            let nibble = (0..<4).reduce(0) { $0 << 1 | (bits[i + $1] ? 1 : 0) }
            return String(nibble, radix: 16)
        }.joined()
    }
}

/// Erkennt den Chemiestil anhand des Symbols auf der Karte.
///
/// Verfahren (identisch mit dem Python-Referenzskript unter Tools/chem_icons):
/// 1. Suchbereich um die erwartete Symbolposition ausschneiden (Graustufen).
/// 2. Dunkle Pixel (unter Mittelwert aus Min/Max) → zusammenhängende Flächen.
///    Flächen am linken/rechten Rand und außerhalb der Mitte werden verworfen,
///    die größte Fläche plus direkt angrenzende Teile ergeben das Symbol.
/// 3. Quadratisch auffüllen, per Flächenmittel auf 24×24 verkleinern, erneut schwellen.
/// 4. Vergleich mit allen Vorlagen: 50 % Überlappung (IoU) + 50 % Korrelation der
///    weichgezeichneten Bilder, jeweils mit ±1 Pixel Verschiebung.
enum ChemistryIconMatcher {
    /// Unterhalb dieser Werte gilt die Erkennung als unsicher → kein Vorschlag.
    static let minimumScore = 0.68
    static let minimumMargin = 0.08

    struct Match {
        let style: String
        let score: Double
        let margin: Double
    }

    static let bundled: [String: [IconPrint]] = ChemistryIconTemplates.all.mapValues { $0.compactMap(IconPrint.init(hex:)) }

    // MARK: - Symbol finden

    /// Detailseite: Position relativ zur Werte-Zeile ("TEM SCH PAS …"), Rechteck in Pixeln.
    static func detailSearchBox(statsRow: CGRect) -> (CGRect, Double) {
        let width = statsRow.width
        let cx = statsRow.minX + 0.115 * width
        let cy = statsRow.midY - 0.588 * width
        let s = 0.15 * width
        return (CGRect(x: cx - s, y: cy - 0.8 * s, width: 2 * s, height: 1.6 * s), s)
    }

    /// Listen (Kandidaten-/Transferliste): direkt unter der Positionsangabe.
    static func listSearchBox(position: CGRect, spacing: Double) -> (CGRect, Double) {
        let rect = CGRect(x: position.midX - 0.8 * spacing, y: position.maxY + 1,
                          width: 1.6 * spacing, height: 1.1 * spacing - 1)
        return (rect, spacing)
    }

    /// Schneidet das Symbol aus (Rechteck in Pixeln, Ursprung oben links).
    static func extract(from image: CGImage, box: CGRect, unit: Double) -> IconPrint? {
        let rect = CGRect(x: floor(box.minX), y: floor(box.minY), width: floor(box.maxX) - floor(box.minX),
                          height: floor(box.maxY) - floor(box.minY))
            .intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height))
        let w = Int(rect.width), h = Int(rect.height)
        guard w > 4, h > 4, let cropped = image.cropping(to: rect), let gray = grayscale(cropped, width: w, height: h) else {
            return nil
        }

        let minV = gray.min() ?? 0, maxV = gray.max() ?? 1
        let threshold = (minV + maxV) / 2
        let dark = gray.map { $0 < threshold }

        // Zusammenhängende Flächen (4er-Nachbarschaft)
        var label = [Int](repeating: 0, count: w * h)
        struct Component { var count = 0; var minX = Int.max; var maxX = 0; var minY = Int.max; var maxY = 0; var sumX = 0; var sumY = 0 }
        var components: [Component] = [Component()] // Index 0 = kein Label
        for start in 0..<(w * h) where dark[start] && label[start] == 0 {
            let id = components.count
            var comp = Component()
            var stack = [start]
            label[start] = id
            while let index = stack.popLast() {
                let x = index % w, y = index / w
                comp.count += 1; comp.sumX += x; comp.sumY += y
                comp.minX = min(comp.minX, x); comp.maxX = max(comp.maxX, x)
                comp.minY = min(comp.minY, y); comp.maxY = max(comp.maxY, y)
                for (nx, ny) in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] where nx >= 0 && nx < w && ny >= 0 && ny < h {
                    let n = ny * w + nx
                    if dark[n] && label[n] == 0 { label[n] = id; stack.append(n) }
                }
            }
            components.append(comp)
        }

        let candidates = components.indices.dropFirst().filter { i in
            let c = components[i]
            guard c.minX > 0, c.maxX < w - 1 else { return false }
            let mx = Double(c.sumX) / Double(c.count), my = Double(c.sumY) / Double(c.count)
            return abs(mx - Double(w) / 2) < 0.3 * Double(w) && abs(my - Double(h) / 2) < 0.3 * Double(h)
        }
        guard let main = candidates.max(by: { components[$0].count < components[$1].count }) else { return nil }
        let m = components[main]
        let tol = 0.2 * unit
        let keepIDs = Set(candidates.filter { i in
            let c = components[i]
            return Double(c.minX) <= Double(m.maxX) + tol && Double(c.maxX) >= Double(m.minX) - tol
                && Double(c.minY) <= Double(m.maxY) + tol && Double(c.maxY) >= Double(m.minY) - tol
        })

        // Maske anwenden, auf Symbol zuschneiden, quadratisch auffüllen
        var x0 = Int.max, x1 = 0, y0 = Int.max, y1 = 0
        for i in 0..<(w * h) where keepIDs.contains(label[i]) {
            x0 = min(x0, i % w); x1 = max(x1, i % w); y0 = min(y0, i / w); y1 = max(y1, i / w)
        }
        let subW = x1 - x0 + 1, subH = y1 - y0 + 1
        let side = max(subW, subH) + 2
        var square = [Double](repeating: maxV, count: side * side)
        let ox = (side - subW) / 2, oy = (side - subH) / 2
        for y in 0..<subH {
            for x in 0..<subW {
                let i = (y0 + y) * w + (x0 + x)
                if keepIDs.contains(label[i]) { square[(oy + y) * side + ox + x] = gray[i] }
            }
        }

        let small = areaResize(square, side: side, to: IconPrint.size)
        let sMin = small.min() ?? 0, sMax = small.max() ?? 1
        let t = (sMin + sMax) / 2
        return IconPrint(bits: small.map { $0 < t })
    }

    // MARK: - Vergleich

    static func match(_ print: IconPrint, learned: [String: [IconPrint]] = [:]) -> Match? {
        var best: [(String, Double)] = []
        let styles = Set(bundled.keys).union(learned.keys)
        for style in styles {
            let candidates = (bundled[style] ?? []) + (learned[style] ?? [])
            let score = candidates.map { similarity(print, $0) }.max() ?? 0
            best.append((style, score))
        }
        best.sort { $0.1 > $1.1 }
        guard let first = best.first else { return nil }
        let second = best.dropFirst().first?.1 ?? 0
        guard first.1 >= minimumScore, first.1 - second >= minimumMargin else { return nil }
        return Match(style: first.0, score: first.1, margin: first.1 - second)
    }

    static func similarity(_ a: IconPrint, _ b: IconPrint) -> Double {
        let n = IconPrint.size
        let blurredA = blur(a.bits.map { $0 ? 1.0 : 0.0 })
        var best = 0.0
        for dy in -1...1 {
            for dx in -1...1 {
                let shifted = roll(b.bits, dy: dy, dx: dx, n: n)
                var inter = 0, union = 0
                for i in 0..<(n * n) {
                    if a.bits[i] && shifted[i] { inter += 1 }
                    if a.bits[i] || shifted[i] { union += 1 }
                }
                let iou = union == 0 ? 0 : Double(inter) / Double(union)
                let corr = ncc(blurredA, blur(shifted.map { $0 ? 1.0 : 0.0 }))
                best = max(best, 0.5 * corr + 0.5 * iou)
            }
        }
        return best
    }

    // MARK: - Hilfsfunktionen

    /// Verschiebung mit Umlauf (wie numpy.roll).
    private static func roll(_ bits: [Bool], dy: Int, dx: Int, n: Int) -> [Bool] {
        var out = [Bool](repeating: false, count: n * n)
        for y in 0..<n {
            for x in 0..<n {
                out[((y + dy + n) % n) * n + (x + dx + n) % n] = bits[y * n + x]
            }
        }
        return out
    }

    /// 3×3-Mittelwert, zweimal, Rand mit 0 aufgefüllt.
    private static func blur(_ values: [Double]) -> [Double] {
        let n = IconPrint.size
        var a = values
        for _ in 0..<2 {
            var out = [Double](repeating: 0, count: n * n)
            for y in 0..<n {
                for x in 0..<n {
                    var sum = 0.0
                    for ky in -1...1 {
                        for kx in -1...1 {
                            let yy = y + ky, xx = x + kx
                            if yy >= 0 && yy < n && xx >= 0 && xx < n { sum += a[yy * n + xx] }
                        }
                    }
                    out[y * n + x] = sum / 9
                }
            }
            a = out
        }
        return a
    }

    private static func ncc(_ a: [Double], _ b: [Double]) -> Double {
        let ma = a.reduce(0, +) / Double(a.count), mb = b.reduce(0, +) / Double(b.count)
        var num = 0.0, da = 0.0, db = 0.0
        for i in a.indices {
            let x = a[i] - ma, y = b[i] - mb
            num += x * y; da += x * x; db += y * y
        }
        let d = (da * db).squareRoot()
        return d == 0 ? 0 : num / d
    }

    /// Verkleinern per Flächenmittel.
    private static func areaResize(_ a: [Double], side: Int, to n: Int) -> [Double] {
        var out = [Double](repeating: 0, count: n * n)
        let scale = Double(side) / Double(n)
        for oy in 0..<n {
            let y0 = Double(oy) * scale, y1 = Double(oy + 1) * scale
            for ox in 0..<n {
                let x0 = Double(ox) * scale, x1 = Double(ox + 1) * scale
                var total = 0.0, weight = 0.0
                for yy in Int(y0)..<min(Int(y1.rounded(.up)), side) {
                    let wy = min(y1, Double(yy + 1)) - max(y0, Double(yy))
                    for xx in Int(x0)..<min(Int(x1.rounded(.up)), side) {
                        let wx = min(x1, Double(xx + 1)) - max(x0, Double(xx))
                        total += a[yy * side + xx] * wx * wy
                        weight += wx * wy
                    }
                }
                out[oy * n + ox] = weight > 0 ? total / weight : 1
            }
        }
        return out
    }

    /// Graustufen 0…1, zeilenweise von oben.
    private static func grayscale(_ image: CGImage, width: Int, height: Int) -> [Double]? {
        var pixels = [UInt8](repeating: 0, count: width * height)
        let ok = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(
                data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
            ) else { return false }
            context.interpolationQuality = .none
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        return ok ? pixels.map { Double($0) / 255 } : nil
    }
}
