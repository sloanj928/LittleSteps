// Name matching for the food and word lists. Shared by the server, which
// refuses a duplicate, and the form, which shows close spellings while the
// family types, so both sides agree on what "the same" means.

/**
 * Foods and words are lists: each name appears once, and trying a food
 * again is an edit to it (a new reaction, a note), not a second row. Firsts
 * and notes are moments, so they may repeat.
 */
export function isListKind(kind: string): kind is 'food' | 'word' {
  return kind === 'food' || kind === 'word';
}

/** Lowercase, accents and punctuation gone, single spaces: "Crème-brûlée " → "creme brulee". */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The identity two names share when they mean the same entry. Spacing and a
 * plural "s" don't make a new one: "uh-oh" is "uh oh", "Bananas" is "Banana".
 * Words of three letters or fewer keep their "s" ("yes", "bus").
 */
export function nameKey(s: string): string {
  return normalize(s)
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))
    .join('');
}

/** Edit distance counting a swap of two neighbours as one slip ("bananna", "brocolli"). */
function distance(a: string, b: string): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

// Slips forgiven by length. Two letters must match exactly, or "ba" would
// offer every two-letter word.
const allowedSlips = (n: number) => (n <= 2 ? 0 : n <= 4 ? 1 : n <= 7 ? 2 : 3);

/**
 * How well `candidate` answers what was typed, lower is better, or null for
 * no match. Exact, then starts-with, then a word starting with it, then
 * contains, then a close spelling of the whole name, one of its words, or
 * its opening (so a half-typed misspelling already finds it).
 */
export function matchScore(typed: string, candidate: string): number | null {
  const q = normalize(typed);
  const c = normalize(candidate);
  if (!q) return 0;
  if (nameKey(q) === nameKey(c)) return 0;
  if (c.startsWith(q)) return 1;
  if (c.split(' ').some((w) => w.startsWith(q))) return 2;
  if (c.includes(q)) return 3;
  const targets = [c, ...c.split(' '), c.slice(0, q.length - 1), c.slice(0, q.length), c.slice(0, q.length + 1)];
  const slips = Math.min(...targets.filter(Boolean).map((t) => distance(q, t)));
  return slips <= allowedSlips(q.length) ? 4 + slips : null;
}

/** The candidates that match what was typed, best first; ties keep their given order. */
export function rankMatches<T>(typed: string, candidates: readonly T[], nameOf: (c: T) => string): T[] {
  return candidates
    .map((c, i) => ({ c, i, score: matchScore(typed, nameOf(c)) }))
    .filter((m): m is { c: T; i: number; score: number } => m.score !== null)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((m) => m.c);
}
