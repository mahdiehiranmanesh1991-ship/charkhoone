# RESEARCH — «چرخونه» (charkhoone)

How «Spin The Wheel – Random Picker» and its competitors work. Written with the REA method (morluto/rea), used as a methodology only: **Observation → Derivation → Inference → Unknown**, each with its **provenance**. No binaries were decompiled. All evidence comes from the user's screenshot, public store listings, user reviews and public FAQs.

## 0. Target
- **O1 (screenshot `/workspace/wheel-ref/reference.png`, provided by the user)**
  - Library screen with *Quick Wheel* and *Wheel Library* CTAs, plus a row of tag chips.
  - Glass cards, each showing:
    - name, spins and "last used";
    - ⋯, share and settings buttons;
    - a **clipped wheel preview** at the card edge.
  - An *Emoji Quiz Master* card with a coin progress bar.
  - Percent, number, timer and "driving" wheels.
  - Two FABs: ★ and +.

## 1. Market scan (store data fetched 2026-10, raw text in `/workspace/appres/wheel/rv_*.txt`)
| App | Store | Rating | Ratings count | Installs | Monetisation |
|---|---|---|---|---|---|
| Spin The Wheel – Random Picker (reference) | Google Play | **4.82** | 150,112 | 10M+ | ads + IAP |
| Spinning Wheel+Roulette (komorebi) | Google Play | 4.67 | 55,721 | 10M+ | ads + IAP |
| Decision Maker (happyverse) | Google Play | 4.60 | 15,792 | 1M+ | ads + IAP |
| Spin The Wheel – Picker Decides | Google Play | 4.14 | 37,023 | 10M+ | ads + IAP |
| Lucky Decisions | Google Play | 4.54 | 354 | – | ads + IAP |
| Wheel of Names (pmdevlabs) | Google Play | 4.33 | 23 | – | ads + IAP |
| Spin The Wheel (Taurius Petraitis) | App Store | **4.87** | 96,855 | – | ads + IAP |
| Tiny Decisions | App Store | 4.71 | 89,762 | – | IAP |
| Wheel+ (Komorebi) | App Store | 4.79 | 11,851 | – | IAP |
| Pick Me | App Store | 4.60 | 15,364 | – | IAP |
| Decide Now! | App Store | 4.74 | 733 | – | $1.99 |
| Picker Wheel | App Store | 4.92 | 12 | – | – |
| wheelofnames.com / pickerwheel.com | Web | – | – | – | ads |

### What users hate (O2, from review text)
- An ad after every spin, and ads that can't be skipped.
- Expensive subscriptions: $14.99 a week, or $20 to remove ads.
- "Results don't feel random", and "flick speed doesn't matter".
- No bulk paste and no history.
- The result is unclear on big wheels.
- A 20-character label limit.
- Poor search.
- Too many tracking-consent screens.

### What users love (O3)
- Deep customisation and unlimited labels.
- Turning a label off without deleting it.
- Presets and sharing.
- "Real" randomness.

### Public engineering facts (O4)
- **wheelofnames FAQ:**
  - Uses a crypto RNG and a Durstenfeld shuffle.
  - Weights are shown as segment size.
  - Has a "remove winner" button.
  - Allows up to 1000 entries, sharing by URL, and installing as a PWA.
- **pickerwheel:** elimination and accumulation modes, weights, a mystery wheel, plus yes/no, number, letter and colour tools.

## 2. Reverse-engineered behaviour
| # | Observation (provenance) | Derivation | Implementation |
|---|---|---|---|
| D1 | The pointer sits at the top, and the winner is the segment under it (O1, O4) | Winner = segment containing angle `mod(-rotation)` | `pointerAngle`, `angleToIndex` in `js/wheel.js` |
| D2 | Weights shown as segment size (O4) | P(i) = wᵢ/Σw, so pick the winner first, then pick the angle | `pickWinner` → `planSpin` (stop angle uniform in 14–86 % of the winning segment, so it never lands on a border) |
| D3 | The wheel slows down smoothly (O1 video frames, competitor apps) | Ease-out θ(t)=θ₀+D·(1−(1−t/T)^p) with p=3; its velocity at t=0 is v₀=pD/T | `angleAt`, `velocityAt`; a flick's v₀ sets the number of turns and T |
| D4 | "Flick speed doesn't matter" complaint (O2) | The flick should control direction, turns and duration, while fairness still comes from the CSPRNG | `gestureVelocity`, two-way `planSpin`; the chi-square test passes in both directions |
| D5 | "Not random" complaint (O2) | Use `crypto.getRandomValues` with rejection sampling (no modulo bias) | `js/rng.js`; tested with chi-square on 2,000+ landings |
| D6 | Tick sound and pointer bounce at each peg (competitor apps) | Fire a tick whenever floor(θ/segment) changes; the pointer's spring is driven by speed | `WheelView` + WebAudio `fx.tick` + `navigator.vibrate` |
| D7 | Remove-winner / elimination (O4) | Mark the segment `out`; `activeSegments` filters it out; a reset button restores it | `recordResult`, `resetElimination` |
| D8 | Card preview clipped at the edge (O1) | Draw the full wheel into a canvas larger than its box, with `overflow:hidden` | `.prev-wrap` / `drawPreview` |
| D9 | Coin progress on challenge cards (O1) | Coins earned per category ÷ total available | `challengeTotal`, `earned` in `js/game.js` |
| D10 | Share wheels by URL (O4) | Wheel JSON → deflate-raw → base64url in `#w=`, so no server is needed | `encodeShare` / `decodeShare` |

## 3. Inferences (I) — design decisions for Mahdieh
- **I1. No ads, paywall, account or tracking.** This removes the #1 complaint. The app is fully offline (service worker), with zero network requests, which e2e checks.
- **I2. Coins only unlock cosmetic pointer skins.** Themes are never locked, so nothing she needs is gated.
- **I3. Persian first:** RTL, Vazirmatn bundled, Persian digits, Jalali dates and Persian relative times ("۳ ساعت پیش").
- **I4. Personal content:**
  - Law quiz (with source articles), emoji quiz, Clash Royale challenges.
  - Cat play, home chores, outfit colour, driving drills and directions.
  - Truth or dare, food.
- **I5. Bulk paste** (one item per line or comma-separated; `text*3` triples the weight) and unlimited history (capped at 500 per wheel), with a stats chart.

## 4. Unknowns (U)
- **U1.** The reference app's exact easing curve and RNG. It's closed source, so D3 and D5 are our own designs, not copies.
- **U2.** Whether the reference biases results. There's no evidence either way; ours is provably unbiased (tests).
- **U3.** iOS Safari haptics: `navigator.vibrate` doesn't exist on iOS, so haptics silently do nothing there. Sound plus visual bounce stand in for them.
- **U4.** A real-device test on her iPhone is still pending; all checks so far ran in headless Chrome with iPhone emulation (390×844, DPR 2).
