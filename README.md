# 🎡 چرخونه — Mahdieh's lucky wheel

A private, Persian, offline PWA spin-the-wheel / random picker (her «تاس»). It was reverse-engineered from «Spin The Wheel – Random Picker»; see `RESEARCH.md` for how.

## Run
```bash
npm run serve            # python3 -m http.server 8799 → http://127.0.0.1:8799/
npm test                 # 28 unit tests (node --test)
PW_DIR=/tmp/pw npm run e2e -- http://127.0.0.1:8799/spin-wheel/   # headless Chrome, iPhone 390×844, screenshots/
```
It's static files only, with relative paths and no CDN, so you can drop the folder on any static host. On iPhone: open it in Safari → Share → *Add to Home Screen*.

## Features
- **Wheel**
  - Glossy 3D canvas wheel with chasing LEDs, running at 60 fps.
  - Spin with the button, by tapping the hub, or by flicking with your finger in either direction.
  - The pointer wobbles off each peg, with WebAudio ticks, confetti and fireworks, a winner card, and haptics where supported.
- **Fairness:** a CSPRNG picks the winner, weighted by segment size. The pointer always lands on the result, which tests verify.
- **Themes:** neon, candy, gold, pastel, galaxy, kashi (کاشی), cat (گربه). Each wheel can also have its own theme. Reduced motion is respected.
- **Library**
  - Previews, spin count, Jalali / relative "last used" times.
  - Favourites, tags and filters, search.
  - Duplicate, share (link with `#w=` or a JSON file), delete with confirmation.
- **Quick wheel and 19 templates:**
  - Percent, number, yes/no, coin, minutes timer.
  - Driving and driving drills.
  - Persian and English letters, dice and dice sum.
  - Food, cat, home, truth or dare, Clash Royale, outfit colour, team picker, reading.
- **Editor (per segment):** text, emoji, colour, weight, on/off and image.
- **Options:** duration, sound, elimination, multiple winners, mystery mode.
- **History and stats:** history list and a stats chart.
- **Tools:** 3D dice (1–6 dice), coin flip, team splitter.
- **Challenges:** emoji quiz and law quiz with coins, 13 achievements, a daily streak bonus, and a shop for pointer skins.
- **Privacy:** no ads, paywall or tracking; data stays in `localStorage` (key `charkhoone.v1`). JSON backup export and import are under Settings.

## Layout
`index.html`, `css/app.css`, `js/` (rng, wheel, renderer, fx, util, themes, templates, challenges, game, store, app), `sw.js` (bump `VERSION` on every change), `manifest.webmanifest`, `icons/`, `fonts/` (Vazirmatn), `tests/`.
