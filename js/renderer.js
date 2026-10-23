// Canvas renderer for «چرخونه»: glossy 3D wheel face (cached), metallic rim with chasing LED bulbs,
// pointer that rides over the pegs with a damped spring, winner highlight. ~60fps: one cached bitmap
// rotation + a few sprite blits per frame.
import { TAU, mod, spans, activeSegments, angleToIndex, pointerAngle, angleAt, velocityAt } from './wheel.js';
import { themeOf } from './themes.js';
import { faDigits } from './util.js';

// ---------- colour helpers ----------
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb = (a, al = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`;
const mix = (c, t, k) => { const a = hex(c), b = t === 'w' ? [255, 255, 255] : [0, 0, 0]; return rgb(a.map((v, i) => v + (b[i] - v) * k)); };
const lum = (c) => { const [r, g, b] = hex(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const segColor = (seg, i, th, n) => { if (seg.color) return seg.color; const p = th.palette; let c = p[i % p.length]; if (n % p.length === 1 && i === n - 1) c = p[(i + 2) % p.length]; return c; };
const textColorFor = (c, th, custom) => { if (th.textOn && th.textOn[c]) return th.textOn[c]; if (!custom && th.deco !== 'neon') return th.text; return lum(c) > 0.45 ? '#2b1d1d' : '#ffffff'; };
const imgCache = new Map();
function getImg(src, onload) { let im = imgCache.get(src); if (!im) { im = new Image(); im.onload = () => onload && onload(); im.src = src; imgCache.set(src, im); } else if (!im.complete && onload) im.addEventListener('load', onload, { once: true }); return im; }

// deterministic pseudo-random for decorations (not used for results)
const hash = (i) => { let x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function star8(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; const rr = k % 2 ? r * 0.55 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function paw(ctx, x, y, r) {
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.25, r * 0.55, r * 0.45, 0, 0, TAU); ctx.fill();
  for (const [dx, dy] of [[-0.55, -0.35], [-0.2, -0.7], [0.2, -0.7], [0.55, -0.35]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.2, 0, TAU); ctx.fill(); }
}

/**
 * Draw the wheel face (segments, decoration, labels, pegs) centred at (0,0) with radius R in current ctx units.
 * Returns the spans used.
 */
export function drawFace(ctx, R, wheel, th, { mystery = false, small = false, digits = true, onImg } = {}) {
  const segs = activeSegments(wheel); const sp = spans(segs); const n = segs.length;
  if (!n) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, '#555'); g.addColorStop(1, '#222');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${R * 0.12}px Vazirmatn`; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillText('خانه‌ای نمانده', 0, R * 0.45); return sp;
  }
  const off = -Math.PI / 2; // wheel coordinate 0 at the top (pointer)
  const neon = th.deco === 'neon';
  segs.forEach((s, i) => {
    const a0 = sp[i].start + off, a1 = sp[i].end + off; const c = segColor(s, i, th, n);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R);
    if (neon && !s.color) { g.addColorStop(0, '#07060f'); g.addColorStop(0.55, mix(c, 'k', 0.82)); g.addColorStop(1, mix(c, 'k', 0.45)); }
    else { g.addColorStop(0, mix(c, 'w', 0.28)); g.addColorStop(0.5, c); g.addColorStop(0.93, mix(c, 'k', 0.18)); g.addColorStop(1, mix(c, 'k', 0.32)); }
    ctx.fillStyle = g; ctx.fill();
    // decoration (clipped to the segment)
    if (!small || R > 40) {
      ctx.clip();
      const mid = sp[i].mid + off;
      if (th.deco === 'girih') {
        ctx.strokeStyle = 'rgba(255,226,140,.55)'; ctx.lineWidth = Math.max(1, R * 0.006); ctx.fillStyle = 'rgba(255,255,255,.08)';
        for (const rr of [0.42, 0.64, 0.86]) { const sz = Math.min(R * 0.07, (sp[i].size * R * rr) * 0.28); if (sz < 2) continue; star8(ctx, Math.cos(mid) * R * rr, Math.sin(mid) * R * rr, sz); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, R * 0.93, a0, a1); ctx.stroke();
      } else if (th.deco === 'stars') {
        ctx.fillStyle = '#fff';
        const k = Math.max(4, Math.round(sp[i].size * 14));
        for (let j = 0; j < k; j++) { const rr = R * (0.25 + 0.72 * hash(i * 31 + j)); const aa = a0 + (a1 - a0) * hash(i * 17 + j * 3 + 1); ctx.globalAlpha = 0.25 + 0.6 * hash(j + i); ctx.beginPath(); ctx.arc(Math.cos(aa) * rr, Math.sin(aa) * rr, Math.max(0.6, R * 0.006 * hash(j * 7 + i)), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (th.deco === 'paws') {
        ctx.fillStyle = 'rgba(255,255,255,.28)'; const sz = Math.min(R * 0.06, sp[i].size * R * 0.5 * 0.22);
        if (sz > 2.5) paw(ctx, Math.cos(mid + sp[i].size * 0.22) * R * 0.5, Math.sin(mid + sp[i].size * 0.22) * R * 0.5, sz);
      } else if (th.deco === 'dots') {
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        for (const rr of [0.4, 0.62, 0.84]) { const sz = Math.min(R * 0.028, sp[i].size * R * rr * 0.1); if (sz > 1.2) for (const d of [-0.28, 0.28]) { const aa = mid + d * sp[i].size; ctx.beginPath(); ctx.arc(Math.cos(aa) * R * rr, Math.sin(aa) * R * rr, sz, 0, TAU); ctx.fill(); } }
      }
      // inner bevel glint along the outer edge
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = R * 0.02; ctx.beginPath(); ctx.arc(0, 0, R * 0.985, a0, a1); ctx.stroke();
    }
    ctx.restore();
  });
  // separators
  if (n > 1) {
    ctx.save(); ctx.lineCap = 'round';
    const lw = Math.max(small ? 0.6 : 1, R * (n > 60 ? 0.003 : 0.008));
    for (let i = 0; i < n; i++) {
      const a = sp[i].start + off; const x = Math.cos(a) * R, y = Math.sin(a) * R;
      if (neon) { ctx.shadowColor = segColor(segs[i], i, th, n); ctx.shadowBlur = R * 0.04; ctx.strokeStyle = segColor(segs[i], i, th, n); }
      else { ctx.strokeStyle = th.sep; }
      ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
  }
  // labels
  const maxFont = R * (small ? 0.16 : 0.12);
  segs.forEach((s, i) => {
    const size = sp[i].size; const mid = sp[i].mid + off;
    const label = mystery ? '؟' : (digits ? faDigits(s.text) : s.text);
    const em = mystery ? '' : s.emoji;
    const c = segColor(s, i, th, n);
    const chord = 2 * Math.sin(Math.min(size, Math.PI) / 2) * R * 0.68; // available height around the text radius
    let f = Math.min(maxFont, chord * 0.62);
    if (f < (small ? 3.2 : 6)) return;
    ctx.save(); ctx.rotate(mid);
    const outer = R * 0.9;
    let textEnd = outer;
    const hasImg = s.img && !mystery && !small;
    if (em) {
      const ef = Math.min(f * 1.25, R * 0.13);
      ctx.font = `${ef}px "Apple Color Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const ex = outer - ef * 0.6; ctx.save(); ctx.translate(ex, 0); ctx.rotate(Math.PI / 2); ctx.fillText(em, 0, 0); ctx.restore();
      textEnd = outer - ef * 1.3;
    }
    if (hasImg) {
      const ir = Math.min(R * 0.16, chord * 0.42); const ix = R * 0.62;
      const im = getImg(s.img, onImg);
      if (im.complete && im.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(ix, 0, ir, 0, TAU); ctx.clip(); ctx.translate(ix, 0); ctx.rotate(Math.PI / 2); const k = Math.max((2 * ir) / im.naturalWidth, (2 * ir) / im.naturalHeight); ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = R * 0.01; ctx.beginPath(); ctx.arc(ix, 0, ir, 0, TAU); ctx.stroke(); }
      textEnd = Math.min(textEnd, ix - ir - R * 0.03);
    }
    const avail = textEnd - R * 0.24;
    if (label && avail > f) {
      ctx.font = `800 ${f}px Vazirmatn, Tahoma, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      let w = ctx.measureText(label).width;
      if (w > avail) { f = Math.max(small ? 3 : 7, (f * avail) / w); ctx.font = `800 ${f}px Vazirmatn, Tahoma, sans-serif`; w = ctx.measureText(label).width; }
      let txt = label;
      if (w > avail) { while (txt.length > 1 && ctx.measureText(txt + '…').width > avail) txt = txt.slice(0, -1); txt += '…'; }
      const tc = textColorFor(c, th, !!s.color);
      if (neon && !s.color) { ctx.shadowColor = c; ctx.shadowBlur = f * 0.6; ctx.fillStyle = '#fff'; }
      else { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, f * 0.16); ctx.strokeStyle = tc === '#2b1d1d' || th.light ? 'rgba(255,255,255,.55)' : th.textStroke; ctx.strokeText(txt, textEnd, f * 0.04); ctx.fillStyle = tc; }
      ctx.fillText(txt, textEnd, f * 0.04);
    }
    ctx.restore();
  });
  // pegs on the boundaries
  if (n > 1 && n <= 80) {
    const pr = Math.max(small ? 0.8 : 1.6, Math.min(R * 0.024, (TAU / n) * R * 0.18));
    for (let i = 0; i < n; i++) {
      const a = sp[i].start + off; const x = Math.cos(a) * R * 0.955, y = Math.sin(a) * R * 0.955;
      const g = ctx.createRadialGradient(x - pr * 0.35, y - pr * 0.35, pr * 0.1, x, y, pr);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, th.rim[1]); g.addColorStop(1, th.rim[2]);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x + pr * 0.25, y + pr * 0.3, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fill();
    }
  }
  return sp;
}

