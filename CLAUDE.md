# Catchphrase — Project Notes

Offline-first PWA, Catchphrase-style party word game. Plain HTML/CSS/JS,
no build step, no framework, no backend. Deployed via GitHub Pages at
`https://huneybadge1.github.io/Phrase-hot-potato/`, repo
`huneybadge1/Phrase-hot-potato` (remote `origin`).

## Deploy workflow (every change follows this)

1. Edit files.
2. Bump `js/version.js`'s `APP_VERSION` (e.g. `"v28"` → `"v29"`) — this is
   the **single source of truth** for the version. `sw.js` derives its
   cache name from it via `importScripts("./js/version.js")`, and the
   on-screen version badge (top-left) reads it directly. Never hardcode
   a separate cache-version string in `sw.js`.
3. Verify locally (`.claude/launch.json` runs `serve.ps1` on :8080 — a
   hand-rolled PowerShell static server, since this machine has no
   node/python). Use the Browser pane; always clear SW/caches
   (`caches.keys()...delete`, `serviceWorker.getRegistrations()...unregister()`)
   before testing a change, since it's a cache-first service worker.
4. `git add -A && git commit -m "..." && git push` — GitHub Pages
   auto-deploys `main`. Poll for the new version live before telling the
   user it's done:
   `until curl -s ".../js/version.js" | grep -q "vNN"; do sleep 5; done`
5. Tell the user to force-close and fully reopen the app once (not just
   background it) to pick up the update — the app auto-reloads itself
   once a new service worker takes control (`controllerchange` listener
   in `app.js`), but that only fires after the update finishes
   installing in the background.

## User's testing constraint (important)

The user has explicitly said, at least once, that they're in a quiet
space and do **not** want real audio played through their speakers
during verification. When testing anything that calls `GameAudio.*`,
mute it first by monkey-patching the function (e.g.
`GameAudio.correct = function() {};`) before triggering the click that
would invoke it — never let a real oscillator start during automated
testing unless the user has explicitly cleared it for that session.

## File map

- `index.html` — all screens/modals in one file, `hidden` attribute
  toggles visibility (`.screen[hidden] { display:none }` — note:
  `[hidden]` needs an explicit override, `.screen { display:flex }`
  alone will beat the UA stylesheet's `[hidden]` rule otherwise).
- `css/style.css` — one file, dark theme, CSS custom properties in `:root`.
- `js/version.js` — `APP_VERSION` constant. Loaded first, before everything else.
- `js/stats.js` — local-only play-stat logging (localStorage), exportable
  as JSON via the "Export Play Data" button (now inside the Game Options
  modal). Never lets a storage failure interrupt gameplay (try/catch everywhere).
- `js/audio.js` — Web Audio synthesis (`beep`, `buzzer`, `correct`). No
  bundled audio files. `unlock()` must run on a real user-gesture click
  (Start Round) for iOS.
- `js/words.js` — word pool, 15-min repeat cooldown, difficulty-based
  draw weighting (see below).
- `js/game.js` — round timer state machine, scoring, pause/resume,
  sudden-death buzzer extension.
- `js/app.js` — DOM wiring/rendering, the biggest file. IIFE, `els`
  object caches all DOM refs by id.
- `sw.js` — cache-first service worker, `importScripts` the version.
- `catchphrase-words.json` — the word bank (see below).
- `manifest.json` — PWA manifest, `orientation: landscape` (mostly
  ignored by iOS Safari, which is why the JS-side rotate overlay + pause
  logic exists).
- `serve.ps1` / `.claude/launch.json` — local dev server only, not deployed.
- `tools/` — maintenance/sanity-check PowerShell scripts (beep-curve sim,
  difficulty-draw balance, slur scan, near-dup finder). Not part of the
  app. See `tools/README.md`.

## Word bank

`catchphrase-words.json`: array of `{ phrase, category, difficulty }`.
Currently **5,588 entries** across 14 categories (`people`, `movies-tv`,
`music`, `books-characters`, `brands-products`, `food-drink`,
`places-landmarks`, `animals`, `objects`, `activities-sports`,
`idioms-sayings`, `science-nature`, `internet-slang`, `events-holidays`).
`difficulty` is `1` (easy) / `2` (medium) / `3` (hard), tagged by 14
parallel background agents against explicit calibration examples — 100%
matched, no defaults needed. Distribution: ~3,503 easy / 1,762 medium /
323 hard.

**Generation history**: built up over ~4 rounds (broad generation →
"second tier" top-ups → live web-search pass for genuinely current
2026 events/slang → lateral "overlooked but mainstream" pass), each
progressively harder to find genuinely new non-duplicate entries
(yield dropped from ~15% to ~35% depending on how the agents were
briefed). A real recurring bug: **exact-string dedup misses near-
duplicates** — accent variants (`Pele`/`Pelé`), leading-word variants
(`Terminator`/`The Terminator`), punctuation variants (`Once Bitten
Twice Shy`/`Once Bitten, Twice Shy`). Run `tools/dedup-words.ps1`
(diacritic-stripping + prefix/punctuation-normalizing fuzzy pass) across
the **whole** file (not just new entries) after any bulk addition — it's
report-only because not everything that matches is a true duplicate
(e.g. `Notebook` the object vs `The Notebook` the movie are genuinely
different; use judgment).

**Content bar**: family-friendly through edgy/adult as seasoning
(~10-15%), zero slurs/hate (hard rule — `tools/check-slurs.ps1` scans
the bank against the root-string denylist in `tools/slur-roots.txt`,
expect harmless false positives like "raccoon"/"Old Spice" containing
substring matches). Recognizability bar is deliberately high — several
rounds specifically **removed** obscure entries added by earlier
passes (niche dishes, technical jargon, dead memes, novelty holidays).
If asked to add more words, expect diminishing returns and hold the
line on obscurity rather than padding counts.

## Key gameplay mechanics and their tuning history

- **Beep curve** (`js/game.js`): `MIN_BEEP_INTERVAL_MS=180`,
  `MAX_BEEP_INTERVAL_MS=1500`, `BEEP_EASING_POWER=1` (linear — every
  speed tier gets roughly equal wall-clock time). This took several
  iterations: the original power (2.2) was **backwards** — it gave the
  *fastest* tier the *most* time (31.5s of a 90s round vs 4.4s for
  slowest), which is why the ending felt endlessly frantic. Don't
  reintroduce a power >1 without checking the time-per-tier distribution
  first — run `tools/beep-curve-sim.ps1` (decile-buckets the beep
  schedule, reports wall-clock time per speed tier).
- **Sudden-death extension**: `LATE_GOTIT_THRESHOLD_MS=5000`,
  `LATE_GOTIT_EXTENSION_MS=5000` — Got It within 5s of the buzzer grants
  +5s, can chain indefinitely if it keeps happening near the tail.
- **Difficulty-aware draw** (`js/words.js`): weights the *next* draw by
  distance from the *previous* draw's difficulty tier
  (`DIFFICULTY_DISTANCE_WEIGHTS = { 0: 0.5, 1: 1.0, 2: 0.2 }`) — this is
  deliberately a "dampen swings" design (favor adjacent tiers, mildly
  discount repeating the same tier, heavily discount a full hard↔easy
  jump), **not** a "just avoid repeats" design. An earlier version only
  discounted repeats and didn't fix the actual complaint (a hard word
  immediately followed by a trivial one) — verify any future change
  against `P(easy | previous was hard)` specifically, not just "does
  hard cluster less." `tools/difficulty-draw-sim.ps1` prints that
  probability table (currently `P(easy | prev hard) = 26.7%` vs a 62.7%
  unweighted baseline).
