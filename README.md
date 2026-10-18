# Coach LoL IA

Coach en tiempo real para League of Legends, en español: sugiere runas, hechizos, orden de habilidades y objetos según la selección de campeón y avisa durante la partida mediante un overlay y voz.

> Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.

## Instalación

Descarga `Coach LoL IA Setup <versión>.exe` desde la sección *Releases* de [pepeipto/coach-lol-ia](https://github.com/pepeipto/coach-lol-ia/releases) y ejecútalo. La app se actualiza sola al arrancar.

## Uso

1. Abre Coach LoL IA y luego el cliente de League of Legends; la app muestra "Esperando al cliente de League of Legends…" hasta que lo detecta.
2. En la selección de campeón, importa las runas y el conjunto de objetos (se titulan `Coach: <Campeón> <Rol>`; la app solo toca páginas con ese prefijo).
3. En partida, el overlay solo se ve si el juego está en modo **Sin bordes** (Ajustes de LoL → Vídeo → Modo de ventana).
4. Durante la partida, oculta o muestra el overlay con la tecla rápida `CommandOrControl+Shift+O`.
5. Para colocar el panel, pulsa «Mover el overlay» en los ajustes, arrástralo y pulsa «Fijar aquí» (o Esc).

## Qué no hace

Solo usa las API locales oficiales de Riot (la API del cliente, LCU, y la Live Client Data API), Data Dragon y nuestro servidor. No lee la memoria del juego, no inyecta código ni DLL, no captura pantalla y no simula teclado ni ratón. Coach LoL IA no está respaldado ni aprobado por Riot Games. Tampoco muestra temporizadores de hechizos o definitivas enemigas, de jungla enemiga ni la posición de enemigos.

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

## Suscripciones

El servidor vende el plan Premium (4,99 €/mes) con Stripe Checkout, sin SDK: usa la API REST con `fetch` y verifica la firma de los webhooks con `node:crypto`. Las claves solo existen como variables de entorno del servidor (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, y `URL_WEB` para las URL de retorno y el CORS). Si falta alguna de las tres de Stripe, `/api/premium/*` y el webhook responden `503 {"error":"premium_no_configurado"}` y el resto del servidor funciona igual.

| Ruta | Descripción |
|---|---|
| `POST /api/premium/checkout` | Crea la sesión de pago; devuelve `{ url }`. |
| `GET /api/premium/licencia?session_id=` | Devuelve `{ clave, estado }` de una sesión pagada (la crea si el webhook aún no llegó) o `404 pendiente`. |
| `POST /api/premium/portal` | Con `{ clave }`, devuelve `{ url }` del portal de cliente de Stripe. |
| `GET /api/premium/estado/:clave` | Devuelve `{ premium, estado, renuevaEn }`; es lo que consulta la app. |
| `POST /api/stripe/webhook` | Eventos de Stripe (firma obligatoria, tolerancia de 300 s). |

Las rutas de premium admiten 30 peticiones por minuto y por IP. Los eventos de suscripción pueden llegar antes que `checkout.session.completed`: si la suscripción es de nuestro precio y aún no existe, el webhook responde 500 a propósito para que Stripe reintente (las suscripciones de otro precio o producto de la cuenta se ignoran con 200; `invoice.payment_failed` solo actúa si la suscripción ya tiene licencia y, si no, se ignora con 200). También se atiende `checkout.session.async_payment_succeeded`. Para configurar el webhook, en el panel de Stripe apunta un endpoint a `https://<tu-servidor>/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed`, y copia su secreto en `STRIPE_WEBHOOK_SECRET`.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `RIOT_API_KEY` | servidor | Clave de la API de Riot (obligatoria). |
| `PUERTO` | servidor | Puerto HTTP (por defecto 8080 en Docker). |
| `RUTA_DB` | servidor | Ruta del archivo SQLite (`/datos/coach.db` en Docker). |
| `MAX_PARTIDAS` | servidor | Límite de partidas nuevas a procesar por región en cada ciclo (por defecto 300). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | servidor | Credenciales de Stripe (opcionales; sin ellas premium responde 503). |
| `TRUST_PROXY` | servidor | `1` o `true` si hay un proxy inverso delante: usa `X-Forwarded-For` para la IP del cliente (el límite de 30 peticiones por minuto de premium es por IP; sin esto, tras un proxy sería global). |
| `URL_WEB` | servidor | URL pública de la web (por defecto `https://pepeipto.github.io/coach-lol-ia`). |
| `COACH_SERVIDOR` | app (al compilar o al ejecutar) | URL del servidor de builds. Al ejecutar tiene prioridad sobre la fijada al compilar; sin ninguna, `http://localhost:8080`. |
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

**Las versiones publicadas deben compilarse con `COACH_SERVIDOR`** apuntando al servidor público (p. ej. `COACH_SERVIDOR=https://… npm run build -w app`). Sin ella la app usa `http://localhost:8080` y `npm run build` muestra un aviso. La URL no se guarda en los ajustes del usuario.
