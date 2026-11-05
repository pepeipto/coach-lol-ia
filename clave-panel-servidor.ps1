# Crea la contraseña del panel de seguimiento (https://api.coachlolia.com/admin/panel) y la guarda como
# secreto PANEL_TOKEN en Fly.io. Solo sirve para el panel: no deja tocar la clave de Riot.
# Con ella entras en el panel desde el navegador y Claude puede pedir las cifras desde el proyecto.
# Se puede volver a ejecutar para cambiarla (la anterior deja de valer). Hecho con ayuda de IA.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$app = 'coachlolia-api'

$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes).Replace('+', 'x').Replace('/', 'y').TrimEnd('=')

Write-Host ''
Write-Host '=== Contraseña del panel de Coach LoL IA ===' -ForegroundColor Cyan
Write-Host 'Guárdala AHORA en tu gestor de contraseñas. No se vuelve a enseñar:'
Write-Host ''
Write-Host "    $token" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Para que Claude vea las cifras desde el proyecto, pon esta misma contraseña en la configuración'
Write-Host 'del entorno del proyecto como variable COACH_PANEL_TOKEN (y permite el dominio api.coachlolia.com).'
Write-Host ''
Read-Host 'Cuando la tengas guardada, pulsa Enter para subirla al servidor' | Out-Null

flyctl secrets set "PANEL_TOKEN=$token" --app $app | Out-Null
$codigo = $LASTEXITCODE
$token = $null
Clear-Host
if ($codigo -ne 0) {
    Write-Host "flyctl no pudo guardarla (código $codigo). Comprueba 'flyctl auth login' y vuelve a ejecutar el script." -ForegroundColor Red
    exit 1
}
Write-Host 'Listo. El servidor se reinicia en unos segundos.' -ForegroundColor Green
Write-Host 'Panel: https://api.coachlolia.com/admin/panel'
Start-Process 'https://api.coachlolia.com/admin/panel'
