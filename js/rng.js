// Fair randomness for «چرخونه». Every random decision goes through crypto.getRandomValues (CSPRNG),
// never Math.random. randInt uses rejection sampling so there is no modulo bias.
const C = globalThis.crypto;
const buf = new Uint32Array(1);
let source = () => { C.getRandomValues(buf); return buf[0]; }; // uniform 32-bit integer

/** Test hook: replace the 32-bit source (e.g. a seeded PRNG). Returns the previous one. */
export function _setSource(fn) { const p = source; source = fn; return p; }

/** Uniform float in [0, 1) with 53 bits of precision. */
export function random() {
  const hi = source() >>> 5, lo = source() >>> 6; // 27 + 26 bits
  return (hi * 67108864 + lo) / 9007199254740992;
}

/** Uniform integer in [0, n) without modulo bias. */
export function randInt(n) {
  if (!(n >= 1) || !Number.isFinite(n)) throw new RangeError('randInt: n must be >= 1');
  n = Math.floor(n);
  if (n === 1) return 0;
  if (n > 2 ** 32) return Math.floor(random() * n);
  const limit = 2 ** 32 - (2 ** 32 % n);
  let x; do { x = source(); } while (x >= limit);
  return x % n;
}

/** Pick an index with probability proportional to weights[i]. Non-positive / invalid weights never win. */
export function weightedIndex(weights) {
  let total = 0; for (const w of weights) if (w > 0 && Number.isFinite(w)) total += w;
  if (total <= 0) return -1;
  let r = random() * total;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]; if (!(w > 0 && Number.isFinite(w))) continue;
    last = i; if (r < w) return i; r -= w;
  }
  return last; // floating-point edge
}

/** Durstenfeld (Fisher–Yates) shuffle, returns a new array. */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Pearson chi-square statistic for observed counts vs expected probabilities. */
export function chiSquare(counts, probs) {
  const n = counts.reduce((s, c) => s + c, 0); let x = 0;
  counts.forEach((c, i) => { const e = n * probs[i]; if (e > 0) x += (c - e) ** 2 / e; });
  return x;
}
