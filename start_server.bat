@echo off
:: 文字コードをUTF-8に変更し、文字化けを防止します
chcp 65001 > nul
title SD Tag Converter Pro - Web Server
set PORT=8000

:: ローカルIPアドレスを自動取得します
for /f "delims=[] tokens=2" %%a in ('ping -4 -n 1 %ComputerName% ^| findstr "["') do set IP=%%a

echo ==================================================
echo   SD Tag Converter Pro を起動しています...
echo ==================================================
echo.
echo [アクセス情報]
echo - このPCから: http://localhost:%PORT%/converter.html
echo - LAN内から : http://%IP%:%PORT%/converter.html
echo.
echo [サーバーログ]

:: すべてのインターフェース(0.0.0.0)で待ち受け、LAN内からのアクセスを許可します
python -m http.server %PORT% --bind 0.0.0.0

pause