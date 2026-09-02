# Difficulty-draw balance check.
#
# Reproduces the weighted draw in js/words.js. Each candidate is weighted by
# DIFFICULTY_DISTANCE_WEIGHTS[ |candidate.difficulty - lastDifficulty| ]:
#   0 tiers away (same):     0.5
#   1 tier  away (adjacent): 1.0
#   2 tiers away (full jump):0.2
# so P(next tier = t | prev tier = p)  is proportional to
#   count(words at tier t) * weight(|t - p|)
#
# The design intent (CLAUDE.md) is "dampen swings", NOT "just avoid repeats".
# The number that actually matters is P(easy | previous was hard) - an early
# version only discounted exact repeats and never fixed the real complaint
# (a brutal word followed by a trivial one). Check that cell after any change.
#
# This computes the exact stationary probabilities from the pool's tier
# counts (the 15-min cooldown perturbs this only slightly in a real game).
#
# Usage:
#   pwsh tools/difficulty-draw-sim.ps1
#   pwsh tools/difficulty-draw-sim.ps1 -Json catchphrase-words.json

param(
    [string]$Json = "catchphrase-words.json",
    [hashtable]$Weights = @{ 0 = 0.5; 1 = 1.0; 2 = 0.2 }
)

$path = if ([IO.Path]::IsPathRooted($Json)) { $Json } else { Join-Path (Get-Location) $Json }
$words = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json

$count = @{ 1 = 0; 2 = 0; 3 = 0 }
foreach ($w in $words) {
    $d = if ($w.difficulty) { [int]$w.difficulty } else { 2 }
    $count[$d]++
}

$label = @{ 1 = 'easy'; 2 = 'medium'; 3 = 'hard' }

Write-Host ""
Write-Host ("pool: {0} words  -  easy {1} / medium {2} / hard {3}" -f `
    $words.Count, $count[1], $count[2], $count[3])
Write-Host ""
Write-Host "P(next tier | previous tier):"
Write-Host ""
Write-Host ("{0,-14} {1,10} {2,10} {3,10}" -f 'prev \ next', 'easy', 'medium', 'hard')
Write-Host ('-' * 46)

foreach ($p in 1, 2, 3) {
    $scores = @{}
    $tot = 0.0
    foreach ($t in 1, 2, 3) {
        $dist = [Math]::Abs($t - $p)
        $scores[$t] = $count[$t] * [double]$Weights[$dist]
        $tot += $scores[$t]
    }
    $row = "{0,-14}" -f ("was " + $label[$p])
    foreach ($t in 1, 2, 3) {
        $row += "{0,9:P1} " -f ($scores[$t] / $tot)
    }
    Write-Host $row
}

Write-Host ""
# Spell out the cell that matters.
$p = 3
$tot = 0.0; $easy = 0.0
foreach ($t in 1, 2, 3) {
    $s = $count[$t] * [double]$Weights[[Math]::Abs($t - $p)]
    $tot += $s
    if ($t -eq 1) { $easy = $s }
}
Write-Host ("P(easy | previous was hard) = {0:P1}" -f ($easy / $tot))
Write-Host ("  (unweighted baseline would be {0:P1})" -f ($count[1] / [double]$words.Count))
Write-Host ""