- **Round pause**: pauses on portrait rotation OR `document.hidden`
  (backgrounded/screen-locked), resumes preserving exact remaining time.
  `screen.orientation.lock()` is also attempted as a bonus (works on
  some Android) but iOS Safari doesn't support it at all — the pause
  logic is the real fix, not the lock attempt.

## Known environment quirks

- No node/python on this machine. PowerShell (`System.Text` etc.) is
  used for all word-bank JSON manipulation.
- **PowerShell gotcha**: `[Math]::Min(1, ...)` / `[Math]::Max(0, ...)`
  can silently resolve to the `(Int32, Int32)` overload if given bare
  int literals, truncating/rounding a double argument. Always use
  `0.0`/`1.0` literals when the other argument is a double. This caused
  a real bug once (crude stepped output instead of a smooth curve) in a
  one-off WAV-preview-generation script — never made it into the actual
  app (plain JS has no such overload ambiguity).
- **Get-Content encoding gotcha**: always pass `-Encoding UTF8` (and use
  `[System.Text.UTF8Encoding]::new($false)` for writing, no BOM) —
  otherwise accented characters get mangled (mojibake) on read.
- **PowerShell variable/param name collision**: variable names are
  case-insensitive, so a script-local `$roots` *is* the `param([string]
  $Roots)` — and the `[string]` constraint silently turns
  `$roots = @()` + `$roots += "x"` into string concatenation (one blob,
  `.Count` = 1). Bit `tools/check-slurs.ps1` once. Don't reuse a param's
  name (any casing) for a differently-typed local.
- Keep `tools/*.ps1` ASCII-only — Windows PowerShell 5.1 reads `.ps1` as
  the system codepage, so an em-dash in a string literal is a parse
  error. (Data files they read are fine, they're opened `-Encoding UTF8`.)
- Service worker updates: `reg.update()` + a `controllerchange` listener
  that force-reloads once. Even so, a *stale HTML + fresh JS* mismatch
  can happen if a user's device gets caught mid-update — the app is
  defensively coded so a missing DOM element (from a stale cache) never
  throws and blocks core gameplay (null-guards + try/catch around all
  cosmetic features). Keep that pattern for any new optional UI feature.

## Things intentionally *not* built (with reasons, don't re-litigate without new info)

- **Automatic voice-based disqualification**: would require cloud speech
  recognition (breaks the offline/airplane-mode requirement), iOS
  Safari's Web Speech API support is unreliable especially in installed
  PWAs, and party-room noise would cause real false positives/negatives.
  The manual score +/- buttons (idle screen) are the agreed practical
  substitute — a human notices the slip and taps it themselves.
