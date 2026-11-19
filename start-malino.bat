@echo off
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte Node.js installieren: https://nodejs.org/
  pause
  exit /b 1
)
echo Starte MALINO MagicPad 0.5 ...
start "" http://127.0.0.1:8787
npm start
pause
