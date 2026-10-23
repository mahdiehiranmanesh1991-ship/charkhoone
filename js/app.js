// «چرخونه» — UI controller. Vanilla ES modules, no network, everything local.
import { makeWheel, makeSegment, activeSegments, spans, pickWinner, planSpin, gestureVelocity, recordResult, labelOf, resetElimination, historyStats, duplicateWheel, parseItems, angleToIndex, TAU, MAX_SEGMENTS } from './wheel.js';
import { randInt, weightedIndex, shuffle } from './rng.js';
import { faDigits, esc, jalali, relTime, encodeShare, decodeShare, exportData, importData } from './util.js';
import { THEMES, THEME_IDS, themeOf, POINTERS } from './themes.js';
import { TEMPLATES, templateById, buildTemplate } from './templates.js';
import { CHALLENGES, challengeTotal, itemKey } from './challenges.js';
import { ACHIEVEMENTS, onSpin, answer, earned, buyPointer, checkAch } from './game.js';
import { load, save, sampleWheels, challengeWheel } from './store.js';
import { drawPreview, WheelView } from './renderer.js';
import * as fx from './fx.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const st = load();
const S = st.settings, G = st.game;
let cur = null; // wheel on the spin screen
let busy = false;
const fmt = (v) => (S.faDigits ? faDigits(v) : String(v));
const reduced = () => S.motion === 'reduce' || (S.motion === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches);
let saveT = 0;
function persist(now = false) {
  clearTimeout(saveT);
  const go = () => { if (!save(st)) toast('حافظه‌ی مرورگر پر است — عکس‌های بزرگ را کم کنید', 'warn'); };
  if (now) go(); else saveT = setTimeout(go, 250);
}
addEventListener('pagehide', () => persist(true));
const themeIdOf = (w) => (w && w.theme && THEMES[w.theme] ? w.theme : S.theme);
function applySettings() { fx.audio.enabled = S.sound; fx.haptics.enabled = S.haptics; document.documentElement.classList.toggle('reduced', reduced()); }

// ---------- page theme ----------
function setPageTheme(id) {
  const th = themeOf(id); const b = document.body; b.dataset.theme = id;
  b.style.setProperty('--bg1', th.bg[0]); b.style.setProperty('--bg2', th.bg[1]); b.style.setProperty('--accent', th.accent); b.style.setProperty('--led', th.led);
  b.classList.toggle('light', !!th.light);
  $('meta[name=theme-color]').content = th.bg[1];
}

// ---------- toasts / sheets ----------
function toast(html, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = html; $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
}
let sheetClose = null;
function openSheet(html, { onClose, cls = '' } = {}) {
  const w = $('#sheet'), b = $('#sheetBody'); b.className = 'sheet ' + cls; b.innerHTML = `<div class="grab"></div>${html}`; w.hidden = false;
  requestAnimationFrame(() => w.classList.add('open')); sheetClose = onClose || null; return b;
}
function closeSheet() { const w = $('#sheet'); w.classList.remove('open'); setTimeout(() => { if (!w.classList.contains('open')) { w.hidden = true; $('#sheetBody').innerHTML = ''; } }, 260); const f = sheetClose; sheetClose = null; f && f(); }
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet(); });
function confirmBox(msg, yes = 'بله', danger = true) {
  return new Promise((res) => {
    const b = openSheet(`<p class="confirm-msg">${msg}</p><div class="row2"><button class="btn ${danger ? 'danger' : 'primary'}" data-y data-testid="confirm-yes">${yes}</button><button class="btn ghost" data-n>انصراف</button></div>`, { onClose: () => res(false) });
    b.querySelector('[data-y]').onclick = () => { sheetClose = null; closeSheet(); res(true); };
    b.querySelector('[data-n]').onclick = () => { sheetClose = null; closeSheet(); res(false); };
  });
}

