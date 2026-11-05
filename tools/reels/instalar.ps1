# Instala lo que necesitan los reels automáticos de TikTok: ffmpeg (montar el vídeo), yt-dlp (bajar clips de
# Twitch) y, si quieres, Whisper para los subtítulos automáticos (necesita Python; tarda unos minutos y ocupa ~1 GB
# la primera vez). Hecho con ayuda de IA.
$ErrorActionPreference = 'Continue'
Write-Host '=== Herramientas de los reels de Coach LoL IA ===' -ForegroundColor Cyan
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'No encuentro winget (Instalador de aplicaciones de Microsoft Store). Instálalo y vuelve a probar.' -ForegroundColor Red
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements }
if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) { winget install -e --id yt-dlp.yt-dlp --accept-source-agreements --accept-package-agreements }

$resp = Read-Host '¿Instalar también los subtítulos automáticos (Whisper)? [S/n]'
if ($resp -notmatch '^[nN]') {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) { winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements }
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    python -m pip install --user --upgrade whisper-ctranslate2
}
Write-Host ''
Write-Host 'Listo. Cierra esta ventana y abre otra para que Windows vea los programas nuevos.' -ForegroundColor Green
