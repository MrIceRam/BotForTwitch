@echo off
rem Starts the bot from the folder where this file is, so the project can live in any folder.
rem Desktop icon: right-click this file - Send to - Desktop (create shortcut).
cd /d "%~dp0"

if not exist node_modules (
    echo Installing Node.js packages...
    call npm install
    if errorlevel 1 goto failed
)

python -c "import requests, keyboard, win32file" >nul 2>nul
if errorlevel 1 (
    echo Installing Python packages...
    python -m pip install -r requirements.txt
)

node src\index.js
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Something went wrong - see the messages above.
pause
