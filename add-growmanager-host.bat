@echo off
:: Ce script ajoute "growmanager" dans le fichier hosts Windows.
:: Doit etre execute en tant qu'Administrateur (clic droit -> Executer en tant qu'admin)

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR : Relancez ce script en tant qu'Administrateur.
    echo Clic droit sur le fichier -> "Executer en tant qu'administrateur"
    pause
    exit /b 1
)

:: Vérifie si la ligne existe déjà
findstr /C:"growmanager" %SystemRoot%\System32\drivers\etc\hosts >nul 2>&1
if %errorlevel% equ 0 (
    echo "growmanager" est deja dans le fichier hosts.
    pause
    exit /b 0
)

:: Ajoute la ligne
echo.>> %SystemRoot%\System32\drivers\etc\hosts
echo 127.0.0.1    growmanager>> %SystemRoot%\System32\drivers\etc\hosts

echo OK - "growmanager" ajoute. Tu peux maintenant ouvrir http://growmanager dans ton navigateur.
pause
