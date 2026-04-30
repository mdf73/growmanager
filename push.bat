@echo off
cd /d "%~dp0"

if not exist "_commit_msg.txt" (
    echo Aucun message de commit trouve.
    pause
    exit /b 1
)

echo.
echo === Commit en cours ===
type _commit_msg.txt
echo =======================
echo.

git add .
git commit -F "_commit_msg.txt"
del "_commit_msg.txt"
git push

echo.
echo === Push termine ! ===
pause
