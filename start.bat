@echo off
cd /d "%~dp0"
title Simple Slideshow

set NODE_EXE=%~dp0node_bin\node.exe

echo  Starting Simple Slideshow...
echo  Browser will open automatically
echo.
echo  Close this window to stop the server
echo.

start "" http://localhost:3000
"%NODE_EXE%" server.js

pause
