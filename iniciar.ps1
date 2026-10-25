# Arranca Coach LoL IA en local: comprueba la clave de Riot, inicia el servidor de builds y abre la app.
# La clave se guarda solo en este PC (.clave-riot, fuera de git) para no pedirla en cada arranque, cifrada con DPAPI
# (ConvertFrom-SecureString): solo la puede leer tu usuario de Windows en este PC. Seguridad (hallazgo 17): antes se
# guardaba en texto plano; un .clave-riot antiguo se lee y se vuelve a guardar cifrado.
$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$archivoClave = Join-Path $raiz '.clave-riot'
$urlPrueba = 'https://euw1.api.riotgames.com/lol/status/v4/platform-data'

function Probar-Clave([string]$clave) {
    try {
        Invoke-RestMethod -Uri $urlPrueba -Headers @{ 'X-Riot-Token' = $clave } -TimeoutSec 15 | Out-Null
        return 'ok'
    } catch {
        $codigo = $_.Exception.Response.StatusCode.value__
        if ($codigo -in 401, 403) { return 'invalida' }
        return "error de red ($($_.Exception.Message))"
    }
}

function Limpiar([string]$texto) { return $texto.Trim().Trim('"', "'") }

# SecureString -> texto (solo en memoria, para la cabecera de Riot y la variable de entorno del servidor).
function A-Texto([securestring]$seguro) { return [System.Net.NetworkCredential]::new('', $seguro).Password }

# Guarda la clave cifrada con DPAPI (usuario actual de Windows).
function Guardar-Clave([string]$clave) {
    $seguro = ConvertTo-SecureString $clave -AsPlainText -Force
    Set-Content -Path $archivoClave -Value (ConvertFrom-SecureString $seguro) -NoNewline
}

# Lee .clave-riot: cifrado con DPAPI o, si es de una versión anterior, en texto plano (y entonces lo cifra).
function Leer-Clave {
    $contenido = (Get-Content $archivoClave -Raw).Trim()
    if ($contenido -match '^["'']?RGAPI-') {
        $clave = Limpiar $contenido
        Guardar-Clave $clave
        Write-Host 'La clave guardada estaba sin cifrar; ahora se guarda cifrada para tu usuario de Windows.'
        return $clave
    }
    try { return A-Texto (ConvertTo-SecureString $contenido) } catch { return $null }
}

Write-Host ''
Write-Host '=== Coach LoL IA ===' -ForegroundColor Cyan

$clave = $null
if (Test-Path $archivoClave) {
    $guardada = Leer-Clave
    if (-not $guardada) {
        Write-Host 'No pude leer la clave guardada (se cifró con otro usuario o en otro PC).' -ForegroundColor Yellow
    } else {
        Write-Host 'Comprobando la clave de Riot guardada...'
        $r = Probar-Clave $guardada
        if ($r -eq 'ok') { $clave = $guardada } else { Write-Host "La clave guardada ya no sirve ($r)." -ForegroundColor Yellow }
    }
    $guardada = $null
}

while (-not $clave) {
    Write-Host ''
    Write-Host 'Necesito tu Development API Key de Riot (empieza por RGAPI-).'
    Write-Host 'La encuentras en https://developer.riotgames.com (inicia sesión y cópiala del panel).'
    # Entrada oculta: la clave no se ve en pantalla.
    $entrada = Limpiar (A-Texto (Read-Host 'Pega la clave aquí y pulsa Enter' -AsSecureString))
    if (-not $entrada) { continue }
    Write-Host 'Comprobando la clave con Riot...'
    $r = Probar-Clave $entrada
    if ($r -eq 'ok') {
        $clave = $entrada
        Guardar-Clave $clave
        Write-Host 'Clave válida.' -ForegroundColor Green
    } elseif ($r -eq 'invalida') {
        Write-Host 'Riot no reconoce esa clave. Suele pasar si se regeneró después de copiarla o si ha caducado (duran 24 h).' -ForegroundColor Red
        Write-Host 'Te abro la página: copia la clave que aparezca AHORA en el panel (o pulsa "Regenerate API Key").'
        Start-Process 'https://developer.riotgames.com'
    } else {
        Write-Host "No pude comprobar la clave: $r. Revisa tu conexión a internet." -ForegroundColor Red
    }
}

# Para un servidor de Coach LoL IA anterior que siga ocupando el puerto 8080 (por ejemplo, con una clave vieja).
$conexion = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conexion) {
    $proceso = Get-CimInstance Win32_Process -Filter "ProcessId=$($conexion.OwningProcess)"
    if ($proceso.CommandLine -like '*coach-lol-ia*' -or $proceso.CommandLine -like '*tsx*') {
        Write-Host 'Cerrando el servidor anterior...'
        taskkill /T /F /PID $conexion.OwningProcess | Out-Null
        Start-Sleep -Seconds 1
    } else {
        Write-Host 'El puerto 8080 lo usa otro programa; ciérralo y vuelve a ejecutar el lanzador.' -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path (Join-Path $raiz 'node_modules'))) {
    Write-Host 'Instalando dependencias (solo la primera vez)...'
    # Solo se ejecutan los scripts de instalación permitidos en allowScripts (package.json).
    Push-Location $raiz; npm install; Pop-Location
}

Write-Host 'Arrancando el servidor de builds (se abre en otra ventana)...'
$env:RIOT_API_KEY = $clave
if (-not $env:MAX_PARTIDAS) { $env:MAX_PARTIDAS = '100' }
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'title Coach LoL IA - servidor && npm run dev -w server' -WorkingDirectory $raiz
Remove-Item Env:RIOT_API_KEY
$clave = $null
$entrada = $null

$listo = $false
foreach ($i in 1..60) {
    try { Invoke-RestMethod 'http://127.0.0.1:8080/salud' -TimeoutSec 2 | Out-Null; $listo = $true; break } catch { Start-Sleep -Seconds 1 }
}
if (-not $listo) { Write-Host 'El servidor no respondió en 60 s; mira su ventana para ver el error.' -ForegroundColor Red; exit 1 }
Write-Host 'Servidor listo en http://localhost:8080. Empieza a recoger partidas (las primeras builds tardan unos minutos).' -ForegroundColor Green

Write-Host 'Abriendo la app...'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'title Coach LoL IA - app && npm run dev -w app' -WorkingDirectory $raiz
Write-Host ''
Write-Host 'Listo. Puedes cerrar esta ventana. Para parar todo, cierra las ventanas "Coach LoL IA - servidor" y "Coach LoL IA - app".'