// ---------- navigation ----------
const TOP = ['scr-lib', 'scr-tools', 'scr-ch', 'scr-set'];
const stack = ['scr-lib'];
function show(id, push = true) {
  const prev = stack[stack.length - 1];
  if (TOP.includes(id)) { stack.length = 0; stack.push(id); } else if (push) stack.push(id);
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  $$('#tabbar [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  $('#tabbar').classList.toggle('hide', !TOP.includes(id));
  if (id !== 'scr-spin') { view.stop(); }
  if (id === 'scr-spin' || id === 'scr-edit') setPageTheme(themeIdOf(cur)); else setPageTheme(S.theme);
  if (id === 'scr-lib') renderLib();
  if (id === 'scr-tools') renderTools();
  if (id === 'scr-ch') renderChallenges();
  if (id === 'scr-set') renderSettings();
  if (id === 'scr-tpl') renderTemplates();
  if (id === 'scr-spin') { view.start(); }
  if (prev !== id) $('#' + id).scrollTop = 0;
}
function back() { if (stack.length > 1) { stack.pop(); const id = stack[stack.length - 1]; show(id, false); } else show('scr-lib'); }
$$('[data-back]').forEach((b) => b.addEventListener('click', back));
$$('#tabbar [data-tab]').forEach((b) => b.addEventListener('click', () => { fx.pop(); show(b.dataset.tab); }));

// ---------- library ----------
let filter = { tag: 'all', q: '' };
function greeting() {
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  const g = h < 5 ? ['شب بخیر', '🌙'] : h < 12 ? ['صبح بخیر', '☀️'] : h < 17 ? ['ظهر بخیر', '🌤️'] : h < 20 ? ['عصر بخیر', '🌇'] : ['شب بخیر', '🌙'];
  return `${g[0]} ${esc(S.name || '')}${S.name ? ' جان' : ''} ${g[1]}`;
}
function allTags() { const t = new Set(S.tags || []); st.wheels.forEach((w) => w.tags.forEach((x) => t.add(x))); return [...t]; }
function renderHeader() {
  $('#greet').innerHTML = S.greet ? greeting() : 'گردونه‌ی شانس، تاس و انتخاب منصفانه';
  $('#coinPill b').textContent = fmt(G.coins); $('#streakPill b').textContent = fmt(G.streak || 0);
}
function renderLib() {
  renderHeader();
  const tags = allTags();
  const chip = (id, label, n) => `<button class="chip ${filter.tag === id ? 'on' : ''}" data-tag="${esc(id)}">${label}${n != null ? ` <small>${fmt(n)}</small>` : ''}</button>`;
  $('#tagChips').innerHTML = chip('all', 'همه', st.wheels.length) + chip('fav', '⭐ محبوب‌ها') + tags.map((t) => chip(t, '#' + esc(t), st.wheels.filter((w) => w.tags.includes(t)).length)).join('') + chip('none', 'بدون برچسب') + '<button class="chip add" data-addtag>＋ برچسب</button>';
  const q = filter.q.trim().toLowerCase();
  let list = st.wheels.filter((w) => {
    if (filter.tag === 'fav' && !w.fav) return false;
    if (filter.tag === 'none' && w.tags.length) return false;
    if (!['all', 'fav', 'none'].includes(filter.tag) && !w.tags.includes(filter.tag)) return false;
    if (q && !(w.name.toLowerCase().includes(q) || w.tags.some((t) => t.toLowerCase().includes(q)) || w.segments.some((s) => s.text.toLowerCase().includes(q)))) return false;
    return true;
  });
  list = list.sort((a, b) => (b.fav - a.fav) || ((b.lastUsed || b.updatedAt) - (a.lastUsed || a.updatedAt)));
  $('#emptyLib').hidden = list.length > 0;
  $('#cards').innerHTML = list.map(cardHTML).join('');
  requestAnimationFrame(() => $$('#cards canvas.prev').forEach((c) => { const w = st.wheels.find((x) => x.id === c.dataset.id); if (w) drawPreview(c, w, themeIdOf(w), S.faDigits); }));
}
function cardHTML(w) {
  const special = w.special && CHALLENGES[w.special];
  let extra = '';
  if (special) {
    const c = CHALLENGES[w.special]; const e = earned(G, c.id, c.reward), tot = challengeTotal(c.id); const pct = Math.round((100 * e) / tot);
    extra = `<div class="prog" data-testid="ch-progress"><div class="prog-top"><b>${fmt(e)} / ${fmt(tot)}</b> سکه گرفته شده <span>${fmt(pct)}٪</span></div><div class="bar"><i style="width:${Math.max(3, pct)}%"></i></div></div>`;
  }
  const n = activeSegments(w).length;
  return `<article class="card ${special ? 'special' : ''} ${w.fav ? 'fav' : ''}" data-id="${w.id}" data-testid="card">
    <div class="card-main" data-open>
      <h3><span class="c-emoji">${esc(w.emoji)}</span><span class="c-name">${esc(w.name)}</span></h3>
      <div class="meta"><span>🔄 ${fmt(w.spins)} چرخش</span><span>🕒 ${esc(relTime(w.lastUsed))}</span></div>
      <div class="meta sub"><span>🧩 ${fmt(n)} خانه</span>${w.tags.slice(0, 3).map((t) => `<span class="tg">#${esc(t)}</span>`).join('')}</div>
      ${extra}
      <div class="card-actions">
        <button class="mini" data-act="menu" aria-label="بیشتر">⋯</button>
        <button class="mini" data-act="share" aria-label="اشتراک">🔗</button>
        <button class="mini" data-act="edit" aria-label="ویرایش">⚙️</button>
        <button class="mini star ${w.fav ? 'on' : ''}" data-act="fav" aria-label="محبوب" data-testid="fav">${w.fav ? '★' : '☆'}</button>
      </div>
    </div>
    <div class="prev-wrap" data-open><canvas class="prev" data-id="${w.id}"></canvas></div>
  </article>`;
}
$('#cards').addEventListener('click', (e) => {
  const card = e.target.closest('.card'); if (!card) return; const w = st.wheels.find((x) => x.id === card.dataset.id); if (!w) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'fav') { w.fav = !w.fav; persist(); fx.pop(); renderLib(); return; }
  if (act === 'share') return shareWheel(w);
  if (act === 'edit') { cur = w; openEditor(); return; }
  if (act === 'menu') return cardMenu(w);
  if (e.target.closest('[data-open]')) openWheel(w);
});
$('#tagChips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.hasAttribute('data-addtag')) {
    const sh = openSheet(`<h3>برچسب تازه</h3><input class="inp" id="newTag" maxlength="24" placeholder="مثلاً: دورهمی، دفتر، گربه‌ها"><button class="btn primary wide" id="okTag">افزودن</button>`);
    const inp = sh.querySelector('#newTag'); setTimeout(() => inp.focus(), 50);
    sh.querySelector('#okTag').onclick = () => { const t = inp.value.trim(); if (t) { S.tags = [...new Set([...(S.tags || []), t])]; persist(); filter.tag = t; } closeSheet(); renderLib(); };
    return;
  }
  filter.tag = b.dataset.tag; renderLib();
});
$('#search').addEventListener('input', (e) => { filter.q = e.target.value; renderLib(); });
function cardMenu(w) {
  const sh = openSheet(`<h3>${esc(w.emoji)} ${esc(w.name)}</h3><div class="menu">
    <button data-m="open">🎡 چرخاندن</button><button data-m="edit">✏️ ویرایش</button><button data-m="dup" data-testid="dup">📄 تکثیر</button>
    <button data-m="share">🔗 اشتراک‌گذاری</button><button data-m="stats">📊 آمار و تاریخچه</button><button data-m="json">💾 فایل JSON همین گردونه</button>
    <button data-m="del" class="danger" data-testid="delete">🗑 حذف</button></div>`);
  sh.onclick = async (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return; closeSheet();
    if (m === 'open') openWheel(w);
    if (m === 'edit') { cur = w; openEditor(); }
    if (m === 'dup') { const c = duplicateWheel(w); st.wheels.unshift(c); persist(); renderLib(); toast('📄 کپی ساخته شد'); }
    if (m === 'share') shareWheel(w);
    if (m === 'stats') { cur = w; openStats(); }
    if (m === 'json') download(`${w.name}.charkhoone.json`, { app: 'charkhoone', v: 1, wheels: [w] });
    if (m === 'del') { if (await confirmBox(`«${esc(w.name)}» حذف شود؟ این کار برگشت ندارد.`, 'حذف کن')) { st.wheels = st.wheels.filter((x) => x !== w); persist(); renderLib(); toast('🗑 حذف شد'); } }
  };
}
$('#fabNew').addEventListener('click', () => {
  const w = makeWheel({ name: 'گردونه‌ی تازه', emoji: '✨', segments: ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'].map((t) => makeSegment({ text: t })) });
  st.wheels.unshift(w); G.made++; achToasts(checkAch(G)); persist(); cur = w; openEditor(true);
});

// ---------- quick wheel ----------
$('#btnQuick').addEventListener('click', () => {
  const sh = openSheet(`<h3>⚡ چرخونه‌ی سریع</h3><p class="muted">هر خط یک گزینه (یا با «،» جدا کن). <b>متن*۳</b> یعنی سه برابر شانس.</p>
    <textarea class="inp area" id="qText" rows="6" placeholder="پیتزا\nکباب\nقورمه‌سبزی*2" data-testid="quick-text"></textarea>
    <div class="chips tight"><button class="chip" data-ex="شیر، خط">🪙 شیر یا خط</button><button class="chip" data-ex="بله، نه، شاید">🤔 بله/نه</button><button class="chip" data-ex="راست، چپ، مستقیم">🚗 مسیر</button><button class="chip" data-ex="🐱 پیشی، 🍲 غذا، 🎮 بازی، 📚 درس">🎯 کار بعدی</button></div>
    <label class="check"><input type="checkbox" id="qSave" checked> در کتابخانه ذخیره شود</label>
    <button class="btn primary wide big" id="qGo" data-testid="quick-go">🎡 بساز و بچرخون</button>`, { cls: 'tall' });
  const ta = sh.querySelector('#qText'); setTimeout(() => ta.focus(), 60);
  sh.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => { ta.value = b.dataset.ex; }));
  sh.querySelector('#qGo').onclick = () => {
    const segs = parseItems(ta.value); if (segs.length < 1) { toast('اول چند گزینه بنویس ✍️', 'warn'); return; }
    const w = makeWheel({ name: segs.slice(0, 3).map((s) => s.text).join('، ') + (segs.length > 3 ? '…' : ''), emoji: '⚡', tags: ['سریع'], segments: segs });
    if (sh.querySelector('#qSave').checked) { st.wheels.unshift(w); persist(); } else w.temp = true;
    closeSheet(); openWheel(w);
  };
});

// ---------- templates ----------
$('#btnTpl').addEventListener('click', () => show('scr-tpl'));
function renderTemplates() {
  $('#tplGrid').innerHTML = TEMPLATES.map((t) => `<button class="tpl" data-t="${t.id}" data-testid="tpl-${t.id}"><canvas class="tprev" data-t="${t.id}"></canvas><b>${t.emoji} ${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('');
  requestAnimationFrame(() => $$('#tplGrid canvas').forEach((c) => { const b = buildTemplate(c.dataset.t); const w = makeWheel(b); drawPreview(c, w, b.theme || S.theme, S.faDigits); }));
}
$('#tplGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]'); if (!b) return; const t = templateById(b.dataset.t);
  const make = (params) => { const built = buildTemplate(t.id, params); const w = makeWheel({ ...built }); st.wheels.unshift(w); G.made++; achToasts(checkAch(G)); persist(); openWheel(w, true); };
  if (!t.params) return make({});
  const sh = openSheet(`<h3>${t.emoji} ${esc(t.name)}</h3><p class="muted">${esc(t.desc)}</p><div class="params">${t.params.map((p) => `<label>${esc(p.label)}<input class="inp" type="number" inputmode="decimal" data-k="${p.k}" value="${p.def}" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} step="any"></label>`).join('')}</div><button class="btn primary wide big" id="tGo" data-testid="tpl-go">بساز ✨</button>`);
  sh.querySelector('#tGo').onclick = () => { const params = {}; sh.querySelectorAll('[data-k]').forEach((i) => { params[i.dataset.k] = +String(i.value).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }); closeSheet(); make(params); };
});

