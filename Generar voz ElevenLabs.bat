@echo off
rem Genera la voz pregrabada de Coach LoL IA con ElevenLabs (lo ejecuta el dueno, ver README).
rem Pide la ruta del .env con ELEVENLABS_API_KEY; la clave nunca se muestra ni se guarda en el repo.
rem Argumentos extra: --idiomas es,en,pt-BR,fr,de  --max-creditos 20000  --dry-run  --yes
cd /d "%~dp0"
call npx tsx app\tools\generar-voz-pack.ts %*
pause
