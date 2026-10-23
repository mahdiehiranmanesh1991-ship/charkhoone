import test from 'node:test';
import assert from 'node:assert/strict';
import { faDigits, enDigits, esc, jalali, dayKey, relTime, encodeShare, decodeShare, wheelToShare, shareToWheel, exportData, importData } from '../js/util.js';
import { makeWheel } from '../js/wheel.js';
import { load, save, sampleWheels, KEY } from '../js/store.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('Persian digits and escaping', () => {
  assert.equal(faDigits('50% of 12'), '۵۰٪ of ۱۲'); assert.equal(enDigits('۱۲۳٤'), '1234');
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});

test('Jalali dates in Tehran time', () => {
  const ts = Date.UTC(2026, 9, 23, 12); // 1 Aban 1405
  assert.equal(dayKey(ts), '1405-08-01');
  assert.match(jalali(ts), /آبان/);
  assert.equal(dayKey(Date.UTC(2026, 2, 20, 21, 0)), '1405-01-01'); // Nowruz starts at Tehran midnight (UTC+3:30)
});

test('relative time', () => {
  const now = Date.UTC(2026, 9, 23, 12);
  assert.equal(relTime(null, now), 'هنوز نچرخیده'); assert.equal(relTime(now - 5e3, now), 'همین حالا');
  assert.equal(relTime(now - 5 * 60e3, now), '5 دقیقه پیش'); assert.equal(relTime(now - 864e5, now), 'دیروز');
  assert.match(relTime(now - 40 * 864e5, now), /۱۴۰۵|1405/);
});

test('share link round-trip (compressed and plain), hostile payloads rejected', async () => {
  const w = makeWheel({ name: 'ناهار', emoji: '🍽️', theme: 'kashi', opts: { elim: true, winners: 2 }, segments: [{ text: 'کباب', emoji: '🍢', weight: 3, color: '#ff0000' }, { text: 'پیتزا' }, { text: 'off', on: false }, { text: 'حقیقت', pool: ['سؤال ۱', 'سؤال ۲'] }] });
  const code = await encodeShare(w); assert.match(code, /^[zj][A-Za-z0-9_-]+$/);
  for (const c of [code, 'https://x.example/app/#w=' + code, 'j' + Buffer.from(JSON.stringify(wheelToShare(w))).toString('base64url')]) {
    const r = await decodeShare(c);
    assert.equal(r.name, 'ناهار'); assert.equal(r.theme, 'kashi'); assert.equal(r.opts.elim, true); assert.equal(r.opts.winners, 2);
    assert.deepEqual(r.segments.map((s) => [s.text, s.emoji, s.weight, s.color]), [['کباب', '🍢', 3, '#ff0000'], ['پیتزا', '', 1, null], ['حقیقت', '', 1, null]]);
    assert.deepEqual(r.segments[2].pool, ['سؤال ۱', 'سؤال ۲']); assert.notEqual(r.id, w.id); assert.ok(r.tags.includes('اشتراکی'));
  }
  await assert.rejects(decodeShare('xabc')); await assert.rejects(decodeShare('j' + Buffer.from('{"s":5}').toString('base64url')));
  const evil = shareToWheel({ n: '<b>', s: [['t', '', 'url(javascript:1)', 1]] }); assert.equal(evil.segments[0].color, null);
});

test('backup export → import (merge by id, settings/game kept by reference)', () => {
  const st = { wheels: sampleWheels(1), settings: { name: 'مهدیه', theme: 'gold' }, game: { coins: 10, best: 2, spins: 5, ach: { first: 1 }, solved: { law: { 'a:0': 1 } }, done: {}, pointers: ['classic'] } };
  const data = JSON.parse(JSON.stringify(exportData(st)));
  assert.equal(data.app, 'charkhoone'); assert.equal(data.v, 1); assert.equal(data.wheels.length, st.wheels.length);
  const target = { wheels: [st.wheels[0], makeWheel({ name: 'mine' })], settings: { name: 'x', theme: 'neon' }, game: { coins: 3, best: 0, spins: 0, ach: {}, solved: { law: { 'a:1': 1 } }, done: {}, pointers: ['classic', 'paw'] } };
  const S = target.settings, G = target.game;
  data.wheels[0].name = 'renamed';
  const r = importData(target, data);
  assert.deepEqual(r, { added: st.wheels.length - 1, replaced: 1 });
  assert.equal(target.wheels.length, st.wheels.length + 1); assert.equal(target.wheels[0].name, 'renamed');
  assert.ok(target.wheels.some((w) => w.name === 'mine'));
  assert.equal(target.settings, S); assert.equal(S.name, 'مهدیه'); assert.equal(target.game, G);
  assert.equal(G.coins, 10); assert.deepEqual(G.solved.law, { 'a:0': 1, 'a:1': 1 }); assert.deepEqual(G.pointers.sort(), ['classic', 'paw']);
  assert.throws(() => importData(target, { app: 'other', wheels: [] })); assert.throws(() => importData(target, null));
});

test('store: first run seeds samples; save/load round-trip; corrupt data recovers', () => {
  const s = mem(); const st = load(s);
  assert.ok(st.wheels.length >= 8); assert.equal(st.settings.name, 'مهدیه'); assert.ok(st.wheels.some((w) => w.special === 'emoji'));
  st.wheels[0].name = 'Z'; assert.equal(save(st, s), true);
  assert.equal(load(s).wheels[0].name, 'Z');
  s.setItem(KEY, '{broken'); assert.ok(load(s).wheels.length >= 8);
  assert.equal(save(st, { setItem() { throw new Error('QuotaExceeded'); } }), false);
});
