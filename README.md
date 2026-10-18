# Coach LoL IA

Coach en tiempo real para League of Legends, en español: sugiere runas, hechizos, orden de habilidades y objetos según la selección de campeón y avisa durante la partida mediante un overlay y voz.

> Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.

## Instalación

Descarga `Coach LoL IA Setup <versión>.exe` desde la sección *Releases* de [pepeipto/coach-lol-ia](https://github.com/pepeipto/coach-lol-ia/releases) y ejecútalo. La app se actualiza sola al arrancar.

## Uso

1. Abre Coach LoL IA y luego el cliente de League of Legends; la app muestra "Esperando al cliente de League of Legends…" hasta que lo detecta.
2. En la selección de campeón, importa las runas y el conjunto de objetos (se titulan `Coach: <Campeón> <Rol>`; la app solo toca páginas con ese prefijo).
3. En partida, el overlay solo se ve si el juego está en modo **Sin bordes** (Ajustes de LoL → Vídeo → Modo de ventana).
4. Alterna el overlay con la tecla rápida `CommandOrControl+Shift+O` (configurable en los ajustes de la app).

## Qué no hace

Solo usa la API del cliente (LCU), la Live Client Data API local, Data Dragon y nuestro servidor. No lee la memoria del juego, no inyecta código ni DLL, no captura pantalla y no simula teclado ni ratón, por lo que es compatible con Vanguard y las normas de Riot. Tampoco muestra temporizadores de hechizos o definitivas enemigas, de jungla enemiga ni la posición de enemigos.

## Servidor

El servidor agrega partidas clasificatorias Solo/Dúo de Esmeralda o superior (EUW, LAN, LAS) cada 6 horas y publica las builds. Desde la raíz del repositorio:

```
docker build -f server/Dockerfile -t coach-lol-ia-server .
docker run -d -p 8080:8080 -v coach-datos:/datos -e RIOT_API_KEY=RGAPI-... coach-lol-ia-server
```

La clave de Riot solo vive en el servidor, como variable de entorno; nunca se guarda en el repositorio ni en la app.

### Clave de producción de Riot

Las claves de desarrollo caducan a las 24 h. Para una clave permanente:

1. Entra en el [Riot Developer Portal](https://developer.riotgames.com/) con tu cuenta de Riot.
2. Pulsa *Register Product* y elige *Production API Key* (producto personal o público).
3. Describe la app (Coach LoL IA), añade la URL del repositorio y el aviso legal anterior, y envía la solicitud.
4. Cuando Riot la apruebe, copia la clave y pásala al contenedor como `RIOT_API_KEY`.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `RIOT_API_KEY` | servidor | Clave de la API de Riot (obligatoria). |
| `PUERTO` | servidor | Puerto HTTP (por defecto 8080 en Docker). |
| `RUTA_DB` | servidor | Ruta del archivo SQLite (`/datos/coach.db` en Docker). |
| `MAX_PARTIDAS` | servidor | Límite de partidas a procesar por ciclo. |
| `COACH_SERVIDOR` | app (al compilar) | URL del servidor que usará la app. |
| `COACH_LIVE_URL` | app | URL alternativa de la Live Client Data API (pruebas con el simulador). |
| `COACH_FORZAR_PARTIDA` | app | `1` simula la fase de partida sin cliente de LoL. |

## Desarrollo

Requiere Node 24. npm 12 bloquea por defecto los scripts de instalación; hacen falta los de `electron`, `better-sqlite3` y `esbuild`:

```
npm ci --dangerously-allow-all-scripts   # o, si Electron falta: node node_modules/electron/install.js
npm test
npx tsc --noEmit -p app                  # también shared y server
npm run dev -w app
```

Simulador de partida (sin tener LoL abierto): `npm run grabar -w app -- partida.json` graba una partida real (con LoL en juego); `npm run simular -w app -- partida.json [velocidad]` la reproduce como Live Client Data API falsa y escribe su puerto. Arranca la app con `COACH_LIVE_URL=http://127.0.0.1:<puerto>` y `COACH_FORZAR_PARTIDA=1`.

Instalador: `npm run build -w app` y, dentro de `app`, `npx electron-builder -w --publish never` genera `app/dist/Coach LoL IA Setup <versión>.exe`.
