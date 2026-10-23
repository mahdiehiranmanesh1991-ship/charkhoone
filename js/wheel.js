// Wheel model, geometry and spin physics for «چرخونه». Pure functions, no DOM → unit-tested in Node.
import { random, weightedIndex, randInt } from './rng.js';

export const TAU = Math.PI * 2;
export const MAX_SEGMENTS = 500;
export const mod = (a, m = TAU) => ((a % m) + m) % m;
export const uid = () => Date.now().toString(36) + randInt(2 ** 31).toString(36);

export const DEFAULT_OPTS = Object.freeze({ duration: 5, sound: true, elim: false, winners: 1, mystery: false, confetti: true });

export function makeSegment(p = {}) {
  return {
    id: p.id || uid(),
    text: String(p.text ?? '').slice(0, 80),
    emoji: String(p.emoji ?? '').slice(0, 8),
    color: isColor(p.color) ? p.color : null,
    weight: Number.isFinite(+p.weight) && +p.weight >= 0 ? Math.min(+p.weight, 1000) : 1,
    on: p.on !== false,
    out: !!p.out, // eliminated by elimination mode (reset restores these, manual "off" stays off)
    img: typeof p.img === 'string' && p.img.startsWith('data:image/') ? p.img : null,
    pool: Array.isArray(p.pool) ? p.pool.map((s) => String(s).slice(0, 160)).filter(Boolean).slice(0, 200) : null,
  };
}

export function makeWheel(p = {}) {
  const now = Date.now();
  return {
    id: p.id || uid(),
    name: String(p.name || 'گردونه‌ی من').slice(0, 60),
    emoji: String(p.emoji || '🎡').slice(0, 8),
    tags: Array.isArray(p.tags) ? [...new Set(p.tags.map((t) => String(t).trim().slice(0, 24)).filter(Boolean))].slice(0, 12) : [],
    theme: typeof p.theme === 'string' ? p.theme : null,
    fav: !!p.fav,
    special: p.special || null,
    template: p.template || null,
    createdAt: p.createdAt || now, updatedAt: p.updatedAt || now,
    spins: Math.max(0, p.spins | 0), lastUsed: p.lastUsed || null,
    segments: (p.segments || []).slice(0, MAX_SEGMENTS).map(makeSegment),
    opts: { ...DEFAULT_OPTS, ...sanitizeOpts(p.opts) },
    history: Array.isArray(p.history) ? p.history.slice(-500) : [],
  };
}

export function sanitizeOpts(o = {}) {
  const r = {};
  if (o == null || typeof o !== 'object') return r;
  if (Number.isFinite(+o.duration)) r.duration = Math.min(20, Math.max(1, +o.duration));
  if (Number.isFinite(+o.winners)) r.winners = Math.min(50, Math.max(1, Math.floor(+o.winners)));
  for (const k of ['sound', 'elim', 'mystery', 'confetti']) if (k in o) r[k] = !!o[k];
  return r;
}

export function isColor(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c); }

/** Segments that take part in a spin (enabled, not eliminated, positive weight). */
export const activeSegments = (w) => w.segments.filter((s) => s.on && !s.out && s.weight > 0);

/** Angular spans in wheel coordinates. 0 = start of first segment, clockwise. Size ∝ weight (honest visuals). */
export function spans(segs) {
  const total = segs.reduce((s, x) => s + x.weight, 0);
  let a = 0;
  return segs.map((s) => { const w = total > 0 ? (s.weight / total) * TAU : 0; const sp = { start: a, end: a + w, mid: a + w / 2, size: w }; a += w; return sp; });
}

/**
 * The pointer sits at the top of the wheel (canvas angle −90°). Segment k is drawn from canvas angle
 * (rotation + start − 90°). So the wheel-coordinate under the pointer is (−rotation) mod 2π.
 */
export const pointerAngle = (rotation) => mod(-rotation);

export function angleToIndex(sp, rotation) {
  const a = pointerAngle(rotation);
  for (let i = 0; i < sp.length; i++) if (a >= sp[i].start && a < sp[i].end) return i;
  return sp.length - 1;
}

/** Choose the winner fairly: probability exactly ∝ segment size (= weight). */
export function pickWinner(sp) { return weightedIndex(sp.map((s) => s.size)); }

/**
 * Physics plan. The wheel leaves the finger with angular velocity v0 (rad/s) and decelerates smoothly
 * (θ(t) = θ0 + D·(1 − (1 − t/T)^p), so θ'(0) = p·D/T = v0). The stopping angle is chosen beforehand with the
 * CSPRNG (uniform inside the winning segment, away from its edges), so a stronger flick gives more turns and a
 * longer spin, but never a biased result.
 */
