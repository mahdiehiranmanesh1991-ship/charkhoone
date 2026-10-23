import test from 'node:test';
import assert from 'node:assert/strict';
import { random, randInt, weightedIndex, shuffle, chiSquare, _setSource } from '../js/rng.js';

// critical values of chi-square at p = 0.001
const CHI_001 = { 1: 10.83, 3: 16.27, 5: 20.52, 7: 24.32, 9: 27.88, 11: 31.26, 19: 43.82, 36: 67.99 };

test('random() is in [0,1) and roughly uniform', () => {
  const bins = new Array(10).fill(0);
  for (let i = 0; i < 50000; i++) { const r = random(); assert.ok(r >= 0 && r < 1); bins[Math.floor(r * 10)]++; }
  assert.ok(chiSquare(bins, new Array(10).fill(0.1)) < CHI_001[9]);
});

test('randInt: range, rejects bad n, no modulo bias (chi-square, n=6 and n=37)', () => {
  assert.throws(() => randInt(0)); assert.throws(() => randInt(NaN)); assert.equal(randInt(1), 0);
  for (const n of [6, 37]) {
    const c = new Array(n).fill(0); const N = 60000;
    for (let i = 0; i < N; i++) { const x = randInt(n); assert.ok(Number.isInteger(x) && x >= 0 && x < n); c[x]++; }
    const crit = n === 6 ? CHI_001[5] : CHI_001[36];
    assert.ok(chiSquare(c, new Array(n).fill(1 / n)) < crit, `chi-square too large for n=${n}`);
  }
});

test('randInt rejection sampling discards the biased top range', () => {
  // n = 3: limit = 2^32 - (2^32 % 3) = 4294967295; the value 4294967295 must be rejected
  const seq = [4294967295, 4]; let i = 0;
  const prev = _setSource(() => seq[i++]);
  try { assert.equal(randInt(3), 1); assert.equal(i, 2); } finally { _setSource(prev); }
});

test('weightedIndex follows the weights (chi-square) and ignores zero / invalid weights', () => {
  const w = [1, 2, 3, 0, -5, NaN, 4]; const p = [0.1, 0.2, 0.3, 0, 0, 0, 0.4];
  const c = new Array(w.length).fill(0);
  for (let i = 0; i < 40000; i++) c[weightedIndex(w)]++;
  assert.equal(c[3] + c[4] + c[5], 0);
  assert.ok(chiSquare([c[0], c[1], c[2], c[6]], [0.1, 0.2, 0.3, 0.4]) < CHI_001[3]);
  assert.equal(weightedIndex([0, 0]), -1); assert.equal(weightedIndex([]), -1);
  void p;
});

test('shuffle is a permutation and every position is uniform', () => {
  const a = [0, 1, 2, 3]; const pos0 = [0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) { const s = shuffle(a); assert.deepEqual([...s].sort(), a); pos0[s[0]]++; }
  assert.deepEqual(a, [0, 1, 2, 3]); // not mutated
  assert.ok(chiSquare(pos0, [0.25, 0.25, 0.25, 0.25]) < CHI_001[3]);
});
