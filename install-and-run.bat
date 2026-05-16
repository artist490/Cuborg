@echo off
setlocal

cd /d "%~dp0"

echo.
echo ==========================================
echo  Personal Secure Vault - install and run
echo ==========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js first:
  echo https://nodejs.org/
  pause
  exit /b 1
)

echo [1/4] Using npm registry: https://registry.npmjs.org/
call npm config set registry https://registry.npmjs.org/

echo [2/4] Clearing npm proxy settings.
call npm config delete proxy >nul 2>nul
call npm config delete https-proxy >nul 2>nul

echo [3/4] Installing dependencies. If VPN causes ECONNRESET, switch VPN server and run this file again.
call npm install --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed.
  echo Try switching VPN server or temporarily disabling VPN, then run install-and-run.bat again.
  pause
  exit /b 1
)

echo.
echo [4/4] Starting Vite dev server.
echo Open the local URL shown below, usually http://localhost:5173/
echo.
call npm run dev

pause