export function planSpin({ sp, rotation = 0, winner, v0 = null, duration = 5, reduced = false, rnd = random }) {
  const p = reduced ? 2 : 3;
  const dir = v0 != null && v0 < 0 ? -1 : 1;
  const speed = v0 == null ? null : Math.abs(v0);
  const s = sp[winner];
  const local = s.start + (0.14 + 0.72 * rnd()) * s.size;
  const targetMod = mod(-local);
  const delta = dir > 0 ? mod(targetMod - mod(rotation)) : mod(mod(rotation) - targetMod); // distance still to travel (< 1 turn)
  let T, dist;
  if (reduced) { T = 1.2; dist = delta + TAU; }
  else if (speed && speed > 0) {
    // flick: a stronger flick = more turns and a longer spin; the outcome is still the CSPRNG's choice
    const ref = 14; // rad/s ≈ a confident flick
    T = Math.min(duration * 1.6, Math.max(2.2, duration * (0.6 + 0.4 * Math.min(2.5, speed / ref))));
    const k = Math.max(2, Math.round(((speed * T) / p - delta) / TAU));
    dist = delta + k * TAU;
    T = Math.min(duration * 1.8, Math.max(2, (p * dist) / speed)); // keep the release speed continuous when possible
  } else {
    T = duration;
    dist = delta + Math.max(3, Math.round(duration * 1.35 + 2)) * TAU;
  }
  const D = dir * dist;
  return { from: rotation, to: rotation + D, D, T, p, winner };
}

export function angleAt(plan, t) {
  const x = Math.min(1, Math.max(0, t / plan.T));
  return plan.from + plan.D * (1 - (1 - x) ** plan.p);
}
export function velocityAt(plan, t) {
  const x = Math.min(1, Math.max(0, t / plan.T));
  return (plan.p * plan.D / plan.T) * (1 - x) ** (plan.p - 1);
}

/** Velocity (rad/s) of a drag gesture around the wheel centre from recent pointer samples [{x,y,t(ms)}]. */
export function gestureVelocity(samples, cx, cy) {
  if (samples.length < 2) return 0;
  const end = samples[samples.length - 1];
  let i = samples.length - 2; while (i > 0 && end.t - samples[i].t < 90) i--;
  const a = samples[i];
  const dt = (end.t - a.t) / 1000; if (dt <= 0) return 0;
  let dA = Math.atan2(end.y - cy, end.x - cx) - Math.atan2(a.y - cy, a.x - cx);
  if (dA > Math.PI) dA -= TAU; if (dA < -Math.PI) dA += TAU;
  return dA / dt;
}

/** Apply a finished spin to the wheel: stats, history, elimination. Returns the result record. */
export function recordResult(wheel, segIds, now = Date.now(), extra = {}) {
  const segs = segIds.map((id) => wheel.segments.find((s) => s.id === id)).filter(Boolean);
  wheel.spins += 1; wheel.lastUsed = now;
  const rec = { t: now, ids: segs.map((s) => s.id), txt: segs.map((s) => labelOf(s)), ...extra };
  wheel.history.push(rec); if (wheel.history.length > 500) wheel.history.splice(0, wheel.history.length - 500);
  if (wheel.opts.elim) for (const s of segs) s.out = true;
  return rec;
}

export const labelOf = (s) => [s.emoji, s.text].filter(Boolean).join(' ') || '—';

export function resetElimination(wheel) { let n = 0; for (const s of wheel.segments) if (s.out) { s.out = false; n++; } return n; }

/** Counts per segment over the wheel's history (for the stats chart). */
export function historyStats(wheel) {
  const byId = new Map(wheel.segments.map((s) => [s.id, { id: s.id, label: labelOf(s), color: s.color, n: 0, weight: s.weight }]));
  let total = 0;
  for (const h of wheel.history) for (const id of h.ids || []) { const r = byId.get(id); if (r) { r.n++; total++; } }
  const wsum = wheel.segments.filter((s) => s.on).reduce((a, s) => a + s.weight, 0) || 1;
  return { total, rows: [...byId.values()].map((r) => ({ ...r, pct: total ? r.n / total : 0, expected: r.weight / wsum })).sort((a, b) => b.n - a.n) };
}

export function duplicateWheel(w) {
  const c = makeWheel(JSON.parse(JSON.stringify({ ...w, id: null, name: 'کپی ' + w.name, spins: 0, lastUsed: null, history: [], createdAt: null, updatedAt: null, special: null })));
  c.segments.forEach((s) => { s.id = uid(); s.out = false; });
  return c;
}

/** Parse quick-wheel text: one item per line (or comma/، separated if a single line). "متن*3" sets weight 3. */
export function parseItems(text) {
  let lines = String(text || '').split(/\r?\n/);
  if (lines.filter((l) => l.trim()).length === 1 && /[,،]/.test(lines[0])) lines = lines[0].split(/[,،]/);
  return lines.map((l) => l.trim()).filter(Boolean).slice(0, MAX_SEGMENTS).map((l) => {
    const m = l.match(/^(.*?)\s*[*×]\s*([\d۰-۹]+(?:[.٫][\d۰-۹]+)?)$/);
    const num = m ? +m[2].replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace('٫', '.') : 1;
    const body = m && m[1] ? m[1] : l; const weight = m && m[1] ? Math.min(1000, Math.max(0.1, num)) : 1;
    const em = body.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u);
    return makeSegment({ text: em ? em[2] : body, emoji: em ? em[1] : '', weight });
  });
}
