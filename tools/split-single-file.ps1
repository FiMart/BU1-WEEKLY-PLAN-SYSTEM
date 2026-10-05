# Split weekly-plan.html (single file) into index.html + css/ + js/.
# Run once from PowerShell:  powershell -ExecutionPolicy Bypass -File ".\tools\split-single-file.ps1"
# The old file is moved to archive\weekly-plan.single-file.html.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root 'weekly-plan.html'
if (-not (Test-Path -LiteralPath $src)) { throw "weekly-plan.html not found in $root (already split?)" }
$L = [System.IO.File]::ReadAllLines($src, $utf8)

function Take([int]$a, [int]$b) { return ($L[($a-1)..($b-1)] -join "`n") }
function Put([string]$rel, [string]$text) {
  $p = Join-Path $root $rel
  $d = Split-Path $p -Parent
  if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
  [System.IO.File]::WriteAllText($p, $text.TrimEnd() + "`n", $utf8)
}

if ($L[4]    -ne '<style>')              { throw 'line 5 is not <style>' }
if ($L[1270] -ne '</style>')             { throw 'line 1271 is not </style>' }
if (-not $L[1272].StartsWith('<aside class="side"')) { throw 'line 1273 is not the sidebar' }
if ($L[1471] -ne '<script>')             { throw 'line 1472 is not <script>' }
if ($L[1472] -ne '(function(){')         { throw 'line 1473 is not the IIFE' }
if ($L[3113] -ne '})();')                { throw 'line 3114 is not the IIFE end' }
if ($L[3114] -ne '</script>')            { throw 'line 3115 is not </script>' }

$css = @(
  @('css/base.css',        6,    558, 'tokens, form controls, buttons, legacy grid, list, summary, settings, dialog, picker, motion keyframes'),
  @('css/views.css',       559,  683, 'people summary, manpower, search, dashboard basics, dialog extras, help'),
  @('css/shell.css',       684,  900, 'sidebar shell, page head, week board, job card, side drawer, worker picker'),
  @('css/theme.css',       901,  1126,'Field Ops theme: palette, typography, components'),
  @('css/attachments.css', 1127, 1141,'file attachments and transport field'),
  @('css/sidebar.css',     1142, 1158,'blue to sky sidebar'),
  @('css/dashboard.css',   1159, 1204,'dashboard detail: tiles, daily chart, tables'),
  @('css/master-data.css', 1205, 1229,'master data topic list and detail'),
  @('css/motion.css',      1230, 1270,'motion tuning: only motion that explains a change')
)
foreach ($c in $css) { Put $c[0] ("/* BU1 Weekly Plan · " + $c[3] + " */`n" + (Take $c[1] $c[2])) }

$js = @(
  @('js/core/constants.js',        1476, 1519, 'job types, periods, statuses, calendar names'),
  @('js/core/utils.js',            1520, 1563, 'DOM/date/text helpers and master data lookups'),
  @('js/core/state.js',            1564, 1583, 'app state and per-viewer preferences'),
  @('js/data/store.js',            1584, 1640, 'shared db (or in-memory store), cached range reads, week helpers'),
  @('js/data/conflicts.js',        1641, 1687, 'people/vehicle lookups and conflict detection'),
  @('js/ui/render.js',             1688, 1837, 'render loop, sidebar, filter bar, banners, week bar, shared UI bits'),
  @('js/views/plan.js',            1838, 1928, 'Weekly Plan board: rows (job type or customer) x days'),
  @('js/features/share.js',        1929, 1987, 'copy as text for LINE, screenshot, dark mode'),
  @('js/views/people.js',          1988, 2049, 'per-person daily summary'),
  @('js/views/projects.js',        2050, 2093, 'long-project manpower plan'),
  @('js/views/search.js',          2094, 2125, 'history search'),
  @('js/views/dashboard.js',       2126, 2255, 'dashboard'),
  @('js/views/settings.js',        2256, 2349, 'master data'),
  @('js/views/help.js',            2350, 2366, 'help page'),
  @('js/dialog/picker.js',         2367, 2453, 'plan drawer: Team Service picker'),
  @('js/dialog/fields.js',         2454, 2484, 'plan drawer: transport, Sale, job type options'),
  @('js/dialog/attachments.js',    2485, 2614, 'plan drawer: photos, file attachments, lightbox'),
  @('js/dialog/task-form.js',      2615, 2843, 'plan drawer: open/view/edit, validation, save, delete, copy'),
  @('js/features/master-actions.js',2844,2863, 'master data actions'),
  @('js/features/export.js',       2864, 2928, 'Excel and A3 print exports'),
  @('js/app/events.js',            2929, 3072, 'global event handlers'),
  @('js/app/boot.js',              3073, 3113, 'data wiring and start-up (loads last)')
)
foreach ($j in $js) { Put $j[0] ("'use strict';`n/* BU1 Weekly Plan · " + $j[3] + " */`n" + (Take $j[1] $j[2])) }

$reset = ':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}'
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + $reset + '</style></head><body>' + "`n")
[void]$sb.Append((Take 1 4) + "`n")
foreach ($c in $css) { [void]$sb.Append('<link rel="stylesheet" href="' + $c[0] + '">' + "`n") }
[void]$sb.Append("`n" + (Take 1273 1471) + "`n`n")
[void]$sb.Append("<!-- scripts share one global scope and must load in this order; js/app/boot.js starts the app -->`n")
foreach ($j in $js) { [void]$sb.Append('<script src="' + $j[0] + '"></script>' + "`n") }
[void]$sb.Append('</body></html>')
[System.IO.File]::WriteAllText((Join-Path $root 'index.html'), $sb.ToString(), $utf8)

$arch = Join-Path $root 'archive'
if (-not (Test-Path -LiteralPath $arch)) { New-Item -ItemType Directory -Path $arch | Out-Null }
Move-Item -LiteralPath $src -Destination (Join-Path $arch 'weekly-plan.single-file.html') -Force

Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.FullName -notmatch '\\archive\\|\\tools\\' } |
  Select-Object @{n='file';e={$_.FullName.Substring($root.Length+1)}}, Length | Format-Table -AutoSize | Out-String -Width 200
