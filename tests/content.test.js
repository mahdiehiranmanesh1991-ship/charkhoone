import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, buildTemplate, diceWays, FA_LETTERS } from '../js/templates.js';
import { CHALLENGES, challengeTotal } from '../js/challenges.js';
import { makeWheel, activeSegments, spans, MAX_SEGMENTS } from '../js/wheel.js';
import { THEMES, THEME_IDS, POINTERS } from '../js/themes.js';
import { newGame, onSpin, answer, buyPointer, checkAch, earned } from '../js/game.js';

test('every template builds a valid wheel', () => {
  for (const t of TEMPLATES) {
    const w = makeWheel(buildTemplate(t.id)); assert.ok(activeSegments(w).length >= 2, t.id);
    assert.ok(!w.theme || THEMES[w.theme], t.id);
  }
});

test('generators: percent, number range, letters, dice sums', () => {
  const p = makeWheel(buildTemplate('percent', { step: 1 })); assert.equal(p.segments.length, 100); assert.equal(p.segments[0].text, '1%'); assert.equal(p.segments[99].text, '100%');
  assert.equal(makeWheel(buildTemplate('percent', { step: 10 })).segments.length, 10);
  assert.deepEqual(buildTemplate('number', { min: 5, max: 1, step: 2 }).segments.map((s) => s.text), ['1', '3', '5']);
  assert.deepEqual(buildTemplate('number', { min: 0, max: 1, step: 0.25 }).segments.map((s) => s.text), ['0', '0.25', '0.5', '0.75', '1']);
  assert.equal(buildTemplate('number', { min: 1, max: 1e9, step: 1 }).segments.length, MAX_SEGMENTS);
  assert.equal(buildTemplate('percent', { step: 'abc' }).segments.length, 100);
  assert.equal(FA_LETTERS.length, 32); assert.equal(buildTemplate('letters-fa').segments.length, 32);
  assert.equal(diceWays(2, 7), 6); assert.equal(diceWays(3, 10), 27); assert.equal(diceWays(2, 1), 0);
  const d = buildTemplate('dice-sum', { n: 2 }); assert.equal(d.segments.length, 11);
  assert.equal(d.segments.reduce((s, x) => s + x.weight, 0), 36);
  const sp = spans(activeSegments(makeWheel(d))); assert.ok(Math.abs(sp[5].size / (2 * Math.PI) - 6 / 36) < 1e-12);
});

test('themes and pointers are complete', () => {
  for (const id of ['neon', 'candy', 'gold', 'pastel', 'galaxy', 'kashi', 'cat']) assert.ok(THEME_IDS.includes(id), id);
  for (const id of THEME_IDS) { const t = THEMES[id]; assert.ok(t.name && t.palette.length >= 4 && t.rim.length >= 2 && t.led && t.accent, id); }
  assert.equal(POINTERS.classic.price, 0);
});

test('challenges: every question has its answer among options and a source for law', () => {
  for (const [id, c] of Object.entries(CHALLENGES)) {
    assert.ok(c.cats.length >= 4, id);
    for (const cat of c.cats) for (const it of cat.items) {
      assert.ok(it.q && it.a && Array.isArray(it.w) && it.w.length >= 2, JSON.stringify(it));
      assert.ok(!it.w.includes(it.a), 'answer duplicated in wrong options: ' + it.q);
      assert.equal(new Set(it.w).size, it.w.length);
      if (id === 'law') assert.ok(it.src, 'law item needs a source: ' + it.q);
    }
    assert.equal(challengeTotal(id), c.cats.reduce((s, x) => s + x.items.length, 0) * c.reward);
  }
});

test('game: daily streak in Tehran days, bonus, achievements once', () => {
  const g = newGame(); const d0 = Date.UTC(2026, 9, 20, 8);
  let ev = onSpin(g, d0); assert.equal(g.streak, 1); assert.ok(ev.some((e) => e.type === 'daily')); assert.ok(g.ach.first);
  const c1 = g.coins; onSpin(g, d0 + 3600e3); assert.equal(g.coins, c1, 'no second daily bonus the same day');
  onSpin(g, d0 + 864e5); onSpin(g, d0 + 2 * 864e5); assert.equal(g.streak, 3); assert.ok(g.ach.st3);
  onSpin(g, d0 + 5 * 864e5); assert.equal(g.streak, 1); assert.equal(g.best, 3);
  const before = g.coins; assert.equal(checkAch(g).length, 0); assert.equal(g.coins, before);
  onSpin(g, Date.UTC(2026, 9, 26, 22)); assert.equal(g.night, true); // 01:30 Tehran
});

test('game: answers pay once, completion flag, pointer shop', () => {
  const g = newGame(); const total = 20;
  assert.equal(answer(g, 'law', 'a:0', false, 10, total).coins, 0);
  assert.equal(answer(g, 'law', 'a:0', true, 10, total).coins, 10);
  assert.equal(answer(g, 'law', 'a:0', true, 10, total).coins, 0);
  answer(g, 'law', 'a:1', true, 10, total); assert.equal(g.done.law, true); assert.equal(earned(g, 'law', 10), 20);
  const id = Object.keys(POINTERS).find((k) => POINTERS[k].price > 0);
  g.coins = 0; assert.equal(buyPointer(g, id), false);
  g.coins = POINTERS[id].price; assert.equal(buyPointer(g, id), true); assert.equal(g.coins, 0); assert.equal(g.pointer, id);
  assert.equal(buyPointer(g, 'classic'), true); assert.throws(() => buyPointer(g, 'nope'));
});
