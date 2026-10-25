# Crea la contraseña de administrador de la página https://api.coachlolia.com/admin/clave
# (renovar la clave de Riot desde el móvil) y la guarda como secreto ADMIN_TOKEN en Fly.io.
# Se ejecuta UNA vez. La contraseña se genera aquí, se enseña una sola vez para que la guardes en tu
# gestor de contraseñas o en el móvil, y no se escribe en ningún archivo.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$app = 'coachlolia-api'

$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes).Replace('+', 'x').Replace('/', 'y').TrimEnd('=')

Write-Host ''
Write-Host '=== Contraseña de administrador de Coach LoL IA ===' -ForegroundColor Cyan
Write-Host 'Guárdala AHORA en tu gestor de contraseñas o en una nota segura del móvil. No se vuelve a enseñar:'
Write-Host ''
Write-Host "    $token" -ForegroundColor Yellow
Write-Host ''
Read-Host 'Cuando la tengas guardada, pulsa Enter para subirla al servidor' | Out-Null

flyctl secrets set "ADMIN_TOKEN=$token" --app $app | Out-Null
$codigo = $LASTEXITCODE
$token = $null
Clear-Host
if ($codigo -ne 0) {
    Write-Host "flyctl no pudo guardarla (código $codigo). Comprueba 'flyctl auth login' y vuelve a ejecutar el script." -ForegroundColor Red
    exit 1
}
Write-Host 'Listo. El servidor se reinicia en unos segundos.' -ForegroundColor Green
Write-Host 'Para renovar la clave de Riot desde el móvil: https://api.coachlolia.com/admin/clave'
