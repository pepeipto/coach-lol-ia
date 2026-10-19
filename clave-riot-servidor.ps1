# Pone la clave de Riot en el servidor público (Fly.io) de Coach LoL IA.
# La clave se pide por teclado, se comprueba con Riot y se guarda como secreto en Fly.
# No se escribe en ningún archivo ni aparece en pantalla.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$app = 'coachlolia-api'

Write-Host ''
Write-Host '=== Clave de Riot para el servidor de Coach LoL IA ===' -ForegroundColor Cyan
Write-Host 'Cópiala de https://developer.riotgames.com (empieza por RGAPI-).'
while ($true) {
    $segura = Read-Host 'Pega la clave y pulsa Enter (no se verá al escribir)' -AsSecureString
    $clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim().Trim('"', "'")
    if (-not $clave) { continue }
    Write-Host 'Comprobando la clave con Riot...'
    try {
        Invoke-RestMethod -Uri 'https://euw1.api.riotgames.com/lol/status/v4/platform-data' -Headers @{ 'X-Riot-Token' = $clave } -TimeoutSec 15 | Out-Null
        Write-Host 'Clave válida.' -ForegroundColor Green
        break
    } catch {
        Write-Host 'Riot no reconoce esa clave. Copia la que aparece AHORA en el panel (o pulsa "Regenerate API Key") y vuelve a intentarlo.' -ForegroundColor Red
    }
}

Write-Host 'Guardando la clave en el servidor (Fly.io) y reiniciándolo...'
flyctl secrets set "RIOT_API_KEY=$clave" --app $app | Out-Null
$clave = $null
Write-Host ''
Write-Host 'Listo. El servidor empieza a recoger partidas ahora y recalcula las builds al terminar cada ciclo.' -ForegroundColor Green
Write-Host 'Recuerda: la clave de desarrollo caduca a las 24 h. Vuelve a ejecutar este script con la nueva.'
