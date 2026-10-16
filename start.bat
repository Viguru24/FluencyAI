@echo off
setlocal
title Eng Tutor - Local Development Server

cd /d "%~dp0"

echo ===================================================
echo             Starting Eng Tutor
echo ===================================================
echo.

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
