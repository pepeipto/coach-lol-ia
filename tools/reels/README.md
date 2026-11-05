# Reels automáticos para TikTok

Convierte grabaciones de OBS, clips de Twitch o vídeos que te pasen en reels verticales (1080x1920) listos para subir:
fondo desenfocado, el vídeo en el centro, el gancho arriba, `coachlolia.com` abajo, subtítulos automáticos si está
Whisper y, si el vídeo es de otra persona, su mención («Vídeo de @…»). Al lado deja un `.txt` con la caption y los
hashtags para pegar. **No publica nada**: subirlo a TikTok lo haces tú.

## Instalar (una vez)
`Instalar herramientas de reels.bat` en la raíz del repositorio: ffmpeg, yt-dlp y, opcional, Whisper (`whisper-ctranslate2`).

## Usar
Todo sale en `%USERPROFILE%\Videos\coach-tiktok\listos` (o la carpeta de `REELS_CARPETA` / `--carpeta`).

- **Un vídeo**: arrástralo encima de `Hacer reel de TikTok.bat` y escribe el gancho. Por consola:
  `node tools/reels/reels.mjs video.mp4 --gancho "El coach me avisó del Barón" --inicio 1:20 --duracion 30 --credito "Vídeo de @streamer"`.
- **Carpeta de entrada**: deja vídeos en `coach-tiktok\entrada` y ejecuta `Hacer reel de TikTok.bat` sin arrastrar nada.
  Si pones un `.txt` con el mismo nombre, la primera línea es el gancho; `inicio: 1:20` y `duracion: 30` recortan;
  el resto es la caption. Los originales pasan a `coach-tiktok\hechos`.
- **Cola del panel**: `Reels aprobados del panel.bat` baja los clips de Twitch de los reels aprobados en
  `/admin/panel`, hace cada vídeo con su gancho y su caption, y lo apunta en el panel («Vídeo listo: …»). Pide una vez
  la contraseña del panel y la guarda en `%USERPROFILE%\.coachlolia\panel.txt`.

Vídeos de otras personas, solo con su permiso y mencionándolas (`--credito`).

Pruebas: `cd tools/reels && npm test`.