/** Small static preview (library cards). */
export function drawPreview(canvas, wheel, themeId, digits = true) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1); const W = canvas.clientWidth || 120;
  canvas.width = W * dpr; canvas.height = W * dpr; const ctx = canvas.getContext('2d');
  const th = themeOf(themeId); const R = W / 2;
  ctx.setTransform(dpr, 0, 0, dpr, R * dpr, R * dpr);
  const ring = R * 0.07;
  const g = ctx.createLinearGradient(-R, -R, R, R); th.rim.forEach((c, i) => g.addColorStop(i / (th.rim.length - 1), c));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  drawFace(ctx, R - ring, wheel, th, { small: true, digits, mystery: wheel.opts.mystery, onImg: () => drawPreview(canvas, wheel, themeId, digits) });
  gloss(ctx, R - ring);
  hub(ctx, R * 0.2, th, wheel.emoji || '🎡', true);
}

function gloss(ctx, R) {
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  let g = ctx.createRadialGradient(0, 0, R * 0.62, 0, 0, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
  ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  g = ctx.createRadialGradient(-R * 0.38, -R * 0.55, R * 0.02, -R * 0.2, -R * 0.35, R * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(0.35, 'rgba(255,255,255,.12)'); g.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  // glass sweep
  ctx.globalCompositeOperation = 'lighter';
  g = ctx.createLinearGradient(-R, -R, R * 0.2, R * 0.4); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(0.42, 'rgba(255,255,255,.07)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
}

function hub(ctx, r, th, label, small) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = r * 0.5; ctx.shadowOffsetY = r * 0.12;
  let g = ctx.createLinearGradient(-r, -r, r, r); th.rim.forEach((c, i) => g.addColorStop(i / (th.rim.length - 1), c));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent';
  g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 0.82); g.addColorStop(0, th.hub[0]); g.addColorStop(0.55, th.hub[1]); g.addColorStop(1, th.hub[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.12, -r * 0.4, r * 0.46, r * 0.22, -0.3, 0, TAU); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (small || /\p{Extended_Pictographic}/u.test(label)) { ctx.font = `${r * 0.85}px "Apple Color Emoji","Noto Color Emoji",sans-serif`; ctx.fillText(label, 0, r * 0.06); }
  else { ctx.direction = 'rtl'; ctx.font = `900 ${r * 0.36}px Vazirmatn`; ctx.fillStyle = th.light ? '#4a2a4a' : '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = r * 0.12; ctx.fillText(label, 0, r * 0.04); }
  ctx.restore();
}

function sprite(size, draw) { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(size); const x = c.getContext('2d'); x.translate(size / 2, size / 2); draw(x); return c; }

export class WheelView {
  constructor(canvas, { onTick, onSpinStart, reduced = false } = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.onTick = onTick; this.onSpinStart = onSpinStart;
    this.rotation = 0; this.plan = null; this.state = 'idle'; this.phi = 0; this.phiV = 0; this.lastIdx = -1; this.winFlash = 0;
    this.reduced = reduced; this.digits = true; this.raf = 0; this.t0 = 0; this.dragging = false; this.hubLabel = 'بچرخون';
    this.loop = this.loop.bind(this);
  }
  setWheel(wheel, themeId, { pointer = 'classic', digits = true } = {}) { this.wheel = wheel; this.themeId = themeId; this.th = themeOf(themeId); this.pointerSkin = pointer; this.digits = digits; this.invalidate(); }
  invalidate() { this.faceDirty = true; this.staticDirty = true; }
  resize() {
    const W = this.cv.clientWidth; if (!W) return false;
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    if (this.W !== W || this.dpr !== dpr) { this.W = W; this.dpr = dpr; this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(W * dpr); this.invalidate(); }
    return true;
  }
  geom() { const W = this.W; return { W, cx: W / 2, cy: W * 0.53, Ro: W * 0.45, Rf: W * 0.45 * 0.865 }; }
  buildFace() {
    const { Rf } = this.geom(); const d = this.dpr; const size = Math.ceil(2 * Rf * d) + 2;
    const c = this.face || document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    x.setTransform(d, 0, 0, d, size / 2, size / 2); x.clearRect(-size, -size, size * 2, size * 2);
    this.sp = drawFace(x, Rf, this.wheel, this.th, { mystery: this.wheel.opts.mystery, digits: this.digits, onImg: () => { this.faceDirty = true; } });
    this.face = c; this.faceDirty = false;
    this.segs = activeSegments(this.wheel);
  }
  buildStatic() {
    const { W, cx, cy, Ro, Rf } = this.geom(); const d = this.dpr; const th = this.th;
    // under-layer: soft floor shadow + rim
    const u = this.under || document.createElement('canvas'); u.width = u.height = Math.round(W * d); let x = u.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, W);
    x.save(); x.translate(cx, cy);
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = W * 0.06; x.shadowOffsetY = W * 0.025;
    let g = x.createLinearGradient(-Ro, -Ro, Ro, Ro); th.rim.forEach((c, i) => g.addColorStop(i / (th.rim.length - 1), c));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, Ro, 0, TAU); x.fill(); x.shadowColor = 'transparent';
    if (x.createConicGradient) { // brushed-metal sheen
      g = x.createConicGradient(-0.6, 0, 0); for (let k = 0; k <= 8; k++) g.addColorStop(k / 8, k % 2 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, Ro, 0, TAU); x.arc(0, 0, Rf, 0, TAU, true); x.fill();
    }
    x.lineWidth = W * 0.006; x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(0, 0, Ro - W * 0.003, Math.PI * 1.05, Math.PI * 1.75); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.arc(0, 0, Ro - W * 0.003, Math.PI * 0.05, Math.PI * 0.8); x.stroke();
    // inner lip
    x.lineWidth = W * 0.012; g = x.createLinearGradient(0, -Rf, 0, Rf); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(255,255,255,.35)');
    x.strokeStyle = g; x.beginPath(); x.arc(0, 0, Rf + W * 0.005, 0, TAU); x.stroke();
    x.restore();
    this.under = u;
    // over-layer: gloss + hub
    const o = this.over || document.createElement('canvas'); o.width = o.height = Math.round(W * d); x = o.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, W); x.translate(cx, cy);
    gloss(x, Rf); hub(x, Rf * 0.2, th, this.hubLabel, false);
    this.over = o;
    // LED sprites
    const rimW = Ro - Rf; this.ledR = rimW * 0.26; const s = rimW * 1.6;
    this.ledOn = sprite(s * d, (c) => { c.scale(d, d); const r = this.ledR; let gg = c.createRadialGradient(0, 0, 0, 0, 0, s / 2); gg.addColorStop(0, rgb(hex(th.led), 0.9)); gg.addColorStop(0.3, rgb(hex(th.led), 0.35)); gg.addColorStop(1, rgb(hex(th.led), 0)); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, s / 2, 0, TAU); c.fill(); gg = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); gg.addColorStop(0, '#fff'); gg.addColorStop(0.5, mix(th.led, 'w', 0.5)); gg.addColorStop(1, th.led); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); });
    this.ledOffS = sprite(s * d, (c) => { c.scale(d, d); const r = this.ledR; const gg = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); gg.addColorStop(0, mix(th.ledOff, 'w', 0.45)); gg.addColorStop(1, th.ledOff); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = r * 0.25; c.stroke(); });
    this.ledS = s; this.nLed = W > 330 ? 24 : 18;
    this.staticDirty = false;
  }
  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  /** Run a planned spin. Resolves with the winning span index once the wheel is at rest. */
  spin(plan) {
    this.plan = plan; this.state = 'spinning'; this.t0 = performance.now(); this.winIdx = -1;
    this.start();
    return new Promise((res) => { this.done = res; });
  }
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.resize() || !this.wheel) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    let vel = 0;
    if (this.state === 'spinning') {
      const t = (now - this.t0) / 1000;
      this.rotation = angleAt(this.plan, t); vel = velocityAt(this.plan, t) * Math.sign(this.plan.D);
      if (t >= this.plan.T) { this.rotation = this.plan.to; this.state = 'win'; this.winAt = now; this.winIdx = angleToIndex(this.sp, this.rotation); const r = this.done; this.done = null; r && r(this.winIdx); }
    } else if (this.dragging) vel = this.dragVel || 0;
    if (this.faceDirty) this.buildFace();
    if (this.staticDirty) this.buildStatic();
    // pointer vs pegs
    const sp = this.sp || []; const n = sp.length;
    if (n > 1) {
      const idx = angleToIndex(sp, this.rotation);
      if (idx !== this.lastIdx) { if (this.lastIdx !== -1 && (this.state === 'spinning' || this.dragging)) this.onTick && this.onTick(Math.min(1, Math.abs(vel) / 25)); this.lastIdx = idx; }
      const pa = pointerAngle(this.rotation); const dir = vel >= 0 ? 1 : -1;
      let push = 0;
      if (Math.abs(vel) > 0.01) {
        // nearest boundary ahead of the tip in the direction of travel
        const b = dir > 0 ? sp[idx].start : sp[idx].end; const rel = dir > 0 ? mod(pa - b) : mod(b - pa);
        const wc = Math.min(0.09, sp[idx].size * 0.12, (sp[(idx - 1 + n) % n] || sp[idx]).size * 0.12, (sp[(idx + 1) % n] || sp[idx]).size * 0.12);
        if (rel < wc) push = (1 - rel / wc) * 0.55 * Math.min(1, 0.35 + Math.abs(vel) / 6);
      }
      const target = -dir * push;
      if (push > 0 && Math.abs(target) > Math.abs(this.phi) * 0.98) { this.phi = target; this.phiV = 0; }
      else { const K = 520, C = 15; this.phiV += (-K * this.phi - C * this.phiV) * dt; this.phi += this.phiV * dt; }
      if (this.reduced) this.phi = 0;
    }
    this.draw(now, vel);
  }
  draw(now, vel) {
    const { W, cx, cy, Ro, Rf } = this.geom(); const x = this.ctx; const d = this.dpr; const th = this.th;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.cv.width, this.cv.height);
    x.drawImage(this.under, 0, 0);
    x.setTransform(d, 0, 0, d, 0, 0);
    // LEDs
    const N = this.nLed, rl = (Ro + Rf) / 2, s = this.ledS; const t = now / 1000;
    for (let i = 0; i < N; i++) {
      let on;
      if (this.reduced) on = i % 2 === 0;
      else if (this.state === 'spinning') { const ph = Math.floor(this.rotation * 3) ; on = (i + ph) % 3 === 0 || (i + ph) % 3 === 1 && Math.abs(vel) > 8; }
      else if (this.state === 'win' && now - this.winAt < 2800) on = (Math.floor((now - this.winAt) / 140) + i) % 2 === 0;
      else on = (i + Math.floor(t * 5)) % 4 !== 0;
      const a = (i / N) * TAU - Math.PI / 2 + Math.PI / N;
      x.drawImage(on ? this.ledOn : this.ledOffS, cx + Math.cos(a) * rl - s / 2, cy + Math.sin(a) * rl - s / 2, s, s);
    }
    // rotating face
    x.save(); x.translate(cx, cy); x.rotate(this.rotation);
    const fs = this.face.width / d; x.drawImage(this.face, -fs / 2, -fs / 2, fs, fs);
    if (this.state === 'win' && this.winIdx >= 0 && this.sp[this.winIdx]) {
      const spn = this.sp[this.winIdx]; const k = Math.min(1, (now - this.winAt) / 300); const pulse = 0.5 + 0.5 * Math.sin((now - this.winAt) / 180);
      x.fillStyle = `rgba(0,0,0,${0.38 * k})`; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, Rf, spn.end - Math.PI / 2, spn.start - Math.PI / 2 + TAU); x.closePath(); x.fill();
      x.strokeStyle = `rgba(255,255,255,${(0.55 + 0.45 * pulse) * k})`; x.lineWidth = W * 0.012; x.shadowColor = th.led; x.shadowBlur = W * 0.04;
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, Rf * 0.99, spn.start - Math.PI / 2, spn.end - Math.PI / 2); x.closePath(); x.stroke();
    }
    x.restore();
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.over, 0, 0); x.setTransform(d, 0, 0, d, 0, 0);
    // hub glow while idle (invites a tap)
    if (this.state !== 'spinning' && !this.reduced) { const p = 0.5 + 0.5 * Math.sin(t * 3); x.save(); x.translate(cx, cy); x.strokeStyle = rgb(hex(th.led), 0.25 + 0.35 * p); x.lineWidth = W * 0.008; x.shadowColor = th.led; x.shadowBlur = W * 0.03 * p; x.beginPath(); x.arc(0, 0, Rf * 0.2 + W * 0.008, 0, TAU); x.stroke(); x.restore(); }
    this.drawPointer(x, cx, cy - Ro - W * 0.005, W);
  }
  drawPointer(x, px, py, W) {
    const th = this.th; const L = W * 0.14, r = W * 0.05;
    x.save(); x.translate(px, py); x.rotate(this.phi);
    x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = W * 0.02; x.shadowOffsetY = W * 0.008;
    x.beginPath(); x.moveTo(-r * 0.92, r * 0.35); x.quadraticCurveTo(-r * 0.5, L * 0.6, 0, L); x.quadraticCurveTo(r * 0.5, L * 0.6, r * 0.92, r * 0.35); x.arc(0, 0, r, 0.36, Math.PI - 0.36, true); x.closePath();
    let g = x.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, mix(th.accent, 'k', 0.35)); g.addColorStop(0.45, mix(th.accent, 'w', 0.35)); g.addColorStop(0.55, th.accent); g.addColorStop(1, mix(th.accent, 'k', 0.45));
    x.fillStyle = g; x.fill(); x.shadowColor = 'transparent';
    x.lineWidth = W * 0.006; g = x.createLinearGradient(0, -r, 0, L); th.rim.forEach((c, i) => g.addColorStop(i / (th.rim.length - 1), c)); x.strokeStyle = g; x.stroke();
    // pivot cap
    g = x.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.05, 0, 0, r * 0.62); g.addColorStop(0, '#fff'); g.addColorStop(0.5, th.rim[1]); g.addColorStop(1, th.rim[2]);
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r * 0.58, 0, TAU); x.fill();
    if (this.pointerSkin && this.pointerSkin !== 'classic') { const em = { gavel: '⚖️', paw: '🐾', crown: '👑', diamond: '💎' }[this.pointerSkin]; if (em) { x.font = `${r * 0.8}px "Apple Color Emoji","Noto Color Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(em, 0, r * 0.04); } }
    x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(-r * 0.3, L * 0.25, r * 0.12, L * 0.18, 0.15, 0, TAU); x.fill();
    x.restore();
  }
  /** Is a client point on the hub / on the face? */
  hit(clientX, clientY) {
    const b = this.cv.getBoundingClientRect(); const { cx, cy, Rf } = this.geom();
    const dx = clientX - b.left - cx, dy = clientY - b.top - cy; const dd = Math.hypot(dx, dy);
    return dd < Rf * 0.22 ? 'hub' : dd < Rf * 1.05 ? 'face' : null;
  }
  center() { const b = this.cv.getBoundingClientRect(); const { cx, cy } = this.geom(); return { x: b.left + cx, y: b.top + cy }; }
}
