# Coach LoL IA v2: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a la app una interfaz de calidad profesional, crear la web del producto y añadir el modelo freemium (licencias con Stripe y anuncios en la web).

**Architecture:** Hay tres pistas paralelas sobre ramas y worktrees separados:
- **A**, la interfaz de la app (`app/`);
- **B**, la web estática Astro (`web/`, un paquete aparte que no forma parte de los workspaces);
- **C1**, las licencias y Stripe en el servidor (`server/`, sin SDK de Stripe, solo con `fetch` y HMAC).

Después llega una fase de integración (**C2**): la app consulta la licencia y aplica las restricciones del plan, la web se enlaza con el servidor, y se fusiona todo en `main`.

**Tech Stack:** Electron, React 19, CSS con tokens, `lucide-react`; Astro 5 estático; Fastify, better-sqlite3 y la API REST de Stripe; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-coach-lol-ia-v2-design.md`

## Global Constraints

- Todo el texto visible está en **español neutro**. En la app sale de `app/src/shared/i18n/es.json` y en la web se escribe directamente en el marcado de Astro.
- **Tokens de diseño** (los mismos en la app y la web): fondo `#0a0e1a`, superficies `#121829` y `#1a2236`, borde `#26314d`, texto `#e8ecf5` y `#8b97b8`, dorado `#c8aa6e`, primario `#4f7cff`, éxito `#2fbf71`, aviso `#f0b429`, error `#ef5b5b`. Radios de 8 y 12 px, tipografía Inter (con system-ui de reserva) y transiciones de 150-200 ms.
- **Precio:** **4,99 €/mes** (EUR). Plan **Gratis**: builds, runas, importación y anuncios (AdSense en la web, banner propio en la app). Plan **Premium**: coach en partida (overlay y voz) y sin anuncios.
- **Licencias:** formato `CLIA-XXXX-XXXX-XXXX-XXXX`, con el alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- **Secretos:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` y `RIOT_API_KEY` solo existen como variables de entorno del servidor. Nunca van en el repositorio, la web ni la app.
- **AdSense nunca dentro de la app.** En la web solo se carga con `PUBLIC_ADSENSE_CLIENT` definido y las cookies aceptadas, y nunca en las páginas `/premium*`.
- **Web publicada en** `https://pepeipto.github.io/coach-lol-ia/` (Astro `site` + `base: '/coach-lol-ia'`).
- **Aviso legal de Riot** visible en la app y en la web: "Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends."
- **Las pruebas existentes (229) deben seguir pasando** en cada pista. Hay que conservar los contratos IPC y del preload, a los que solo se les pueden añadir cosas.

## Review Focus

1. **Licencia sin conexión:** si el servidor está caído pero la caché es de hace menos de 7 días, el plan sigue siendo premium. Con más de 7 días pasa a gratis, sin cerrar la app. Prueba en C2-1.
2. **Webhook con firma inválida o repetido:** con firma inválida responde 400 sin cambiar nada; un evento repetido no duplica licencias. Prueba en C1-2.
3. **Página de gracias antes del webhook:** si llega antes que el webhook, la licencia se crea igualmente al consultar la sesión en Stripe, y es la misma que creará el webhook después. Prueba en C1-3.
4. **Plan gratuito en partida:** el overlay no aparece y la ventana principal avisa "El coach en partida es Premium". Prueba en C2-2.
5. **Servidor sin Stripe configurado:** builds y roles siguen funcionando, y `/api/premium/*` responde 503 `premium_no_configurado`. Prueba en C1-3.

---

## Pista A: interfaz de la app (rama `v2-ui`)

**Alcance de archivos:**
- `app/src/renderer/**`
- `app/src/shared/i18n/es.json` (solo añadir claves)
- `app/src/shared/tiposApp.ts` (solo añadir tipos y métodos)
- `app/src/preload/index.ts` (solo añadir métodos)
- `app/src/main/ventanas/principal.ts`
- `app/src/main/index.ts` (solo los manejadores IPC de la ventana)
- `app/package.json` (añadir `lucide-react`)
- `app/test/**`

