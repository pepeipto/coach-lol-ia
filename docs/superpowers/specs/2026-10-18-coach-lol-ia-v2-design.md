# Coach LoL IA v2: interfaz premium, web del producto y suscripciones

**Fecha:** 2026-10-18
**Estado:** pendiente de revisión
**Base:** v1 (`docs/superpowers/specs/2026-10-18-coach-lol-ia-design.md`), ya funcionando con datos reales.

## 1. Objetivo

Llevar Coach LoL IA de "funciona" a "producto". Son tres piezas enlazadas:

1. **Interfaz de la app de calidad profesional**, al estilo Blitz: oscura, con arte del campeón, tarjetas y microanimaciones.
2. **Web del producto** presentada como entrega de proyecto final: qué hace, cómo funciona, arquitectura, seguridad, planes, descarga y FAQ.
3. **Modelo freemium:**
   - **Gratis:** builds, runas e importación en la selección de campeón, con anuncios.
   - **Premium (4,99 €/mes):** coach en partida (overlay con avisos y voz) y sin anuncios.

**Criterios de éxito:**
- La app nueva se ve al nivel de Blitz o Porofessor: tema oscuro coherente, arte del campeón, iconos nítidos y transiciones suaves. Además, mantiene todo lo que v1 ya hace y todas sus pruebas.
- La web se publica en GitHub Pages, está en español, se ve bien en móvil y escritorio, y explica el producto de principio a fin.
- Un usuario puede suscribirse desde la web y pegar en la app la licencia que recibe. Con eso se activa el coach en partida y desaparecen los anuncios. Si cancela, vuelve a ser gratuito.
- Ningún secreto (Stripe, Riot) está en el repositorio, en la web ni en la app.

## 2. Decisiones y restricciones

- **Anuncios en la web, no AdSense dentro de la app.** Las normas de Google AdSense solo permiten sus anuncios en sitios web propios, no en aplicaciones de escritorio. Por eso:
  - **En la web:** espacios de Google AdSense, que se activan con el ID de editor del propietario (`PUBLIC_ADSENSE_CLIENT`). Sin ese ID no se muestra nada y no hay errores.
  - **En la app gratuita:** un **banner promocional propio** ("Hazte Premium por 4,99 €/mes") en la ventana principal. No es una red publicitaria. Integrar una red de anuncios para escritorio queda fuera de v2.
- **Pagos con Stripe** (Checkout + Customer Portal + webhooks), con una suscripción mensual de 4,99 € en EUR. El propietario crea la cuenta, el producto y el precio en Stripe y configura las claves como variables de entorno del servidor. Nadie más las introduce.
- **Licencias sin cuentas de usuario.** Tras pagar, la página de éxito muestra una **clave de licencia** (`CLIA-XXXX-XXXX-XXXX-XXXX`), que el usuario pega en la app (Ajustes → Licencia). No hay contraseñas ni envío de correos en v2: la clave se puede volver a consultar desde la página de éxito y el usuario gestiona o cancela su suscripción en el Customer Portal de Stripe.
- **Riot:** antes de pedir la clave de producción, el propietario debe confirmar con la política vigente que puede cobrar por el overlay. La web y la app incluyen el aviso legal de Riot.
- **Sin dependencias pesadas nuevas en la app:** React y CSS propio con variables de diseño, más `lucide-react` para los iconos. Ni Tailwind ni librerías de componentes.
- **Web estática con Astro**, en `web/` del mismo monorepo, desplegada en GitHub Pages con GitHub Actions. Es el camino más simple para una web estática rápida y con buen SEO.

## 3. Pieza A: interfaz de la app

### 3.1 Sistema de diseño (`app/src/renderer/comun/`)
- **Tokens en CSS:** fondo `#0a0e1a`, superficies `#121829` y `#1a2236`, borde `#26314d`, texto `#e8ecf5` y `#8b97b8`, acento dorado `#c8aa6e` (guiño a LoL), acento primario `#4f7cff`, éxito `#2fbf71`, aviso `#f0b429`, error `#ef5b5b`. Radios de 8 y 12 px, sombras suaves, tipografía Inter (con system-ui como reserva) y transiciones de 150-200 ms.
- **Componentes compartidos:**
  - `Tarjeta`, `Boton` (primario, secundario, fantasma)
  - `Insignia` (porcentaje de victorias, parche, número de partidas)
  - `IconoDDragon` (objeto, hechizo, runa o campeón, con tooltip de nombre)
  - `Pestanas`, `Interruptor` (sustituye a los checkbox), `Esqueleto` (carga) y `Aviso`
- Tamaño mínimo de ventana: 1000×680. Ventana sin marco nativo, con barra de título propia (minimizar, maximizar, cerrar) y región de arrastre.

