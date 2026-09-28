# Referenz-Implementierung der Chemiestil-Symbolerkennung.
# Muss mit FCTrader/Services/ChemistryIconMatcher.swift übereinstimmen.
import numpy as np
from PIL import Image
from scipy import ndimage

SIZE = 24
MIN_SCORE = 0.68
MIN_MARGIN = 0.08


def area_resize(a, n):
    """Verkleinern per Flächenmittel."""
    h, w = a.shape
    out = np.zeros((n, n))
    for oy in range(n):
        y0, y1 = oy * h / n, (oy + 1) * h / n
        for ox in range(n):
            x0, x1 = ox * w / n, (ox + 1) * w / n
            tot = wsum = 0.0
            for yy in range(int(y0), min(int(np.ceil(y1)), h)):
                wy = min(y1, yy + 1) - max(y0, yy)
                for xx in range(int(x0), min(int(np.ceil(x1)), w)):
                    wx = min(x1, xx + 1) - max(x0, xx)
                    tot += a[yy, xx] * wx * wy
                    wsum += wx * wy
            out[oy, ox] = tot / wsum
    return out


def to_print(gray, keep):
    ys, xs = np.where(keep)
    bg = gray.max()
    sub = np.where(keep, gray, bg)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = sub.shape
    s = max(h, w) + 2
    pad = np.full((s, s), bg)
    pad[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = sub
    small = area_resize(pad, SIZE)
    return small < (small.min() + small.max()) / 2


def extract_box(img, x0, y0, x1, y1, unit):
    """Symbol im Suchbereich (Pixel) ausschneiden → 24x24-Bitmaske."""
    g = np.asarray(img.convert('L'), dtype=float) / 255
    c = g[int(y0):int(y1), int(x0):int(x1)]
    if c.size == 0:
        return None
    dark = c < (c.min() + c.max()) / 2
    lab, n = ndimage.label(dark)  # 4er-Nachbarschaft
    h, w = c.shape
    comps = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if xs.min() == 0 or xs.max() == w - 1:
            continue
        if abs(xs.mean() - w / 2) < 0.3 * w and abs(ys.mean() - h / 2) < 0.3 * h:
            comps.append((len(xs), i, xs.min(), xs.max(), ys.min(), ys.max()))
    if not comps:
        return None
    comps.sort(reverse=True)
    _, _, mx0, mx1, my0, my1 = comps[0]
    tol = 0.2 * unit
    keep = np.zeros_like(dark)
    for _, i, a, b, c_, d in comps:
        if a <= mx1 + tol and b >= mx0 - tol and c_ <= my1 + tol and d >= my0 - tol:
            keep |= lab == i
    return to_print(c, keep)


def detail_box(stat_box):
    """Detailseite: Suchbereich relativ zur Werte-Zeile (TEM SCH PAS …)."""
    x0, y0, x1, y1 = stat_box
    W = x1 - x0
    cx, cy, s = x0 + 0.115 * W, (y0 + y1) / 2 - 0.588 * W, 0.15 * W
    return (cx - s, cy - 0.8 * s, cx + s, cy + 0.8 * s, s)


def list_box(pos_box, spacing):
    """Listen: Bereich direkt unter der Positionsangabe."""
    a0, b0, a1, b1 = pos_box
    cx = (a0 + a1) / 2
    return (cx - 0.8 * spacing, b1 + 1, cx + 0.8 * spacing, b1 + 1.1 * spacing, spacing)


def blur(m):
    a = m.astype(float)
    for _ in range(2):
        p = np.pad(a, 1)
        a = sum(p[dy:dy + SIZE, dx:dx + SIZE] for dy in range(3) for dx in range(3)) / 9
    return a


def ncc(a, b):
    a = a - a.mean()
    b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return (a * b).sum() / d if d else 0


def score(p, q):
    bp = blur(p)
    best = 0
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            qq = np.roll(np.roll(q, dy, 0), dx, 1)
            u = (p | qq).sum()
            j = (p & qq).sum() / u if u else 0
            best = max(best, 0.5 * ncc(bp, blur(qq)) + 0.5 * j)
    return best


def classify(p, templates):
    """→ (Stil, Score) oder (None, Score), wenn unsicher."""
    sc = sorted(((max(score(p, q) for q in qs), n) for n, qs in templates.items()), reverse=True)
    (s1, n1), (s2, _) = sc[0], sc[1]
    return (n1 if s1 >= MIN_SCORE and s1 - s2 >= MIN_MARGIN else None), s1