// ---------- spin screen ----------
const canvas = $('#wheel');
const view = new WheelView(canvas, {
  reduced: reduced(),
  onTick: (k) => { if (cur && cur.opts.sound) fx.tick(k); if (navigator.vibrate && S.haptics) try { navigator.vibrate(3); } catch { /* */ } },
});
function openWheel(w, fromTpl = false) {
  cur = w; view.reduced = reduced(); view.state = 'idle'; view.phi = 0;
  view.setWheel(w, themeIdOf(w), { pointer: G.pointer, digits: S.faDigits });
  view.hubLabel = 'بچرخون';
  if (!G.themes.includes(themeIdOf(w))) { G.themes.push(themeIdOf(w)); achToasts(checkAch(G)); persist(); }
  renderSpin(); show('scr-spin');
  if (fromTpl) toast(`${esc(w.emoji)} «${esc(w.name)}» ساخته شد`);
}
function renderSpin() {
  const w = cur; $('#spinTitle').innerHTML = `<span>${esc(w.emoji)}</span> ${esc(w.name)}`;
  const act = activeSegments(w).length, out = w.segments.filter((s) => s.out).length;
  const sp = w.special ? CHALLENGES[w.special] : null;
  $('#spinSub').innerHTML = sp ? `<span class="pill coin">🪙 ${fmt(earned(G, sp.id, sp.reward))} / ${fmt(challengeTotal(sp.id))}</span> <span class="muted">${esc(sp.intro)}</span>` : `<span class="muted">${fmt(act)} خانه${out ? ` · ${fmt(out)} حذف‌شده` : ''} · ${fmt(w.spins)} چرخش</span>`;
  const o = w.opts;
  $('#spinToggles').innerHTML = w.special ? '' : `
    <button class="tog ${o.sound ? 'on' : ''}" data-o="sound">${o.sound ? '🔊' : '🔇'} صدا</button>
    <button class="tog ${o.elim ? 'on' : ''}" data-o="elim" data-testid="tog-elim">🚫 حذف برنده</button>
    <button class="tog ${o.mystery ? 'on' : ''}" data-o="mystery">🙈 مخفی</button>
    <span class="tog step"><button data-w="-1" aria-label="کمتر">−</button>🏆 ${fmt(o.winners)} برنده<button data-w="1" aria-label="بیشتر">+</button></span>
    ${out ? `<button class="tog warn" data-reset data-testid="reset-elim">↺ برگرداندن ${fmt(out)} گزینه</button>` : ''}`;
  renderLast();
}
function renderLast() {
  const h = cur.history.slice(-8).reverse();
  $('#lastResults').innerHTML = h.length ? `<div class="last-h">آخرین نتیجه‌ها</div><div class="last-list">${h.map((r) => `<span class="lr">${esc(fmtLabel(r.txt.join('، ')))}<small>${esc(relTime(r.t))}</small></span>`).join('')}</div>` : '';
}
const fmtLabel = (s) => (S.faDigits ? faDigits(s) : s);
$('#spinToggles').addEventListener('click', (e) => {
  const o = cur.opts; const b = e.target.closest('[data-o]');
  if (b) { o[b.dataset.o] = !o[b.dataset.o]; if (b.dataset.o === 'mystery') view.invalidate(); fx.pop(); }
  const wb = e.target.closest('[data-w]'); if (wb) { o.winners = Math.max(1, Math.min(Math.max(1, activeSegments(cur).length), o.winners + +wb.dataset.w)); }
  if (e.target.closest('[data-reset]')) { resetElimination(cur); view.state = 'idle'; view.invalidate(); toast('↺ همه‌ی گزینه‌ها برگشتند'); }
  persist(); renderSpin();
});
$('#btnEdit').addEventListener('click', () => openEditor());
$('#btnStats').addEventListener('click', () => openStats());
$('#btnSpin').addEventListener('click', () => spin(null));

// gestures: drag the wheel and flick it; tap the hub to spin
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  fx.unlockAudio(); if (busy) return; const h = view.hit(e.clientX, e.clientY); if (!h) return;
  canvas.setPointerCapture(e.pointerId); const c = view.center();
  drag = { id: e.pointerId, hub: h === 'hub', c, a: Math.atan2(e.clientY - c.y, e.clientX - c.x), moved: 0, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
  view.state = 'idle'; view.dragging = true; view.dragVel = 0; view.start();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const a = Math.atan2(e.clientY - drag.c.y, e.clientX - drag.c.x); let dA = a - drag.a; if (dA > Math.PI) dA -= TAU; if (dA < -Math.PI) dA += TAU;
  drag.a = a; drag.moved += Math.abs(dA); view.rotation += dA;
  drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (drag.samples.length > 12) drag.samples.shift();
  view.dragVel = gestureVelocity(drag.samples, drag.c.x, drag.c.y);
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; view.dragging = false;
  d.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
  const v = e.timeStamp - d.samples[d.samples.length - 2].t > 120 ? 0 : gestureVelocity(d.samples, d.c.x, d.c.y);
  if (Math.abs(v) > 2.2) spin(Math.max(-40, Math.min(40, v)));
  else if (d.moved < 0.06) spin(null);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; view.dragging = false; } });
canvas.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(null); } });

async function spin(v0) {
  fx.unlockAudio();
  if (busy || !cur) return;
  const w = cur; const segs = activeSegments(w);
  if (!segs.length) { const out = w.segments.some((s) => s.out); toast(out ? 'همه حذف شدند — «برگرداندن» را بزن ↺' : 'هیچ گزینه‌ی فعالی نیست', 'warn'); return; }
  busy = true; document.body.classList.add('spinning'); $('#btnSpin').disabled = true;
  if (view.faceDirty) view.buildFace();
  const sp = spans(segs); const winner = pickWinner(sp);
  const plan = planSpin({ sp, rotation: view.rotation, winner, v0, duration: w.opts.duration, reduced: reduced() });
  if (w.opts.sound) fx.whoosh(); fx.buzz(18);
  const idx = await view.spin(plan);
  // the pointer is the single source of truth for the displayed result
  const first = segs[idx];
  const winners = [first];
  if (w.opts.winners > 1 && !w.special) {
    const rest = segs.filter((s) => s !== first);
    while (winners.length < w.opts.winners && rest.length) { const k = weightedIndex(rest.map((s) => s.weight)); winners.push(rest.splice(k, 1)[0]); }
  }
  const extra = {}; if (first.pool && first.pool.length) extra.prompt = first.pool[randInt(first.pool.length)];
  const rec = recordResult(w, winners.map((s) => s.id), Date.now(), extra);
  if (w.temp && !st.wheels.includes(w)) { /* temporary quick wheel: not saved */ }
  const ev = onSpin(G);
  if (w.opts.elim && !activeSegments(w).length) { G.elimDone++; ev.push(...checkAch(G).map((a) => ({ type: 'ach', ach: a }))); }
  persist();
  window.__lastSpin = { winner, idx, pointerIdx: angleToIndex(view.sp, view.rotation), label: labelOf(first), id: first.id };
  if (w.opts.sound) fx.fanfare(); fx.buzz([30, 40, 60]);
  if (w.opts.confetti) fx.celebrate([...themeOf(themeIdOf(w)).palette.slice(0, 4), '#ffffff', themeOf(themeIdOf(w)).led], { reduced: reduced() });
  busy = false; document.body.classList.remove('spinning'); $('#btnSpin').disabled = false;
  if (w.special) showQuestion(w, first);
  else showReveal(w, winners, rec);
  setTimeout(() => { for (const e of ev) { if (e.type === 'daily') toast(`🔥 روز ${fmt(e.streak)} پشت سر هم! <b>+${fmt(e.coins)} 🪙</b>`, 'gold'); if (e.type === 'ach') achToast(e.ach); } renderHeader(); }, 900);
  renderSpin();
}
function achToast(a) { fx.coinSound(); toast(`🏆 دستاورد تازه: <b>${a.emoji} ${esc(a.name)}</b> +${fmt(a.coins)} 🪙`, 'gold'); }
function achToasts(list) { list.forEach(achToast); }