### 3.2 Ventana principal
- **Barra lateral fija** con el logo y la navegación: **Campeón** (la vista de la build), **Overlay**, **Ajustes** y **Premium**. Abajo, el estado de conexión con el cliente de LoL (punto verde o gris y texto).
- **Vista Campeón:**
  - Cabecera con el splash art del campeón difuminado al fondo, su retrato, nombre, rol con selector, y las insignias de victorias, partidas y parche.
  - **Tarjeta Runas:** las ramas principal y secundaria con sus iconos, más los fragmentos.
  - **Tarjeta Hechizos.**
  - **Tarjeta Build:** inicio → núcleo (con flechas) → botas, y abajo los situacionales.
  - **Tarjeta Orden de habilidades:** una rejilla de 18 niveles con Q/W/E/R coloreadas, como en Blitz.
  - **Botón principal "Importar"** fijo arriba a la derecha, con un estado de éxito animado.
  - **Estados vacíos ilustrados:** "Esperando al cliente…", "Elige un campeón" y "Build no disponible", con esqueletos de carga.
- **Vista Overlay:** vista previa del panel, botón "Mover el overlay", interruptores por tipo de aviso y voz.
- **Vista Ajustes:** importación automática, tecla rápida (solo lectura), licencia (pestaña de la pieza C) y acerca de (versión y aviso legal).
- **Vista Premium:**
  - **Si el plan es gratuito:** beneficios, precio, botón "Suscribirme" (abre la web de precios en el navegador) y campo para pegar la licencia.
  - **Si es premium:** el estado, la fecha de renovación y el botón "Gestionar suscripción".
- **Banner promocional (plan gratuito):** franja discreta bajo la cabecera de la vista Campeón, que se puede cerrar durante la sesión.

### 3.3 Overlay
- Panel compacto translúcido, con desenfoque de fondo y borde dorado fino. Muestra iconos del objeto de la próxima compra y del objetivo (dragón, Heraldo o Barón), con una cuenta atrás con barra de progreso.
- Avisos tipo toast con un icono por tipo, que entran deslizándose y se desvanecen a los 5 s.
- Todo el comportamiento de v1 se mantiene: click-through, modo mover, voz y antispam.

### 3.4 Restricciones
- Se mantienen todos los textos en `es.json`, la API del preload y el contrato IPC (solo se añaden campos).
- Las pruebas de v1 siguen pasando; las de componentes se actualizan si cambia el marcado.

## 4. Pieza B: web del producto (`web/`)

- **Astro** en modo estático, con el CSS de los mismos tokens de diseño que la app. Todo en español.
- **Páginas:**
  - `/`, la presentación del proyecto, con estas secciones:
    1. **Hero:** nombre, lema, captura de la app y botones de descarga y Premium.
    2. **Qué hace:** las funciones en tarjetas.
    3. **Cómo funciona:** los pasos 1-2-3 de la selección de campeón a la partida.
    4. **Arquitectura:** diagrama SVG con la app, la LCU API, la Live Client API, el servidor de builds, Riot API, Data Dragon y Stripe.
    5. **Seguridad y Vanguard:** solo APIs oficiales; qué hace y qué no.
    6. **Datos:** de dónde salen las builds, con los umbrales de partidas y el refresco cada 6 h.
    7. **Tecnologías:** Electron, React, TypeScript, Node, SQLite, Fastify, Vitest y Astro.
    8. **Calidad:** pruebas automáticas, CI y revisión por tareas.
    9. **Planes:** el resumen de precios.
    10. **Hoja de ruta.**
    11. **FAQ.**
    12. **Pie:** aviso legal de Riot y enlaces.
  - `/premium`: la comparativa Gratis/Premium y el botón "Suscribirme" (llama al servidor para crear la sesión de Stripe Checkout).
  - `/premium/gracias?session_id=…`: pide la licencia al servidor y la muestra con un botón para copiarla y las instrucciones para pegarla en la app.
  - `/premium/gestionar`: el usuario pega su licencia y se le redirige al Customer Portal de Stripe.
  - `/descargar`: enlace a la última release de GitHub y requisitos (Windows 10/11, modo "Sin bordes").
  - `/privacidad`, `/terminos` y `/cookies`: textos legales básicos de plantilla, con un banner de consentimiento de cookies que bloquea AdSense hasta que se acepten.
- **Anuncios:** componente `Anuncio` con espacios en `/` y `/descargar`, nunca en las páginas de pago. Solo se carga si existe `PUBLIC_ADSENSE_CLIENT` y el usuario ha aceptado las cookies.
- **Configuración en tiempo de compilación:** `PUBLIC_API_URL` (la URL del servidor) y `PUBLIC_ADSENSE_CLIENT`.
- **Capturas:** imágenes de la app nueva en `web/public/capturas/`. Si aún no hay capturas reales, se usan maquetas SVG o HTML fieles a la interfaz, marcadas para sustituirlas.
- **Despliegue:** workflow de GitHub Actions que compila `web/` y publica en GitHub Pages (`https://pepeipto.github.io/coach-lol-ia/`, con el `base` de Astro configurado).

