// Gamification: coins, daily streak, achievements, unlockable pointer skins. All local, no tracking.
import { dayKey } from './util.js';
import { POINTERS } from './themes.js';

export const ACHIEVEMENTS = [
  { id: 'first', name: 'اولین چرخش', emoji: '🎡', coins: 10, test: (g) => g.spins >= 1 },
  { id: 's10', name: '۱۰ چرخش', emoji: '🔟', coins: 15, test: (g) => g.spins >= 10 },
  { id: 's100', name: 'صد چرخش!', emoji: '💯', coins: 50, test: (g) => g.spins >= 100 },
  { id: 's500', name: 'استاد چرخونه', emoji: '🏅', coins: 150, test: (g) => g.spins >= 500 },
  { id: 'st3', name: '۳ روز پشت سر هم', emoji: '🔥', coins: 20, test: (g) => g.best >= 3 },
  { id: 'st7', name: 'یک هفته‌ی کامل', emoji: '🌟', coins: 70, test: (g) => g.best >= 7 },
  { id: 'maker', name: 'سازنده', emoji: '🛠️', coins: 20, test: (g) => g.made >= 3 },
  { id: 'elim', name: 'تا آخرین نفر', emoji: '🏁', coins: 20, test: (g) => g.elimDone >= 1 },
  { id: 'themes', name: 'جهانگرد تم‌ها', emoji: '🎨', coins: 20, test: (g) => (g.themes || []).length >= 4 },
  { id: 'dice', name: 'تاس‌باز', emoji: '🎲', coins: 15, test: (g) => g.dice >= 10 },
  { id: 'emoji', name: 'استاد ایموجی', emoji: '🤩', coins: 100, test: (g) => g.done?.emoji },
  { id: 'law', name: 'حقوق‌دان برتر', emoji: '⚖️', coins: 100, test: (g) => g.done?.law },
  { id: 'night', name: 'شب‌زنده‌دار', emoji: '🦉', coins: 10, test: (g) => g.night },
];

export const newGame = () => ({ coins: 0, spins: 0, streak: 0, best: 0, lastDay: null, ach: {}, solved: {}, made: 0, elimDone: 0, themes: [], dice: 0, done: {}, night: false, pointers: ['classic'], pointer: 'classic' });

/** Check achievements; awards coins once per achievement. Returns newly unlocked list. */
export function checkAch(g, now = Date.now()) {
  const out = [];
  for (const a of ACHIEVEMENTS) if (!g.ach[a.id] && a.test(g)) { g.ach[a.id] = now; g.coins += a.coins; out.push(a); }
  return out;
}

/** Called after every wheel spin. Handles the daily streak (Jalali days, Tehran time). */
export function onSpin(g, now = Date.now()) {
  const ev = [];
  g.spins += 1;
  const today = dayKey(now);
  if (g.lastDay !== today) {
    const yesterday = dayKey(now - 864e5);
    g.streak = g.lastDay === yesterday ? g.streak + 1 : 1;
    g.best = Math.max(g.best, g.streak); g.lastDay = today;
    const bonus = 5 * Math.min(g.streak, 7); g.coins += bonus;
    ev.push({ type: 'daily', coins: bonus, streak: g.streak });
  }
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now));
  if (h < 4) g.night = true;
  for (const a of checkAch(g, now)) ev.push({ type: 'ach', ach: a });
  return ev;
}

/** Answer a challenge question once; correct answers earn coins the first time only. */
export function answer(g, chId, key, correct, reward, total) {
  g.solved[chId] = g.solved[chId] || {};
  const first = !(key in g.solved[chId]);
  if (first) g.solved[chId][key] = correct ? 1 : 0;
  else if (correct && !g.solved[chId][key]) g.solved[chId][key] = 1;
  else return { coins: 0, first: false };
  const coins = correct ? reward : 0; g.coins += coins;
  if (Object.values(g.solved[chId]).filter(Boolean).length * reward >= total) g.done[chId] = true;
  return { coins, first, ach: checkAch(g) };
}
export const earned = (g, chId, reward) => Object.values(g.solved[chId] || {}).filter(Boolean).length * reward;

export function buyPointer(g, id) {
  const p = POINTERS[id]; if (!p) throw new Error('unknown');
  if (g.pointers.includes(id)) { g.pointer = id; return true; }
  if (g.coins < p.price) return false;
  g.coins -= p.price; g.pointers.push(id); g.pointer = id; return true;
}
