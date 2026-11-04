# Herramientas de directo y clips

Dos scripts de PowerShell para Windows que ayudan a sacar clips de TikTok (y a seguir los directos de Twitch) sin
tener que revisar la grabación entera:

| Script | Qué hace |
| --- | --- |
| `eventos-lol.ps1` | Mientras juegas, apunta cada evento de la partida (kills, muertes, dragones, torres…) con el segundo de partida y la hora del reloj del PC. Deja un `partida-AAAAMMDD-HHMMSS.json` por partida. |
| `marcas-video.ps1` | Cruza ese JSON con la grabación de OBS y te dice en qué minuto del vídeo está cada jugada, con un margen para cortar el clip. |

Solo leen. No tocan el juego, el cliente de Riot ni OBS, y no necesitan clave de la API de Riot: usan la
[Live Client Data API](https://developer.riotgames.com/docs/lol#game-client-api) que el propio juego abre en
`https://127.0.0.1:2999` durante la partida, la misma fuente que usan los overlays de directo.

## Requisitos

- Windows 10/11 con PowerShell 5.1 (viene de serie) y `curl.exe` (también de serie desde Windows 10 1803).
- OBS grabando con el nombre de archivo por defecto (`AAAA-MM-DD HH-MM-SS.mkv`). Si lo has cambiado, mira
  «Si el nombre del vídeo no tiene la fecha» más abajo.

Los dos scripts guardan y buscan los JSON en `%USERPROFILE%\Videos\coach-tiktok`. Cámbialo con `-Carpeta`.

## En el directo: grabar los eventos

1. Antes de la primera partida, lanza el registrador y déjalo abierto toda la sesión:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\stream\eventos-lol.ps1
   ```

   Para que no aparezca ninguna ventana en pantalla durante el directo:

   ```powershell
   powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File .\stream\eventos-lol.ps1
   ```

2. Dale a **Iniciar grabación** en OBS (además de, o en vez de, **Iniciar transmisión**). Si solo emites en Twitch,
   activa también la grabación local, o descarga luego el VOD (ver más abajo).
3. Juega con normalidad. El script detecta cada partida sola, escribe el JSON mientras juegas y lo cierra al acabar.
   Puedes encadenar partidas sin tocar nada.
4. Para pararlo, cierra la ventana (o, si va oculto, `Stop-Process` sobre el `powershell` que lo ejecuta).

Solo puede haber una copia en marcha: si lo lanzas dos veces, la segunda sale sola y lo apunta en el registro.
Lo que va haciendo queda en `eventos-lol.log`:

```
2026-11-03T23:54:53 Partida detectada: CLASSIC con Zed (akira88#lol), minuto 6.
2026-11-04T00:15:35 Partida terminada: ...\partida-20261103-235453.json (100 eventos).
```

Si lo arrancas a mitad de partida no pasa nada: el juego devuelve todos los eventos desde el minuto 0.

> Truco: para que arranque solo al encender el PC, crea un acceso directo a la orden oculta de arriba en la
> carpeta `shell:startup` (Win+R → `shell:startup`).

## Después: sacar los clips

Con la partida terminada y la grabación guardada:

```powershell
.\stream\marcas-video.ps1 -Video "$env:USERPROFILE\Videos\2026-11-03 23-45-10.mkv"
```

Sin `-Partida` usa el JSON más reciente. La salida es algo así:

```
Zed (akira88#lol) · CLASSIC · grabación desde 03/11/2026 23:45:10

Video    Desde    Hasta    Partida  Jugada
-----    -----    -----    -------  ------
00:14:38 00:14:28 00:14:43 00:11:03 Kill a Kennen
00:16:05 00:15:55 00:16:10 00:12:30 Kill a Vayne
00:18:08 00:17:58 00:18:13 00:14:33 Kill a Darius
00:18:39 00:18:29 00:18:44 00:15:04 Kill a Lux
00:18:44 00:18:34 00:18:49 00:15:09 Muerte contra Vayne
...
```

- **Video**: minuto exacto de la jugada en la grabación.
- **Desde / Hasta**: el tramo a cortar para el clip (10 s antes y 5 s después; cámbialo con `-Antes` y `-Despues`).
- **Partida**: el cronómetro del juego, por si quieres comprobarlo en la repetición del cliente.

Por defecto salen tus kills, muertes, asistencias y multikills, y los objetivos grandes (dragones, Barón, Heraldo,
larvas, inhibidores, ace y primera sangre). Con `-Todo` salen todos los eventos de la partida.

Para llevarlo al editor (CapCut, DaVinci, Premiere…) guarda la lista en CSV:

```powershell
.\stream\marcas-video.ps1 -Video "...\2026-11-03 23-45-10.mkv" -Csv marcas.csv
```

### Si el nombre del vídeo no tiene la fecha

El script usa entonces la fecha de creación del archivo y avisa. Si no cuadra (por ejemplo, el vídeo se ha copiado
de otro disco), da la hora de inicio a mano:

```powershell
.\stream\marcas-video.ps1 -InicioGrabacion '2026-11-03 23:45:10'
```

### Con el VOD de Twitch

El VOD empieza cuando le das a **Iniciar transmisión**. Usa `-InicioGrabacion` con esa hora (la ves en el panel de
creador de Twitch o en el registro de OBS, Ayuda → Archivos de registro).

## Formato del JSON

Por si quieres usarlo desde otra herramienta:

```json
{
  "inicioReloj": "2026-11-03T23:54:53.97+01:00",
  "relojSegundo0": "2026-11-03T23:48:45.01+01:00",
  "modo": "CLASSIC",
  "yo": "akira88#lol",
  "miCampeon": "Zed",
  "jugadores": [{ "nombre": "...", "campeon": "Darius", "equipo": "ORDER" }],
  "eventos": [
    { "id": 2, "tipo": "ChampionKill", "segundo": 89.7, "reloj": "2026-11-03T23:50:14.77+01:00",
      "KillerName": "Darius", "VictimName": "Mordekaiser", "Assisters": [] }
  ],
  "marcador": { "kills": 9, "muertes": 7, "asistencias": 5, "segundo": 1603 },
  "finReloj": "2026-11-04T00:15:35.54+01:00"
}
```

- `relojSegundo0` es la hora del PC a la que el cronómetro de la partida marcaba 0:00. Se corrige sola si el juego se
  pausa o se desvía (se queda con la estimación más temprana).
- `segundo` es el tiempo de partida del evento y `reloj` la hora del PC equivalente. Para pasar a tiempo de vídeo
  basta con `reloj − hora de inicio de la grabación`, que es lo que hace `marcas-video.ps1`.
- Los campos en inglés (`KillerName`, `DragonType`…) se copian tal cual de la API del juego. Según la cola, los
  nombres pueden venir como Riot ID sin `#TAG` o como nombre de campeón.

## Problemas frecuentes

- **No detecta la partida**: la API solo existe con la partida cargada (no en la selección de campeón). Mira
  `eventos-lol.log`. Si ves «Arranco» pero nunca «Partida detectada», comprueba que `curl.exe` existe
  (`curl.exe --version`).
- **«no se puede cargar porque la ejecución de scripts está deshabilitada»**: lánzalo con
  `powershell -ExecutionPolicy Bypass -File ...` como en los ejemplos.
- **Las marcas salen desfasadas unos segundos**: el reloj del PC y el inicio de la grabación no coinciden del todo.
  Ajusta `-InicioGrabacion` o sube `-Antes`.
- **Sale vacío**: el vídeo no corresponde a esa partida, o la grabación empezó después. Prueba con `-Partida` y el
  JSON correcto, o con `-Todo`.
