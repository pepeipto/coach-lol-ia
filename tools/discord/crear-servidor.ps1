# Crea el servidor oficial de Discord de Coach LoL IA con crear-servidor.mjs.
# El token del bot se pide por teclado (no se ve al escribir), se pasa al programa solo por una variable de entorno de
# este proceso y se borra al terminar. No se escribe en ningún archivo.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location $PSScriptRoot

Write-Host ''
Write-Host '=== Servidor de Discord de Coach LoL IA ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Falta Node.js. Instálalo desde https://nodejs.org (versión LTS) y vuelve a abrir este acceso directo.' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\discord.js'))) {
    Write-Host 'Instalando discord.js (solo la primera vez)...'
    npm install --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { Write-Host 'No se pudo instalar discord.js.' -ForegroundColor Red; exit 1 }
}

# Comprueba el diseño y los mensajes antes de pedir nada.
node crear-servidor.mjs --simular
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not $env:DISCORD_TOKEN) {
    Write-Host ''
    Write-Host 'Copia el token del bot: https://discord.com/developers/applications → tu aplicación → Bot → Reset Token.'
    while (-not $env:DISCORD_TOKEN) {
        $segura = Read-Host 'Pega el token y pulsa Enter (no se verá al escribir)' -AsSecureString
        $env:DISCORD_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim().Trim('"', "'")
    }
}
try {
    node crear-servidor.mjs
    $codigo = $LASTEXITCODE
} finally {
    Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue
}
exit $codigo
