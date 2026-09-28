"""Erzeugt FCTrader/Models/ChemistryIconTemplates.swift aus Item-Details-Screenshots.

Aufruf:
    pip install numpy pillow scipy
    python3 Tools/chem_icons/build_templates.py <ordner>

Im Ordner liegen unbearbeitete iPhone-Screenshots der Seite „Item-Details“,
benannt nach dem Chemiestil, z. B. Anchor.png, Anchor_2.png, Glove.png.
Die Position der Werte-Zeile ist für 1320 px Bildbreite hinterlegt und wird skaliert.
"""
import os
import re
import sys

from PIL import Image

import iconlib as L

STYLES = ["Basic", "Sniper", "Finisher", "Deadeye", "Marksman", "Hawk", "Artist", "Architect",
          "Powerhouse", "Maestro", "Engine", "Sentinel", "Guardian", "Gladiator", "Backbone", "Anchor",
          "Hunter", "Catalyst", "Shadow", "Wall", "Shield", "Cat", "Glove"]
STATS_ROW_1320 = (504, 852, 816, 881)  # Werte-Zeile "TEM SCH PAS …" bei 1320 px Breite
SCALES = (1.0, 0.5, 0.4, 0.33)


def main(folder):
    templates = {}
    for file in sorted(os.listdir(folder)):
        style = re.sub(r"(_\d+)?\.png$", "", file, flags=re.I)
        if style not in STYLES:
            continue
        img = Image.open(os.path.join(folder, file))
        base = img.width / 1320
        for f in SCALES:
            im = img if f == 1 else img.resize((int(img.width * f), int(img.height * f)), Image.LANCZOS)
            box = L.detail_box(tuple(v * base * f for v in STATS_ROW_1320))
            p = L.extract_box(im, *box)
            if p is not None and not any((p == e).all() for e in templates.get(style, [])):
                templates.setdefault(style, []).append(p)

    missing = [s for s in STYLES if s not in templates]
    if missing:
        print("Fehlende Stile:", ", ".join(missing))

    lines = []
    for style in STYLES:
        if style not in templates:
            continue
        hexes = [format(int("".join("1" if v else "0" for v in p.flatten()), 2), "0144x") for p in templates[style]]
        lines.append(f'        "{style}": [\n' + "".join(f'            "{h}",\n' for h in hexes) + "        ],")

    out = os.path.join(os.path.dirname(__file__), "../../FCTrader/Models/ChemistryIconTemplates.swift")
    with open(out, "w") as fh:
        fh.write('''import Foundation

/// Vorlagen der Chemiestil-Symbole, erzeugt aus Screenshots der Item-Details (EA FC 27, deutsche Oberfläche).
/// Je Stil mehrere Größen (100 %, 50 %, 40 %, 33 %), jeweils 24×24 Bit als Hex (Zeilen von oben, MSB zuerst).
/// Neu erzeugen: Tools/chem_icons/build_templates.py
enum ChemistryIconTemplates {
    static let all: [String: [String]] = [
''' + "\n".join(lines) + '''
    ]
}
''')
    print(sum(len(v) for v in templates.values()), "Vorlagen geschrieben →", os.path.normpath(out))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
