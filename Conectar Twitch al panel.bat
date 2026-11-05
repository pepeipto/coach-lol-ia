@echo off
rem Conecta el canal de Twitch al panel de seguimiento (TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0twitch-panel-servidor.ps1"
pause
