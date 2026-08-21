@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Ollama UI needs Node.js 22 or newer.
  echo Install it from https://nodejs.org then run run.cmd again.
  exit /b 1
)

if not exist node_modules (
  echo Installing Ollama UI...
  call npm install
  if errorlevel 1 exit /b 1
)

if defined PORT goto start
set PORT=8080

:start
echo Starting Ollama UI at http://127.0.0.1:%PORT%
echo Leave this window open. Open that address in your browser.
call npm run dev -- --host 0.0.0.0 --port %PORT% --strictPort false
if errorlevel 1 (
  echo.
  echo If the port was busy, run: set PORT=8081 ^&^& run.cmd
)
