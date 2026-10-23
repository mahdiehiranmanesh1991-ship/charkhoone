// Formatting, Jalali dates, share links and backups for «چرخونه».
import { makeWheel, makeSegment, isColor, sanitizeOpts, MAX_SEGMENTS } from './wheel.js';

const FA = '۰۱۲۳۴۵۶۷۸۹';
export const faDigits = (s) => String(s).replace(/[0-9]/g, (d) => FA[d]).replace(/%/g, '٪');
export const enDigits = (s) => String(s).replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TZ = 'Asia/Tehran';
export function jalali(ts, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { timeZone: TZ, ...opts }).format(new Date(ts));
}
/** Jalali calendar day key "1405-08-01" (Tehran time) — used for the daily streak. */
export function dayKey(ts) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return `${p.year.replace(/\D/g, '')}-${p.month}-${p.day}`;
}
export function relTime(ts, now = Date.now()) {
  if (!ts) return 'هنوز نچرخیده';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return 'همین حالا';
  if (s < 3600) return `${Math.floor(s / 60)} دقیقه پیش`;
  if (dayKey(ts) === dayKey(now)) return `${Math.floor(s / 3600)} ساعت پیش`;
  if (dayKey(ts) === dayKey(now - 864e5)) return 'دیروز';
  if (s < 7 * 864e5 / 1000) return `${Math.ceil(s / 86400)} روز پیش`;
  return jalali(ts);
}

// ---------- base64url ----------
function b64url(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
async function pipe(bytes, Stream, fmt) { const st = new Blob([bytes]).stream().pipeThrough(new Stream(fmt)); return new Uint8Array(await new Response(st).arrayBuffer()); }

/** Compact, image-free snapshot of a wheel for a link. */
export function wheelToShare(w) {
  return { n: w.name, e: w.emoji, th: w.theme || undefined, o: w.opts, s: w.segments.filter((s) => s.on).map((s) => { const r = [s.text]; if (s.emoji || s.color || s.weight !== 1 || s.pool) { r.push(s.emoji || '', s.color || '', s.weight); if (s.pool) r.push(s.pool); } return r; }) };
}
export function shareToWheel(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.s)) throw new Error('bad share');
  return makeWheel({ name: o.n, emoji: o.e, theme: typeof o.th === 'string' ? o.th : null, opts: sanitizeOpts(o.o), tags: ['اشتراکی'],
    segments: o.s.slice(0, MAX_SEGMENTS).map((r) => Array.isArray(r) ? makeSegment({ text: r[0], emoji: r[1], color: isColor(r[2]) ? r[2] : null, weight: r[3] ?? 1, pool: r[4] }) : makeSegment({ text: r })) });
}
export async function encodeShare(w) {
  const bytes = new TextEncoder().encode(JSON.stringify(wheelToShare(w)));
  if (typeof CompressionStream === 'function') { try { return 'z' + b64url(await pipe(bytes, CompressionStream, 'deflate-raw')); } catch { /* fall through */ } }
  return 'j' + b64url(bytes);
}
export async function decodeShare(code) {
  code = String(code || '').trim().replace(/^.*#w=/, '');
  const kind = code[0]; let bytes = unb64url(code.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, DecompressionStream, 'deflate-raw'); else if (kind !== 'j') throw new Error('bad share');
  if (bytes.length > 400000) throw new Error('too big');
  return shareToWheel(JSON.parse(new TextDecoder().decode(bytes)));
}

// ---------- full backup ----------
export function exportData(state) { return { app: 'charkhoone', v: 1, exportedAt: new Date().toISOString(), wheels: state.wheels, settings: state.settings, game: state.game }; }
/** Validates a backup and merges it: wheels with the same id are replaced, others added. */
export function importData(state, data) {
  if (!data || data.app !== 'charkhoone' || !Array.isArray(data.wheels)) throw new Error('این فایل پشتیبان «چرخونه» نیست');
  const incoming = data.wheels.slice(0, 2000).map(makeWheel);
  const ids = new Set(incoming.map((w) => w.id));
  const replaced = state.wheels.filter((w) => ids.has(w.id)).length;
  state.wheels = [...incoming, ...state.wheels.filter((w) => !ids.has(w.id))];
  // mutate in place so that references held by the UI stay valid
  if (data.settings && typeof data.settings === 'object') Object.assign(state.settings, pick(data.settings, Object.keys(state.settings)));
  if (data.game && typeof data.game === 'object') {
    const g = data.game; const s = state.game;
    s.coins = Math.max(s.coins | 0, g.coins | 0); s.best = Math.max(s.best | 0, g.best | 0); s.spins = Math.max(s.spins | 0, g.spins | 0);
    s.ach = { ...(g.ach || {}), ...s.ach };
    for (const [ch, m] of Object.entries(g.solved || {})) { s.solved[ch] = s.solved[ch] || {}; for (const [k, v] of Object.entries(m || {})) s.solved[ch][k] = Math.max(s.solved[ch][k] | 0, v | 0); }
    s.done = { ...(g.done || {}), ...(s.done || {}) };
    if (Array.isArray(g.pointers)) s.pointers = [...new Set([...(s.pointers || []), ...g.pointers])];
  }
  return { added: incoming.length - replaced, replaced };
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