// ---------- reveal ----------
function closeReveal() { const r = $('#reveal'); r.classList.remove('open'); setTimeout(() => { r.hidden = true; }, 250); if (cur && cur.opts.elim) { view.state = 'idle'; view.invalidate(); } }
$('#reveal').addEventListener('click', (e) => { if (e.target.id === 'reveal') closeReveal(); });
function openReveal(html, color) {
  const r = $('#reveal'); $('#revealCard').innerHTML = html; $('#revealCard').style.setProperty('--win', color || 'var(--accent)'); r.hidden = false; requestAnimationFrame(() => r.classList.add('open'));
}
function showReveal(w, winners, rec) {
  const th = themeOf(themeIdOf(w)); const segsAll = activeSegments(w); const first = winners[0];
  const i = w.segments.indexOf(first); const color = first.color || th.palette[Math.max(0, i) % th.palette.length];
  const multi = winners.length > 1;
  const body = multi
    ? `<div class="r-kicker">${fmt(winners.length)} برنده 🏆</div><ol class="r-list" data-testid="reveal-list">${winners.map((s, k) => `<li><span class="rk">${fmt(k + 1)}</span>${s.img ? `<img src="${s.img}" alt="">` : ''}<b>${esc(fmtLabel(labelOf(s)))}</b></li>`).join('')}</ol>`
    : `<div class="r-kicker">${w.opts.mystery ? 'رمز گشایی شد! 🙈' : 'نتیجه'}</div>${first.img ? `<img class="r-img" src="${first.img}" alt="">` : first.emoji ? `<div class="r-emoji">${esc(first.emoji)}</div>` : ''}<div class="r-label" data-testid="reveal-label">${esc(fmtLabel(first.text || labelOf(first)))}</div>${rec.prompt ? `<div class="r-prompt" data-testid="reveal-prompt">${esc(rec.prompt)}</div>` : ''}`;
  openReveal(`${body}<div class="r-actions"><button class="btn primary" data-r="again" data-testid="again">🔄 دوباره</button>${!w.opts.elim && segsAll.length > 1 ? '<button class="btn ghost" data-r="remove">🚫 حذفش کن</button>' : ''}<button class="btn ghost" data-r="ok" data-testid="reveal-ok">باشه</button></div>`, color);
  $('#revealCard').onclick = (e) => {
    const r = e.target.closest('[data-r]')?.dataset.r; if (!r) return;
    if (r === 'remove') { winners.forEach((s) => { s.out = true; }); persist(); renderSpin(); toast('🚫 از این دور حذف شد'); }
    closeReveal(); if (r === 'again') setTimeout(() => spin(null), 280);
  };
}

