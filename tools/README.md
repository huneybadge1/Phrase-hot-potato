# tools/

One-off maintenance and sanity-check scripts. **Not part of the app** — GitHub
Pages serves this folder but nothing links to it. All PowerShell (this machine
has no node/python). Run from the repo root.

| script | what it does |
|---|---|
| `beep-curve-sim.ps1` | Replays the accelerating-beep schedule from `js/game.js` and buckets beeps into 10 speed tiers, reporting wall-clock time per tier. Run before changing `MIN_BEEP_INTERVAL_MS` / `MAX_BEEP_INTERVAL_MS` / `BEEP_EASING_POWER`. |
| `difficulty-draw-sim.ps1` | Computes `P(next difficulty tier \| previous tier)` for the weighted draw in `js/words.js`, and spells out `P(easy \| previous was hard)` — the number that actually matters. Run after any change to `DIFFICULTY_DISTANCE_WEIGHTS` or the tier mix. |
| `check-slurs.ps1` | Substring-scans `catchphrase-words.json` against the denylist in `slur-roots.txt`. Exit code non-zero on any match, so it can gate a commit. Over-catches on purpose — most hits are benign (`raccoon`, `Old Spice`). |
| `slur-roots.txt` | Denylist data for `check-slurs.ps1`. Conservative on purpose. |
| `dedup-words.ps1` | Finds near-duplicate phrases (accent / leading-article / punctuation variants) that exact-string dedup misses. Report-only — never edits the file. Run across the whole file after any bulk word addition. |

## Examples

```powershell
# is the current beep curve roughly flat across speed tiers?
pwsh tools/beep-curve-sim.ps1

# what would power 2.2 do? (the old bug: fastest tier hogs the round)
pwsh tools/beep-curve-sim.ps1 -Power 2.2

# difficulty balance after a word-bank or weight change
pwsh tools/difficulty-draw-sim.ps1

# content check + near-dup pass after adding words
pwsh tools/check-slurs.ps1
pwsh tools/dedup-words.ps1
```

On this machine use `powershell` instead of `pwsh` if PowerShell 7 isn't installed:

```powershell
powershell -NoProfile -File tools/beep-curve-sim.ps1
```

## Reference output

`beep-curve-sim.ps1 -Power 2.2` reproduces the numbers in `CLAUDE.md`
(fastest tier gets ~31.5s of a 90s round, slowest ~4.4s); the shipped
linear curve holds every tier near 9s.

`difficulty-draw-sim.ps1` on the current 5,588-word bank:
`P(easy | previous was hard) = 26.7%` vs a 62.7% unweighted baseline — the
swing-dampening is doing its job.
