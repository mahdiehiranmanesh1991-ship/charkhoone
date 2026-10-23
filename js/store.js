// Local persistence (localStorage) + first-run sample wheels («نمونه»).
import { makeWheel, makeSegment } from './wheel.js';
import { buildTemplate } from './templates.js';
import { CHALLENGES } from './challenges.js';
import { newGame } from './game.js';

export const KEY = 'charkhoone.v1';
export const defaultSettings = () => ({ name: 'مهدیه', greet: true, theme: 'gold', faDigits: true, sound: true, haptics: true, motion: 'auto', tags: [] });

export function challengeWheel(id) {
  const c = CHALLENGES[id];
  return makeWheel({ name: c.name, emoji: c.emoji, theme: c.theme, special: id, tags: ['نمونه', 'چالش'], segments: c.cats.map((cat) => makeSegment({ text: cat.name, emoji: cat.emoji })) });
}

export function sampleWheels(now = Date.now()) {
  const T = (id, p, extra = {}) => makeWheel({ ...buildTemplate(id, p), tags: ['نمونه'], ...extra });
  const list = [
    challengeWheel('emoji'),
    challengeWheel('law'),
    T('percent', { step: 5 }, { name: 'گردونه‌ی درصد' }),
    T('number', { min: 1, max: 12, step: 1 }),
    T('timer'),
    T('drive'),
    T('food'),
    T('cat'),
    T('clash'),
  ];
  list.forEach((w, i) => { w.createdAt = w.updatedAt = now - i * 1000; });
  return list;
}

export function load(storage = globalThis.localStorage) {
  let st = null;
  try { st = JSON.parse(storage.getItem(KEY) || 'null'); } catch { st = null; }
  if (!st || !Array.isArray(st.wheels)) st = { wheels: sampleWheels(), settings: defaultSettings(), game: newGame() };
  st.settings = { ...defaultSettings(), ...(st.settings || {}) };
  st.game = { ...newGame(), ...(st.game || {}) };
  st.wheels = st.wheels.map((w) => makeWheel(w));
  return st;
}

export function save(st, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(st)); return true; }
  catch { return false; } // quota (large images) — caller shows a warning
}