// ---------- challenge questions ----------
function showQuestion(w, seg) {
  const c = CHALLENGES[w.special]; const ci = c.cats.findIndex((x) => x.name === seg.text); const cat = c.cats[Math.max(0, ci)];
  const solved = G.solved[c.id] || {};
  const pool = cat.items.map((it, i) => i).filter((i) => !solved[itemKey(ci, i)]);
  const allDone = !pool.length; const i = allDone ? randInt(cat.items.length) : pool[randInt(pool.length)];
  const it = cat.items[i]; const opts = shuffle([it.a, ...it.w]);
  const isEmoji = c.id === 'emoji';
  openReveal(`<div class="r-kicker">${esc(cat.emoji)} ${esc(cat.name)}</div><div class="${isEmoji ? 'q-emoji' : 'q-text'}" data-testid="question">${esc(it.q)}</div>
    <div class="q-opts">${opts.map((o) => `<button class="q-opt" data-a="${esc(o)}">${esc(fmtLabel(o))}</button>`).join('')}</div>
    <div class="q-foot" id="qFoot">${allDone ? '<span class="muted">این دسته را کامل کرده‌ای؛ این دور سکه ندارد 😎</span>' : `<span class="muted">جواب درست: <b>+${fmt(c.reward)} 🪙</b></span>`}</div>`, themeOf(c.theme).accent);
  $('#revealCard').onclick = (e) => {
    const b = e.target.closest('.q-opt');
    if (b && !b.closest('.answered')) {
      const ok = b.dataset.a === it.a; $('.q-opts').classList.add('answered');
      $$('.q-opt').forEach((x) => { if (x.dataset.a === it.a) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const res = answer(G, c.id, itemKey(ci, i), ok, c.reward, challengeTotal(c.id)); persist();
      if (ok) { fx.coinSound(); fx.buzz(20); if (!reduced()) fx.celebrate(themeOf(c.theme).palette, { fireworks: false }); } else { fx.softFail(); fx.buzz([40, 30, 40]); }
      $('#qFoot').innerHTML = `${ok ? `<b class="ok">آفرین! ${res.coins ? `+${fmt(res.coins)} 🪙` : ''}</b>` : `<b class="no">نه! جواب: ${esc(fmtLabel(it.a))}</b>`}${it.src ? `<div class="src">📖 ${esc(fmtLabel(it.src))}</div>` : ''}<div class="r-actions"><button class="btn primary" data-r="again">🎡 سؤال بعدی</button><button class="btn ghost" data-r="ok">بستن</button></div>`;
      (res.ach || []).forEach(achToast); renderHeader(); renderSpin();
      return;
    }
    const r = e.target.closest('[data-r]')?.dataset.r; if (!r) return; closeReveal(); if (r === 'again') setTimeout(() => spin(null), 280);
  };
}

// ---------- stats ----------
function openStats() {
  const w = cur; const s = historyStats(w); const max = Math.max(0.0001, ...s.rows.map((r) => Math.max(r.pct, r.expected)));
  const rows = s.rows.filter((r) => r.n || r.expected).slice(0, 40);
  const th = themeOf(themeIdOf(w));
  openSheet(`<h3>📊 آمار «${esc(w.name)}»</h3>
    <div class="stat-top"><div><b>${fmt(w.spins)}</b><small>کل چرخش‌ها</small></div><div><b>${fmt(s.total)}</b><small>برنده‌ها</small></div><div><b>${esc(w.lastUsed ? jalali(w.lastUsed, { day: 'numeric', month: 'short' }) : '—')}</b><small>آخرین بار</small></div></div>
    ${s.total ? `<p class="muted">میله = درصد واقعی برد · خط سفید = شانس مورد انتظار (از روی وزن). با چرخش‌های بیشتر به هم نزدیک می‌شوند.</p>
    <div class="chart" data-testid="chart">${rows.map((r, i) => `<div class="crow"><span class="cl">${esc(fmtLabel(r.label))}</span><span class="cb"><i style="width:${(100 * r.pct) / max}%;background:${r.color || th.palette[i % th.palette.length]}"></i><em style="right:${(100 * r.expected) / max}%"></em></span><span class="cn">${fmt(r.n)}</span></div>`).join('')}</div>
    <h4>تاریخچه</h4><ul class="hist">${w.history.slice(-40).reverse().map((h) => `<li><b>${esc(fmtLabel(h.txt.join('، ')))}</b>${h.prompt ? `<small>${esc(h.prompt)}</small>` : ''}<time>${esc(fmtLabel(jalali(h.t, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })))}</time></li>`).join('')}</ul>
    <button class="btn ghost wide" id="clrHist">🧹 پاک کردن تاریخچه</button>` : '<p class="muted center">هنوز چرخشی ثبت نشده. بچرخون تا آمار ساخته شود!</p>'}`, { cls: 'tall' });
  const c = $('#clrHist'); if (c) c.onclick = async () => { if (await confirmBox('تاریخچه‌ی این گردونه پاک شود؟', 'پاک کن')) { w.history = []; persist(); if (stack.at(-1) === 'scr-spin') renderSpin(); } };
}

// ---------- editor ----------
let edPrevT = 0;
function openEditor(isNew = false) {
  if (!cur) return; if (stack.at(-1) !== 'scr-edit') show('scr-edit'); renderEditor(); if (isNew) setTimeout(() => $('#editBody .seg-text')?.focus(), 200);
}
function renderEditor() {
  const w = cur; const o = w.opts; const tags = [...new Set([...allTags(), ...w.tags])];
  const segRows = w.segments.map((s, i) => `<div class="seg-row ${s.on ? '' : 'off'} ${s.out ? 'out' : ''}" data-sid="${s.id}">
      <label class="sw" style="--c:${s.color || themeOf(themeIdOf(w)).palette[i % themeOf(themeIdOf(w)).palette.length]}" title="رنگ"><input type="color" data-f="color" value="${s.color || themeOf(themeIdOf(w)).palette[i % 6]}"></label>
      <input class="seg-emoji" data-f="emoji" value="${esc(s.emoji)}" placeholder="🙂" maxlength="8" aria-label="ایموجی">
      <input class="seg-text" data-f="text" value="${esc(s.text)}" placeholder="متن گزینه" maxlength="80" aria-label="متن" data-testid="seg-text">
      <label class="seg-w" title="وزن (شانس)">×<input data-f="weight" type="number" inputmode="decimal" min="0" max="1000" step="any" value="${s.weight}"></label>
      <button class="sb" data-a="on" aria-label="فعال/غیرفعال" title="فعال/غیرفعال">${s.on ? '👁' : '🚫'}</button>
      <button class="sb" data-a="more" aria-label="بیشتر">⋯</button>
      ${s.img ? `<img class="seg-img" src="${s.img}" alt="">` : ''}${s.pool ? `<span class="pool">📜 ${fmt(s.pool.length)}</span>` : ''}
    </div>`).join('');
  $('#editBody').innerHTML = `
    <div class="ed-head"><canvas class="ed-prev" id="edPrev"></canvas><div class="ed-fields">
      <label>نام<input class="inp" id="edName" value="${esc(w.name)}" maxlength="60" data-testid="ed-name"></label>
      <label>ایموجی<input class="inp" id="edEmoji" value="${esc(w.emoji)}" maxlength="8"></label></div></div>
    <h4>🎨 تم</h4><div class="themes" id="edThemes">${['', ...THEME_IDS].map((id) => `<button class="th ${(w.theme || '') === id ? 'on' : ''}" data-th="${id}" data-testid="ed-theme-${id || 'default'}">${id ? `<i style="background:conic-gradient(${themeOf(id).palette.map((c, k, a) => `${c} ${(k * 100) / a.length}% ${((k + 1) * 100) / a.length}%`).join(',')})"></i><span>${themeOf(id).emoji} ${themeOf(id).name}</span>` : '<i class="def">⚙︎</i><span>پیش‌فرض</span>'}</button>`).join('')}</div>
    <h4>🏷 برچسب‌ها</h4><div class="chips tight" id="edTags">${tags.map((t) => `<button class="chip ${w.tags.includes(t) ? 'on' : ''}" data-tg="${esc(t)}">#${esc(t)}</button>`).join('')}<input class="inp tag-inp" id="edNewTag" placeholder="+ برچسب" maxlength="24"></div>
    ${w.special ? `<p class="note">🏆 این یک گردونه‌ی چالش است؛ دسته‌ها ثابت‌اند تا سکه‌ها درست حساب شوند.</p>` : `
    <h4>🧩 گزینه‌ها <small class="muted">(${fmt(w.segments.length)})</small></h4>
    <div class="seg-list" id="segList">${segRows}</div>
    <div class="ed-tools"><button class="btn small" id="segAdd" data-testid="seg-add">＋ گزینه</button><button class="btn small" id="segBulk">📋 گروهی</button><button class="btn small" id="segShuffle">🔀 بُر</button><button class="btn small" id="segSort">🔤 مرتب</button><button class="btn small" id="segColors">🎨 رنگ تم</button></div>`}
    <h4>⚙️ چرخش</h4>
    <div class="opts">
      <label class="range">⏱ مدت چرخش <b id="durV">${fmt(o.duration)} ثانیه</b><input type="range" id="edDur" min="1" max="20" step="1" value="${o.duration}"></label>
      ${[['sound', '🔊 صدای تیک و جشن'], ['confetti', '🎉 کاغذ رنگی و آتش‌بازی'], ...(w.special ? [] : [['elim', '🚫 حالت حذفی (برنده از دور بعد حذف شود)'], ['mystery', '🙈 حالت مخفی (متن‌ها تا پایان پنهان)']])].map(([k, l]) => `<label class="switch"><span>${l}</span><input type="checkbox" data-o="${k}" ${o[k] ? 'checked' : ''}><i></i></label>`).join('')}
      ${w.special ? '' : `<label class="range">🏆 تعداد برنده در هر چرخش <b id="winV">${fmt(o.winners)}</b><input type="range" id="edWin" min="1" max="${Math.max(1, Math.min(20, w.segments.length))}" value="${o.winners}"></label>`}
    </div>
    <div class="ed-foot"><button class="btn ghost" id="edDup">📄 تکثیر</button><button class="btn ghost" id="edShare">🔗 اشتراک</button><button class="btn danger" id="edDel">🗑 حذف</button></div>`;
  drawEdPrev();
}
function drawEdPrev() { const c = $('#edPrev'); if (c && cur) drawPreview(c, cur, themeIdOf(cur), S.faDigits); }
function edChanged(full = false) { cur.updatedAt = Date.now(); view.invalidate(); persist(); clearTimeout(edPrevT); edPrevT = setTimeout(drawEdPrev, 60); if (full) renderEditor(); }
$('#editBody').addEventListener('input', (e) => {
  const t = e.target; const row = t.closest('.seg-row');
  if (t.id === 'edName') { cur.name = t.value.slice(0, 60) || 'گردونه'; return edChanged(); }
  if (t.id === 'edEmoji') { cur.emoji = t.value.slice(0, 8); return edChanged(); }
  if (t.id === 'edDur') { cur.opts.duration = +t.value; $('#durV').textContent = fmt(t.value) + ' ثانیه'; return edChanged(); }
  if (t.id === 'edWin') { cur.opts.winners = +t.value; $('#winV').textContent = fmt(t.value); return edChanged(); }
  if (row) {
    const s = cur.segments.find((x) => x.id === row.dataset.sid); const f = t.dataset.f; if (!s || !f) return;
    if (f === 'text') s.text = t.value.slice(0, 80);
    if (f === 'emoji') s.emoji = t.value.slice(0, 8);
    if (f === 'color') { s.color = t.value; row.querySelector('.sw').style.setProperty('--c', t.value); }
    if (f === 'weight') { const v = +String(t.value).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); if (Number.isFinite(v) && v >= 0) s.weight = Math.min(1000, v); }
    edChanged();
  }
});
$('#editBody').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.o) { cur.opts[t.dataset.o] = t.checked; edChanged(); }
  if (t.id === 'edNewTag' && t.value.trim()) { cur.tags = [...new Set([...cur.tags, t.value.trim().slice(0, 24)])]; edChanged(true); }
});
$('#editBody').addEventListener('click', async (e) => {
  const t = e.target;
  const th = t.closest('[data-th]'); if (th) { cur.theme = th.dataset.th || null; setPageTheme(themeIdOf(cur)); view.setWheel(cur, themeIdOf(cur), { pointer: G.pointer, digits: S.faDigits }); if (!G.themes.includes(themeIdOf(cur))) { G.themes.push(themeIdOf(cur)); achToasts(checkAch(G)); } fx.pop(); return edChanged(true); }
  const tg = t.closest('[data-tg]'); if (tg) { const x = tg.dataset.tg; cur.tags = cur.tags.includes(x) ? cur.tags.filter((y) => y !== x) : [...cur.tags, x]; return edChanged(true); }
  const row = t.closest('.seg-row'); const s = row && cur.segments.find((x) => x.id === row.dataset.sid);
  const a = t.closest('[data-a]')?.dataset.a;
  if (s && a === 'on') { s.on = !s.on; s.out = false; return edChanged(true); }
  if (s && a === 'more') return segMenu(s);
  if (t.id === 'segAdd') { if (cur.segments.length >= MAX_SEGMENTS) return toast('حداکثر ۵۰۰ گزینه'); cur.segments.push(makeSegment({ text: `گزینه ${fmt(cur.segments.length + 1)}` })); edChanged(true); const all = $$('#segList .seg-text'); const last = all[all.length - 1]; last && (last.focus(), last.select()); return; }
  if (t.id === 'segBulk') return bulkAdd();
  if (t.id === 'segShuffle') { cur.segments = shuffle(cur.segments); return edChanged(true); }
  if (t.id === 'segSort') { cur.segments.sort((x, y) => x.text.localeCompare(y.text, 'fa', { numeric: true })); return edChanged(true); }
  if (t.id === 'segColors') { cur.segments.forEach((x) => { x.color = null; }); return edChanged(true); }
  if (t.id === 'edDup') { const c = duplicateWheel(cur); st.wheels.unshift(c); persist(); cur = c; toast('📄 کپی ساخته شد'); return renderEditor(); }
  if (t.id === 'edShare') return shareWheel(cur);
  if (t.id === 'edDel') { if (await confirmBox(`«${esc(cur.name)}» حذف شود؟`, 'حذف کن')) { st.wheels = st.wheels.filter((x) => x !== cur); cur = null; persist(); show('scr-lib'); toast('🗑 حذف شد'); } }
});
function segMenu(s) {
  const sh = openSheet(`<h3>${esc(labelOf(s))}</h3><div class="menu">
    <button data-m="img">🖼 ${s.img ? 'تغییر عکس' : 'افزودن عکس'}</button>${s.img ? '<button data-m="noimg">✖️ حذف عکس</button>' : ''}
    <button data-m="pool">📜 ${s.pool ? 'ویرایش' : 'افزودن'} پرسش‌ها/چالش‌های تصادفی</button>
    <button data-m="nocolor">🎨 رنگ پیش‌فرض تم</button><button data-m="dup">📄 تکثیر این گزینه</button>
    <button data-m="del" class="danger">🗑 حذف گزینه</button></div>`);
  sh.onclick = (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return; closeSheet();
    if (m === 'img') pickImage(s);
    if (m === 'noimg') { s.img = null; edChanged(true); }
    if (m === 'nocolor') { s.color = null; edChanged(true); }
    if (m === 'dup') { const i = cur.segments.indexOf(s); cur.segments.splice(i + 1, 0, makeSegment({ ...s, id: null })); edChanged(true); }
    if (m === 'del') { cur.segments = cur.segments.filter((x) => x !== s); edChanged(true); }
    if (m === 'pool') setTimeout(() => {
      const p = openSheet(`<h3>📜 پرسش‌های «${esc(s.text)}»</h3><p class="muted">هر خط یکی؛ وقتی این خانه برنده شود، یکی به تصادف نشان داده می‌شود.</p><textarea class="inp area" rows="8" id="poolTa">${esc((s.pool || []).join('\n'))}</textarea><button class="btn primary wide" id="poolOk">ذخیره</button>`, { cls: 'tall' });
      p.querySelector('#poolOk').onclick = () => { const l = p.querySelector('#poolTa').value.split('\n').map((x) => x.trim()).filter(Boolean); s.pool = l.length ? l.slice(0, 200) : null; closeSheet(); edChanged(true); };
    }, 280);
  };
}
function pickImage(s) {
  const f = $('#fileImg'); f.value = '';
  f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    try { s.img = await shrinkImage(file, 256); edChanged(true); } catch { toast('این عکس خوانده نشد', 'warn'); }
  };
  f.click();
}
function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82)); };
    im.onerror = rej; im.src = url;
  });
}
function bulkAdd() {
  const sh = openSheet(`<h3>📋 افزودن گروهی</h3><p class="muted">هر خط یک گزینه؛ می‌توانی از جای دیگر کپی کنی. <b>متن*۲</b> = وزن ۲.</p><textarea class="inp area" rows="8" id="bulkTa"></textarea><label class="check"><input type="checkbox" id="bulkReplace"> جایگزین گزینه‌های فعلی شود</label><button class="btn primary wide" id="bulkOk">افزودن</button>`, { cls: 'tall' });
  sh.querySelector('#bulkOk').onclick = () => {
    const segs = parseItems(sh.querySelector('#bulkTa').value); if (!segs.length) return closeSheet();
    cur.segments = (sh.querySelector('#bulkReplace').checked ? segs : [...cur.segments, ...segs]).slice(0, MAX_SEGMENTS); closeSheet(); edChanged(true); toast(`＋ ${fmt(segs.length)} گزینه اضافه شد`);
  };
}
$('#btnEditDone').addEventListener('click', () => { persist(true); if (stack.includes('scr-spin')) { back(); view.state = 'idle'; view.setWheel(cur, themeIdOf(cur), { pointer: G.pointer, digits: S.faDigits }); renderSpin(); } else openWheel(cur); });

// ---------- share / import ----------
async function shareWheel(w) {
  let code; try { code = await encodeShare(w); } catch { return toast('ساخت لینک ممکن نشد', 'warn'); }
  const url = location.href.split('#')[0] + '#w=' + code;
  const sh = openSheet(`<h3>🔗 اشتراک «${esc(w.name)}»</h3><p class="muted">هرکس این لینک را باز کند، همین گردونه را (بدون عکس‌ها و تاریخچه) در «چرخونه» می‌بیند. هیچ سروری در کار نیست؛ همه‌چیز داخل خود لینک است.</p>
    <input class="inp ltr" readonly value="${esc(url)}" id="shUrl" data-testid="share-url">
    <div class="row2">${navigator.share ? '<button class="btn primary" id="shNative">📤 اشتراک‌گذاری</button>' : ''}<button class="btn ${navigator.share ? 'ghost' : 'primary'}" id="shCopy">📋 کپی لینک</button></div>
    <button class="btn ghost wide" id="shJson">💾 دانلود فایل JSON</button>`);
  sh.querySelector('#shCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('📋 لینک کپی شد'); } catch { const i = sh.querySelector('#shUrl'); i.select(); document.execCommand('copy'); toast('📋 لینک کپی شد'); } };
  const n = sh.querySelector('#shNative'); if (n) n.onclick = () => navigator.share({ title: w.name, text: `گردونه‌ی «${w.name}» در چرخونه 🎡`, url }).catch(() => {});
  sh.querySelector('#shJson').onclick = () => download(`${w.name}.charkhoone.json`, { app: 'charkhoone', v: 1, wheels: [w] });
}
async function checkHash() {
  if (!location.hash.startsWith('#w=')) return;
  const code = location.hash; history.replaceState(null, '', location.pathname + location.search);
  let w; try { w = await decodeShare(code); } catch { return toast('این لینک گردونه خراب است 😕', 'warn'); }
  const sh = openSheet(`<h3>🎁 یک گردونه برایت فرستاده‌اند</h3><div class="imp"><canvas class="imp-prev" id="impPrev"></canvas><div><b>${esc(w.emoji)} ${esc(w.name)}</b><p class="muted">${fmt(w.segments.length)} گزینه</p></div></div><div class="row2"><button class="btn primary" id="impOk" data-testid="import-shared">➕ افزودن و چرخاندن</button><button class="btn ghost" data-close>نه، ممنون</button></div>`);
  requestAnimationFrame(() => drawPreview(sh.querySelector('#impPrev'), w, w.theme || S.theme, S.faDigits));
  sh.querySelector('#impOk').onclick = () => { st.wheels.unshift(w); persist(); closeSheet(); openWheel(w); };
}
addEventListener('hashchange', checkHash);
function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const file = new File([blob], name.replace(/[\\/:*?"<>|]/g, '_'), { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iP(hone|ad)/.test(navigator.userAgent)) { navigator.share({ files: [file], title: name }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('#fileImport').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const data = JSON.parse(await f.text()); const r = importData(st, data); persist(true); applySettings(); toast(`✅ ${fmt(r.added)} گردونه‌ی تازه، ${fmt(r.replaced)} به‌روز شد`); show('scr-lib'); }
  catch (err) { toast('❌ ' + esc(err.message || 'فایل نامعتبر'), 'warn'); }
});

// ---------- tools: dice / coin / teams / number ----------
let diceN = 2; const diceVals = []; const diceRot = [];
const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] }; // [rotX, rotY] that shows the face
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const faceHTML = (n) => `<div class="face f${n}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<i class="${PIPS[n].includes(k) ? 'p' : ''}"></i>`).join('')}</div>`;
function renderTools() {
  $('#toolsBody').innerHTML = `
    <section class="tool dice-tool" data-testid="dice-tool"><h3>🎲 تاس سه‌بعدی</h3>
      <div class="dice-n">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="chip ${n === diceN ? 'on' : ''}" data-dn="${n}">${fmt(n)}</button>`).join('')}<span class="muted">تاس</span></div>
      <div class="dice-stage" id="diceStage">${Array.from({ length: diceN }, (_, i) => `<div class="die-wrap"><div class="die" data-i="${i}" style="transform:rotateX(${diceRot[i]?.[0] ?? -20}deg) rotateY(${diceRot[i]?.[1] ?? 30}deg)">${[1, 2, 3, 4, 5, 6].map(faceHTML).join('')}</div></div>`).join('')}</div>
      <div class="dice-sum" id="diceSum" data-testid="dice-sum">${diceVals.length ? `جمع: <b>${fmt(diceVals.reduce((a, b) => a + b, 0))}</b> <small>(${diceVals.map(fmt).join(' + ')})</small>` : 'تاس‌ها را بریز!'}</div>
      <button class="btn primary wide big" id="rollBtn" data-testid="roll">🎲 بریز!</button></section>
    <section class="tool coin-tool"><h3>🪙 شیر یا خط</h3><div class="coin-stage"><div class="coin3d" id="coin"><div class="cf heads">🦁<span>شیر</span></div><div class="cf tails">✍️<span>خط</span></div></div></div><div class="dice-sum" id="coinRes">سکه را بنداز</div><button class="btn wide" id="flipBtn">🪙 بنداز</button></section>
    <section class="tool"><h3>🔢 عدد تصادفی</h3><div class="row3"><label>از<input class="inp" id="rnMin" type="number" value="1" inputmode="numeric"></label><label>تا<input class="inp" id="rnMax" type="number" value="100" inputmode="numeric"></label><button class="btn" id="rnGo">بزن</button></div><div class="big-num" id="rnOut">؟</div></section>
    <section class="tool"><h3>👥 گروه‌بندی تصادفی</h3><textarea class="inp area" rows="4" id="tmNames" placeholder="اسم‌ها، هر خط یکی"></textarea><div class="row3"><label>تعداد گروه<input class="inp" id="tmN" type="number" value="2" min="2" max="20" inputmode="numeric"></label><button class="btn" id="tmGo">گروه‌بندی</button></div><div class="teams" id="tmOut"></div></section>`;
}
$('#toolsBody').addEventListener('click', (e) => {
  fx.unlockAudio();
  const dn = e.target.closest('[data-dn]'); if (dn) { diceN = +dn.dataset.dn; diceVals.length = 0; return renderTools(); }
  if (e.target.id === 'rollBtn') return rollDice();
  if (e.target.id === 'flipBtn') return flipCoin();
  if (e.target.id === 'rnGo') { let a = Math.round(+$('#rnMin').value), b = Math.round(+$('#rnMax').value); if (!Number.isFinite(a) || !Number.isFinite(b)) return; if (b < a) [a, b] = [b, a]; const v = a + randInt(Math.min(2 ** 32, b - a + 1)); const o = $('#rnOut'); o.textContent = fmt(v); o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop'); fx.pop(); fx.buzz(10); return; }
  if (e.target.id === 'tmGo') {
    const names = parseItems($('#tmNames').value).map((s) => labelOf(s)); const n = Math.max(2, Math.min(20, +$('#tmN').value | 0)); if (names.length < 2) return toast('حداقل دو اسم بنویس', 'warn');
    const sh = shuffle(names); const teams = Array.from({ length: n }, () => []); sh.forEach((x, i) => teams[i % n].push(x));
    $('#tmOut').innerHTML = teams.map((t, i) => `<div class="team" style="--c:${themeOf(S.theme).palette[i % 6]}"><b>گروه ${fmt(i + 1)}</b>${t.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`).join(''); fx.pop();
  }
});
function rollDice() {
  const dice = $$('#diceStage .die'); diceVals.length = 0; if (S.sound) fx.diceRattle(); fx.buzz([10, 30, 10, 30, 20]);
  dice.forEach((d, i) => {
    const v = 1 + randInt(6); diceVals.push(v); const [rx, ry] = FACE_ROT[v];
    const prev = diceRot[i] || [0, 0]; const spinsX = 360 * (2 + randInt(2)), spinsY = 360 * (2 + randInt(2));
    const nx = Math.ceil((prev[0] + 1) / 360) * 360 + spinsX + rx, ny = Math.ceil((prev[1] + 1) / 360) * 360 + spinsY + ry;
    diceRot[i] = [nx, ny]; d.style.transition = reduced() ? 'none' : `transform ${1 + i * 0.12}s cubic-bezier(.2,.9,.25,1.02)`; d.style.transform = `rotateX(${nx}deg) rotateY(${ny}deg)`;
    d.parentElement.classList.remove('bounce'); void d.offsetWidth; d.parentElement.classList.add('bounce');
  });
  G.dice++; const ach = checkAch(G); persist();
  const sum = diceVals.reduce((a, b) => a + b, 0);
  $('#diceSum').innerHTML = '…';
  setTimeout(() => { $('#diceSum').innerHTML = `جمع: <b>${fmt(sum)}</b> <small>(${diceVals.map(fmt).join(' + ')})</small>`; if (diceVals.length > 1 && diceVals.every((x) => x === diceVals[0])) { toast('جفت! 🎉'); fx.celebrate(undefined, { fireworks: false, reduced: reduced() }); } achToasts(ach); }, reduced() ? 50 : 1100 + diceN * 120);
}
let coinDeg = 0;
function flipCoin() {
  const heads = randInt(2) === 0; coinDeg += 360 * (3 + randInt(3)) + (heads ? (coinDeg % 360 ? 180 : 0) : (coinDeg % 360 ? 0 : 180));
  const c = $('#coin'); c.style.transition = reduced() ? 'none' : 'transform 1.4s cubic-bezier(.2,.8,.3,1)'; c.style.transform = `rotateY(${coinDeg}deg)`;
  fx.whoosh(); $('#coinRes').textContent = '…';
  setTimeout(() => { $('#coinRes').innerHTML = `<b>${heads ? '🦁 شیر' : '✍️ خط'}</b>`; fx.coinSound(); fx.buzz(15); }, reduced() ? 50 : 1400);
}

// ---------- challenges / achievements / shop ----------
function renderChallenges() {
  const chCard = (c) => { const e = earned(G, c.id, c.reward), tot = challengeTotal(c.id), pct = Math.round((100 * e) / tot); return `<button class="ch-card" data-ch="${c.id}" style="--a:${themeOf(c.theme).accent};--b1:${themeOf(c.theme).bg[0]};--b2:${themeOf(c.theme).bg[1]}" data-testid="ch-${c.id}"><span class="ch-emoji">${c.emoji}</span><b>${esc(c.name)}</b><small>${esc(c.intro)}</small><div class="prog"><div class="prog-top"><b>${fmt(e)} / ${fmt(tot)}</b> سکه <span>${fmt(pct)}٪</span></div><div class="bar"><i style="width:${Math.max(3, pct)}%"></i></div></div></button>`; };
  $('#chBody').innerHTML = `
    <div class="wallet"><div><span class="big">🪙 ${fmt(G.coins)}</span><small>سکه</small></div><div><span class="big">🔥 ${fmt(G.streak || 0)}</span><small>روز پشت سر هم · بهترین ${fmt(G.best || 0)}</small></div><div><span class="big">🎡 ${fmt(G.spins)}</span><small>کل چرخش</small></div></div>
    <p class="muted">هر روز که بچرخانی سکه‌ی روزانه می‌گیری (تا ۳۵ سکه برای ۷ روز پیاپی).</p>
    ${Object.values(CHALLENGES).map(chCard).join('')}
    <h4>🏆 دستاوردها <small class="muted">${fmt(Object.keys(G.ach).length)} از ${fmt(ACHIEVEMENTS.length)}</small></h4>
    <div class="ach-grid">${ACHIEVEMENTS.map((a) => `<div class="ach ${G.ach[a.id] ? 'on' : ''}"><span>${a.emoji}</span><b>${esc(a.name)}</b><small>${G.ach[a.id] ? '✓ ' + esc(fmtLabel(jalali(G.ach[a.id], { day: 'numeric', month: 'short' }))) : `+${fmt(a.coins)} 🪙`}</small></div>`).join('')}</div>
    <h4>🎯 عقربه‌ها <small class="muted">با سکه باز کن</small></h4>
    <div class="shop">${Object.entries(POINTERS).map(([id, p]) => { const own = G.pointers.includes(id); return `<button class="sk ${G.pointer === id ? 'on' : ''} ${own ? 'own' : ''}" data-sk="${id}"><span>${p.emoji}</span><b>${esc(p.name)}</b><small>${G.pointer === id ? 'فعال' : own ? 'انتخاب' : `${fmt(p.price)} 🪙`}</small></button>`; }).join('')}</div>`;
}
$('#chBody').addEventListener('click', (e) => {
  const ch = e.target.closest('[data-ch]');
  if (ch) { let w = st.wheels.find((x) => x.special === ch.dataset.ch); if (!w) { w = challengeWheel(ch.dataset.ch); st.wheels.unshift(w); persist(); } return openWheel(w); }
  const sk = e.target.closest('[data-sk]');
  if (sk) { const id = sk.dataset.sk; const had = G.pointers.includes(id); if (buyPointer(G, id)) { if (!had) { fx.coinSound(); toast(`🎯 عقربه‌ی «${esc(POINTERS[id].name)}» باز شد!`, 'gold'); } persist(); renderChallenges(); renderHeader(); } else toast(`سکه کافی نیست — ${fmt(POINTERS[id].price - G.coins)} سکه‌ی دیگر لازم است`, 'warn'); }
});

// ---------- settings ----------
function renderSettings() {
  $('#setBody').innerHTML = `
    <div class="group"><label class="field">نام شما (برای خوشامد)<input class="inp" id="sName" value="${esc(S.name)}" maxlength="30" data-testid="set-name"></label>
      <label class="switch"><span>👋 نمایش خوشامد با اسم</span><input type="checkbox" data-s="greet" ${S.greet ? 'checked' : ''}><i></i></label></div>
    <h4>🎨 تم پیش‌فرض</h4>
    <div class="themes big" id="sThemes">${THEME_IDS.map((id) => `<button class="th ${S.theme === id ? 'on' : ''}" data-th="${id}" data-testid="theme-${id}"><canvas class="thprev" data-th="${id}"></canvas><span>${themeOf(id).emoji} ${themeOf(id).name}</span></button>`).join('')}</div>
    <div class="group">
      <label class="switch"><span>۱۲۳ ارقام فارسی</span><input type="checkbox" data-s="faDigits" ${S.faDigits ? 'checked' : ''} data-testid="set-digits"><i></i></label>
      <label class="switch"><span>🔊 صدا</span><input type="checkbox" data-s="sound" ${S.sound ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>📳 لرزش (هپتیک)</span><input type="checkbox" data-s="haptics" ${S.haptics ? 'checked' : ''}><i></i></label>
      <label class="field">🌀 انیمیشن<select class="inp" id="sMotion"><option value="auto" ${S.motion === 'auto' ? 'selected' : ''}>طبق تنظیمات گوشی</option><option value="full" ${S.motion === 'full' ? 'selected' : ''}>کامل</option><option value="reduce" ${S.motion === 'reduce' ? 'selected' : ''}>کم (بدون حرکت زیاد)</option></select></label>
    </div>
    <h4>💾 پشتیبان</h4>
    <div class="group row2"><button class="btn" id="sExport" data-testid="export">⬇️ خروجی JSON</button><button class="btn" id="sImport" data-testid="import">⬆️ ورود از فایل</button></div>
    <div class="group row2"><button class="btn ghost" id="sSamples">🎁 افزودن نمونه‌ها</button><button class="btn danger" id="sReset">🧨 پاک کردن همه</button></div>
    <h4>📲 نصب روی آیفون</h4>
    <p class="muted">در Safari دکمه‌ی اشتراک <b>⬆︎</b> را بزن، بعد «<b>Add to Home Screen</b>». بعد از نصب، بدون اینترنت هم کار می‌کند.</p>
    <div class="about"><b>🎡 چرخونه</b> — ساخته‌شده فقط برای ${esc(S.name || 'شما')} 💛<br>بدون تبلیغ، بدون اشتراک پولی، بدون ردیابی. همه‌ی داده‌ها فقط روی همین گوشی می‌ماند. نتیجه‌ها با مولد تصادفی رمزنگاری‌شده‌ی مرورگر (crypto) انتخاب می‌شوند و شانس هر خانه دقیقاً متناسب با اندازه‌ی آن است.<br><small class="muted">نسخه‌ی ${fmt('1.0.0')}</small></div>`;
  requestAnimationFrame(() => $$('#sThemes canvas').forEach((c) => drawPreview(c, DEMO, c.dataset.th, S.faDigits)));
}
const DEMO = makeWheel({ name: 'demo', emoji: '🎡', segments: Array.from({ length: 8 }, () => makeSegment({ text: '' })) });
$('#setBody').addEventListener('input', (e) => { if (e.target.id === 'sName') { S.name = e.target.value.slice(0, 30); persist(); renderHeader(); } });
$('#setBody').addEventListener('change', (e) => {
  const t = e.target; if (t.dataset.s) { S[t.dataset.s] = t.checked; applySettings(); persist(); if (t.dataset.s === 'faDigits') { view.digits = S.faDigits; view.invalidate(); renderSettings(); } }
  if (t.id === 'sMotion') { S.motion = t.value; applySettings(); view.reduced = reduced(); persist(); }
});
$('#setBody').addEventListener('click', async (e) => {
  const th = e.target.closest('[data-th]'); if (th) { S.theme = th.dataset.th; if (!G.themes.includes(S.theme)) { G.themes.push(S.theme); achToasts(checkAch(G)); } persist(); setPageTheme(S.theme); fx.pop(); renderSettings(); drawLogo(); return; }
  if (e.target.id === 'sExport') download(`charkhoone-backup-${jalali(Date.now(), { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}.json`, exportData(st));
  if (e.target.id === 'sImport') $('#fileImport').click();
  if (e.target.id === 'sSamples') { const have = new Set(st.wheels.map((w) => w.template || w.special)); const add = sampleWheels().filter((w) => !have.has(w.template || w.special)); st.wheels.unshift(...add); persist(); toast(`🎁 ${fmt(add.length)} نمونه اضافه شد`); }
  if (e.target.id === 'sReset') { if (await confirmBox('همه‌ی گردونه‌ها، سکه‌ها و تنظیمات پاک شود؟ (اول خروجی بگیر!)', 'پاک کن همه را')) { localStorage.removeItem('charkhoone.v1'); location.reload(); } }
});

// ---------- logo ----------
function drawLogo() { const c = $('#logoWheel'); drawPreview(c, LOGO, S.theme, false); }
const LOGO = makeWheel({ emoji: '🎲', segments: Array.from({ length: 8 }, () => makeSegment({ text: '' })) });

// ---------- boot ----------
applySettings(); setPageTheme(S.theme); renderLib(); drawLogo();
document.fonts?.ready.then(() => { renderLib(); drawLogo(); view.invalidate(); });
addEventListener('resize', () => { view.invalidate(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => { applySettings(); view.reduced = reduced(); });
document.addEventListener('pointerdown', fx.unlockAudio, { once: true, capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { view.stop(); persist(true); } else if (stack.at(-1) === 'scr-spin') view.start(); });
checkHash();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__charkhoone = { st, view, get cur() { return cur; } };
document.body.dataset.ready = '1';
