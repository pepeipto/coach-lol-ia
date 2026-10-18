# Coach LoL IA — Diseño de la versión 1

**Fecha:** 2026-10-18
**Estado:** pendiente de revisión

## 1. Objetivo

Aplicación de escritorio para Windows, **pública y gratuita**, que ayuda a jugadores de League of Legends de forma similar a Game Coach AI, pero **íntegramente en español** (español neutro). Público: jugadores de España y Latinoamérica (servidores EUW, LAN y LAS).

La versión 1 incluye:

1. **Selección de campeón:** builds, runas, hechizos y orden de habilidades más utilizados por campeón y rol, con importación al cliente en un clic.
2. **Overlay en partida:** indicaciones **en español** (texto y voz opcional) sobre compras, habilidades, objetivos, visión y fase de partida.

Fuera de la versión 1 (versiones posteriores): análisis post-partida con IA, monetización (anuncios o suscripción), otros idiomas, otros modos de juego específicos (ARAM, Arena).

### Criterios de éxito

- Funciona con Vanguard activo sin advertencias ni sanciones: la app nunca interactúa con el proceso del juego.
- Cumple la política de desarrolladores de Riot y obtiene la clave de producción.
- Al elegir campeón, la build aparece en menos de 2 s, y la importación de runas, hechizos y objetos funciona en un clic.
- Durante la partida, las indicaciones aparecen en español en menos de 2 s desde que el dato cambia, sin interferir con los clics del jugador.
- **Todo** el texto visible (app, overlay, errores, voz) está en español.

## 2. Requisitos obligatorios

- **Idioma:** todo en español neutro, incluidas las indicaciones durante la partida. Textos centralizados en archivos de idioma (i18n) para poder añadir más idiomas en el futuro.
- **Seguridad con Vanguard:** solo se usan las APIs locales oficiales de Riot (LCU API y Live Client Data API). Prohibido leer memoria, inyectar código o DLL, hacer capturas de pantalla para analizarlas o automatizar entradas en el juego.
- **Cumplimiento con Riot:** el overlay solo muestra información que el jugador ya puede ver en el juego (ver sección 5.3).
- **Clave de Riot:** la API key reside únicamente en el servidor, nunca en la app distribuida.
- **Monetización preparada pero no implementada:** la arquitectura no debe impedir añadir anuncios o suscripción más adelante.

## 3. Tecnología

| Pieza | Tecnología |
|---|---|
| App de escritorio | Electron + TypeScript + React |
| Servidor de builds | Node.js + TypeScript |
| Datos estáticos (nombres, imágenes) | Data Dragon de Riot, idioma `es_MX` |
| Instalador y actualizaciones | electron-builder + electron-updater con GitHub Releases |
| Voz | Síntesis de voz del sistema (voces de Windows en español), sin coste |

Se descartó Overwolf (obliga al usuario a instalar Overwolf y depender de su plataforma) y Tauri (overlay transparente con clics pasantes menos maduro en Windows).

## 4. Arquitectura

```
┌──────────────────── PC del jugador ────────────────────┐        ┌──────── Nube ────────┐
│                                                         │        │                      │
│  Cliente LoL ──(LCU API, lockfile)──► Conector LCU      │        │  Recolector          │
│                                          │              │        │  (API de Riot)       │
│  Partida ──(localhost:2999)──► Conector de partida      │        │        │             │
│                                          │              │        │  Agregador           │
│                        Motor de consejos ◄┘              │        │        │             │
│                          │                              │ HTTPS  │  API pública         │
│        Ventana principal ◄── builds ────────────────────┼────────┤  GET /builds/...     │
│        Ventana overlay  ◄── indicaciones en español     │        │                      │
└─────────────────────────────────────────────────────────┘        └──────────────────────┘
```

### 4.1 App de escritorio

| Módulo | Responsabilidad |
|---|---|
| **Conector LCU** | Localiza el cliente leyendo el `lockfile` (puerto y contraseña), se conecta a la LCU API y escucha por WebSocket: entrada en selección de campeón, campeón elegido, rol asignado e inicio y fin de partida. Ejecuta las importaciones. |
| **Conector de partida** | Durante la partida consulta `https://127.0.0.1:2999/liveclientdata/allgamedata` cada segundo: oro, objetos, nivel, tiempo de juego, eventos (dragones, barones, heraldo…) y jugadores. Emite un estado normalizado. |
| **Motor de consejos** | Función pura: (estado de partida + build recomendada + rol) → lista de indicaciones. Reglas locales y deterministas, sin IA en la v1. Incluye antispam. |
| **Cliente de builds** | Pide las builds al servidor, las cachea en disco y sirve la última copia si no hay conexión. |
| **Datos estáticos** | Descarga y cachea Data Dragon (`es_MX`) del parche actual: campeones, objetos, runas, hechizos e iconos. |
| **Ventana principal** | Muestra la build en la selección de campeón, el botón "Importar", el selector de rol y los ajustes. |
| **Ventana overlay** | Ventana transparente, sin marco, siempre encima y con clics pasantes (`setIgnoreMouseEvents`). Panel compacto arrastrable más avisos emergentes. |
| **i18n** | Archivo `es.json` con todos los textos. Ningún texto visible escrito directamente en el código. |
| **Ajustes** | Activar o desactivar cada tipo de aviso, voz, importación automática, tecla rápida y posición del overlay. Se guardan en disco. |

