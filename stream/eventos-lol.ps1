<#
.SYNOPSIS
    Apunta los eventos de cada partida de LoL (kills, muertes, objetivos…) con su segundo de partida y la hora del reloj.

.DESCRIPTION
    Lee la Live Client Data API del propio juego (https://127.0.0.1:2999/liveclientdata), que solo existe mientras
    hay una partida en curso, y guarda un JSON por partida con todos los eventos. Sirve para saber en qué segundo de la
    grabación de OBS está cada jugada sin ver el vídeo entero (ver marcas-video.ps1).

    - Se queda esperando: puedes lanzarlo antes de entrar en cola y dejarlo abierto toda la sesión de directo.
    - Al detectar una partida crea partida-AAAAMMDD-HHMMSS.json y lo reescribe cada vez que hay eventos nuevos.
    - Cuando la API desaparece (fin de partida) cierra el archivo y vuelve a esperar a la siguiente.
    - Si lo arrancas a mitad de partida, recupera también los eventos anteriores (la API los devuelve todos).
    - Solo lee: no toca el juego, ni OBS, ni el cliente. No usa la API de Riot ni ninguna clave.

    Va dejando un registro de lo que hace en eventos-lol.log dentro de la carpeta de salida.

.PARAMETER Carpeta
    Dónde guardar los JSON y el registro. Por defecto, %USERPROFILE%\Videos\coach-tiktok (se crea si no existe).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\stream\eventos-lol.ps1

.EXAMPLE
    # Oculto, para que no estorbe en pantalla durante el directo:
    powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File .\stream\eventos-lol.ps1 -Carpeta D:\clips
#>
param(
    [string]$Carpeta = (Join-Path $env:USERPROFILE 'Videos\coach-tiktok')
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
# El certificado de la API del juego es autofirmado.
[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

if (-not (Test-Path $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta | Out-Null }
$api = 'https://127.0.0.1:2999/liveclientdata'
$registro = Join-Path $Carpeta 'eventos-lol.log'

function Anotar([string]$t) { Add-Content -Path $registro -Value "$(Get-Date -Format s) $t" }

# Una sola copia a la vez: dos copias escribirían la misma partida en dos archivos distintos.
$unico = New-Object System.Threading.Mutex($false, 'Local\CoachLolIA-eventos-lol')
if (-not $unico.WaitOne(0)) {
    Anotar 'Ya había otra copia en marcha: salgo.'
    Write-Host 'eventos-lol.ps1 ya se está ejecutando.'
    exit 0
}

# curl.exe con -k: Invoke-RestMethod no se traga el certificado autofirmado del juego cuando corre oculto.
function Pedir([string]$ruta) {
    $salida = & curl.exe -sk --max-time 3 "$api/$ruta"
    if (-not $salida) { throw 'sin respuesta' }
    return ($salida -join "`n") | ConvertFrom-Json
}

# Riot ID completo (Nombre#TAG) o, en cuentas antiguas, el nombre de invocador.
function NombreDe($jugador) {
    if ($jugador.riotIdGameName) { return "$($jugador.riotIdGameName)#$($jugador.riotIdTagLine)" }
    return [string]$jugador.summonerName
}

function Guardar() { $partida | ConvertTo-Json -Depth 6 | Set-Content -Path $archivo -Encoding UTF8 }

Anotar "Arranco: espero a que empiece una partida (salida en $Carpeta)."
$partida = $null
$archivo = $null
$vistos = @{}

while ($true) {
    $datos = $null
    try { $datos = Pedir 'allgamedata' } catch { $datos = $null }

    if ($null -eq $datos) {
        if ($null -ne $partida) {
            # La API ha desaparecido: la partida ha terminado.
            $partida.finReloj = (Get-Date).ToString('o')
            Guardar
            Anotar "Partida terminada: $archivo ($($partida.eventos.Count) eventos)."
            $partida = $null; $archivo = $null; $vistos = @{}
        }
        Start-Sleep -Seconds 3
        continue
    }

    $ahora = Get-Date
    $tiempoJuego = [double]$datos.gameData.gameTime
    if ($null -eq $partida) {
        $yo = $datos.activePlayer
        $nombre = NombreDe $yo
        $miCampeon = ''
        foreach ($j in $datos.allPlayers) {
            if ($j.riotIdGameName -eq $yo.riotIdGameName -or $j.summonerName -eq $yo.summonerName) { $miCampeon = [string]$j.championName; break }
        }
        $archivo = Join-Path $Carpeta ("partida-{0}.json" -f $ahora.ToString('yyyyMMdd-HHmmss'))
        $partida = [ordered]@{
            archivo              = $archivo
            inicioReloj          = $ahora.ToString('o')
            # Hora del reloj a la que el cronómetro de la partida marcaba 0:00 (para pasar del segundo de partida al del vídeo).
            relojSegundo0        = $ahora.AddSeconds(-$tiempoJuego).ToString('o')
            tiempoJuegoAlEmpezar = $tiempoJuego
            modo                 = [string]$datos.gameData.gameMode
            mapa                 = [string]$datos.gameData.mapName
            yo                   = $nombre
            miCampeon            = $miCampeon
            jugadores            = @($datos.allPlayers | ForEach-Object { [ordered]@{ nombre = NombreDe $_; campeon = [string]$_.championName; equipo = [string]$_.team } })
            eventos              = @()
            finReloj             = $null
        }
        Anotar "Partida detectada: $($partida.modo) con $miCampeon ($nombre), minuto $([int]($tiempoJuego/60))."
    }

    # Si el reloj del juego y el del PC se desvían, el mínimo es la mejor estimación del segundo 0 (las pausas lo retrasan).
    $cero = $ahora.AddSeconds(-$tiempoJuego)
    if ($cero -lt [datetime]::Parse($partida.relojSegundo0)) { $partida.relojSegundo0 = $cero.ToString('o') }

    $nuevos = 0
    foreach ($e in @($datos.events.Events)) {
        $id = [int]$e.EventID
        if ($vistos.ContainsKey($id)) { continue }
        $vistos[$id] = $true
        $ev = [ordered]@{
            id      = $id
            tipo    = [string]$e.EventName
            segundo = [math]::Round([double]$e.EventTime, 1)
            reloj   = $cero.AddSeconds([double]$e.EventTime).ToString('o')
        }
        foreach ($campo in 'KillerName', 'VictimName', 'Assisters', 'KillStreak', 'DragonType', 'Stolen', 'TurretKilled', 'InhibKilled', 'Acer', 'AcingTeam', 'Recipient') {
            if ($null -ne $e.$campo) { $ev[$campo] = $e.$campo }
        }
        $partida.eventos += $ev
        $nuevos++
    }
    if ($nuevos -gt 0) {
        # El marcador propio va en allPlayers (activePlayer no lo trae).
        $yoAhora = $datos.allPlayers | Where-Object { $_.championName -eq $partida.miCampeon } | Select-Object -First 1
        $partida.marcador = [ordered]@{ kills = $yoAhora.scores.kills; muertes = $yoAhora.scores.deaths; asistencias = $yoAhora.scores.assists; segundo = [math]::Round($tiempoJuego) }
        Guardar
    }
    Start-Sleep -Seconds 1
}
