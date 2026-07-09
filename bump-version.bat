@echo off
cd /d "%~dp0"

echo.
echo ===================================
echo   GrowManager — Montee de version
echo ===================================
echo.
echo NOTE : depuis v3.4.0, push.bat bump la version TOUT SEUL
echo (via version-bump.js, en lisant le prefixe de _commit_msg.txt :
echo  feat -^> minor, fix/chore/... -^> patch, feat!/BREAKING -^> major).
echo N'utilise ce script que pour un bump manuel exceptionnel
echo (ex: forcer un major hors convention).
echo.
echo Version actuelle :
node -e "const p=require('./frontend/package.json'); console.log('  v' + p.version);"
echo.
echo Choisir le type de montee :
echo   [1] patch  — correction de bug     (0.1.0 -^> 0.1.1)
echo   [2] minor  — nouvelle fonctionnalite (0.1.0 -^> 0.2.0)
echo   [3] major  — refonte majeure        (0.1.0 -^> 1.0.0)
echo   [0] Annuler
echo.
set /p CHOIX="Ton choix (1/2/3/0) : "

if "%CHOIX%"=="0" (
    echo Annule.
    pause
    exit /b 0
)
if "%CHOIX%"=="1" set TYPE=patch
if "%CHOIX%"=="2" set TYPE=minor
if "%CHOIX%"=="3" set TYPE=major

if not defined TYPE (
    echo Choix invalide.
    pause
    exit /b 1
)

echo.
echo Bump de version : %TYPE%

cd frontend
call npm version %TYPE% --no-git-tag-version
cd ..

echo.
echo Nouvelle version :
node -e "const p=require('./frontend/package.json'); console.log('  v' + p.version);"

echo.
echo N'oublie pas de :
echo   1. Mettre a jour CHANGELOG.md
echo   2. Lancer push.bat avec le message de commit
echo.
pause
