@echo off
cd /d "%~dp0"

echo Simple Slideshow を起動中...

if not exist "node_modules" (
  echo 初回起動: npm install を実行中...
  npm install
)

start "" http://localhost:3000
node server.js
