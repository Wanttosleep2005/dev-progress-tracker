@echo off
chcp 65001 >nul
title DevTrack - 开发进度系统
echo.
echo   ╔══════════════════════════════════╗
echo   ║     DevTrack 开发进度追踪系统    ║
echo   ╚══════════════════════════════════╝
echo.
echo   正在启动开发服务器...
echo.
cd /d "%~dp0"
start http://localhost:5173
npx vite --host --port 5173 --strictPort
pause
