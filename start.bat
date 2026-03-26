@echo off
cd /d "%~dp0"
title Simple Slideshow

set NODE_VERSION=22.12.0
set NODE_DIR=%~dp0node_bin
set NODE_EXE=%NODE_DIR%\node.exe
set NPM_CMD=%NODE_DIR%\npm.cmd

:: ===== Node.js が同梱されていなければ自動ダウンロード =====
if not exist "%NODE_EXE%" (
    echo.
    echo  ============================================
    echo   初回セットアップ中...
    echo   Node.js をダウンロードしています
    echo   インターネット接続が必要です
    echo   ^(約 30MB / 数分かかる場合があります^)
    echo  ============================================
    echo.

    set ZIP_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip
    set ZIP_FILE=%~dp0_node_tmp.zip
    set TMP_DIR=%~dp0_node_tmp_dir

    curl -L --progress-bar -o "%ZIP_FILE%" "%ZIP_URL%"
    if errorlevel 1 (
        echo.
        echo  [エラー] ダウンロードに失敗しました。
        echo  インターネット接続を確認してから、もう一度 start.bat を実行してください。
        echo.
        if exist "%ZIP_FILE%" del "%ZIP_FILE%"
        pause
        exit /b 1
    )

    echo.
    echo  解凍中...
    powershell -NoProfile -Command ^
        "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%TMP_DIR%' -Force"
    if errorlevel 1 (
        echo  [エラー] 解凍に失敗しました。
        if exist "%ZIP_FILE%" del "%ZIP_FILE%"
        pause
        exit /b 1
    )

    move "%TMP_DIR%\node-v%NODE_VERSION%-win-x64" "%NODE_DIR%" >nul
    rmdir /s /q "%TMP_DIR%"
    del "%ZIP_FILE%"

    echo  Node.js のセットアップが完了しました！
    echo.
)

:: ===== 依存パッケージのインストール =====
if not exist "%~dp0node_modules" (
    echo  パッケージをインストール中...
    "%NPM_CMD%" install --prefix "%~dp0"
    if errorlevel 1 (
        echo  [エラー] パッケージのインストールに失敗しました。
        pause
        exit /b 1
    )
    echo.
)

:: ===== 起動 =====
echo  Simple Slideshow を起動中...
echo  ブラウザが自動で開きます
echo.
echo  終了するときはこのウィンドウを閉じてください
echo.

start "" http://localhost:3000
"%NODE_EXE%" server.js

pause
