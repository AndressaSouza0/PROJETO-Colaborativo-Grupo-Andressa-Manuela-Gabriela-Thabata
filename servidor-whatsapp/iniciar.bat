@echo off
title Servidor WhatsApp - Biblioteca Jorge Amado
cd /d "%~dp0"

echo Liberando porta 3000...
for /f "tokens=5 delims= " %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

set "LAUNCHER=%~dp0iniciar-protocolo.bat"
reg add "HKEY_CURRENT_USER\Software\Classes\biblioteca-server" /ve /d "URL:Biblioteca Server Protocol" /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Classes\biblioteca-server" /v "URL Protocol" /d "" /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Classes\biblioteca-server\shell\open\command" /ve /d "\"%LAUNCHER%\" \"%%1\"" /f >nul 2>&1

:loop
echo.
echo [%date% %time%] Iniciando servidor...
echo.
call node bot.js
echo.
echo [%date% %time%] Servidor encerrou. Reiniciando em 5 segundos...
echo Pressione Ctrl+C para sair.
for /f "tokens=5 delims= " %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 5 /nobreak >nul
goto loop
