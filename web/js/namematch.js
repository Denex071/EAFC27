// Unscharf gelesene Spielernamen einem bekannten Namen zuordnen („Mossl“ → „Messi“, „Isoak“ → „Isak“).
// Abstand mit günstigeren Kosten für typische Verwechslungen der Texterkennung (l/i/t, o/a/e/c, rn/m …).
import { nameKey } from "./parser.js";

const GROUPS = ["iltj1", "oaecdq0", "nmrh", "uvwy", "bhk6", "sz5", "gq9", "fte", "ijl"];
const near = (a, b) => GROUPS.some(g => g.includes(a) && g.includes(b));

function cost(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit + 1) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i * 0.8);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i * 0.8]; let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : near(a[i - 1], b[j - 1]) ? 0.5 : 1;
      cur[j] = Math.min(prev[j] + 0.8, cur[j - 1] + 0.8, prev[j - 1] + sub);
      if (cur[j] < best) best = cur[j];
    }
    if (best > limit + 1) return 99;
    prev = cur;
  }
  return prev[b.length];
}

/// Bester Treffer aus known (eigene Spieler, Vorrang) und dict, sonst null
export function matchPlayerName(text, known = [], dict = []) {
  const key = nameKey(text); if (key.length < 3) return null;
  const words = String(text).trim().split(/\s+/).map(nameKey).filter(w => w.length >= 3);
  // ganzer Text, einzelne Wörter, und Anfänge (Reste der Position wie „lcoM“ aus „(CDM)“ am Ende)
  const prefixes = []; for (let n = key.length - 1; n >= Math.max(4, key.length - 5); n--) prefixes.push(key.slice(0, n));
  const tries = [...new Set([key, ...words, words.slice(-2).join(""), ...prefixes].filter(Boolean))];
  let best = null, bestScore = Infinity;
  const seen = new Set();
  for (const [list, bonus] of [[known, 0.3], [dict, 0]]) for (const n of list) {
    const k = nameKey(n); if (!k || seen.has(k)) continue; seen.add(k);
    const limit = k.length <= 4 ? 1 : k.length <= 7 ? 2 : 3;
    for (const t of tries) {
      const c = cost(t, k, limit);
      if (c > limit || c / k.length > 0.32) continue; // nicht zu großzügig: „Reus“ ist nicht „Neves“
      // Teil-Treffer (nur ein Wort des gelesenen Textes) etwas schlechter bewerten als den ganzen Namen
      const score = c / k.length + (key.length - t.length) / key.length * 0.5 - bonus * 0.1;
      if (score < bestScore) { bestScore = score; best = n; }
    }
  }
  return best;
}
