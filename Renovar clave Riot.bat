@echo off
rem Renueva la clave de desarrollo de Riot del servidor de Coach LoL IA (caduca cada 24 h).
rem clave-riot-servidor.ps1 abre el portal de Riot, lee la clave nueva del portapapeles, la guarda en Fly.io
rem y sustituye la guardada en este PC. Primer argumento opcional: carpeta del repo (para .clave-riot).
chcp 65001 >nul
title Renovar clave Riot
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clave-riot-servidor.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clave-riot-servidor.ps1" -Repo "%~1"
)
echo.
pause
