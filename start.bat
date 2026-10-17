@echo off
setlocal
title Eng Tutor - Local Development Server

cd /d "%~dp0"

echo ===================================================
echo             Starting Eng Tutor
echo ===================================================
echo.

:: Check and terminate any previous Vite/node processes holding ports 5173 or 5174
echo [INFO] Ensuring ports 5173 and 5174 are free...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo [INFO] Closing old server on port 5173 ^(PID %%a^)...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":5174" ^| findstr "LISTENING"') do (
    echo [INFO] Closing old server on port 5174 ^(PID %%a^)...
    taskkill /F /PID %%a >nul 2>&1
)

:: Check if node_modules exists, otherwise install dependencies
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b %errorlevel%
    )
)

echo [INFO] Starting Vite development server and opening browser...
echo.

:: Start Vite dev server with --open flag to launch browser automatically
call npm run dev -- --open

if errorlevel 1 (
    echo.
    echo [ERROR] Server terminated unexpectedly.
    pause
)
