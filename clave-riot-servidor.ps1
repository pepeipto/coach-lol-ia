# Renueva la clave de Riot de Coach LoL IA: la pide, la comprueba con Riot, la guarda como secreto en el servidor
# público (Fly.io) y espera a que el servidor la use. También sustituye la clave antigua guardada en este PC
# (.clave-riot, cifrada con DPAPI) para que «Iniciar Coach LoL IA» no use una caducada.
# La clave no se escribe en ningún archivo en claro ni aparece en pantalla.
# -Repo: carpeta del repo (para .clave-riot). Si no se indica, la del propio script.
#
# Pensado para salir bien a la primera:
#  - Si Riot rechaza la clave, se reintenta unos segundos antes de darla por mala (a veces tarda en activarse) y el
#    aviso explica la causa habitual: copiarla antes de que el portal enseñe la nueva.
#  - Si flyctl falla DESPUÉS de guardar el secreto (p. ej. «unauthorized» al comprobar la máquina, que pasa con la
#    sesión de Fly recién renovada), no se da por perdido: se mira /salud y, si el servidor ya usa la clave nueva,
#    se termina bien. Solo es un error si el servidor sigue sin ella.
param([string]$Repo = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$app = 'coachlolia-api'
$portal = 'https://developer.riotgames.com'
$salud = 'https://api.coachlolia.com/salud'
$forma = '^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$registro = Join-Path $env:TEMP 'renovar-clave-riot.log'
# Cuántas veces se pregunta a Riot por una clave que rechaza, y cada cuánto, antes de darla por mala.
$intentosRiot = 3
$pausaRiotSeg = 4
# Cuánto se espera a que /salud diga que el servidor usa la clave nueva.
$esperaServidorSeg = 120

function Escribir-Error([string]$texto) {
    Write-Host $texto -ForegroundColor Red
    Add-Content -Path $registro -Value "$(Get-Date -Format s) $texto"
}

# Una petición barata a Riot con la clave: 'ok', 'invalida' (401/403) o el error de red.
function Probar-Clave([string]$clave) {
    try {
        Invoke-RestMethod -Uri 'https://euw1.api.riotgames.com/lol/status/v4/platform-data' -Headers @{ 'X-Riot-Token' = $clave } -TimeoutSec 15 | Out-Null
        return 'ok'
    } catch {
        $codigo = $_.Exception.Response.StatusCode.value__
        if ($codigo -in 401, 403) { return 'invalida' }
        # 404 (sin datos) y 429 (límite de peticiones) demuestran que Riot acepta la clave.
        if ($codigo -in 404, 429) { return 'ok' }
        return "error de red ($($_.Exception.Message))"
    }
}

# Como Probar-Clave, pero a una clave rechazada le da varias oportunidades: recién regenerada puede tardar unos segundos.
function Probar-Clave-Con-Paciencia([string]$clave) {
    for ($i = 1; $i -le $intentosRiot; $i++) {
        $r = Probar-Clave $clave
        if ($r -ne 'invalida' -or $i -eq $intentosRiot) { return $r }
        Write-Host "Riot aún no la acepta; vuelvo a probar en $pausaRiotSeg s (intento $i de $intentosRiot)..." -ForegroundColor Yellow
        Start-Sleep -Seconds $pausaRiotSeg
    }
    return 'invalida'
}

# Busca una clave con forma de Riot dentro de un texto (el portapapeles o lo pegado puede traer espacios o comillas).
function Extraer-Clave([string]$texto) {
    if (-not $texto) { return $null }
    $m = [regex]::Match($texto, 'RGAPI-[0-9a-fA-F-]{36}')
    if ($m.Success -and $m.Value -match $forma) { return $m.Value }
    return $null
}

# Principio y final de la clave, para reconocerla sin enseñarla entera: RGAPI-12345678...abcd
function Recortar([string]$clave) {
    return $clave.Substring(0, 14) + '...' + $clave.Substring($clave.Length - 4)
}

# Estado de la clave según el servidor ('ok', 'caducada', 'desconocida') y desde cuándo (UTC), o $null si no responde.
function Estado-Servidor {
    try {
        $s = Invoke-RestMethod -Uri $salud -TimeoutSec 10
        return @{ riot = [string]$s.riot; desde = [datetime]::Parse([string]$s.riotDesde, $null, 'AdjustToUniversal') }
    } catch { return $null }
}

# Espera a que el servidor diga 'ok' con una fecha posterior a $desde (es decir, con la clave nueva). Devuelve el estado final.
function Esperar-Servidor([datetime]$desde, [int]$segundos) {
    $fin = (Get-Date).AddSeconds($segundos)
    $estado = 'arrancando'
    while ((Get-Date) -lt $fin) {
        Start-Sleep -Seconds 5
        $e = Estado-Servidor
        if ($null -eq $e) { $estado = 'arrancando' }
        else {
            $estado = $e.riot
            if ($estado -eq 'ok' -and $e.desde -gt $desde) { return 'ok' }
            if ($estado -eq 'ok') { $estado = 'ok con la clave anterior' }
        }
        Write-Host '.' -NoNewline
    }
    return $estado
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

    # Estado del servidor antes de tocar nada: sirve para saber luego si la clave nueva ha llegado.
    $antes = Estado-Servidor
    $desdeAntes = if ($null -ne $antes) { $antes.desde } else { [datetime]::UtcNow.AddMinutes(-1) }

    # 2. Pedir la clave: se abre el portal, se copia y basta con pulsar Enter (se lee del portapapeles).
    Write-Host ''
    Write-Host "Se abre $portal en el navegador."
    Write-Host '  1) Inicia sesión y pulsa "Regenerate API Key". ESPERA a que la clave de la pantalla cambie.'
    Write-Host '  2) Pulsa el botón de copiar junto a la clave nueva (empieza por RGAPI-).'
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
        Write-Host "Clave leída: $(Recortar $clave). Comprobándola con Riot..."
        $r = Probar-Clave-Con-Paciencia $clave
        if ($r -eq 'invalida') {
            Write-Host 'Riot rechaza esa clave (401/403). Casi siempre es la ANTERIOR, copiada antes de que el portal enseñara la nueva:' -ForegroundColor Red
            Write-Host "vuelve al portal, comprueba que la clave de la pantalla empieza por $($clave.Substring(0, 14)) y, si no, copia esa (o pulsa «Regenerate API Key» otra vez)." -ForegroundColor Red
            $clave = $null
        } elseif ($r -ne 'ok') {
            throw "No pude comprobar la clave con Riot: $r. Revisa tu conexión a internet."
        }
    }
    Write-Host 'Clave válida.' -ForegroundColor Green

    # 3. Guardarla en el servidor. flyctl reinicia la máquina; su salida se enseña para ver cualquier error.
    Write-Host 'Guardando la clave en el servidor (Fly.io) y reiniciándolo (tarda un minuto)...'
    # Se recoge la salida (también la de error) para enseñarla y poder reconocer el fallo. Con 'Continue' las líneas
    # de error de flyctl no se convierten en excepción (PowerShell 5.1).
    $ErrorActionPreference = 'Continue'
    $salidaFly = @(& flyctl secrets set "RIOT_API_KEY=$clave" --app $app 2>&1 | ForEach-Object { $_.ToString() })
    $codigoFly = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $salidaFly | ForEach-Object { Write-Host $_ }
    $guardada = ($codigoFly -eq 0)
    if (-not $guardada) {
        # flyctl ha fallado, pero puede que el secreto ya esté guardado y el servidor reiniciado (pasa cuando falla
        # solo la comprobación final de la máquina, p. ej. «unauthorized»). Lo decide el servidor, no flyctl.
        # Si flyctl ni siquiera llegó a actualizar la máquina, no hace falta esperar.
        $estado = 'sin cambios'
        if (($salidaFly -join "`n") -match 'Updating existing machines|staged|Release v\d') {
            Write-Host ''
            Write-Host "flyctl ha devuelto el código $codigoFly. Compruebo si, aun así, el servidor ya usa la clave nueva..." -ForegroundColor Yellow
            $estado = Esperar-Servidor $desdeAntes $esperaServidorSeg
            Write-Host ''
        }
        if ($estado -eq 'ok') {
            Write-Host 'El servidor ya usa la clave nueva: el error de flyctl era solo de su comprobación final.' -ForegroundColor Green
            $guardada = $true
        } else {
            $pista = ''
            if (($salidaFly -join "`n") -match 'unauthorized|401') {
                $pista = " Fly ha rechazado la sesión de flyctl («unauthorized»): cierra la ventana, ejecuta en una terminal 'flyctl auth logout' y luego 'flyctl auth login', y vuelve a abrir «Renovar clave Riot»."
            }
            throw "flyctl no pudo guardar la clave (código $codigoFly) y el servidor sigue sin ella (estado: $estado). El mensaje de arriba dice por qué.$pista"
        }
    }

    # 4. Sustituir la clave antigua de este PC por la nueva (cifrada para tu usuario de Windows).
    if ($Repo -and (Test-Path $Repo)) {
        $archivoClave = Join-Path $Repo '.clave-riot'
        if (Test-Path $archivoClave) { Remove-Item $archivoClave -Force }
        Set-Content -Path $archivoClave -Value (ConvertFrom-SecureString (ConvertTo-SecureString $clave -AsPlainText -Force)) -NoNewline
        Write-Host 'Clave antigua de este PC sustituida por la nueva.'
    }
    $clave = $null
    Set-Clipboard -Value ' ' -ErrorAction SilentlyContinue  # que la clave no se quede en el portapapeles

    # 5. Esperar a que el servidor diga que la clave vale (si no se ha comprobado ya en el paso 3).
    if ($codigoFly -eq 0) {
        Write-Host 'Esperando a que el servidor confirme la clave...'
        $estado = Esperar-Servidor $desdeAntes $esperaServidorSeg
        Write-Host ''
    }
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
