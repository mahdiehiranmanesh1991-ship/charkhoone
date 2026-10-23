import test from 'node:test';
import assert from 'node:assert/strict';
import { TAU, mod, makeWheel, makeSegment, activeSegments, spans, pointerAngle, angleToIndex, pickWinner, planSpin, angleAt, velocityAt,
  gestureVelocity, recordResult, resetElimination, historyStats, duplicateWheel, parseItems, sanitizeOpts, MAX_SEGMENTS } from '../js/wheel.js';
import { chiSquare } from '../js/rng.js';

const W = (texts, extra = {}) => makeWheel({ segments: texts.map((t) => (typeof t === 'object' ? t : { text: t })), ...extra });

test('spans are proportional to weight and tile the circle', () => {
  const sp = spans([{ weight: 1 }, { weight: 3 }]);
  assert.equal(sp[0].start, 0); assert.ok(Math.abs(sp[1].end - TAU) < 1e-12);
  assert.ok(Math.abs(sp[1].size / sp[0].size - 3) < 1e-12);
});

test('angle → segment mapping with the pointer at the top', () => {
  const sp = spans([{ weight: 1 }, { weight: 1 }, { weight: 1 }, { weight: 1 }]); // 90° each
  assert.equal(angleToIndex(sp, 0), 0); // pointer at wheel-angle 0 = start of segment 0
  assert.equal(angleToIndex(sp, -0.1), 0);
  assert.equal(angleToIndex(sp, -Math.PI / 2 - 0.01), 1); // wheel turned anticlockwise → later segments
  assert.equal(angleToIndex(sp, 0.01), 3); // turned clockwise a bit → last segment under the pointer
  assert.equal(angleToIndex(sp, 7 * TAU - Math.PI / 4), 0);
  for (let k = 0; k < 4; k++) assert.equal(angleToIndex(sp, -sp[k].mid), k);
  assert.ok(Math.abs(pointerAngle(TAU + 1) - (TAU - 1)) < 1e-9);
});

test('planSpin always lands inside the chosen segment (forward, backward, flick, reduced)', () => {
  const w = W(['a', { text: 'b', weight: 5 }, 'c', 'd', { text: 'e', weight: 0.5 }]); const sp = spans(activeSegments(w));
  for (let i = 0; i < 2000; i++) {
    const winner = i % sp.length; const rotation = (Math.random() - 0.5) * 100;
    const v0 = [null, 5, 18, 40, -12, -30][i % 6]; const reduced = i % 7 === 0;
    const plan = planSpin({ sp, rotation, winner, v0, duration: 4, reduced });
    assert.equal(angleToIndex(sp, plan.to), winner);
    assert.equal(angleAt(plan, plan.T), plan.to); assert.equal(angleAt(plan, 0), rotation);
    assert.ok(Math.abs(plan.D) >= TAU, 'at least one full turn');
    if (v0 != null && !reduced) assert.equal(Math.sign(plan.D), Math.sign(v0), 'spins in the flick direction');
    assert.ok(Math.abs(velocityAt(plan, plan.T)) < 1e-9, 'comes to rest');
    // stop point keeps away from the segment edges (no ambiguous result)
    const a = mod(-plan.to) - sp[winner].start; assert.ok(a > 0.13 * sp[winner].size && a < 0.87 * sp[winner].size);
  }
});

test('stronger flick → more turns, monotone deceleration', () => {
  const sp = spans(activeSegments(W(['a', 'b', 'c'])));
  const soft = planSpin({ sp, winner: 0, v0: 6, duration: 5, rnd: () => 0.5 });
  const hard = planSpin({ sp, winner: 0, v0: 40, duration: 5, rnd: () => 0.5 });
  assert.ok(hard.D > soft.D);
  let prev = Infinity; for (let t = 0; t <= hard.T; t += hard.T / 50) { const v = velocityAt(hard, t); assert.ok(v <= prev + 1e-9); prev = v; }
});

test('end-to-end fairness: pick → plan → read back from the angle (chi-square, weighted)', () => {
  const w = W([{ text: 'x', weight: 1 }, { text: 'y', weight: 2 }, { text: 'z', weight: 3 }, { text: 'off', on: false }, { text: 'q', weight: 4 }]);
  const segs = activeSegments(w); assert.equal(segs.length, 4); const sp = spans(segs);
  const counts = [0, 0, 0, 0]; let rot = 0;
  for (let i = 0; i < 30000; i++) { const plan = planSpin({ sp, rotation: rot, winner: pickWinner(sp), duration: 3 }); rot = plan.to; counts[angleToIndex(sp, rot)]++; }
  assert.ok(chiSquare(counts, [0.1, 0.2, 0.3, 0.4]) < 16.27, `counts ${counts}`);
});

