# Revisión de seguridad (octubre de 2026)

Revisión del servidor (`server/`, desplegado en Fly.io), la app de escritorio (`app/`, Electron), la web (`web/`, Astro
estática en GitHub Pages), los scripts de claves y los workflows de GitHub Actions. El repositorio es público, así que
se ha mirado también todo el historial de git en busca de secretos.

## Resumen

El código está en buen estado: las claves no salen nunca del servidor, las entradas se validan con listas blancas y
límites de tamaño, hay límites por IP y topes globales de gasto en todas las rutas que llaman a la IA, el CORS solo
admite la web propia y la app de Electron está bien aislada. **No hay secretos en el historial.**

Lo que se ha corregido en este PR:

| # | Hallazgo | Gravedad | Estado |
|---|----------|----------|--------|
| 1 | Los errores inesperados (500) devolvían el mensaje interno al cliente | Media | Corregido |
| 2 | Faltaban cabeceras de seguridad en las respuestas de la API | Baja | Corregido |
| 3 | El workflow de CI no limitaba los permisos del `GITHUB_TOKEN` | Baja | Corregido |
| 4 | No había Dependabot, CodeQL ni escaneo de secretos | Media | Añadidos |

Lo que queda pendiente está en la sección «Pendiente», ordenado por prioridad.

## Lo que se ha revisado y está bien

### Claves y secretos

- **Historial de git limpio.** Se pasó gitleaks 8.28 sobre los 149 commits y sobre el árbol actual, y además una
  búsqueda con patrones propios (`sk-ant-`, `RGAPI-`, `sk_live_`, `whsec_`, `price_`, claves privadas, tokens de
  GitHub y AWS). Solo aparecen valores de prueba (`RGAPI-00000000-secreta`, `sk_clave_de_prueba_…`) y dos falsos
  positivos en las traducciones (`voz.alma.punto.*`), que se excluyen en `.gitleaks.toml`.
- `.gitignore` y `.dockerignore` excluyen `.env`, `.clave-riot`, las bases `*.db` y `node_modules`.
- `server/.env.example` solo tiene nombres de variables vacíos.
- `fly.toml` no tiene secretos: `RIOT_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*` y `PRUEBA_SAL` van con
  `fly secrets set`.
- **`server/src/claveIa.ts`**: elige bien entre clave clásica (`x-api-key`) y clave de usuario o token
  (`Authorization: Bearer` con la beta `oauth-2025-04-20`). La clave solo se lee del entorno, no se registra en
  ningún log y nunca llega al cliente. Los errores de Anthropic se registran solo con su tipo y su código HTTP.
- La clave de Riot va en la cabecera `X-Riot-Token` (no en la URL, así que no acaba en logs de proxies) y `/salud`
  solo publica `ok | caducada | desconocida`.
- La clave de ElevenLabs solo se usa en la herramienta local que genera los paquetes de voz; se lee de un `.env`
  local y no se imprime.
- Los scripts `clave-ia-servidor.ps1` y `clave-riot-servidor.ps1` piden la clave con `-AsSecureString`, la
  comprueban y la guardan como secreto de Fly sin escribirla en disco.

### Validación de entradas

- Todas las rutas `POST` validan el cuerpo campo a campo (tipos, rangos, longitudes, listas blancas de regiones,
  roles, modos e idiomas) y responden 400 si algo no cuadra. Un JSON mal formado es un 400, no un 500.
- Las rutas de la IA tienen límites de tamaño propios (`bodyLimit`: 64 KB el análisis, 24 KB el coach personal,
  8 KB el consejo) y recortan los textos que se mandan al modelo.
- Lo que devuelve el modelo también se valida y se acota (`leerAnalisis`, `filtrarConsejo`) antes de mandarlo a la
  app.
- Todas las consultas SQL usan parámetros (`?`); las únicas cadenas interpoladas son nombres de tabla fijos o listas
  de marcadores generadas por el propio código.
- Los PUUID se validan con su formato exacto (78 caracteres) antes de llamar a Riot.

### Autenticación, CORS y límites

- **Stripe** (hoy desactivado con `PREMIUM_HABILITADO`): la firma del webhook se comprueba con HMAC-SHA256 sobre los
  bytes originales, con tolerancia de 300 s y comparación en tiempo constante.
- Las claves de licencia (`CLIA-XXXX-…`) tienen 80 bits aleatorios criptográficos: no se pueden adivinar, y
  `/api/premium/*` limita a 30 peticiones por minuto e IP.
