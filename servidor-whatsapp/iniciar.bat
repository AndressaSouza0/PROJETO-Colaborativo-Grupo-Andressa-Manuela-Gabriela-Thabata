@echo off
cd /d "%~dp0"

:: Registra o protocolo automaticamente (so precisa rodar 1 vez, mas nao faz mal repetir)
set "LAUNCHER=%~dp0iniciar-protocolo.bat"
reg add "HKEY_CURRENT_USER\Software\Classes\biblioteca-server" /ve /d "URL:Biblioteca Server Protocol" /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Classes\biblioteca-server" /v "URL Protocol" /d "" /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Classes\biblioteca-server\shell\open\command" /ve /d "\"%LAUNCHER%\" \"%%1\"" /f >nul 2>&1

node bot.js