### 4.2 Servidor de builds

| Módulo | Responsabilidad |
|---|---|
| **Recolector** | Usa la API de Riot (League-v4 y Match-v5) para obtener partidas clasificatorias de jugadores Esmeralda o superior de EUW, LAN y LAS, respetando los límites de peticiones. |
| **Agregador** | Para cada campeón y rol calcula: página de runas, hechizos, objetos iniciales, núcleo (3 objetos), botas, situacionales y orden de habilidades más frecuentes, con su tasa de victorias y número de partidas. |
| **API pública** | `GET /builds/:campeon/:rol` y `GET /roles/:campeon` (roles más jugados). Respuestas JSON con el parche y la fecha de cálculo. |
| **Programación** | El agregador se ejecuta cada 6 horas. |

**Reglas de agregación:** solo partidas del parche actual. Si un campeón y rol tiene menos de 200 partidas, se combinan con el parche anterior y la respuesta lo indica (`mezclaParches: true`).

## 5. Funcionalidades

### 5.1 Selección de campeón

- Al elegir campeón, la ventana principal se abre o se actualiza sola y muestra runas, hechizos, objetos (iniciales, núcleo, botas, situacionales), orden de habilidades, % de victorias y número de partidas.
- **Rol:** se toma el rol asignado por el cliente. Si no hay ninguno, se usa el más jugado con ese campeón y el jugador puede cambiarlo con un selector.
- **Importar** (LCU API):
  - Runas: crea la página "Coach: <Campeón> <Rol>". Si no quedan páginas libres, reemplaza solo una página creada previamente por la app (prefijo "Coach:"); nunca borra páginas del jugador. Si no puede, avisa.
  - Hechizos: los selecciona en la selección de campeón.
  - Objetos: crea un conjunto de objetos visible en la tienda del juego.
- Opción de **importación automática** en ajustes (desactivada por defecto).

### 5.2 Overlay en partida (todo en español)

| Indicación | Ejemplo | Fuente |
|---|---|---|
| Próxima compra | "Tienes 1250 de oro: ya puedes comprar Códice Demoníaco" | Oro + inventario frente a la build |
| Orden de habilidades | "Nivel 4: sube la Q" | Nivel + orden de la build |
| Objetivos | "El dragón aparece en 60 s" / "Barón disponible" | Tiempo de juego + eventos públicos |
| Visión | "No llevas guardianes de control" | Inventario |
| Fase de partida | "Fase media: agrupa con tu equipo para los objetivos" | Minuto + rol (textos escritos por nosotros) |

- Panel compacto fijo con la próxima compra y el próximo objetivo; avisos emergentes que se desvanecen a los 5 s.
- **Antispam:** como mucho un aviso emergente cada 10 s; el mismo aviso no se repite hasta que su condición cambie.
- **Voz opcional** en español.
- **Tecla rápida** `Ctrl+Shift+O` para mostrar u ocultar (atajo global de Electron, sin interactuar con el juego).
- Si el juego está en pantalla completa, la app avisa de que hay que usar "Sin bordes".

### 5.3 Lo que el overlay NO muestra (cumplimiento con Riot)

- Temporizadores de hechizos de invocador o definitivas enemigas.
- Temporizadores de campamentos de la jungla enemiga.
- Posición o paradero de enemigos, o cualquier dato no visible en la pantalla del jugador.

Antes de solicitar la clave de producción se revisará cada indicación contra la política vigente de Riot.

## 6. Gestión de errores

| Situación | Comportamiento |
|---|---|
| Cliente de LoL cerrado | "Esperando al cliente de League of Legends…"; reintento cada 3 s |
| Sin partida en curso | Overlay oculto; no se consulta el puerto 2999 |
| Servidor de builds caído | Se usa la caché con el aviso "Datos sin conexión (parche X)"; si no hay caché, "Build no disponible" |
| Pantalla completa | Aviso con instrucciones para cambiar a "Sin bordes" |
| Fallo al importar | Mensaje con la causa; no se modifica nada del jugador |
| Parche nuevo | Servidor y Data Dragon se actualizan solos; la app muestra "Datos del parche X.Y" |
| Respuesta inesperada de la API local | Se registra en el log local y se ignora ese ciclo, sin cerrar la app |

## 7. Pruebas

- **Unitarias:** motor de consejos (estado → indicaciones) y agregador (partidas → builds), con datos grabados.
- **Simulador de partida:** servidor falso en `localhost:2999` que reproduce partidas grabadas para probar el overlay sin LoL.
- **LCU simulado:** respuestas grabadas para probar la selección de campeón y la importación.
- **Prueba real** en partida de práctica antes de cada versión.

## 8. Publicación

- Repositorio nuevo en el GitHub del usuario (separado de Jarvis).
- Instalador `.exe` para Windows con actualizaciones automáticas desde GitHub Releases.
- Servidor en un alojamiento económico; desarrollo con la clave de desarrollo de Riot y solicitud de la clave de producción en el Developer Portal antes del lanzamiento público.
- Aviso legal visible: "Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends."

## 9. Ubicación del proyecto

- Carpeta: `E:\coach-lol-ia`
- Estructura prevista: `app/` (Electron), `server/` (servidor de builds), `docs/`.
