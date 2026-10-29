@echo off
rem Crea en el escritorio el acceso directo "Renovar clave Riot" (no hace falta ser administrador).
rem Ese acceso abre developer.riotgames.com y lanza clave-riot-servidor.ps1 para guardar la clave nueva.
title Crear acceso directo Riot
set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$raiz = $env:RAIZ; $destino = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Renovar clave Riot.lnk'; $l = (New-Object -ComObject WScript.Shell).CreateShortcut($destino); $l.TargetPath = Join-Path $raiz 'Renovar clave Riot.bat'; $l.WorkingDirectory = $raiz; $l.IconLocation = $env:SystemRoot + '\System32\imageres.dll,77'; $l.Description = 'Abre el portal de Riot y guarda la clave nueva en el servidor'; $l.Save(); Write-Host ('Acceso directo creado: ' + $destino) -ForegroundColor Green"
echo.
pause
