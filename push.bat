@echo off
cd /d "%~dp0"

if not exist "_commit_msg.txt" (
    echo Aucun message de commit trouve.
    pause
    exit /b 1
)

set /p MSG=<_commit_msg.txt
echo.
echo === Commit en cours ===
echo %MSG%
echo =======================
echo.

git add .
git commit -m "%MSG%"
del "_commit_msg.txt"
git push

echo.
echo === Push termine ! ===
pause
