@echo off
rem Starts the bot from the folder where this file is, so the project can live in any folder.
rem If the bot crashes during a stream, it is restarted automatically after 5 seconds.
rem If it crashes right at startup 3 times in a row, the window stays open so you can read the error.
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

rem Exit codes of the bot: 0 - normal exit, 2 - crashed after working a while, anything else - crashed at startup
set crashes=0
:run
node src\index.js
set code=%errorlevel%
if "%code%"=="0" exit /b 0
if "%code%"=="2" (set crashes=0) else (set /a crashes+=1)
if %crashes% geq 3 goto failed
echo.
echo The bot crashed (code %code%). Restarting in 5 seconds... Press Ctrl+C to stop.
timeout /t 5 /nobreak >nul
goto run

:failed
echo.
echo Something went wrong - see the messages above and the logs folder.
pause
