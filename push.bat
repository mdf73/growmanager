@echo off
cd /d "%~dp0"

if not exist "_commit_msg.txt" (
    echo Aucun message de commit trouve.
    pause
    exit /b 1
)

echo.
echo === Nettoyage de l'index git ===
if exist ".git\index.lock" del ".git\index.lock"
git restore --staged .

echo.
echo === Montee de version automatique ===
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js introuvable dans le PATH — bump de version ignore.
) else (
    node version-bump.js
    if errorlevel 1 (
        echo ERREUR lors du bump de version. Le commit continue quand meme.
    )
)

echo.
echo === Commit en cours ===
type _commit_msg.txt
echo =======================
echo.

git add -A
git commit -F "_commit_msg.txt"
del "_commit_msg.txt"
git push

echo.
echo === Push termine ! ===
pause
