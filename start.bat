@echo off
cd /d "%~dp0"
title Simple Slideshow

set NODE_EXE=%~dp0node_bin\node.exe
set NPM_CMD=%~dp0node_bin\npm.cmd

:: ===== Install dependencies =====
if not exist "%~dp0node_modules" (
    echo  Installing packages...
    "%NPM_CMD%" install --prefix "%~dp0"
    if errorlevel 1 (
        echo  [ERROR] Package installation failed.
        pause
        exit /b 1
    )
    echo.
)

:: ===== Launch =====
echo  Starting Simple Slideshow...
echo  Browser will open automatically
echo.
echo  Close this window to stop the server
echo.

start "" http://localhost:3000
"%NODE_EXE%" server.js

pause
