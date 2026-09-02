# Beep-curve simulation / sanity check.
#
# Replays the exact accelerating-beep schedule from js/game.js (tick()):
#   frac     = remainingMs / totalDurationMs        (clamped 0..1)
#   eased    = frac ^ BEEP_EASING_POWER
#   interval = MIN + (MAX - MIN) * eased            (clamped to remainingMs)
#
# then buckets every beep into 10 "speed tiers" by its interval length and
# reports how much WALL-CLOCK TIME the round spends in each tier. The design
# goal (see CLAUDE.md) is roughly equal time per tier - a power > 1 secretly
# hands the *fastest* tier the *most* time, which is the bug that made the
# old 2.2 curve feel endlessly frantic near the buzzer. Run this before
# shipping any curve change.
#
# Usage:
#   pwsh tools/beep-curve-sim.ps1
#   pwsh tools/beep-curve-sim.ps1 -Power 2.2 -RoundSeconds 90
#   pwsh tools/beep-curve-sim.ps1 -MinMs 180 -MaxMs 1500 -Power 1

param(
    [double]$MinMs        = 180,
    [double]$MaxMs        = 1500,
    [double]$Power        = 1,
    [double]$RoundSeconds = 90,
    [int]   $Tiers        = 10
)

$total = $RoundSeconds * 1000.0
$remaining = $total

$tierTime  = New-Object 'double[]' $Tiers
$tierCount = New-Object 'int[]'    $Tiers
$beeps = 0

while ($remaining -gt 0) {
    $frac  = [Math]::Max(0.0, [Math]::Min(1.0, $remaining / $total))
    $eased = [Math]::Pow($frac, $Power)
    $interval = $MinMs + ($MaxMs - $MinMs) * $eased
    if ($interval -gt $remaining) { $interval = $remaining }

    # Which speed tier does this interval fall in? tier 0 = fastest (near MinMs).
    $span = ($MaxMs - $MinMs)
    $tierIdx = if ($span -le 0) { 0 } else { [int]([Math]::Floor((($interval - $MinMs) / $span) * $Tiers)) }
    if ($tierIdx -lt 0)        { $tierIdx = 0 }
    if ($tierIdx -ge $Tiers)   { $tierIdx = $Tiers - 1 }

    $tierTime[$tierIdx]  += $interval
    $tierCount[$tierIdx] += 1
    $beeps++
    $remaining -= $interval
}

Write-Host ""
Write-Host ("Round {0:N1}s  |  interval {1:N0}..{2:N0} ms  |  power {3}  |  {4} beeps" -f `
    $RoundSeconds, $MinMs, $MaxMs, $Power, $beeps)
Write-Host ""
Write-Host ("{0,-22} {1,10} {2,10} {3,8}" -f 'speed tier (ms)', 'wall time', '% of round', 'beeps')
Write-Host ('-' * 54)

for ($i = $Tiers - 1; $i -ge 0; $i--) {
    $lo = $MinMs + ($MaxMs - $MinMs) * ($i     / [double]$Tiers)
    $hi = $MinMs + ($MaxMs - $MinMs) * (($i+1) / [double]$Tiers)
    $secs = $tierTime[$i] / 1000.0
    $pct  = 100.0 * $tierTime[$i] / $total
    $bar  = '#' * [int][Math]::Round($pct / 2)
    Write-Host ("{0,7:N0}..{1,-7:N0}  {2,9:N1}s {3,9:N1}% {4,7}  {5}" -f $lo, $hi, $secs, $pct, $tierCount[$i], $bar)
}

Write-Host ""
$spread = ($tierTime | Measure-Object -Maximum -Minimum)
Write-Host ("time spread across tiers: {0:N1}s (min) .. {1:N1}s (max)  - closer = flatter curve" -f `
    ($spread.Minimum / 1000.0), ($spread.Maximum / 1000.0))
Write-Host ""
