@echo off
rem Renueva la clave de desarrollo de Riot del servidor de Coach LoL IA (caduca cada 24 h).
rem Abre el portal de Riot (pulsa "Regenerate API Key") y pide la clave nueva, que se guarda en Fly.io.
chcp 65001 >nul
title Renovar clave Riot
start "" "https://developer.riotgames.com"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clave-riot-servidor.ps1"
echo.
pause
