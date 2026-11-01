# Renueva la clave de Riot de Coach LoL IA: la pide, la comprueba con Riot, la guarda como secreto en el servidor
# público (Fly.io) y espera a que el servidor la use. También sustituye la clave antigua guardada en este PC
# (.clave-riot, cifrada con DPAPI) para que «Iniciar Coach LoL IA» no use una caducada.
# La clave no se escribe en ningún archivo en claro ni aparece en pantalla.
# -Repo: carpeta del repo (para .clave-riot). Si no se indica, la del propio script.
param([string]$Repo = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$app = 'coachlolia-api'
$portal = 'https://developer.riotgames.com'
$salud = 'https://api.coachlolia.com/salud'
$forma = '^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$registro = Join-Path $env:TEMP 'renovar-clave-riot.log'

function Escribir-Error([string]$texto) {
    Write-Host $texto -ForegroundColor Red
    Add-Content -Path $registro -Value "$(Get-Date -Format s) $texto"
}

function Probar-Clave([string]$clave) {
    try {
        Invoke-RestMethod -Uri 'https://euw1.api.riotgames.com/lol/status/v4/platform-data' -Headers @{ 'X-Riot-Token' = $clave } -TimeoutSec 15 | Out-Null
        return 'ok'
    } catch {
        $codigo = $_.Exception.Response.StatusCode.value__
        if ($codigo -in 401, 403) { return 'invalida' }
        return "error de red ($($_.Exception.Message))"
    }
}

# Busca una clave con forma de Riot dentro de un texto (el portapapeles o lo pegado puede traer espacios o comillas).
function Extraer-Clave([string]$texto) {
    if (-not $texto) { return $null }
    $m = [regex]::Match($texto, 'RGAPI-[0-9a-fA-F-]{36}')
    if ($m.Success -and $m.Value -match $forma) { return $m.Value }
    return $null
}

try {
    Write-Host ''
    Write-Host '=== Renovar la clave de Riot de Coach LoL IA ===' -ForegroundColor Cyan

    # 1. flyctl, antes de pedir nada: sin él no se puede guardar la clave.
    if (-not (Get-Command flyctl -ErrorAction SilentlyContinue)) {
        throw "No encuentro flyctl. Instálalo con: iwr https://fly.io/install.ps1 -useb | iex  (y vuelve a abrir este acceso directo)."
    }
    # cmd /c: en PowerShell 5.1, redirigir la salida de error de un programa con $ErrorActionPreference = 'Stop' lanza una excepción.
    cmd /c 'flyctl auth whoami >nul 2>&1'
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'flyctl no tiene la sesión iniciada. Se abre el navegador para iniciarla...' -ForegroundColor Yellow
        & flyctl auth login
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar sesión en Fly.io (flyctl auth login).' }
    }

    # 2. Pedir la clave: se abre el portal, se copia y basta con pulsar Enter (se lee del portapapeles).
    Write-Host ''
    Write-Host "Se abre $portal en el navegador."
    Write-Host '  1) Inicia sesión y pulsa "Regenerate API Key".'
    Write-Host '  2) Pulsa el botón de copiar junto a la clave (empieza por RGAPI-).'
    Write-Host '  3) Vuelve a esta ventana y pulsa Enter.'
    Start-Process $portal
    $clave = $null
    while (-not $clave) {
        Read-Host 'Pulsa Enter cuando hayas copiado la clave' | Out-Null
        $clave = Extraer-Clave (Get-Clipboard -Raw -ErrorAction SilentlyContinue)
        if (-not $clave) {
            Write-Host 'No hay una clave de Riot en el portapapeles. También puedes pegarla aquí (clic derecho o Ctrl+V; no se verá).' -ForegroundColor Yellow
            $segura = Read-Host 'Clave' -AsSecureString
            $clave = Extraer-Clave ([System.Net.NetworkCredential]::new('', $segura).Password)
            if (-not $clave) { Write-Host 'Eso no parece una clave de Riot (RGAPI-xxxxxxxx-xxxx-...). Prueba otra vez.' -ForegroundColor Red; continue }
        }
        Write-Host 'Comprobando la clave con Riot...'
        $r = Probar-Clave $clave
        if ($r -eq 'invalida') {
            Write-Host 'Riot no reconoce esa clave. Copia la que aparece AHORA en el panel (si la regeneraste, la anterior deja de valer).' -ForegroundColor Red
            $clave = $null
        } elseif ($r -ne 'ok') {
            throw "No pude comprobar la clave con Riot: $r. Revisa tu conexión a internet."
        }
    }
    Write-Host 'Clave válida.' -ForegroundColor Green

    # 3. Guardarla en el servidor. flyctl reinicia la máquina; su salida se enseña para ver cualquier error.
    Write-Host 'Guardando la clave en el servidor (Fly.io) y reiniciándolo (tarda un minuto)...'
    & flyctl secrets set "RIOT_API_KEY=$clave" --app $app
    if ($LASTEXITCODE -ne 0) { throw "flyctl no pudo guardar la clave (código $LASTEXITCODE). El mensaje de arriba dice por qué." }

    # 4. Sustituir la clave antigua de este PC por la nueva (cifrada para tu usuario de Windows).
    if ($Repo -and (Test-Path $Repo)) {
        $archivoClave = Join-Path $Repo '.clave-riot'
        if (Test-Path $archivoClave) { Remove-Item $archivoClave -Force }
        Set-Content -Path $archivoClave -Value (ConvertFrom-SecureString (ConvertTo-SecureString $clave -AsPlainText -Force)) -NoNewline
        Write-Host 'Clave antigua de este PC sustituida por la nueva.'
    }
    $clave = $null
    Set-Clipboard -Value ' ' -ErrorAction SilentlyContinue  # que la clave no se quede en el portapapeles

    # 5. Esperar a que el servidor diga que la clave vale.
    Write-Host 'Esperando a que el servidor confirme la clave...'
    $estado = 'desconocida'
    for ($i = 0; $i -lt 24 -and $estado -ne 'ok'; $i++) {
        Start-Sleep -Seconds 5
        try { $estado = (Invoke-RestMethod -Uri $salud -TimeoutSec 10).riot } catch { $estado = 'arrancando' }
    }
    Write-Host ''
    if ($estado -eq 'ok') {
        Write-Host 'Listo. El servidor ya usa la clave nueva. Caduca en 24 h: vuelve a usar este acceso directo entonces.' -ForegroundColor Green
    } else {
        Write-Host "La clave se ha guardado, pero el servidor aún responde «$estado». Mira $salud dentro de unos minutos." -ForegroundColor Yellow
    }
} catch {
    Escribir-Error "ERROR: $($_.Exception.Message)"
    Write-Host "Queda anotado en $registro." -ForegroundColor Red
    exit 1
}
