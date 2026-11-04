@echo off
rem Instala "Renovar clave Riot": copia el .bat y el .ps1 a %LOCALAPPDATA%\CoachLoLIA (asi no depende de la rama
rem en la que este el repo) y crea el acceso directo en el escritorio. No hace falta ser administrador.
title Crear acceso directo Riot
set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "DESTINO=%LOCALAPPDATA%\CoachLoLIA"
if not exist "%DESTINO%" mkdir "%DESTINO%"
copy /y "%RAIZ%\Renovar clave Riot.bat" "%DESTINO%" >nul || goto error
copy /y "%RAIZ%\clave-riot-servidor.ps1" "%DESTINO%" >nul || goto error
powershell -NoProfile -ExecutionPolicy Bypass -Command "$destino = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Renovar clave Riot.lnk'; $l = (New-Object -ComObject WScript.Shell).CreateShortcut($destino); $l.TargetPath = Join-Path $env:DESTINO 'Renovar clave Riot.bat'; $q = [char]34; $l.Arguments = $q + $env:RAIZ + $q; $l.WorkingDirectory = $env:DESTINO; $l.IconLocation = $env:SystemRoot + '\System32\imageres.dll,77'; $l.Description = 'Abre el portal de Riot y guarda la clave nueva en el servidor'; $l.Save(); Write-Host ('Acceso directo creado: ' + $destino) -ForegroundColor Green" || goto error
echo.
pause
exit /b 0
:error
echo No se pudo crear el acceso directo.
pause
exit /b 1