### Task A1: sistema de diseño y componentes base

**Files:**
- Create: `app/src/renderer/comun/tokens.css`, `app/src/renderer/comun/componentes.tsx` (Tarjeta, Boton, Insignia, Pestanas, Interruptor, Esqueleto, Aviso), `app/src/renderer/comun/IconoDDragon.tsx`
- Test: `app/test/componentes.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  Boton({ variante?: 'primario' | 'secundario' | 'fantasma', ...props de <button> })
  Tarjeta({ titulo?: string, icono?: ReactNode, children })
  Insignia({ tono: 'exito' | 'aviso' | 'error' | 'neutro' | 'oro', children })
  Pestanas({ opciones: { id: string; texto: string; icono?: ReactNode }[], activa: string, alCambiar(id: string): void })
  Interruptor({ marcado: boolean, alCambiar(v: boolean): void, etiqueta: string })
  Esqueleto({ ancho?: number | string, alto?: number | string })
  IconoDDragon({ tipo: 'objeto' | 'hechizo' | 'runa' | 'campeon', id: string | number, version: string, nombre: string, tamano?: number, imagen?: string })
  ```
  `IconoDDragon` construye las URLs de Data Dragon (las mismas que usa hoy `VistaBuild.tsx`), muestra un `title` con el nombre y un hueco con el mismo tamaño si `id` es 0 o no hay imagen.

- [ ] **Step 1:** Escribir las pruebas: `Interruptor` llama a `alCambiar(true)` al hacer clic y expone `role="switch"` con `aria-checked`; `Pestanas` marca la activa con `aria-selected`; `IconoDDragon` del objeto 3157, versión `16.20.1`, tiene src `https://ddragon.leagueoflegends.com/cdn/16.20.1/img/item/3157.png` y `title` con el nombre.
- [ ] **Step 2:** `npx vitest run app/test/componentes.test.tsx` → FALLA.
- [ ] **Step 3:** Implementar los tokens y los componentes (CSS con variables; añadir `lucide-react` a la app).
- [ ] **Step 4:** Ejecutar la prueba → PASA.
- [ ] **Step 5:** Commit `feat(app): sistema de diseño y componentes base`.

### Task A2: ventana sin marco y barra lateral

**Files:**
- Modify: `app/src/main/ventanas/principal.ts` (`frame: false`, `minWidth: 1000`, `minHeight: 680`, `backgroundColor: '#0a0e1a'`), `app/src/main/index.ts` (IPC `ventana:minimizar`, `ventana:maximizar`, `ventana:cerrar`, solo desde el webContents de la ventana principal), `app/src/preload/index.ts`, `app/src/shared/tiposApp.ts`
- Create: `app/src/renderer/principal/BarraTitulo.tsx`, `app/src/renderer/principal/BarraLateral.tsx`
- Modify: `app/src/renderer/principal/App.tsx` (rutas por vista: `'campeon' | 'overlay' | 'ajustes' | 'premium'`)
- Test: `app/test/navegacion-ui.test.tsx`

**Interfaces:**
- Produces in `ApiCoach`: `ventana(accion: 'minimizar' | 'maximizar' | 'cerrar'): void`.
- Produces types:
  ```ts
  export type Plan = 'gratis' | 'premium';
  export interface EstadoLicencia { plan: Plan; estado: 'sin_licencia' | 'activa' | 'cancelada' | 'impagada' | 'sin_conexion'; renuevaEn: string | null; claveVisible: string | null; }
  ```
- Produces in `ApiCoach` (C2 implementa el lado main; mientras tanto el preload ya invoca los canales):
  ```ts
  licencia(): Promise<EstadoLicencia>;                         // 'coach:licencia-estado'
  activarLicencia(clave: string): Promise<EstadoLicencia>;     // 'coach:licencia-activar'
  quitarLicencia(): Promise<EstadoLicencia>;                   // 'coach:licencia-quitar'
  abrirWeb(ruta: '/premium' | '/premium/gestionar' | '/descargar' | '/'): Promise<void>; // 'coach:abrir-web'
  alCambiarLicencia(cb: (e: EstadoLicencia) => void): () => void; // evento 'coach:licencia'
  ```
  En el renderer, si `licencia()` falla (porque aún no hay manejador), se trata como `{ plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null }`.

