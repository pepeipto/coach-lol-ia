@echo off
rem Pone la clave de la IA (Anthropic) en el servidor de Coach LoL IA. La clave se pide oculta.
start "" https://platform.claude.com/settings/keys
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clave-ia-servidor.ps1"
pause
