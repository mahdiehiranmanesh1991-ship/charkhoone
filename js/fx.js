// Sound (WebAudio synthesis — no audio files), haptics and confetti/fireworks for «چرخونه».
let ac = null, master = null, noiseBuf = null;
export const audio = { enabled: true };
export function unlockAudio() {
  if (!audio.enabled) return;
  try {
    if (!ac) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.55;
      const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  } catch { /* no audio */ }
}
const ok = () => audio.enabled && ac && ac.state === 'running';
function tone(freq, t, dur, type = 'sine', vol = 0.3, slide = 0) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
let lastTick = 0;
/** Peg click; intensity 0..1 from wheel speed. */
export function tick(intensity = 0.5) {
  if (!ok()) return; const t = ac.currentTime; if (t - lastTick < 0.028) return; lastTick = t;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + 1400 * intensity; f.Q.value = 3;
  const g = ac.createGain(); g.gain.setValueAtTime(0.5 * (0.45 + 0.55 * intensity), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.2, 0.04);
  tone(1800 + 500 * intensity, t, 0.025, 'triangle', 0.08);
}
export function whoosh() {
  if (!ok()) return; const t = ac.currentTime; const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 0.5);
}
export function fanfare() {
  if (!ok()) return; const t = ac.currentTime; const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, i) => { tone(n, t + i * 0.09, 0.32, 'triangle', 0.22); tone(n * 2, t + i * 0.09, 0.2, 'sine', 0.05); });
  [1046.5, 1318.5, 1568].forEach((n) => tone(n, t + 0.4, 0.9, 'sine', 0.12));
  for (let i = 0; i < 8; i++) tone(2600 + Math.random() * 2400, t + 0.45 + i * 0.06, 0.12, 'sine', 0.04); // sparkle
}
export function coinSound() { if (!ok()) return; const t = ac.currentTime; tone(988, t, 0.09, 'square', 0.08); tone(1319, t + 0.08, 0.35, 'square', 0.08); }
export function softFail() { if (!ok()) return; const t = ac.currentTime; tone(330, t, 0.25, 'triangle', 0.18, 0.7); tone(247, t + 0.18, 0.35, 'triangle', 0.15, 0.8); }
export function pop() { if (!ok()) return; const t = ac.currentTime; tone(600, t, 0.08, 'sine', 0.15, 1.8); }
export function diceRattle() { if (!ok()) return; const t = ac.currentTime; for (let i = 0; i < 9; i++) { const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1500; f.Q.value = 6; const g = ac.createGain(); const tt = t + i * 0.055 + Math.random() * 0.02; g.gain.setValueAtTime(0.35, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05); s.connect(f).connect(g).connect(master); s.start(tt, Math.random() * 0.2, 0.06); } }

// ---------- haptics ----------
// Android: navigator.vibrate. iOS Safari has no Vibration API; iOS 18+ gives a light system haptic when a
// <input type=checkbox switch> is toggled through its label, so we use that as a best-effort fallback.
let sw = null;
export const haptics = { enabled: true };
export function buzz(pattern = 12) {
  if (!haptics.enabled) return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); return; } catch { /* ignore */ } }
  try {
    if (!sw) { sw = document.createElement('label'); sw.setAttribute('aria-hidden', 'true'); sw.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; sw.appendChild(i); document.body.appendChild(sw); }
    sw.click();
  } catch { /* ignore */ }
}

// ---------- confetti + fireworks ----------
let fxCanvas = null, parts = [], fxRaf = 0;
export function celebrate(colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ffffff'], { fireworks = true, reduced = false } = {}) {
  if (reduced) return;
  if (!fxCanvas) { fxCanvas = document.createElement('canvas'); fxCanvas.className = 'fx-canvas'; fxCanvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(fxCanvas); }
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1); fxCanvas.width = W * d; fxCanvas.height = H * d;
  const rnd = Math.random;
  for (let i = 0; i < 170; i++) { // confetti cannons from both bottom corners
    const left = i % 2 === 0; const a = (left ? -Math.PI / 2 + 0.25 + rnd() * 0.55 : -Math.PI / 2 - 0.25 - rnd() * 0.55); const v = 9 + rnd() * 11;
    parts.push({ k: 'c', x: left ? 0 : W, y: H * 0.92, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd() * TAU0, vr: (rnd() - 0.5) * 0.4, w: 6 + rnd() * 6, h: 9 + rnd() * 8, c: colors[i % colors.length], life: 1, flip: rnd() * TAU0 });
  }
  if (fireworks) for (let b = 0; b < 3; b++) parts.push({ k: 'rocket', x: W * (0.2 + 0.3 * b + rnd() * 0.1), y: H, vx: (rnd() - 0.5) * 1.5, vy: -(12 + rnd() * 3), t: 30 + b * 9, c: colors[b % colors.length] });
  if (!fxRaf) fxRaf = requestAnimationFrame(fxLoop);
}
const TAU0 = Math.PI * 2;
function fxLoop() {
  const x = fxCanvas.getContext('2d'); const d = fxCanvas.width / innerWidth; x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
  const next = [];
  for (const p of parts) {
    if (p.k === 'c') {
      p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.flip += 0.18; if (p.vy > 2) p.life -= 0.006;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(Math.cos(p.flip), 1); x.globalAlpha = Math.max(0, p.life); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
      if (p.y < innerHeight + 30 && p.life > 0) next.push(p);
    } else if (p.k === 'rocket') {
      p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.t--;
      x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x, p.y, 2.5, 0, TAU0); x.fill();
      if (p.t <= 0) { for (let i = 0; i < 60; i++) { const a = (i / 60) * TAU0, v = 2 + Math.random() * 4.5; next.push({ k: 's', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: i % 3 ? p.c : '#fff', life: 1 }); } } else next.push(p);
    } else {
      p.vy += 0.07; p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx; p.y += p.vy; p.life -= 0.014;
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.max(0, p.life); x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, 2.2, 0, TAU0); x.fill(); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      if (p.life > 0) next.push(p);
    }
  }
  parts = next;
  if (parts.length) fxRaf = requestAnimationFrame(fxLoop); else { fxRaf = 0; x.clearRect(0, 0, innerWidth, innerHeight); }
}
