@echo off
rem Crea (o actualiza) el servidor oficial de Discord de Coach LoL IA: roles, canales, permisos y mensajes fijados.
rem Pide el token del bot sin mostrarlo. Guia paso a paso: docs\discord\README.md
chcp 65001 >nul
title Crear servidor de Discord
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\discord\crear-servidor.ps1"
echo.
pause
