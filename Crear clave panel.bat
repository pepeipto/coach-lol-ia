@echo off
rem Crea la contrasena del panel de seguimiento y la guarda en el servidor (PANEL_TOKEN).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clave-panel-servidor.ps1"
pause
