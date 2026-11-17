@echo off
chcp 65001 >nul
title CertChain - Xac minh van bang bang Blockchain
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Hay cai Node.js 18 tro len tai https://nodejs.org roi chay lai.
  start "" https://nodejs.org
  pause
  exit /b 1
)
node scripts\start.js
pause
