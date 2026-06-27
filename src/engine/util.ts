// Small pure helpers used by the detector and agent.
// Kept dependency-free so the whole engine runs in the browser and under Vitest.

const STOPWORDS = new Set([
  "the", "a", "an", "to", "for", "of", "your", "you", "press", "our", "please",
  "and", "or", "with", "on", "call", "calling", "about", "i", "we", "is", "are",
  "this", "that", "if", "at", "in", "by", "my", "me", "have", "has", "it", "be",
]);

/** Lowercase, strip punctuation, drop stopwords. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Count of distinct shared tokens between two token lists. */
export function overlap(a: string[], b: string[]): number {
  const bset = new Set(b);
  const seen = new Set<string>();
  let n = 0;
  for (const w of a) {
    if (bset.has(w) && !seen.has(w)) {
      n += 1;
      seen.add(w);
    }
  }
  return n;
}

export function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

/** Format a 0..1 value as a percentage string. */
export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
