# Pone la clave de la API de Anthropic (Claude) en el servidor público (Fly.io) de Coach LoL IA.
# La usan el asistente de ayuda, el análisis al terminar la partida y los consejos de los momentos muertos.
# La clave se pide por teclado, se comprueba con Anthropic y se guarda como secreto en Fly.
# No se escribe en ningún archivo ni aparece en pantalla.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$app = 'coachlolia-api'

Write-Host ''
Write-Host '=== Clave de la IA (Anthropic) para el servidor de Coach LoL IA ===' -ForegroundColor Cyan
Write-Host 'Créala en https://console.anthropic.com → API Keys (empieza por sk-ant-).'
Write-Host 'Consejo: en la consola de Anthropic pon un límite de gasto mensual (Settings → Limits).'
while ($true) {
    $segura = Read-Host 'Pega la clave y pulsa Enter (no se verá al escribir)' -AsSecureString
    $clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim().Trim('"', "'")
    if (-not $clave) { continue }
    Write-Host 'Comprobando la clave con Anthropic...'
    try {
        Invoke-RestMethod -Uri 'https://api.anthropic.com/v1/models' -Headers @{ 'x-api-key' = $clave; 'anthropic-version' = '2023-06-01' } -TimeoutSec 15 | Out-Null
        Write-Host 'Clave válida.' -ForegroundColor Green
        break
    } catch {
        Write-Host 'Anthropic no reconoce esa clave. Cópiala de nuevo desde la consola y vuelve a intentarlo.' -ForegroundColor Red
    }
}

Write-Host 'Guardando la clave en el servidor (Fly.io) y reiniciándolo...'
flyctl secrets set "ANTHROPIC_API_KEY=$clave" --app $app | Out-Null
$codigo = $LASTEXITCODE
$clave = $null
Write-Host ''
if ($codigo -ne 0) {
    Write-Host "flyctl no pudo guardar la clave (código $codigo). Comprueba que has iniciado sesión con 'flyctl auth login' y vuelve a intentarlo." -ForegroundColor Red
    exit 1
}
Write-Host 'Listo. El asistente, el análisis con IA y los consejos de IA ya funcionan en el servidor.' -ForegroundColor Green
Write-Host 'Topes de gasto del servidor (fly.toml): como mucho 200 análisis y 3000 consejos al día entre todos los usuarios.'
