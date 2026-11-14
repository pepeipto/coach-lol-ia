@echo off
rem Genera la voz pregrabada de Coach LoL IA con ElevenLabs (lo ejecuta el dueno, ver README).
rem La clave se guarda una vez en %USERPROFILE%\.coachlolia\elevenlabs.env (se pide oculta; nunca se muestra ni va al repo).
rem Argumentos extra: --idiomas es,en,pt-BR,fr,de  --max-creditos 20000  --dry-run  --yes
cd /d "%~dp0"
set "ENVVOZ="
if exist "%TEMP%\ruta-env-voz.txt" del "%TEMP%\ruta-env-voz.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clave-elevenlabs.ps1"
if exist "%TEMP%\ruta-env-voz.txt" set /p ENVVOZ=<"%TEMP%\ruta-env-voz.txt"
if not defined ENVVOZ (
  echo No se pudo preparar la clave de ElevenLabs.
  pause
  exit /b 1
)
call npx tsx app\tools\generar-voz-pack.ts --env "%ENVVOZ%" %*
pause