- [ ] **Step 1:** Prueba: la barra lateral muestra «Campeón», «Overlay», «Ajustes» y «Premium»; al hacer clic en Ajustes se ve la vista de ajustes; el indicador de conexión dice «Conectado» o «Esperando al cliente…» según `estado.cliente`.
- [ ] **Step 2:** Ejecutar la prueba → FALLA.
- [ ] **Step 3:** Implementar la barra de título (región de arrastre con `-webkit-app-region: drag` y botones con `no-drag`), la barra lateral y el enrutado. Aprovechar los textos de `es.json` y añadir las claves nuevas.
- [ ] **Step 4:** Ejecutar la prueba → PASA. Ejecutar `npm test` (todo) → PASA.
- [ ] **Step 5:** Commit `feat(app): ventana sin marco con barra de título y barra lateral`.

### Task A3: vista Campeón estilo Blitz

**Files:**
- Create: `app/src/renderer/principal/vistas/VistaCampeon.tsx`, `CabeceraCampeon.tsx`, `TarjetaRunas.tsx`, `TarjetaBuild.tsx`, `RejillaHabilidades.tsx`, `BannerPremium.tsx`, `EstadoVacio.tsx`
- Modify/Remove: `VistaBuild.tsx` (su contenido pasa a estas piezas; hay que actualizar `app/test/VistaBuild.test.tsx` a la nueva estructura conservando las mismas comprobaciones: «Importar», «Datos del parche», porcentaje, «Build no disponible» sin botón, «sin conexión» y aviso legal)
- Test: `app/test/VistaCampeon.test.tsx`