- La prueba gratuita guarda solo un HMAC de la IP con una sal secreta (`PRUEBA_SAL`) y borra los registros a los 30
  días.
- **CORS**: solo `/api/asistente` y `/api/premium/*` lo tienen, y solo para el origen de `URL_WEB`. Las rutas del
  coach con IA no tienen CORS (las usa la app, no la web), así que un navegador no puede llamarlas desde otra web.
- **Límites**: asistente 20/h por IP más topes globales; coach con IA por IP y día más topes globales por hora y día
  guardados en la base (sobreviven a reinicios); pantalla de carga 6/min por IP; el limitador de Riot reserva parte
  de la cuota para el recolector. Las IPv6 se agrupan por /64.
- `trustProxy` solo confía en el salto de Fly (`TRUST_PROXY=1`): falsificar `X-Forwarded-For` no cambia la IP.

### App de escritorio (Electron)

- Las dos ventanas usan `sandbox: true`, `contextIsolation: true` y `nodeIntegration: false`, con CSP estricta
  (`script-src 'self'`).
- Se bloquean las ventanas nuevas y la navegación a otras URL; `shell.openExternal` solo abre rutas de una lista
  blanca de `https://www.coachlolia.com`, y solo si lo pide la ventana principal.
- `rejectUnauthorized: false` solo se usa en agentes propios para el cliente de LoL en `127.0.0.1` (certificado
  autofirmado de Riot), nunca de forma global.
- Los paquetes de voz se descargan con su SHA-256 fijado y el extractor tar rechaza rutas absolutas, `..` y
  enlaces.

### Web

- El asistente inserta todo el texto con `textContent` (nunca HTML). Los `set:html` de Astro solo pintan textos
  propios de las traducciones al compilar, no datos de usuarios ni de la API.

## Lo que se ha corregido

### 1. Los errores 500 filtraban el mensaje interno (media)

Fastify, por defecto, responde a un error no controlado con `{"statusCode":500,"message":"<mensaje del error>"}`. Si
falla la base (por ejemplo, el volumen lleno) o un servicio externo, el mensaje puede llevar rutas de archivos, SQL o
detalles internos. Además, como el servidor no tiene el logger de Fastify activado, esos errores no quedaban
registrados en ningún sitio.

Ahora (`server/src/http.ts`) un error 5xx se registra en el log de Fly (`[http] Error inesperado en GET /ruta: …`) y
el cliente solo recibe `{"error":"error_interno"}`. Los 4xx de Fastify (JSON no válido, cuerpo demasiado grande…)
siguen igual. Pruebas en `server/test/seguridadHttp.test.ts`.

### 2. Cabeceras de seguridad (baja)

