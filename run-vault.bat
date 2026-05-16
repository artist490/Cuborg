@echo off
setlocal

cd /d "%~dp0"

echo.
echo ==========================================
echo  Personal Secure Vault
echo ==========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js first:
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\vite" (
  echo [INFO] Dependencies are not installed yet.
  echo Run install-and-run.bat first.
  pause
  exit /b 1
)

echo Starting Vite dev server...
echo Open the local URL shown below, usually http://localhost:5173/
echo.
call npm run dev

pause