## 5. Pieza C: suscripciones y licencias

### 5.1 Servidor (`server/`)
- **Tabla nueva** `licencias(clave TEXT PK, stripe_customer TEXT, stripe_subscription TEXT UNIQUE, checkout_session TEXT UNIQUE, estado TEXT, renueva_en TEXT, actualizada TEXT)`. `estado` toma los valores `activa`, `cancelada` o `impagada`.
- **Endpoints (JSON, con CORS solo para el origen de la web):**
  - `POST /api/premium/checkout` → `{ url }`: crea una sesión de Stripe Checkout en modo `subscription` con `STRIPE_PRICE_ID` y las URLs de éxito y cancelación de la web.
  - `GET /api/premium/licencia?session_id=…` → `{ clave, estado }`: busca la licencia de esa sesión. Si el webhook aún no ha llegado, consulta la sesión en Stripe y crea la licencia (idempotente).
  - `POST /api/premium/portal` con `{ clave }` → `{ url }`: abre el Customer Portal del cliente de esa licencia.
  - `GET /api/premium/estado/:clave` → `{ premium: boolean, estado, renuevaEn }`. Es lo que consulta la app.
  - `POST /api/stripe/webhook`: lee el cuerpo sin procesar y verifica la firma con `STRIPE_WEBHOOK_SECRET`. Gestiona `checkout.session.completed` (crea la licencia), `customer.subscription.updated` y `customer.subscription.deleted` (actualizan el estado y la fecha de renovación), e `invoice.payment_failed` (marca la licencia como `impagada`).
- **Claves de licencia:** `CLIA-` seguido de 4 grupos de 4 caracteres aleatorios criptográficos (alfabeto sin caracteres ambiguos).
- **Variables de entorno:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` y `URL_WEB`. Si faltan las de Stripe, las rutas de premium responden `503 {"error":"premium_no_configurado"}` y el resto del servidor funciona igual.
- **Rate limit** sencillo por IP en `/api/premium/*` (30 peticiones por minuto).
- **Pruebas:** el cliente de Stripe se inyecta y se simula en las pruebas. Cubren la verificación de firma del webhook (incluida una firma inválida), la idempotencia, los cambios de estado, el 503 sin configuración y el CORS.

### 5.2 App
- **Módulo `licencia`** en el proceso principal:
  - guarda la clave en `userData/licencia.json`;
  - la consulta en `GET /api/premium/estado/:clave` al arrancar y cada 6 h;
  - guarda en caché el último estado premium, con una **tolerancia sin conexión de 7 días**.
- **Plan** = `'premium'` si la licencia está activa y verificada (o en caché dentro de la tolerancia); si no, `'gratis'`.
- **Restricciones del plan:**
  - **Gratis:** builds, importación y banner promocional. El overlay no arranca en partida; en su lugar, un aviso en la ventana principal dice "El coach en partida es Premium".
  - **Premium:** overlay completo y sin banner.
- **IPC nuevo:** `coach:licencia-estado`, `coach:licencia-activar(clave)`, `coach:licencia-quitar` y `coach:abrir-web(ruta)`. Este último solo permite rutas de la web oficial y abre el navegador del sistema.
- **Modo desarrollo:** `COACH_PREMIUM=1` fuerza el plan premium para poder probar el overlay sin pagar.
- **Pruebas:** estados de la licencia (activa, cancelada, sin conexión dentro y fuera de los 7 días) y bloqueo del overlay en el plan gratuito.

## 6. Organización del trabajo
- **Fase 1, en paralelo:** son tres pistas independientes, cada una en su propio worktree y rama.
  - **A (interfaz):** solo `app/src/renderer/**`, `app/src/shared/i18n/es.json` (añadiendo claves) y el `package.json` de la app.
  - **B (web):** solo `web/**` y el workflow de Pages.
  - **C1 (servidor):** solo `server/**`.
- **Fase 2, integración:** esta fase se ejecuta después de A, B y C1.
  - **C2:** licencia y restricciones del plan en la app.
  - Botones de la web enlazados al servidor real.
  - URLs cruzadas: la app abre la web y la web apunta a las releases.
  - Revisión final de toda la rama.

## 7. Fuera de alcance (v2)
- Red de anuncios dentro de la app de escritorio.
- Cuentas con usuario y contraseña, y envío de correos.
- Otros idiomas, y Mac o Linux.
- Firma de código del instalador.
