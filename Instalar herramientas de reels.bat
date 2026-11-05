@echo off
rem Instala ffmpeg, yt-dlp y (opcional) Whisper para los reels automaticos de TikTok.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\reels\instalar.ps1"
pause
