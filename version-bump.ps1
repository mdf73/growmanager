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
#
# IMPORTANT (bug corrige le 2026-07-09) : ce script lit/ecrit TOUJOURS les
# fichiers via [System.IO.File]::ReadAllText/WriteAllText avec un encodage
# UTF8 SANS BOM explicite. Ne JAMAIS utiliser Get-Content/Set-Content avec
# -Encoding UTF8 ici : sur Windows PowerShell 5.1, Get-Content sans -Encoding
# lit avec l'encodage ANSI de la machine (pas UTF-8), ce qui corrompt tous
# les caracteres accentues (mojibake, ex: "e" devient "Ã©"). Et
# Set-Content -Encoding UTF8 ajoute un BOM (EF BB BF) que JSON.parse rejette.
# Les deux bugs ont corrompu package.json/package-lock.json/main.py/
# CHANGELOG.md des le premier run reel (accents mojibake + BOM + meme un
# fichier tronque). D'ou l'usage exclusif de l'API .NET ci-dessous, stable
# sur PowerShell 5.1 et 7+. Teste en local avec des accents + un vrai
# package-lock.json de 4484 lignes avant livraison.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8($path) {
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8($path, $content) {
    [System.IO.File]::WriteAllText($path, $content, $Utf8NoBom)
}

$commitMsgPath = Join-Path $root "_commit_msg.txt"
$pkgPath       = Join-Path $root "frontend\package.json"
$lockPath      = Join-Path $root "frontend\package-lock.json"
$mainPyPath    = Join-Path $root "backend\app\main.py"
$changelogPath = Join-Path $root "CHANGELOG.md"

if (-not (Test-Path $commitMsgPath)) {
    Write-Host "[version-bump] _commit_msg.txt introuvable - bump ignore."
    exit 0
}

$commitMsg = Read-Utf8 $commitMsgPath
$firstLine = ($commitMsg -split "`r?`n")[0].Trim()
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

$pkgContent = Read-Utf8 $pkgPath
if ($pkgContent -notmatch '"version":\s*"(\d+)\.(\d+)\.(\d+)"') {
    Write-Host "[version-bump] Version introuvable dans package.json - bump annule."
    exit 1
}

$oldVersion = $Matches[1] + "." + $Matches[2] + "." + $Matches[3]
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
        $before = Read-Utf8 $f
        $after = [regex]::Replace($before, "`"version`":\s*`"$oldEscaped`"", "`"version`": `"$newVersion`"")
        if ($after.Length -lt ($before.Length - 50)) {
            Write-Host "[version-bump] ERREUR : $f semble tronque apres remplacement (avant=$($before.Length) apres=$($after.Length) car.) - fichier NON modifie."
            exit 1
        }
        Write-Utf8 $f $after
    }
}

# backend/app/main.py : version="X.Y.Z" et "version": "X.Y.Z"
if (Test-Path $mainPyPath) {
    $before = Read-Utf8 $mainPyPath
    $after = [regex]::Replace($before, "version=`"$oldEscaped`"", "version=`"$newVersion`"")
    $after = [regex]::Replace($after, "`"version`":\s*`"$oldEscaped`"", "`"version`": `"$newVersion`"")
    if ($after.Length -lt ($before.Length - 50)) {
        Write-Host "[version-bump] ERREUR : main.py semble tronque apres remplacement - fichier NON modifie."
        exit 1
    }
    Write-Utf8 $mainPyPath $after
} else {
    Write-Host "[version-bump] backend/app/main.py introuvable - sync ignoree."
}

# CHANGELOG.md : Unreleased -> version datee, nouvelle section Unreleased vide
if (Test-Path $changelogPath) {
    $before = Read-Utf8 $changelogPath
    $marker = "## [Unreleased]"
    if ($before.Contains($marker)) {
        $today = Get-Date -Format "yyyy-MM-dd"
        $replacement = "$marker`n`n*(prochaines modifications en cours)*`n`n---`n`n## [$newVersion] - $today"
        $idx = $before.IndexOf($marker)
        $after = $before.Substring(0, $idx) + $replacement + $before.Substring($idx + $marker.Length)
        if ($after.Length -lt ($before.Length - 50)) {
            Write-Host "[version-bump] ERREUR : CHANGELOG.md semble tronque apres remplacement - fichier NON modifie."
            exit 1
        }
        Write-Utf8 $changelogPath $after
    } else {
        Write-Host "[version-bump] Section '## [Unreleased]' introuvable dans CHANGELOG.md - non modifie."
    }
} else {
    Write-Host "[version-bump] CHANGELOG.md introuvable - non modifie."
}

Write-Host "[version-bump] Nouvelle version : v$newVersion"
exit 0
