# Coach LoL IA

Coach en tiempo real para League of Legends, en español: sugiere runas, hechizos, orden de habilidades y objetos según la selección de campeón y avisa durante la partida mediante un overlay y voz.

> Coach LoL IA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
>
> Coach LoL IA no está respaldado por Riot Games y no refleja los puntos de vista ni las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de las propiedades de Riot Games. Riot Games y todas sus propiedades asociadas son marcas comerciales o marcas registradas de Riot Games, Inc.

El primer párrafo es el aviso oficial de las [políticas de la API de Riot](https://developer.riotgames.com/policies/general), literal; la app y la web lo enseñan en inglés en todas las páginas y, en los demás idiomas, después de su traducción.

## Instalación

Descarga `Coach LoL IA Setup <versión>.exe` desde la sección *Releases* de [pepeipto/coach-lol-ia](https://github.com/pepeipto/coach-lol-ia/releases) y ejecútalo. La app se actualiza sola al arrancar.

## Uso

1. Abre Coach LoL IA y luego el cliente de League of Legends; la app muestra "Esperando al cliente de League of Legends…" hasta que lo detecta.
2. En la selección de campeón, importa las runas y el conjunto de objetos (se titulan `Coach: <Campeón> <Rol>`; la app solo toca páginas con ese prefijo, salvo que no quede ninguna libre: entonces, al pulsar «Importar», pregunta antes de sustituir una página tuya, nunca una predefinida; la importación automática nunca borra nada).
3. En partida, el overlay solo se ve si el juego está en modo **Sin bordes** (Ajustes de LoL → Vídeo → Modo de ventana).
4. Durante la partida, oculta o muestra el overlay con la tecla rápida `CommandOrControl+Shift+O` (Ctrl+Mayús+O). La app solo la registra mientras dura la partida o el modo mover.
5. Para colocar el panel, en la vista Overlay de la app pulsa «Mover y calibrar», arrástralo y pulsa «Fijar aquí» (o Esc, o la tecla rápida, que también salen del modo mover).
6. Todo es gratis, también el coach en partida (overlay y voz). Si tienes dudas, la vista «Ayuda» tiene un asistente.

## Voz

En **Overlay → Voz → Tipo de voz** hay dos voces, las dos sin conexión y gratis para el usuario: la **natural (neuronal)**, Supertonic 3 sobre ONNX Runtime en un proceso aparte de prioridad baja, y la de **Windows**. El modelo de la voz natural (~124 MB) no va en el instalador: la app lo descarga sola en segundo plano desde la release `voces-v1` de GitHub (con SHA-256 y reanudación), nunca durante la selección de campeón, la carga ni la partida; hasta entonces, o si falla, suena la de Windows. El código también admite una voz pregrabada por idioma (paquetes generados con ElevenLabs), pero aún no hay ningún paquete publicado y la app no la ofrece. Cómo se generan y se suben los paquetes: [docs/voz-natural.md](docs/voz-natural.md).

Créditos: Supertonic 3 de Supertone Inc. (modelo bajo BigScience OpenRAIL-M; código de referencia MIT), versión int8 de sherpa-onnx (k2-fsa, Apache-2.0) y ONNX Runtime de Microsoft (MIT).

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

El texto de la solicitud está en [docs/solicitud-clave-produccion-riot.md](docs/solicitud-clave-produccion-riot.md).

#### Verificación del sitio: `riot.txt`

Riot no procesa la solicitud hasta verificar el sitio con `https://www.coachlolia.com/riot.txt`. Ese archivo **no está en el repositorio a propósito**: su contenido es la cadena que da el portal *después* de enviar la solicitud. Cuando la tengas:

1. Crea `web/public/riot.txt` con **solo** esa cadena: UTF-8 sin BOM y sin espacios ni saltos de línea antes o después (con un editor de código, nunca con Word). En PowerShell: `Set-Content -Path web\public\riot.txt -Value "<cadena>" -NoNewline -Encoding ascii` (la cadena es ASCII; `-Encoding UTF8` de PowerShell 5.1 añadiría BOM).
2. `cd web && npm test && npm run build`: Astro lo copia a `dist/riot.txt` y la compilación falla si el archivo lleva BOM, espacios o más de una línea.
3. Haz commit y despliega la web (el flujo *Web* de GitHub Actions al subir a `main`).
4. Abre `https://www.coachlolia.com/riot.txt`, comprueba que enseña la cadena exacta como texto plano, sin redirección ni página 404, y pulsa *Verify* en el portal.

Cuando Riot dé el sitio por verificado, el archivo se puede borrar.

## Gratis para todos

Coach LoL IA es gratis para todo el mundo: builds, importación, coach en partida (overlay y voz) y asistente. La app no tiene anuncios ni banners, no pide licencia y no consulta ninguna. El proyecto se financia con anuncios de Google AdSense en la web (solo con el consentimiento de cookies) y con donaciones voluntarias desde [www.coachlolia.com/apoyar](https://www.coachlolia.com/apoyar); el botón «Donar» de esa página aparece cuando la web se compila con `PUBLIC_DONACION_URL`.

Es así porque las políticas generales de Riot para desarrolladores no permiten cobrar por la app ni dar acceso exclusivo, total o parcial, a algunos usuarios.

## Premium (desactivado)

El código de Premium (licencias, pruebas gratuitas y Stripe) se conserva, con sus pruebas, pero está **desactivado** y solo debe encenderse **si Riot aprueba oficialmente la monetización**:

- **Servidor**: con `PREMIUM_HABILITADO=1`. Sin ella (por defecto), las rutas `/api/premium/*` y `/api/stripe/webhook` no se registran y responden `404 {"error":"no_disponible"}`; `/builds`, `/roles`, `/salud` y `/api/asistente` funcionan igual.
- **App y web**: constante de compilación `PREMIUM_HABILITADO` (`shared/src/producto.ts` y `web/src/lib/producto.ts`, ambas `false`). Apagada, la app no crea el gestor de licencias (el coach en partida funciona para todos), no muestra el banner ni la sección Licencia y la barra lateral ofrece «Apoya el proyecto»; la web no construye `/premium`, `/premium/gracias` ni `/premium/gestionar` (su código está en `web/src/premium/`).

Lo que sigue describe Premium tal y como funcionaría con el interruptor encendido.

### Suscripciones

El servidor vendería el plan Premium (4,99 €/mes) con Stripe Checkout, sin SDK: usa la API REST con `fetch` y verifica la firma de los webhooks con `node:crypto`. Las claves solo existen como variables de entorno del servidor (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, y `URL_WEB` para las URL de retorno y el CORS). Si falta alguna de las tres de Stripe, `/api/premium/*` (salvo `GET /api/premium/estado/:clave` y `POST /api/premium/prueba`, que no necesitan Stripe) y el webhook responden `503 {"error":"premium_no_configurado"}` y el resto del servidor funciona igual.

| Ruta | Descripción |
|---|---|
| `POST /api/premium/checkout` | Crea la sesión de pago; devuelve `{ url }`. |
| `GET /api/premium/licencia?session_id=` | Devuelve `{ clave, estado }` de una sesión pagada (la crea si el webhook aún no llegó) o `404 pendiente`. |
| `POST /api/premium/portal` | Con `{ clave }`, devuelve `{ url }` del portal de cliente de Stripe (`400 licencia_vitalicia` con una licencia vitalicia). |
| `GET /api/premium/estado/:clave?dispositivo=<id>` | Devuelve `{ premium, estado, renuevaEn, caducaEn, tipo }` (y `vitalicia: true` en las vitalicias); es lo que consulta la app. Una prueba se vincula al primer dispositivo que la consulta (`otro_dispositivo` desde otro; `prueba_ya_usada` si ese dispositivo ya usó otra prueba). |
| `POST /api/premium/prueba` | Sin cuerpo. Crea una prueba gratuita de 24 h y devuelve `{ clave, caducaEn }`; una por IP cada 30 días (`429 prueba_ya_solicitada`). De la IP solo se guarda un HMAC-SHA256 con `PRUEBA_SAL`, que se borra a los 30 días. |
| `POST /api/stripe/webhook` | Eventos de Stripe (firma obligatoria, tolerancia de 300 s). |

Las rutas de premium admiten 30 peticiones por minuto y por IP. Los eventos de suscripción pueden llegar antes que `checkout.session.completed`: si la suscripción es de nuestro precio y aún no existe, el webhook responde 500 a propósito para que Stripe reintente (las suscripciones de otro precio o producto de la cuenta se ignoran con 200; `invoice.payment_failed` solo actúa si la suscripción ya tiene licencia y, si no, se ignora con 200). También se atiende `checkout.session.async_payment_succeeded`. Para configurar el webhook, en el panel de Stripe apunta un endpoint a `https://<tu-servidor>/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed`, y copia su secreto en `STRIPE_WEBHOOK_SECRET`.

#### Licencias vitalicias y de prueba

Además de las de suscripción hay dos tipos de licencia que Stripe nunca modifica:

- **Vitalicias** (por ejemplo, la del desarrollador): siempre activas, no caducan.
- **De prueba**: se vinculan al primer dispositivo que las usa y, pasada su duración, dan el estado `caducada`. Las de la web duran 24 h desde que se piden, y un equipo solo puede usar una. Las de tester (`--horas`) empiezan a contar en su primera activación y no cuentan para ese límite por equipo.

Se crean en la base de datos del servidor, sin `RIOT_API_KEY` ni Stripe, con exactamente una de `--horas` o `--vitalicia`:

```
npm run licencia:crear -w server -- --horas 72 --nota "Tester"
npm run licencia:crear -w server -- --vitalicia --nota "Desarrollador"
```

Imprime la clave `CLIA-XXXX-XXXX-XXXX-XXXX` (y, en las de prueba, cuántas horas dura desde su primera activación). Sin `--db <ruta>` usa `RUTA_DB` o `./coach.db` (relativa a `server/`). Las bases anteriores se migran solas al abrirse, conservando todas las licencias.

## Asistente de soporte con IA

`POST /api/asistente` responde en español a dudas sobre Coach LoL IA (la web y la vista «Ayuda» de la app lo usan). Usa el SDK oficial `@anthropic-ai/sdk` con el modelo `claude-opus-5-5` (esfuerzo `low`, sin streaming, con los *fallbacks* del servidor ante rechazos) y unas instrucciones y una base de conocimiento estables en `server/src/asistente/conocimiento.ts`, con caché de prompts. El cuerpo es `{ mensajes: [{ rol: 'usuario' | 'asistente', texto }] }` (hasta 12 mensajes alternos, el último del usuario; las preguntas de 1 a 1000 caracteres y las respuestas del asistente que se reenvían, de hasta 8000) y la respuesta `{ respuesta }`. Admite 20 peticiones por hora y por IP (`429 limite_asistente`), aparte del límite de premium. Además hay un tope global de gasto, guardado en la base por hora y por día: `ASISTENTE_MAX_HORA` (300 por defecto) y `ASISTENTE_MAX_DIA` (2000); al superarlo también responde `429 limite_asistente`. Como red de seguridad, fija también un límite de gasto mensual en la Anthropic Console (Settings → Limits). Sin `ANTHROPIC_API_KEY` responde `503 asistente_no_configurado`; un fallo de la API de Anthropic da `502 asistente_no_disponible`. Los mensajes no se guardan en el servidor.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `RIOT_API_KEY` | servidor | Clave de la API de Riot (obligatoria). |
| `PUERTO` | servidor | Puerto HTTP (por defecto 8080 en Docker). |
| `RUTA_DB` | servidor | Ruta del archivo SQLite (`/datos/coach.db` en Docker). |
| `MAX_PARTIDAS` | servidor | Límite de partidas nuevas a procesar por región en cada ciclo (por defecto 300). |
| `REGIONES_RECOLECTOR` | servidor | Regiones que recoge el recolector, separadas por comas: `EUW`, `LAN`, `LAS`, `BR`, `NA` (por defecto `EUW,LAN,LAS`, para no repartir el presupuesto de la clave). La pantalla de carga funciona en las cinco. |
| `RIOT_PORCENTAJE_INTERACTIVO` | servidor | Porcentaje de cada límite de Riot (por host) que pueden usar las consultas de la pantalla de carga, de 5 a 70 (por defecto 60). El resto queda siempre para el recolector, aunque alguien abuse de la ruta pública. |
| `PREMIUM_HABILITADO` | servidor | `1` enciende Premium (licencias, pruebas y Stripe). **Solo si Riot aprueba la monetización**; por defecto está apagado y las rutas de premium responden 404. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | servidor | Credenciales de Stripe (solo con `PREMIUM_HABILITADO=1`; sin ellas premium responde 503). |
| `TRUST_PROXY` | servidor | Número de proxies inversos de confianza delante del servidor (`1` a `5`; `true` equivale a `1`). Con él, la IP del cliente se lee de `X-Forwarded-For` contando esos saltos desde el final, así que una cabecera falsificada no sirve. En Fly.io es `1`. Sin proxy, déjala vacía. Los límites por IP agrupan las IPv6 por su prefijo /64 y tratan `::ffff:a.b.c.d` como IPv4. |
| `ANTHROPIC_API_KEY` | servidor | Clave de la API de Anthropic para el asistente (la lee el SDK). Sin ella, `/api/asistente` responde 503. |
| `ASISTENTE_MODELO` | servidor | Opcional: modelo del asistente (por defecto `claude-opus-5-5`). Debe admitir `output_config.effort` y los `fallbacks` del servidor. |
| `ASISTENTE_MAX_HORA` / `ASISTENTE_MAX_DIA` | servidor | Tope global de peticiones al asistente por hora (300) y por día (2000). |
| `PRUEBA_SAL` | servidor | Clave secreta del HMAC-SHA256 de las IP con que se limita la prueba gratuita. **Obligatoria con `NODE_ENV=production` y `PREMIUM_HABILITADO=1`** (el servidor no arranca sin ella); en desarrollo, vacía, se genera una y se guarda en la base. Los hash se borran a los 30 días. |
| `URL_WEB` | servidor | URL pública de la web, sin barra final (por defecto `https://www.coachlolia.com`). |
| `COACH_SERVIDOR` | app (al compilar o al ejecutar) | URL del servidor de builds. Al ejecutar tiene prioridad sobre la fijada al compilar; sin ninguna, `http://localhost:8080`. |
| `COACH_LIVE_URL` | app | URL alternativa de la Live Client Data API (pruebas con el simulador). |
| `COACH_FORZAR_PARTIDA` | app | `1` simula la fase de partida sin cliente de LoL. |
| `PUBLIC_DONACION_URL` | web (al compilar) | Enlace del botón «Donar» de `/apoyar` (opcional; sin él, la página dice que pronto se podrá donar). En GitHub Actions sale de la variable de repositorio del mismo nombre. |

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