test('gestureVelocity measures angular speed around the centre (sign = direction)', () => {
  const s = []; for (let i = 0; i <= 10; i++) { const a = i * 0.05; s.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a), t: i * 10 }); }
  assert.ok(Math.abs(gestureVelocity(s, 0, 0) - 5) < 0.01);
  assert.ok(gestureVelocity(s.map((p) => ({ ...p, y: -p.y })), 0, 0) < 0);
  assert.equal(gestureVelocity([s[0]], 0, 0), 0);
});

test('elimination: winners are removed, reset brings them back', () => {
  const w = W(['a', 'b', 'c'], { opts: { elim: true } });
  const id = w.segments[1].id; const rec = recordResult(w, [id], 1000);
  assert.equal(w.spins, 1); assert.equal(w.lastUsed, 1000); assert.deepEqual(rec.ids, [id]);
  assert.equal(activeSegments(w).length, 2); assert.ok(!activeSegments(w).some((s) => s.id === id));
  recordResult(w, [w.segments[0].id]); recordResult(w, [w.segments[2].id]);
  assert.equal(activeSegments(w).length, 0);
  assert.equal(resetElimination(w), 3); assert.equal(activeSegments(w).length, 3);
  const w2 = W(['a', 'b']); recordResult(w2, [w2.segments[0].id]); assert.equal(activeSegments(w2).length, 2);
});

test('history is capped and stats compare observed vs expected', () => {
  const w = W(['a', { text: 'b', weight: 3 }]);
  for (let i = 0; i < 520; i++) recordResult(w, [w.segments[i % 4 === 0 ? 0 : 1].id], i);
  assert.equal(w.history.length, 500); assert.equal(w.spins, 520);
  const st = historyStats(w); assert.equal(st.total, 500);
  const b = st.rows.find((r) => r.label === 'b'); assert.equal(b.expected, 0.75); assert.equal(b.pct, 375 / 500);
});

test('duplicateWheel gets fresh ids and clean stats', () => {
  const w = W(['a', 'b'], { name: 'X', fav: true }); recordResult(w, [w.segments[0].id]);
  const c = duplicateWheel(w);
  assert.notEqual(c.id, w.id); assert.equal(c.name, 'کپی X'); assert.equal(c.spins, 0); assert.equal(c.history.length, 0);
  c.segments.forEach((s, i) => { assert.notEqual(s.id, w.segments[i].id); assert.equal(s.text, w.segments[i].text); });
});

test('parseItems: lines, commas, weights (latin/persian digits), emoji, limit', () => {
  const a = parseItems('🍕 پیتزا*3\nکباب × ۲\n\n  سالاد  \nBox 3\nx*0');
  assert.deepEqual(a.map((s) => [s.emoji, s.text, s.weight]), [['🍕', 'پیتزا', 3], ['', 'کباب', 2], ['', 'سالاد', 1], ['', 'Box 3', 1], ['', 'x', 0.1]]);
  assert.deepEqual(parseItems('علی، رضا, سارا').map((s) => s.text), ['علی', 'رضا', 'سارا']);
  assert.equal(parseItems('a*99999')[0].weight, 1000);
  assert.equal(parseItems('*3')[0].text, '*3');
  assert.equal(parseItems(Array.from({ length: 900 }, (_, i) => 'i' + i).join('\n')).length, MAX_SEGMENTS);
});

test('makeWheel / makeSegment sanitise hostile input', () => {
  const w = makeWheel({ name: 'x'.repeat(500), segments: [{ text: 'y'.repeat(999), weight: -3, color: 'red;}' }], opts: { duration: 999, winners: 50 } });
  assert.ok(w.name.length <= 60); assert.ok(w.segments[0].text.length <= 200);
  assert.ok(w.segments[0].weight >= 0); assert.equal(w.segments[0].color, null);
  const o = sanitizeOpts({ duration: 999, winners: 50 }); assert.equal(o.duration, 20); assert.equal(o.winners, 50); assert.equal(sanitizeOpts({ winners: 0 }).winners, 1);
  assert.equal(makeSegment({}).on, true);
});
