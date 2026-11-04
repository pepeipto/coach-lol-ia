<#
.SYNOPSIS
    Convierte un JSON de eventos-lol.ps1 en marcas de tiempo de la grabación de OBS, listas para cortar clips.

.DESCRIPTION
    Cada evento del JSON lleva la hora del reloj del PC a la que pasó (campo «reloj»). Restándole la hora a la que
    empezó la grabación, sale el minuto exacto del vídeo. La hora de inicio de la grabación se saca del nombre del
    archivo de OBS (formato por defecto «AAAA-MM-DD HH-MM-SS.mkv»); si no lo tiene, de la fecha de creación del
    archivo, o se puede dar a mano con -InicioGrabacion.

    Por defecto solo saca tus jugadas (kills, muertes, asistencias, multikills) y los objetivos grandes. Con -Todo
    saca todos los eventos de la partida.

.PARAMETER Partida
    JSON de la partida. Por defecto, el más reciente de -Carpeta.

.PARAMETER Video
    Grabación de OBS de esa partida (o del directo entero). Se usa para saber a qué hora empezó.

.PARAMETER InicioGrabacion
    Hora a la que empezó la grabación, si no se puede sacar del archivo (por ejemplo «2026-11-03 23:45:10»).

.PARAMETER Antes
    Segundos de margen antes de cada jugada para el clip. Por defecto 10.

.PARAMETER Despues
    Segundos de margen después de cada jugada. Por defecto 5.

.PARAMETER Csv
    Si se indica, guarda también la lista en este CSV (se abre bien en Excel o se importa en el editor).

.EXAMPLE
    .\stream\marcas-video.ps1 -Video "$env:USERPROFILE\Videos\2026-11-03 23-45-10.mkv"

.EXAMPLE
    .\stream\marcas-video.ps1 -Partida .\partida-20261103-235453.json -InicioGrabacion '2026-11-03 23:45:10' -Todo -Csv marcas.csv
#>
param(
    [string]$Partida,
    [string]$Video,
    [datetime]$InicioGrabacion,
    [string]$Carpeta = (Join-Path $env:USERPROFILE 'Videos\coach-tiktok'),
    [int]$Antes = 10,
    [int]$Despues = 5,
    [switch]$Todo,
    [string]$Csv
)

$ErrorActionPreference = 'Stop'

if (-not $Partida) {
    $ultimo = Get-ChildItem -Path $Carpeta -Filter 'partida-*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $ultimo) { throw "No hay ningún partida-*.json en $Carpeta." }
    $Partida = $ultimo.FullName
}
$datos = Get-Content -Path $Partida -Raw -Encoding UTF8 | ConvertFrom-Json

# Hora de inicio de la grabación: a mano, por el nombre que pone OBS o por la fecha de creación del archivo.
if (-not $PSBoundParameters.ContainsKey('InicioGrabacion')) {
    if (-not $Video) { throw 'Indica -Video (la grabación de OBS) o -InicioGrabacion.' }
    $archivoVideo = Get-Item -Path $Video
    $fecha = [datetime]::MinValue
    if ([datetime]::TryParseExact($archivoVideo.BaseName, 'yyyy-MM-dd HH-mm-ss', $null, 'None', [ref]$fecha)) {
        $InicioGrabacion = $fecha
    } else {
        $InicioGrabacion = $archivoVideo.CreationTime
        Write-Warning "El nombre del vídeo no tiene la fecha de OBS: uso su fecha de creación ($InicioGrabacion)."
    }
}

# En la API los nombres pueden venir como Riot ID sin #TAG, como nombre de invocador o como campeón.
$mios = @(([string]$datos.yo).Split('#')[0], [string]$datos.yo, [string]$datos.miCampeon) | Where-Object { $_ }
function EsMio($nombre) { return $nombre -and ($mios -contains [string]$nombre) }

$objetivos = 'DragonKill', 'BaronKill', 'HeraldKill', 'HordeKill', 'InhibKilled', 'Ace', 'FirstBlood'

function Formato([double]$s) {
    if ($s -lt 0) { $s = 0 }
    return [TimeSpan]::FromSeconds([math]::Floor($s)).ToString('hh\:mm\:ss')
}

$filas = foreach ($e in $datos.eventos) {
    $quien = ''
    switch ($e.tipo) {
        'ChampionKill' {
            if (EsMio $e.KillerName) { $quien = "Kill a $($e.VictimName)" }
            elseif (EsMio $e.VictimName) { $quien = "Muerte contra $($e.KillerName)" }
            elseif (@($e.Assisters | Where-Object { EsMio $_ }).Count) { $quien = "Asistencia ($($e.KillerName) a $($e.VictimName))" }
            elseif ($Todo) { $quien = "$($e.KillerName) mata a $($e.VictimName)" }
        }
        'Multikill' {
            if ((EsMio $e.KillerName) -or $Todo) { $quien = "Multikill x$($e.KillStreak) de $($e.KillerName)" }
        }
        default {
            if (($objetivos -contains $e.tipo) -or $Todo) {
                $detalle = @($e.KillerName, $e.Recipient, $e.Acer, $e.DragonType) | Where-Object { $_ }
                $quien = ($e.tipo + $(if ($detalle) { ' (' + ($detalle -join ', ') + ')' } else { '' }))
            }
        }
    }
    if (-not $quien) { continue }

    $enVideo = ([datetime]::Parse($e.reloj) - $InicioGrabacion).TotalSeconds
    if ($enVideo -lt 0) { continue }   # pasó antes de darle a grabar
    [pscustomobject]@{
        Video     = Formato $enVideo
        Desde     = Formato ($enVideo - $Antes)
        Hasta     = Formato ($enVideo + $Despues)
        Partida   = Formato $e.segundo
        Jugada    = $quien
    }
}

if (-not $filas) {
    Write-Warning 'No hay jugadas dentro de la grabación. ¿Es el vídeo de esta partida? Prueba con -Todo.'
    return
}
Write-Host "$($datos.miCampeon) ($($datos.yo)) · $($datos.modo) · grabación desde $InicioGrabacion"
$filas | Format-Table -AutoSize
if ($Csv) {
    $filas | Export-Csv -Path $Csv -NoTypeInformation -Encoding UTF8 -Delimiter ';'
    Write-Host "Guardado en $Csv"
}
