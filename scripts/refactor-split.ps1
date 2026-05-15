$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $root 'lumentech-erp.html'
$cssOutPath = Join-Path $root 'styles.css'
$jsDir = Join-Path $root 'js'
$dbOutPath = Join-Path $jsDir 'db.js'

if (-not (Test-Path $jsDir)) { New-Item -ItemType Directory -Path $jsDir | Out-Null }

$lines = Get-Content -Path $htmlPath -Encoding UTF8

# Sanity checks: lines are 0-indexed in PS arrays, file lines are 1-indexed
if ($lines[16] -notmatch '^<style>') { throw "Linha 17 nao e <style>: $($lines[16])" }
if ($lines[3491] -notmatch '^</style>') { throw "Linha 3492 nao e </style>: $($lines[3491])" }
if ($lines[3583] -notmatch '^<script>') { throw "Linha 3584 nao e <script>: $($lines[3583])" }
if ($lines[3657] -notmatch '^// STORAGE') { throw "Linha 3658 nao e // STORAGE: $($lines[3657])" }
if ($lines[3658] -notmatch '^const STORAGE_KEY') { throw "Linha 3659 nao e STORAGE_KEY: $($lines[3658])" }
if ($lines[4026] -notmatch '^\}') { throw "Linha 4027 nao fecha nextId: $($lines[4026])" }
if ($lines[32568] -notmatch '^const AUTH') { throw "Linha 32569 nao e AUTH: $($lines[32568])" }

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# CSS: linhas 18..3491 (idx 17..3490)
$cssContent = ($lines[17..3490]) -join "`r`n"
[System.IO.File]::WriteAllText($cssOutPath, $cssContent + "`r`n", $utf8NoBom)

# DB JS: linhas 3658..4027 (idx 3657..4026)
$dbContent = ($lines[3657..4026]) -join "`r`n"
[System.IO.File]::WriteAllText($dbOutPath, $dbContent + "`r`n", $utf8NoBom)

# Reconstruir HTML
$newLines = New-Object System.Collections.Generic.List[string]

# 1..16 -> preamble (idx 0..15)
$newLines.AddRange([string[]]$lines[0..15])

# Substituir bloco <style> por <link>
$newLines.Add('<link rel="stylesheet" href="styles.css">')

# 3493..3583 -> body content ate antes do <script> (idx 3492..3582)
$newLines.AddRange([string[]]$lines[3492..3582])

# Adicionar tags de scripts externos antes do <script> inline
$newLines.Add('<script src="js/db.js"></script>')
$newLines.Add('<script src="js/auth.js"></script>')

# linha 3584 <script> (idx 3583)
$newLines.Add($lines[3583])

# 3585..3657 -> ICONS, MENU (idx 3584..3656)
$newLines.AddRange([string[]]$lines[3584..3656])

# SKIP 3658..4027 (extraido pra db.js)

# 4028..32568 -> resto do app ate antes do AUTH (idx 4027..32567)
$newLines.AddRange([string[]]$lines[4027..32567])

# SKIP linha 32569 (AUTH, extraido pra auth.js)

# 32570..fim (idx 32569..end)
$newLines.AddRange([string[]]$lines[32569..($lines.Count - 1)])

$newHtml = ($newLines -join "`r`n") + "`r`n"
[System.IO.File]::WriteAllText($htmlPath, $newHtml, $utf8NoBom)

Write-Output ("OK: styles.css ({0} linhas), js/db.js ({1} linhas), HTML reconstruido ({2} linhas)" -f ($lines[17..3490].Count), ($lines[3657..4026].Count), $newLines.Count)
