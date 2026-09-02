# Fuzzy near-duplicate finder for catchphrase-words.json.
#
# Exact-string dedup repeatedly misses near-duplicates (CLAUDE.md):
#   - accent variants:        Pele / Pele
#   - leading-word variants:  Terminator / The Terminator
#   - punctuation variants:   Once Bitten Twice Shy / Once Bitten, Twice Shy
#
# This normalizes every phrase (lowercase, strip diacritics, drop a leading
# the/a/an, strip punctuation, collapse spaces) and reports groups that
# collide. It is REPORT-ONLY and never edits the file - not every collision
# is a true dupe (Notebook the object vs The Notebook the movie are
# genuinely different). A human resolves the list.
#
# Run it across the WHOLE file after any bulk word addition, not just the
# new rows.
#
# Usage:
#   pwsh tools/dedup-words.ps1
#   pwsh tools/dedup-words.ps1 -Json catchphrase-words.json

param(
    [string]$Json = "catchphrase-words.json"
)

function Remove-Diacritics([string]$s) {
    $n = $s.Normalize([Text.NormalizationForm]::FormD)
    -join ($n.ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
    })
}

function Get-Key([string]$phrase) {
    $k = (Remove-Diacritics $phrase).ToLowerInvariant()
    $k = $k -replace '^(the|a|an)\s+', ''      # leading article
    $k = $k -replace '&', ' and '
    $k = $k -replace "[^a-z0-9 ]", ''          # punctuation / apostrophes
    $k = $k -replace '\s+', ' '
    $k.Trim()
}

$path = if ([IO.Path]::IsPathRooted($Json)) { $Json } else { Join-Path (Get-Location) $Json }
$words = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json

$groups = @{}
foreach ($w in $words) {
    $key = Get-Key $w.phrase
    if (-not $groups.ContainsKey($key)) { $groups[$key] = New-Object System.Collections.ArrayList }
    [void]$groups[$key].Add($w)
}

$collisions = $groups.GetEnumerator() |
    Where-Object { $_.Value.Count -gt 1 } |
    Sort-Object { $_.Key }

Write-Host ""
Write-Host ("{0} total words  -  {1} normalized-key collision group(s)" -f $words.Count, $collisions.Count)
Write-Host ""

foreach ($g in $collisions) {
    Write-Host ("[{0}]" -f $g.Key) -ForegroundColor Yellow
    foreach ($w in $g.Value) {
        $d = if ($w.difficulty) { $w.difficulty } else { '?' }
        Write-Host ("    {0,-40} {1,-22} d{2}" -f $w.phrase, $w.category, $d)
    }
    Write-Host ""
}

if ($collisions.Count -eq 0) {
    Write-Host "No near-duplicates found." -ForegroundColor Green
    Write-Host ""
}
