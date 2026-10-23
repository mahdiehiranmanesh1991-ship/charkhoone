// Headless-Chrome end-to-end test for «چرخونه» at iPhone size (390×844).
// Usage: python3 -m http.server 8799 -d /workspace &  PW_DIR=/tmp/pw node tests/e2e.mjs http://127.0.0.1:8799/spin-wheel/
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');

const URL_ = process.argv[2] || 'http://127.0.0.1:8799/spin-wheel/';
const ORIGIN = new URL(URL_).origin;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname; rmSync(SHOTS, { recursive: true, force: true }); mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('•', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Asia/Tehran',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const external = [], errors = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const tid = (t) => `[data-testid="${t}"]`;
let n = 0;
const shot = async (name, settle = 600) => { await sleep(settle); const f = `${SHOTS}${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); log('screenshot', f); };
const visible = (sel) => page.locator(sel).first().waitFor({ state: 'visible', timeout: 15000 });
const click = async (sel) => { await visible(sel); await page.locator(sel).first().click(); };
const back = async () => { await page.locator('.screen.active [data-back]').click(); await sleep(250); };
const sheetClosed = () => page.waitForFunction(() => document.getElementById('sheet').hidden, null, { timeout: 5000 });

/** Spin with the button (or a flick) and verify the reveal matches the segment under the pointer. */
async function spinAndCheck({ flick = false, name } = {}) {
  const before = await page.evaluate(() => window.__charkhoone.cur.spins);
  if (flick) {
    const box = await page.locator(tid('wheel')).boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height * 0.53, r = box.width * 0.33;
    await page.mouse.move(cx + r, cy); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { const a = i * 0.16; await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a)); await sleep(8); }
    await page.mouse.up();
  } else await click(tid('spin'));
  await page.waitForFunction(() => document.body.classList.contains('spinning'), null, { timeout: 3000 });
  await sleep(1300); if (name) await shot(name + '-spinning', 0);
  await page.waitForFunction(() => !document.body.classList.contains('spinning'), null, { timeout: 30000 });
  await visible('#reveal.open');
  const r = await page.evaluate(() => ({ ...window.__lastSpin, spins: window.__charkhoone.cur.spins, shown: document.querySelector('[data-testid=reveal-label],[data-testid=question],[data-testid=reveal-list]')?.textContent || '' }));
  assert.equal(r.spins, before + 1, 'spin counted');
  assert.equal(r.idx, r.winner, 'wheel stopped on the CSPRNG winner');
  assert.equal(r.pointerIdx, r.idx, 'segment under the pointer = result');
  return r;
}
const fa2en = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٪/g, '%');

// ---------- 1. first run: library ----------
await page.goto(URL_);
await page.waitForFunction(() => document.body.dataset.ready === '1');
await page.evaluate(() => document.fonts.ready);
assert.match(await page.textContent(tid('greet')), /مهدیه/);
const cards0 = await page.locator(tid('card')).count(); assert.ok(cards0 >= 8, 'sample wheels'); log('library cards', cards0);
assert.ok(await page.locator(tid('ch-progress')).count() >= 2, 'challenge cards show coin progress');
await shot('library', 900);

// ---------- 2. quick wheel → spin → reveal matches pointer ----------
await click(tid('quick')); await visible(tid('quick-text'));
await page.fill(tid('quick-text'), '🍕 پیتزا\nکباب*2\nسالاد\nقورمه‌سبزی\n🍔 همبرگر\nآش رشته');
await shot('quick-sheet', 500);
await click(tid('quick-go')); await visible(tid('spin-screen'));
assert.equal(await page.evaluate(() => window.__charkhoone.cur.segments.length), 6);
await shot('quick-wheel', 700);
let r = await spinAndCheck({ name: 'quick' });
const lbl = await page.textContent(tid('reveal-label'));
assert.ok(r.label.includes(lbl.trim()), `reveal "${lbl}" vs pointer "${r.label}"`); log('quick result', r.label);
await shot('quick-reveal', 900);
await click(tid('reveal-ok')); await sleep(400);

// a flick in the opposite direction also lands fairly
r = await spinAndCheck({ flick: true }); log('flick result', r.label);
await click(tid('reveal-ok')); await sleep(400);

// elimination: winners disappear until reset
await click(tid('tog-elim'));
for (let i = 0; i < 2; i++) { await spinAndCheck(); await click(tid('reveal-ok')); await sleep(350); }
assert.equal(await page.evaluate(() => window.__charkhoone.cur.segments.filter((s) => s.out).length), 2);
await visible(tid('reset-elim')); await shot('elimination', 500);
await click(tid('reset-elim')); assert.equal(await page.evaluate(() => window.__charkhoone.cur.segments.filter((s) => s.out).length), 0);
await click(tid('tog-elim'));

// stats chart
await click(tid('stats')); await visible(tid('chart')); await shot('stats', 600);
await page.mouse.click(195, 40); await sheetClosed();

// editor
await click(tid('edit')); await visible(tid('editor'));
await page.locator(tid('seg-text')).nth(2).fill('سالاد سزار');
await shot('editor', 700);
await click(tid('edit-done')); await visible(tid('spin-screen'));
assert.equal(await page.evaluate(() => window.__charkhoone.cur.segments[2].text), 'سالاد سزار');
await back(); await visible(tid('library'));

// ---------- 3. library: search, favourite, duplicate, delete ----------
assert.equal(await page.locator(tid('card')).count(), cards0 + 1, 'quick wheel saved');
await page.fill(tid('search'), 'درصد'); await sleep(200);
assert.equal(await page.locator(tid('card')).count(), 1);
await page.locator(tid('fav')).first().click(); await sleep(150);
await page.fill(tid('search'), ''); await page.locator(`${tid('tags')} .chip >> nth=1`).click(); await sleep(200);
assert.equal(await page.locator(tid('card')).count(), 1, 'favourites filter'); await page.locator(`${tid('tags')} .chip >> nth=0`).click(); await sleep(200);
await page.locator(`${tid('card')} >> nth=0 >> [data-act=menu]`).click(); await click(tid('dup')); await sleep(300);
assert.equal(await page.locator(tid('card')).count(), cards0 + 2);
assert.match(await page.locator(`${tid('card')} >> nth=0 >> .c-name`).textContent(), /^کپی /);
await page.locator(`${tid('card')} >> nth=0 >> [data-act=menu]`).click(); await click(tid('delete')); await click(tid('confirm-yes')); await sleep(300);
assert.equal(await page.locator(tid('card')).count(), cards0 + 1); log('search/fav/dup/delete ok');
await page.evaluate(() => document.getElementById('scr-lib').scrollTo(0, 0));

// ---------- 4. percent template ----------
await click(tid('templates')); await visible(tid('templates-screen')); await shot('templates', 900);
await click(tid('tpl-percent')); await visible(tid('tpl-go'));
await page.fill('[data-k=step]', '10'); await click(tid('tpl-go')); await visible(tid('spin-screen'));
const segs = await page.evaluate(() => window.__charkhoone.cur.segments.map((s) => s.text));
assert.deepEqual(segs, ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%']);
r = await spinAndCheck({ name: 'percent' });
assert.match(fa2en(await page.textContent(tid('reveal-label'))), /^\d+%$/); log('percent result', r.label);
await shot('percent-reveal', 900);
await click(tid('reveal-ok')); await sleep(300);

// ---------- 5. challenge wheel (law) ----------
await back(); await back(); await visible(tid('library'));
await page.locator(`${tid('card')}.special >> nth=1 >> [data-open] >> nth=0`).click(); await visible(tid('spin-screen'));
await spinAndCheck(); await visible('.q-opt'); await shot('law-question', 900);
await page.locator('.q-opt').first().click(); await sleep(600); await shot('law-answered', 300);
await click('#revealCard [data-r=ok]'); await sleep(400);

// ---------- 6. themes ----------
await back(); await visible(tid('library'));
await click(tid('tab-set')); await visible(tid('settings'));
const bgBefore = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bg1').trim());
await click(tid('theme-galaxy')); await sleep(300);
assert.equal(await page.evaluate(() => window.__charkhoone.st.settings.theme), 'galaxy');
assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bg1').trim()), bgBefore);
await shot('settings-galaxy', 700);
await click(tid('tab-lib')); await shot('library-galaxy', 900);
for (const th of ['kashi', 'cat', 'candy']) {
  await click(tid('tab-set')); await click(tid('theme-' + th)); await click(tid('tab-lib')); await sleep(200);
  await page.locator(`${tid('card')} >> nth=4 >> [data-open] >> nth=0`).click(); await visible(tid('spin-screen'));
  await page.evaluate(() => { const w = window.__charkhoone.cur; w.theme = null; }); // follow the app theme
  await page.evaluate(() => window.__charkhoone.view.setWheel(window.__charkhoone.cur, window.__charkhoone.st.settings.theme, {}));
  await shot('wheel-' + th, 800);
  await back(); await visible(tid('library'));
}
await click(tid('tab-set')); await click(tid('theme-gold')); await click(tid('tab-lib'));

// ---------- 7. tools & challenges ----------
await click(tid('tab-tools')); await visible(tid('dice-tool'));
await click(tid('roll')); await sleep(1600);
assert.match(fa2en(await page.textContent(tid('dice-sum'))), /\d/); await shot('tools-dice', 300);
await click(tid('tab-ch')); await visible(tid('challenges')); await shot('challenges', 800);

// ---------- 8. share link import ----------
const code = await page.evaluate(async () => { const { encodeShare } = await import('./js/util.js'); return encodeShare(window.__charkhoone.st.wheels[0]); });
const p2 = await ctx.newPage(); await p2.goto(URL_ + '#w=' + code); await p2.waitForFunction(() => document.body.dataset.ready === '1');
await p2.locator(tid('import-shared')).waitFor({ state: 'visible', timeout: 5000 }); await p2.screenshot({ path: `${SHOTS}${String(++n).padStart(2, '0')}-share-import.png` });
await p2.close(); log('share import sheet ok');

// ---------- 9. offline reload ----------
await click(tid('tab-lib'));
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }); });
const cardsNow = await page.locator(tid('card')).count();
await ctx.setOffline(true);
await page.reload(); await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
assert.equal(await page.locator(tid('card')).count(), cardsNow, 'data persisted + app shell offline');
assert.ok(await page.evaluate(() => document.fonts.check('900 20px Vazirmatn')), 'font cached offline');
await shot('offline', 900); await ctx.setOffline(false); log('offline reload ok');

assert.deepEqual(external, [], 'no external requests'); 
assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), [], 'no page errors');
await browser.close();
console.log(`\nE2E PASS — ${n} screenshots in ${SHOTS}`);