Todas las respuestas de la API llevan ahora `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y
`Strict-Transport-Security: max-age=31536000` (Fly ya fuerza HTTPS). Es una API JSON, así que no rompen nada: el
CORS de la web sigue funcionando (hay prueba).

### 3. Permisos del `GITHUB_TOKEN` en CI (baja)

`ci.yml` no declaraba `permissions`, así que el token heredaba los permisos por defecto del repositorio (que pueden
ser de escritura). Ahora es `contents: read`. Los otros workflows ya los limitaban.

### 4. Dependabot, CodeQL y escaneo de secretos (media)

- **`.github/dependabot.yml`**: actualizaciones semanales (lunes) de npm en la raíz (shared, server, app) y en
  `web/`, de las acciones de GitHub y de la imagen de Docker del servidor. Menores y parches se agrupan en un solo
  PR por ecosistema.
- **`.github/workflows/codeql.yml`**: CodeQL con las consultas `security-extended` para JavaScript/TypeScript y para
  los propios workflows, en cada push y PR a `main` y cada lunes.
- **`.github/workflows/secretos.yml`**: gitleaks sobre los commits nuevos de cada push y PR, y sobre todo el
  historial cada lunes. Descarga el binario oficial con su SHA-256 fijado. Los falsos positivos conocidos están en
  `.gitleaks.toml`.

## Pendiente

Ordenado de más a menos importante. Nada de esto es urgente: no hay ninguna vulnerabilidad explotable conocida en
producción.

1. **Activar en GitHub el escaneo de secretos nativo y la protección de push** (Settings → Code security → Secret
   scanning y Push protection; gratis en repos públicos). La protección de push bloquea un commit con una clave
   *antes* de que llegue a GitHub, que es lo que más importa en un repo público. También conviene activar
   «Dependabot alerts». Es un ajuste del repositorio que no se puede hacer desde un PR.
2. **Las rutas del coach con IA no tienen autenticación** (`/api/coach/analisis`, `/consejo`, `/personal`).
   Cualquiera que lea el código puede llamarlas con `curl` y usar el coach personal como chat gratis. El gasto está
   acotado por los topes globales (unos 10 USD/día en el peor caso, según `fly.toml`), pero alguien con muchas IP
   podría agotar el tope diario y dejar sin IA a los usuarios reales hasta el día siguiente. En una app de
   escritorio pública no hay forma infalible de demostrar que la petición viene de la app; opciones razonables, de
   menos a más esfuerzo: un token anónimo por instalación emitido por el servidor con su propio límite, o exigir el
   id de dispositivo que la app ya calcula. Mientras tanto, conviene poner también un límite de gasto mensual en la
   consola de Anthropic (el script ya lo recomienda).
3. **Dependencias de desarrollo con vulnerabilidades** (`npm audit`): `vitest` 2 (críticas en `tinypool` y en la UI
   de vitest; alta en `vite`) y `electron-builder` (moderada en `sprintf-js`). Solo afectan al equipo de desarrollo y
   a CI, no al servidor ni a la app instalada: **las dependencias de producción del servidor tienen 0
   vulnerabilidades**. Arreglarlas exige subir de versión mayor (vitest 5, electron-builder 26.5+), y vitest 5 choca
   ahora con el árbol de dependencias de `electron-vite`; Dependabot abrirá los PR y hay que probarlos con calma.
4. **Web: Astro 5 tiene avisos críticos** (XSS y SSRF, y `sharp` vulnerable). La web es estática y la mayoría de esos
   fallos afectan al modo servidor o al servidor de desarrollo, así que el riesgo real es bajo, pero conviene subir a
   Astro 7 (versión mayor: revisar la compilación y las pruebas de `web/`).
5. **El contenedor del servidor corre como root.** Añadir `USER node` al `Dockerfile` reduce el daño si alguien
   llegara a ejecutar código en el servidor, pero el volumen de Fly (`/datos`) se monta como root y la base dejaría de
   poder escribirse: hay que ajustar los permisos del volumen al arrancar (o con `fly ssh console`) y probarlo en un
   despliegue. Por eso no se ha tocado aquí.
6. **Las rutas públicas de lectura no tienen límite por IP** (`/builds`, `/campeones`, `/roles`, `/jungla/ruta`).
   Son lecturas baratas de SQLite (y `/campeones` va en caché), así que el riesgo es solo de carga; si algún día hay
   abuso, se puede añadir un límite generoso (por ejemplo 300/min por IP).
7. **Fijar las acciones de GitHub por SHA** en lugar de por etiqueta (`actions/checkout@v4`) para protegerse de una
   etiqueta movida en una acción comprometida. Dependabot mantiene los SHA al día si se fijan.
8. **CI instala con `--dangerously-allow-all-scripts`**: cualquier dependencia puede ejecutar código al instalarse en
   CI. El `Dockerfile` ya usa una lista blanca (`allow-scripts=better-sqlite3,esbuild`); en CI se podría hacer lo
   mismo añadiendo `electron` y `onnxruntime-node`.
9. **Los scripts de claves pasan la clave a `flyctl` en la línea de órdenes** (`flyctl secrets set "CLAVE=…"`), así
   que es visible en la lista de procesos del PC durante un instante. Es un riesgo local y pequeño; se puede evitar
   con `"ANTHROPIC_API_KEY=$clave" | flyctl secrets import --app $app` (hay que probarlo en Windows).
10. **El certificado del cliente de LoL no se comprueba** (`rejectUnauthorized: false` hacia `127.0.0.1`). Es lo
    habitual y el riesgo es bajo (solo en local), pero se podría fijar el certificado raíz público de Riot
    (`riotgames.pem`) en esos agentes.

## Cómo se ha comprobado

- `npm audit` en la raíz, en el workspace `server` (solo producción) y en `web/`.
- gitleaks 8.28 sobre todo el historial (`gitleaks git`) y sobre el árbol actual (`gitleaks dir`).
- `npx tsc --noEmit` de `shared`, `server` y `app`, y `npm test` (vitest).
