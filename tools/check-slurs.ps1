# Slur / hate-term scan for catchphrase-words.json.
#
# Hard rule (CLAUDE.md): zero slurs, zero hate terms in the word bank.
# Family-friendly-through-edgy is fine; slurs are not, ever.
#
# Matches each phrase against the ROOT strings in tools/slur-roots.txt
# (one per line, '#' comments ignored, case-insensitive substring match).
# Root-string matching deliberately over-catches: expect harmless false
# positives where a slur root is a substring of an innocent word
# ("raccoon", "Old Spice", "Scunthorpe"). Eyeball every hit; a hit is a
# problem only if the phrase itself is the slur.
#
# Exit code is non-zero if any phrase matches, so this can gate a commit.
#
# Usage:
#   pwsh tools/check-slurs.ps1
#   pwsh tools/check-slurs.ps1 -Json catchphrase-words.json

param(
    [string]$Json     = "catchphrase-words.json",
    [string]$RootFile = ""
)

$here      = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$rootsPath = if ($RootFile) { $RootFile } else { Join-Path $here "slur-roots.txt" }
$jsonPath  = if ([IO.Path]::IsPathRooted($Json)) { $Json } else { Join-Path (Get-Location) $Json }

if (-not (Test-Path $rootsPath)) {
    Write-Error "root list not found: $rootsPath"
    exit 2
}

$roots = @()
foreach ($line in (Get-Content -Encoding UTF8 $rootsPath)) {
    $t = $line.Trim()
    if ($t -and -not $t.StartsWith('#')) { $roots += $t.ToLowerInvariant() }
}

$words = Get-Content -Raw -Encoding UTF8 $jsonPath | ConvertFrom-Json

$hits = New-Object System.Collections.ArrayList
foreach ($w in $words) {
    $p = $w.phrase.ToLowerInvariant()
    foreach ($r in $roots) {
        if ($p.Contains($r)) {
            [void]$hits.Add([pscustomobject]@{ Phrase = $w.phrase; Category = $w.category; Root = $r })
            break
        }
    }
}

Write-Host ""
Write-Host ("scanned {0} phrases against {1} root strings" -f $words.Count, $roots.Count)
Write-Host ""

if ($hits.Count -eq 0) {
    Write-Host "clean - no matches" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host ("{0} match(es) - review each (most are expected substring false positives):" -f $hits.Count) -ForegroundColor Yellow
Write-Host ""
foreach ($h in $hits) {
    Write-Host ("    {0,-40} {1,-22} <- '{2}'" -f $h.Phrase, $h.Category, $h.Root)
}
Write-Host ""
exit 1
