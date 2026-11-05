@echo off
rem Arrastra uno o varios videos encima de este archivo: salen en vertical para TikTok en Videos\coach-tiktok\listos.
rem Sin arrastrar nada, hace todo lo que haya en Videos\coach-tiktok\entrada.
if "%~1"=="" goto entrada
set "GANCHO="
set /p "GANCHO=Gancho del video, el texto grande de arriba. Enter para ninguno: "
node "%~dp0tools\reels\reels.mjs" %* --gancho "%GANCHO%"
goto fin
:entrada
node "%~dp0tools\reels\reels.mjs" --entrada
:fin
pause
