# Bump automatique de version, appele par push.bat avant chaque commit.
#
# - Lit la premiere ligne de _commit_msg.txt pour deviner le type de bump
#   (convention conventional commits, deja utilisee dans ce projet) :
#     feat:              -> minor
#     feat!: / BREAKING  -> major
#     fix/chore/refactor/docs/ci/style/perf/test/wiki -> patch
# - Bump frontend/package.json + package-lock.json (remplacement texte, pas
#   de reformattage du fichier)
# - Synchronise backend/app/main.py (2 occurrences de version="X.Y.Z")
# - Transforme la section "## [Unreleased]" de CHANGELOG.md en
#   "## [X.Y.Z] - YYYY-MM-DD" et recree une section Unreleased vide au-dessus
#
# Ne fait rien (exit 0, aucun bump) si _commit_msg.txt est absent.
# Pur PowerShell, aucune dependance externe (pas besoin de Node/npm).

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$commitMsgPath = Join-Path $root "_commit_msg.txt"
$pkgPath       = Join-Path $root "frontend\package.json"
$lockPath      = Join-Path $root "frontend\package-lock.json"
$mainPyPath    = Join-Path $root "backend\app\main.py"
$changelogPath = Join-Path $root "CHANGELOG.md"

if (-not (Test-Path $commitMsgPath)) {
    Write-Host "[version-bump] _commit_msg.txt introuvable - bump ignore."
    exit 0
}

$firstLine = (Get-Content $commitMsgPath -TotalCount 1).Trim()
Write-Host "[version-bump] Message : `"$firstLine`""

$bumpType = "patch"
if ($firstLine -match "BREAKING CHANGE" -or $firstLine -match "^[a-zA-Z]+(\([^)]*\))?!:") {
    $bumpType = "major"
} elseif ($firstLine -match "^feat(\([^)]*\))?:") {
    $bumpType = "minor"
}
Write-Host "[version-bump] Type de bump detecte : $bumpType"

if (-not (Test-Path $pkgPath)) {
    Write-Host "[version-bump] frontend/package.json introuvable - bump annule."
    exit 1
}

$pkgContent = Get-Content $pkgPath -Raw
if ($pkgContent -notmatch '"version":\s*"(\d+)\.(\d+)\.(\d+)"') {
    Write-Host "[version-bump] Version introuvable dans package.json - bump annule."
    exit 1
}

$oldVersion = $Matches[0] -replace '.*"(\d+\.\d+\.\d+)".*', '$1'
$major = [int]$Matches[1]
$minor = [int]$Matches[2]
$patch = [int]$Matches[3]

switch ($bumpType) {
    "major" { $major++; $minor = 0; $patch = 0 }
    "minor" { $minor++; $patch = 0 }
    "patch" { $patch++ }
}
$newVersion = "$major.$minor.$patch"
Write-Host "[version-bump] $oldVersion -> $newVersion"

$oldEscaped = [regex]::Escape($oldVersion)

# frontend/package.json + package-lock.json : "version": "X.Y.Z"
foreach ($f in @($pkgPath, $lockPath)) {
    if (Test-Path $f) {
        $c = Get-Content $f -Raw
        $c = [regex]::Replace($c, "`"version`":\s*`"$oldEscaped`"", "`"version`": `"$newVersion`"")
        Set-Content -Path $f -Value $c -NoNewline -Encoding UTF8
    }
}

# backend/app/main.py : version="X.Y.Z" et "version": "X.Y.Z"
if (Test-Path $mainPyPath) {
    $c = Get-Content $mainPyPath -Raw
    $c = [regex]::Replace($c, "version=`"$oldEscaped`"", "version=`"$newVersion`"")
    $c = [regex]::Replace($c, "`"version`":\s*`"$oldEscaped`"", "`"version`": `"$newVersion`"")
    Set-Content -Path $mainPyPath -Value $c -NoNewline -Encoding UTF8
} else {
    Write-Host "[version-bump] backend/app/main.py introuvable - sync ignoree."
}

# CHANGELOG.md : Unreleased -> version datee, nouvelle section Unreleased vide
if (Test-Path $changelogPath) {
    $c = Get-Content $changelogPath -Raw
    $marker = "## [Unreleased]"
    if ($c.Contains($marker)) {
        $today = Get-Date -Format "yyyy-MM-dd"
        $replacement = "$marker`n`n*(prochaines modifications en cours)*`n`n---`n`n## [$newVersion] - $today"
        $idx = $c.IndexOf($marker)
        $c = $c.Substring(0, $idx) + $replacement + $c.Substring($idx + $marker.Length)
        Set-Content -Path $changelogPath -Value $c -NoNewline -Encoding UTF8
    } else {
        Write-Host "[version-bump] Section '## [Unreleased]' introuvable dans CHANGELOG.md - non modifie."
    }
} else {
    Write-Host "[version-bump] CHANGELOG.md introuvable - non modifie."
}

Write-Host "[version-bump] Nouvelle version : v$newVersion"
exit 0
