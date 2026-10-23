// Renders the PNG icons with headless Chrome using the app's own wheel renderer.
// Run: PW_DIR=/tmp/pw node scripts/icons.mjs   (starts a throw-away static server on :8799)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');
const root = new URL('../', import.meta.url).pathname;
const PORT = 8799;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', root], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/scripts/blank.html`).catch(() => {});
for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true], ['apple-touch-icon', 180, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><head><base href="http://127.0.0.1:${PORT}/"><style>@font-face{font-family:Vazirmatn;src:url(fonts/Vazirmatn-Variable.woff2)}
  body{margin:0}#b{width:${size}px;height:${size}px;border-radius:${pad ? 0 : size * 0.22}px;overflow:hidden;position:relative;background:radial-gradient(circle at 50% 35%,#7a1d2e,#2a0610 60%,#0c0205)}
  #b:before{content:'';position:absolute;inset:0;background:repeating-conic-gradient(rgba(255,215,106,.10) 0 10deg,transparent 10deg 24deg)}
  canvas{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);width:${size * (pad ? 0.66 : 0.8)}px;height:${size * (pad ? 0.66 : 0.8)}px;filter:drop-shadow(0 ${size * 0.03}px ${size * 0.04}px rgba(0,0,0,.6))}
  svg{position:absolute;left:50%;top:${pad ? 13 : 5}%;transform:translateX(-50%);width:${size * 0.16}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}</style></head>
  <body><div id="b"><canvas id="c"></canvas><svg viewBox="0 0 40 48"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff6c7"/><stop offset=".5" stop-color="#ffc21a"/><stop offset="1" stop-color="#b07800"/></linearGradient></defs><path d="M20 46 L4 10 A16 16 0 0 1 36 10 Z" fill="url(#g)" stroke="#5a3d00" stroke-width="2"/><circle cx="20" cy="12" r="5" fill="#e63946" stroke="#fff" stroke-width="1.5"/></svg></div>
  <script type="module">
    import { drawPreview } from './js/renderer.js'; import { makeWheel } from './js/wheel.js';
    const w = makeWheel({ name: 'icon', emoji: '🐱', segments: ['۱','۲','۳','۴','۵','۶','۷','۸'].map((t) => ({ text: t })) });
    await document.fonts.load('900 20px Vazirmatn'); drawPreview(document.getElementById('c'), w, 'gold'); window.done = 1;
  </script></body></html>`);
  await page.waitForFunction(() => window.done === 1, null, { timeout: 10000 }); await page.waitForTimeout(300);
  await page.locator('#b').screenshot({ path: `${root}icons/${name}.png`, omitBackground: !pad });
}
await browser.close(); srv.kill(); console.log('icons ok');
