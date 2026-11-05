# Conecta el canal de Twitch al panel (https://api.coachlolia.com/admin/panel): guarda en Fly.io el
# identificador y el secreto de una aplicación de Twitch (TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET).
# Con ellos el panel ve si estás en directo, los espectadores, tus clips y tus últimos directos.
# Solo lee datos públicos del canal: no puede cambiar nada en él. Hecho con ayuda de IA.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$app = 'coachlolia-api'

Write-Host ''
Write-Host '=== Conectar Twitch al panel de Coach LoL IA ===' -ForegroundColor Cyan
Write-Host '1. Se abre dev.twitch.tv. Entra con tu cuenta de Twitch y pulsa «Registrar tu aplicación».'
Write-Host '2. Nombre: coachlolia-panel. URL de redirección: http://localhost. Categoría: Website Integration.'
Write-Host '   Tipo de cliente: Confidencial. Pulsa «Crear».'
Write-Host '3. Pulsa «Administrar» en la aplicación: copia el «ID de cliente» y pulsa «Nuevo secreto».'
Write-Host ''
Start-Process 'https://dev.twitch.tv/console/apps/create'
$id = (Read-Host 'Pega el ID de cliente').Trim()
$secreto = (Read-Host 'Pega el secreto de cliente').Trim()
$canal = (Read-Host 'Nombre del canal (Enter = crazylovers)').Trim().ToLower()
if (-not $canal) { $canal = 'crazylovers' }
if (-not $id -or -not $secreto) {
    Write-Host 'Falta el ID o el secreto. Vuelve a ejecutar el script.' -ForegroundColor Red
    exit 1
}

flyctl secrets set "TWITCH_CLIENT_ID=$id" "TWITCH_CLIENT_SECRET=$secreto" "TWITCH_CANAL=$canal" --app $app | Out-Null
$codigo = $LASTEXITCODE
$secreto = $null
Clear-Host
if ($codigo -ne 0) {
    Write-Host "flyctl no pudo guardarlos (código $codigo). Comprueba 'flyctl auth login' y vuelve a ejecutar el script." -ForegroundColor Red
    exit 1
}
Write-Host 'Listo. El servidor se reinicia en unos segundos y el panel ya enseña tu canal de Twitch.' -ForegroundColor Green
Start-Process 'https://api.coachlolia.com/admin/panel'