**Interfaces:**
- Consumes: `EstadoPrincipal`, `RecursosBuild`, `EstadoLicencia`, los componentes de A1.
- Splash art: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/<id>_0.jpg` (añadirlo al `img-src` del CSP si hace falta).

- [ ] **Step 1:** Pruebas:
  - la rejilla de habilidades tiene 18 celdas y la celda del nivel 6 está marcada como R;
  - el banner premium aparece con `plan: 'gratis'`, no aparece con `plan: 'premium'` y se cierra con su botón;
  - con `cliente: 'esperando'` se muestra el estado vacío «Esperando al cliente de League of Legends…»;
  - el botón Importar muestra el estado de éxito cuando `importacion` viene completa.
- [ ] **Step 2:** Ejecutar las pruebas → FALLAN.
- [ ] **Step 3:** Implementar:
  - la cabecera con el splash difuminado (gradiente encima), el retrato, el nombre, el selector de rol y las insignias (victorias en verde si es al menos 50 % y en ámbar si no, partidas y parche);
  - las tarjetas de runas (ramas, más los fragmentos como iconos o huecos), hechizos, build (inicio → núcleo con flechas `ChevronRight` → botas, y los situacionales debajo) y la rejilla de habilidades (Q, W, E y R con colores distintos);
  - el botón Importar fijo arriba a la derecha.
- [ ] **Step 4:** Ejecutar las pruebas y `npm test` → PASAN.
- [ ] **Step 5:** Commit `feat(app): vista Campeón con arte, tarjetas y rejilla de habilidades`.

### Task A4: vistas Overlay, Ajustes y Premium, y nuevo overlay

**Files:**
- Create: `app/src/renderer/principal/vistas/VistaOverlay.tsx`, `VistaAjustes.tsx` (sustituye a `Ajustes.tsx`; sus pruebas se adaptan), `VistaPremium.tsx`
- Modify: `app/src/renderer/overlay/Overlay.tsx`, `Panel.tsx`, `Avisos.tsx`, `estilos.css` (con los tokens)
- Test: `app/test/VistaPremium.test.tsx`, `app/test/overlay-ui.test.tsx`

**Interfaces:**
- Consumes: el `ApiCoach` de licencias de A2.

- [ ] **Step 1:** Pruebas:
  - VistaPremium con `plan: 'gratis'` muestra «4,99 €/mes», el botón «Suscribirme» (que llama a `abrirWeb('/premium')`) y un campo «Clave de licencia» con el botón «Activar», que llama a `activarLicencia` con el texto recortado;
  - con `plan: 'premium'` muestra «Premium activo» y el botón «Gestionar suscripción» (que llama a `abrirWeb('/premium/gestionar')`);
  - el Panel del overlay muestra la próxima compra y el objetivo con sus etiquetas;
  - el aviso del overlay lleva el icono de su tipo.
- [ ] **Step 2:** Ejecutar las pruebas → FALLAN.
- [ ] **Step 3:** Implementar. El overlay usa un panel translúcido (`backdrop-filter: blur(8px)`, fondo `rgba(18,24,41,.78)` y borde de 1 px dorado al 40 %), toasts que entran deslizándose y la cuenta atrás del objetivo con una barra de progreso de 60 s. Hay que conservar intacta toda la lógica de mover, capturar el ratón, fijar y la voz.
- [ ] **Step 4:** Ejecutar `npm test` y `npx tsc --noEmit -p app` → PASAN. `npm run build -w app` → OK.
- [ ] **Step 5:** Commit `feat(app): vistas Overlay, Ajustes y Premium y overlay rediseñado`.

---

## Pista B: web del producto (rama `v2-web`)

**Alcance:** `web/**` y `.github/workflows/web.yml`. `web/` es un paquete npm independiente, con su propio `package-lock.json` y fuera de los workspaces de la raíz.

### Task B1: proyecto Astro, diseño y página principal

**Files:**
- Create: `web/package.json` (astro 5), `web/astro.config.mjs` (`site: 'https://pepeipto.github.io'`, `base: '/coach-lol-ia'`), `web/src/styles/global.css` (tokens), `web/src/layouts/Base.astro` (cabecera con navegación, pie con aviso legal y banner de cookies), `web/src/components/*.astro`, `web/src/pages/index.astro`, `web/public/capturas/*` (maquetas SVG de la app nueva, marcadas como `maqueta`), `web/public/favicon.svg`
- Test: `web/tests/contenido.test.mjs` (con `node:test`: compila con `astro build` y comprueba el HTML generado)

- [ ] **Step 1:** Prueba: tras `npm run build`, `dist/index.html` contiene «Coach LoL IA», las secciones con id `que-hace`, `como-funciona`, `arquitectura`, `seguridad`, `datos`, `tecnologias`, `calidad`, `planes`, `hoja-de-ruta` y `faq`, el texto «4,99 €» y el aviso legal de Riot completo.
- [ ] **Step 2:** `cd web && npm test` → FALLA.
- [ ] **Step 3:** Implementar la página de presentación con las 12 secciones del spec (§4), el diagrama de arquitectura en SVG en línea y un diseño responsive (con la navegación como menú en móvil). El contenido técnico sale del spec v1 y del README: APIs usadas, umbrales de 200/20 partidas, refresco cada 6 h, Esmeralda+ en EUW/LAN/LAS, 229 pruebas automáticas y CI.
- [ ] **Step 4:** `cd web && npm test` → PASA.
- [ ] **Step 5:** Commit `feat(web): proyecto Astro y página de presentación`.

### Task B2: páginas de Premium, descarga y legales, anuncios y despliegue

**Files:**
- Create: `web/src/pages/premium.astro`, `web/src/pages/premium/gracias.astro`, `web/src/pages/premium/gestionar.astro`, `web/src/pages/descargar.astro`, `web/src/pages/privacidad.astro`, `web/src/pages/terminos.astro`, `web/src/pages/cookies.astro`, `web/src/components/Anuncio.astro`, `web/src/scripts/premium.ts`, `.github/workflows/web.yml`

**Interfaces (contrato con C1):**
- `POST ${PUBLIC_API_URL}/api/premium/checkout` → `{ url }`: se redirige a esa URL.
- `GET ${PUBLIC_API_URL}/api/premium/licencia?session_id=…` → `{ clave, estado }`. Mientras responda 404 `{"error":"pendiente"}`, se reintenta cada 2 s durante 30 s como máximo.
- `POST ${PUBLIC_API_URL}/api/premium/portal` con `{ clave }` → `{ url }`.
- `503 {"error":"premium_no_configurado"}`: se muestra «Las suscripciones aún no están disponibles».
- Configuración: `import.meta.env.PUBLIC_API_URL` (por defecto `http://localhost:8080`) y `PUBLIC_ADSENSE_CLIENT` (opcional).

- [ ] **Step 1:** Ampliar la prueba con estas comprobaciones:
  - existen `premium/index.html`, `premium/gracias/index.html`, `premium/gestionar/index.html`, `descargar/index.html`, `privacidad/index.html`, `terminos/index.html` y `cookies/index.html`;
  - las páginas `premium*` no contienen `adsbygoogle`;
  - compilando sin `PUBLIC_ADSENSE_CLIENT`, ninguna página contiene `pagead2.googlesyndication.com`;
  - compilando con `PUBLIC_ADSENSE_CLIENT=ca-pub-123`, `index.html` sí lo contiene, dentro de un script que solo se activa con el consentimiento.
- [ ] **Step 2:** `npm test` → FALLA.
- [ ] **Step 3:** Implementar:
  - las páginas y la lógica de cliente en `premium.ts`, con estados de carga y error en español y un botón para copiar la licencia en la página de gracias;
  - el banner de cookies, que guarda la elección en `localStorage` y solo entonces inyecta AdSense;
  - `/descargar`, que enlaza a `https://github.com/pepeipto/coach-lol-ia/releases/latest`;
  - el workflow que, en cada push a `main` que toque `web/**`, compila y despliega en GitHub Pages con `actions/deploy-pages`, usando las variables de repositorio `PUBLIC_API_URL` y `PUBLIC_ADSENSE_CLIENT`.
- [ ] **Step 4:** `npm test` → PASA. Revisar a mano `npm run preview` en el navegador: escritorio y móvil.
- [ ] **Step 5:** Commit `feat(web): Premium, descarga, legales, anuncios y despliegue`.

---

## Pista C1: licencias y Stripe en el servidor (rama `v2-servidor`)

**Alcance:** solo `server/**`. Sin SDK de Stripe: la API REST de Stripe con `fetch` (cuerpo `application/x-www-form-urlencoded` y `Authorization: Bearer`) y la verificación de la firma del webhook con `node:crypto` (HMAC-SHA256 de `${t}.${cuerpo}` y tolerancia de 300 s).

### Task C1-1: licencias en la base de datos y cliente de Stripe

**Files:**
- Create: `server/src/premium/licencias.ts`, `server/src/premium/stripe.ts`
- Modify: `server/src/db.ts` (tabla `licencias` creada desde `abrirDb`)
- Test: `server/test/licencias.test.ts`, `server/test/stripe.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type EstadoLicencia = 'activa' | 'cancelada' | 'impagada';
  interface Licencia { clave: string; stripeCustomer: string; stripeSubscription: string | null; checkoutSession: string; estado: EstadoLicencia; renuevaEn: string | null; actualizada: string }
  function generarClave(aleatorio?: (n: number) => Buffer): string;        // CLIA-XXXX-XXXX-XXXX-XXXX
  interface RepoLicencias {
    porSesion(sesion: string): Licencia | null;
    porClave(clave: string): Licencia | null;
    porSuscripcion(sub: string): Licencia | null;
    crearSiNoExiste(datos: { checkoutSession: string; stripeCustomer: string; stripeSubscription: string | null; renuevaEn: string | null }): Licencia; // idempotente por checkoutSession
    actualizarPorSuscripcion(sub: string, cambios: { estado?: EstadoLicencia; renuevaEn?: string | null }): Licencia | null;
  }
  function crearRepoLicencias(db: Db): RepoLicencias;   // Db expone ahora la conexión con `db.sql` (better-sqlite3 Database)
  interface ClienteStripe {
    crearCheckout(o: { priceId: string; urlExito: string; urlCancelar: string }): Promise<{ url: string; id: string }>;
    obtenerSesion(id: string): Promise<{ id: string; status: string; payment_status: string; customer: string | null; subscription: string | null }>;
    obtenerSuscripcion(id: string): Promise<{ id: string; status: string; current_period_end: number }>;
    crearPortal(o: { customer: string; urlVuelta: string }): Promise<{ url: string }>;
  }
  function crearClienteStripe(o: { clave: string; fetch?: typeof fetch }): ClienteStripe;
  function verificarFirmaWebhook(cuerpo: string, cabecera: string | undefined, secreto: string, ahora?: number): boolean;
  ```
  `urlExito` = `${URL_WEB}/premium/gracias?session_id={CHECKOUT_SESSION_ID}`; `urlCancelar` = `${URL_WEB}/premium`.

- [ ] **Step 1:** Pruebas:
  - `generarClave` cumple `/^CLIA(-[A-HJ-NP-Z2-9]{4}){4}$/`;
  - `crearSiNoExiste` llamada dos veces con la misma sesión devuelve la misma clave;
  - `actualizarPorSuscripcion` cambia el estado;
  - `crearCheckout` envía `mode=subscription`, `line_items[0][price]` y `line_items[0][quantity]=1` con la cabecera Bearer (comprobado con un fetch falso);
  - una firma correcta da true; un cuerpo alterado, una firma de otro secreto o un timestamp con más de 300 s de antigüedad dan false.
- [ ] **Step 2:** `npx vitest run server/test/licencias.test.ts server/test/stripe.test.ts` → FALLA.
- [ ] **Step 3:** Implementar. La comparación de firmas se hace con `crypto.timingSafeEqual`.
- [ ] **Step 4:** → PASA.
- [ ] **Step 5:** Commit `feat(server): licencias y cliente REST de Stripe`.

### Task C1-2: webhook

**Files:**
- Create: `server/src/premium/webhook.ts`
- Test: `server/test/webhook.test.ts`

**Interfaces:**
- Produces: `procesarEvento(evento: { type: string; data: { object: any } }, repo: RepoLicencias, stripe: ClienteStripe): Promise<void>`
  - `checkout.session.completed`: obtiene la suscripción para la fecha de renovación y llama a `crearSiNoExiste`.
  - `customer.subscription.updated`: mapea el estado de Stripe (`active` y `trialing` → activa; `past_due` y `unpaid` → impagada; `canceled` e `incomplete_expired` → cancelada) y la fecha `current_period_end` en ISO.
  - `customer.subscription.deleted`: pone la licencia en cancelada.
  - `invoice.payment_failed`: pone en impagada la licencia de `invoice.subscription`.
  - Otros tipos: se ignoran.

- [ ] **Step 1:** Pruebas:
  - cada tipo de evento produce el estado esperado;
  - un `checkout.session.completed` repetido no duplica la licencia;
  - un evento de una suscripción desconocida no lanza error.
- [ ] **Step 2–4:** RED → implementar → GREEN.
- [ ] **Step 5:** Commit `feat(server): procesamiento de webhooks de Stripe`.

### Task C1-3: rutas HTTP de premium

**Files:**
- Create: `server/src/premium/rutas.ts`
- Modify: `server/src/http.ts` (registra las rutas y el CORS para `URL_WEB`), `server/src/config.ts` (añade `stripe: { clave, webhook, precio } | null` y `urlWeb`, por defecto `https://pepeipto.github.io/coach-lol-ia`), `server/src/index.ts`, `server/.env.example`, `README.md` (sección «Suscripciones»)
- Test: `server/test/premium-http.test.ts`

**Interfaces (contrato con B y C2):**
- `POST /api/premium/checkout` → `200 { url }`.
- `GET /api/premium/licencia?session_id=` → `200 { clave, estado }`, o `404 { error: 'pendiente' }` si la sesión no está pagada (`payment_status !== 'paid'`). Si la sesión está pagada y no hay licencia, la crea con `crearSiNoExiste` (idempotente).
- `POST /api/premium/portal` con `{ clave }` → `200 { url }`, o `404 { error: 'licencia_desconocida' }`.
- `GET /api/premium/estado/:clave` → `200 { premium: estado === 'activa', estado, renuevaEn }`, o `404 { error: 'licencia_desconocida' }`.
- `POST /api/stripe/webhook`: lee el cuerpo sin procesar (registrar el content-type `application/json` como texto solo para esta ruta). Responde `400` si la firma no es válida y `200 { recibido: true }` si lo es.
- Sin configuración de Stripe, todas las rutas de premium responden `503 { error: 'premium_no_configurado' }`.
- Límite por IP de 30 peticiones por minuto en `/api/premium/*`, con `429` al superarlo.
- CORS: `Access-Control-Allow-Origin` = el origen de `URL_WEB` (solo esquema y host) en `/api/premium/*`.

- [ ] **Step 1:** Pruebas con `inject` y un ClienteStripe falso:
  - el checkout devuelve la URL;
  - la licencia queda pendiente y después se crea, y la misma clave sale aunque luego llegue el webhook;
  - estado activo frente a cancelado;
  - el portal;
  - el webhook con firma válida e inválida;
  - el 503 sin configuración (mientras `/builds` sigue funcionando);
  - el 429 en la petición 31;
  - la cabecera CORS.
- [ ] **Step 2–4:** RED → implementar → GREEN. Ejecutar también `npm test` y `npx tsc --noEmit -p server`.
- [ ] **Step 5:** Commit `feat(server): rutas de suscripción y licencias`.

---

## Fase 2: integración (rama `v2`, después de fusionar A, B y C1)

### Task C2-1: licencia en el proceso principal

**Files:**
- Create: `app/src/main/licencia.ts`
- Modify: `app/src/main/index.ts` (manejadores `coach:licencia-estado`, `coach:licencia-activar`, `coach:licencia-quitar`, `coach:abrir-web` y el evento `coach:licencia`)
- Test: `app/test/licencia.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function crearGestorLicencia(o: { ruta: string; urlServidor: string; fetch?: typeof fetch; ahora?: () => number; forzarPremium?: boolean }): {
    estado(): EstadoLicencia;
    comprobar(): Promise<EstadoLicencia>;            // consulta /api/premium/estado/:clave; tolerancia sin conexión de 7 días
    activar(clave: string): Promise<EstadoLicencia>; // valida el formato y lo guarda solo si el servidor la reconoce
    quitar(): EstadoLicencia;
    alCambiar(cb: (e: EstadoLicencia) => void): () => void;
  }
  ```
  - El archivo `licencia.json` guarda `{ clave, ultimoEstado, comprobadaEn }`.
  - `claveVisible` muestra solo el último grupo (`CLIA-••••-••••-••••-WXYZ`).
  - `forzarPremium` viene de `COACH_PREMIUM === '1'`.
  - Se comprueba al arrancar y cada 6 h.
  - `abrirWeb` solo acepta las 4 rutas definidas y abre `https://pepeipto.github.io/coach-lol-ia<ruta>` con `shell.openExternal`.

- [ ] **Step 1:** Pruebas:
  - activa → premium;
  - cancelada → gratis;
  - servidor caído con la caché activa de hace 3 días → premium (`sin_conexion`);
  - con la caché de hace 8 días → gratis;
  - activar con un formato inválido lanza error y no se guarda;
  - con `forzarPremium` → premium.
- [ ] **Step 2–4:** RED → implementar → GREEN.
- [ ] **Step 5:** Commit `feat(app): gestor de licencia premium`.

### Task C2-2: restricciones del plan en la app

**Files:**
- Modify: `app/src/main/orquestador/partida.ts` (nueva dependencia `esPremium(): boolean`; si es false, no se inicia el overlay y se llama a `avisar(t('premium.coachBloqueado'))`, con el texto «El coach en partida es Premium. Actívalo en la sección Premium.»), `app/src/main/index.ts` (conecta `esPremium` con el gestor y envía `EstadoLicencia` a la ventana)
- Test: `app/test/partida.test.ts` (ampliar)

- [ ] **Step 1:** Pruebas:
  - con `esPremium` false, la fase InProgress no inicia el conector y avisa con el texto en español;
  - con true, se comporta como en v1;
  - pasar a premium a mitad de partida activa el overlay en el siguiente estado.
- [ ] **Step 2–4:** RED → implementar → GREEN.
- [ ] **Step 5:** Commit `feat(app): el coach en partida es Premium`.

### Task C2-4: overlay con próxima habilidad y temporizadores de objetivos de jungla

Petición del propietario: el overlay debe mostrar siempre la habilidad que toca subir y los tiempos de jungla.

- **Panel:**
  - `Panel` gana el campo `proximaHabilidad: Habilidad | null`, calculado con el mismo criterio que el aviso de habilidad.
  - `Panel` gana `objetivos: { id: 'dragon' | 'anciano' | 'larvas' | 'heraldo' | 'baron' | 'atakhan'; nombre: string; aparece: number | null; disponible: boolean }[]`, con todos los objetivos épicos vigentes y su cuenta atrás.
  - Se rellenan también los campos opcionales que añadió la pista A: `AvisoOverlay.tipo`, `Panel.compraId` y `Panel.version`.
- **Antes de implementar,** verificar con fuentes actuales (wiki de LoL y notas del parche 16.x) qué objetivos épicos existen, sus tiempos de aparición y reaparición, y los `EventName` de la Live Client Data API (por ejemplo `HordeKill`, `DragonKill` con `DragonType` Elder, `HeraldKill`, `BaronKill` y el de Atakhan si existe). Las constantes van a `consejos/objetivos.ts` con un comentario de la fuente y la fecha.
- **Inicio de partida:** mostrar los campamentos de jungla y el Escarabajo con su primera aparición. No se muestran reapariciones de campamentos normales ni nada del enemigo, porque la API no lo permite y Riot lo prohíbe.
- **Renderer del overlay:** una fila con el icono de la próxima habilidad y una lista compacta de objetivos con su cuenta atrás. Usa los iconos de la pista A.
- **Pruebas** en `motor.test.ts` y `overlay-ui.test.tsx`:
  - próxima habilidad;
  - Larvas y Heraldo con sus ventanas de tiempo;
  - el Anciano tras un alma de dragón (cuarto dragón de un equipo) si el parche lo mantiene;
  - el Barón reaparece a los 6 min.

### Task C2-3: fusión, enlaces cruzados y verificación

- [ ] **Step 1:** Fusionar en la rama `v2` las ramas `v2-ui`, `v2-web` y `v2-servidor`. Si hay conflicto en `package-lock.json`, se resuelve regenerándolo con `npm install`.
- [ ] **Step 2:** Comprobar los enlaces cruzados:
  - la app abre las rutas de la web;
  - la web llama a las rutas del servidor (`PUBLIC_API_URL`);
  - `URL_WEB` del servidor coincide con la web;
  - `/descargar` apunta a las releases.
- [ ] **Step 3:** Verificar con `npm test`, `npx tsc --noEmit` (shared, server y app), `npm run build -w app` y `cd web && npm test && npm run build`. Hacer una prueba de humo de la app en desarrollo con `COACH_PREMIUM=1`, deteniendo solo sus procesos.
- [ ] **Step 4:** Commit `chore: integración de v2`.
