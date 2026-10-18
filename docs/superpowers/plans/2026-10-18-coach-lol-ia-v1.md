# Coach LoL IA v1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app de escritorio Coach LoL IA (selección de campeón con importación y overlay en partida, todo en español) y su servidor de builds.

**Architecture:** Monorepo con npm workspaces y tres paquetes: `shared` (tipos y utilidades comunes), `server` (recolecta partidas de la API de Riot, agrega builds en SQLite y las sirve por HTTP) y `app` (Electron, que habla solo con la LCU API y la Live Client Data API locales). Las tareas 1-7 entregan un servidor funcional por sí solo; las tareas 8-17 construyen la app sobre él.

**Tech Stack:** Node 24, TypeScript, Vitest, Fastify, better-sqlite3, Electron con electron-vite, React, `ws`, electron-builder y electron-updater.

**Spec:** `docs/superpowers/specs/2026-10-18-coach-lol-ia-design.md`

## Global Constraints

- Todo texto visible para el usuario (app, overlay, errores, voz, títulos de páginas de runas y conjuntos de objetos) está en **español neutro** y sale de `app/src/shared/i18n/es.json`. Nunca se escribe texto visible directamente en el código.
- La app solo se comunica con la **LCU API** (credenciales del `lockfile`), con la **Live Client Data API** (`https://127.0.0.1:2999`), con Data Dragon y con nuestro servidor. Prohibido: leer memoria, inyectar código o DLL, capturar pantalla, simular teclado o ratón en el juego.
- El overlay **no** muestra temporizadores de hechizos o definitivas enemigas, temporizadores de jungla enemiga ni la posición de enemigos.
- La clave de Riot (`RIOT_API_KEY`) solo existe en el servidor y se lee de variables de entorno. Nunca va en el repositorio ni en la app.
- Data Dragon en idioma `es_MX`.
- Builds a partir de partidas clasificatorias Solo/Dúo (`queue=420`) de Esmeralda o superior en EUW (`euw1`/`europe`), LAN (`la1`/`americas`) y LAS (`la2`/`americas`).
- Si una combinación campeón-rol tiene menos de **200** partidas en el parche actual, se mezcla con el parche anterior (`mezclaParches: true`). Con menos de **20** partidas en total no se publica build.
- El agregador se ejecuta cada **6 horas**.
- Overlay: avisos emergentes que se desvanecen a los **5 s**; como mucho **1 aviso cada 10 s**; tecla por defecto `CommandOrControl+Shift+O`.
- El reintento de conexión con el cliente de LoL se hace cada **3 s**; la Live Client Data API se consulta cada **1 s**.
- Las páginas de runas y conjuntos de objetos de la app se titulan `Coach: <Campeón> <Rol>`. La app solo borra o reemplaza páginas con el prefijo `Coach:`.
- Aviso legal visible: "Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends."
- Repositorio GitHub: `pepeipto/coach-lol-ia`.

## Review Focus

1. **Campeón recién lanzado o sin datos suficientes:** la app muestra "Build no disponible" y el overlay solo da avisos que no dependen de la build (objetivos, visión, fase). Nunca debe fallar. Pruebas en las tareas 9 y 14.
2. **Pantalla de carga:** durante la carga, la Live Client Data API responde con error o con datos incompletos. Se ignora el ciclo sin cerrar el conector y se reintenta. Prueba en la tarea 13.
3. **Riot ID con acentos, eñes o espacios** (`Señor Ñandú#LAS1`): el jugador activo debe encontrarse igualmente en `allPlayers`. Prueba en la tarea 13.
4. **Todas las páginas de runas ocupadas por páginas del jugador:** la app devuelve `sin_paginas` y no borra nada. Prueba en la tarea 11.
5. **Límite de la API de Riot (429):** el recolector espera lo que indica `Retry-After` y reintenta, sin perder la partida ni bloquear el ciclo. Prueba en la tarea 2.

---

## Estructura de archivos

```
coach-lol-ia/
  package.json                      workspaces: shared, server, app
  tsconfig.base.json
  shared/src/
    tipos.ts                        Rol, Habilidad, PaginaRunas, Build, RolesCampeon, ItemDDragonCrudo
    objetos.ts                      clasificarObjeto
    ddragon.ts                      URLs de Data Dragon y parcheDeVersion
    index.ts
  server/src/
    riot/limitador.ts               crearLimitador
    riot/riotApi.ts                 crearRiotApi, regiones
    extraer.ts                      extraerParticipaciones (partida + timeline → Participacion[])
    db.ts                           abrirDb (SQLite)
    agregador.ts                    agregarBuild, generarOrdenHabilidades, calcularBuilds
    recolector.ts                   recolectar
    programacion.ts                 ejecutarCiclo, iniciarProgramacion
    http.ts                         crearServidor (Fastify)
    index.ts                        arranque
  server/Dockerfile
  app/
    electron.vite.config.ts
    electron-builder.yml
    src/shared/i18n/es.json, i18n.ts
    src/shared/tiposApp.ts          EstadoPartida, Indicacion, Ajustes, SeleccionCampeon, IPC
    src/main/index.ts               orquestador
    src/main/log.ts
    src/main/ajustes.ts
    src/main/datos/estaticos.ts
    src/main/builds/clienteBuilds.ts
    src/main/lcu/lockfile.ts, cliente.ts, vigilante.ts, seleccion.ts, importar.ts
    src/main/partida/normalizar.ts, conector.ts, modoVentana.ts
    src/main/consejos/objetivos.ts, motor.ts, antispam.ts
    src/main/ventanas/principal.ts, overlay.ts
    src/preload/index.ts
    src/renderer/principal/…        React: App, VistaBuild, Ajustes, PieLegal
    src/renderer/overlay/…          React: Overlay, Panel, Avisos, voz.ts
    tools/simulador-partida.ts, grabar-partida.ts
    test/fixtures/…
```

---

### Task 1: Monorepo y paquete `shared`

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc` (`24`)
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/tipos.ts`, `shared/src/objetos.ts`, `shared/src/ddragon.ts`, `shared/src/index.ts`
- Test: `shared/test/objetos.test.ts`, `shared/test/ddragon.test.ts`

**Interfaces:**
- Produces (`@coach/shared`):
  ```ts
  type Rol = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';
  const ROLES: Rol[];
  type Habilidad = 'Q' | 'W' | 'E' | 'R';
  interface PaginaRunas { estiloPrincipal: number; estiloSecundario: number; runas: number[] } // 9 ids: 4 principal, 2 secundaria, 3 fragmentos (ataque, flexible, defensa)
  interface Build {
    campeon: string;            // id de Data Dragon, p. ej. "Ahri"
    rol: Rol; parche: string;   // "15.20"
    partidas: number; tasaVictoria: number; // 0..1
    mezclaParches: boolean;
    runas: PaginaRunas; hechizos: [number, number];
    objetosIniciales: number[]; nucleo: number[]; botas: number | null; situacionales: number[];
    ordenHabilidades: Habilidad[]; // 18 elementos
    calculadoEn: string;        // ISO
  }
  interface RolesCampeon { campeon: string; roles: { rol: Rol; partidas: number }[] }
  interface ItemDDragonCrudo { gold: { total: number; purchasable: boolean }; from?: string[]; into?: string[]; tags?: string[]; consumed?: boolean; maps?: Record<string, boolean>; name?: string }
  function clasificarObjeto(id: number, item: ItemDDragonCrudo): 'botas' | 'legendario' | 'otro';
  const URL_VERSIONES: string; // https://ddragon.leagueoflegends.com/api/versions.json
  function urlDatosDDragon(version: string, archivo: 'champion' | 'item' | 'runesReforged' | 'summoner', idioma?: string): string; // idioma por defecto es_MX
  function parcheDeVersion(version: string): string; // "15.20.1" → "15.20"
  ```

- [ ] **Step 1: Crear el monorepo** con workspaces `shared`, `server` y `app`, TypeScript `strict`, Vitest como dependencia de desarrollo en la raíz y el script `npm test` → `vitest run`. `.gitignore`: `node_modules`, `dist`, `out`, `*.db`, `.env`.
- [ ] **Step 2: Escribir las pruebas que fallan**

```ts
// shared/test/objetos.test.ts
const legendario = { gold: { total: 2900, purchasable: true }, into: [], tags: ['SpellDamage'], maps: { '11': true } };
it('legendario: completo, comprable y de 2000 de oro o más', () => expect(clasificarObjeto(6655, legendario)).toBe('legendario'));
it('componente épico (Códice demoníaco, se mejora a otro)', () =>
  expect(clasificarObjeto(3108, { gold: { total: 900, purchasable: true }, into: ['6655'], maps: { '11': true } })).toBe('otro'));
it('botas mejoradas', () => expect(clasificarObjeto(3020, { gold: { total: 1100, purchasable: true }, tags: ['Boots'], into: [] })).toBe('botas'));
it('botas básicas (1001) no cuentan como botas', () => expect(clasificarObjeto(1001, { gold: { total: 300, purchasable: true }, tags: ['Boots'], into: ['3020'] })).toBe('otro'));
it('consumibles nunca son legendarios', () => expect(clasificarObjeto(2003, { gold: { total: 50, purchasable: true }, consumed: true })).toBe('otro'));
it('no disponible en la Grieta (maps["11"] false)', () => expect(clasificarObjeto(9999, { ...legendario, maps: { '11': false } })).toBe('otro'));

// shared/test/ddragon.test.ts
it('parcheDeVersion', () => expect(parcheDeVersion('15.20.1')).toBe('15.20'));
it('urlDatosDDragon usa es_MX', () =>
  expect(urlDatosDDragon('15.20.1', 'item')).toBe('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/es_MX/item.json'));
```

- [ ] **Step 3: Ejecutar** `npx vitest run shared`. Esperado: FALLA (módulos inexistentes).
- [ ] **Step 4: Implementar** `tipos.ts`, `objetos.ts` y `ddragon.ts` con las firmas de arriba. Reglas de `clasificarObjeto`: es `botas` si tiene la etiqueta `Boots` y `id !== 1001`; es `legendario` si no es consumible, `into` está vacío o no existe, `gold.purchasable` es verdadero, `gold.total >= 2000`, `maps['11'] !== false` y no tiene la etiqueta `Trinket`. En cualquier otro caso es `otro`.
- [ ] **Step 5: Ejecutar** `npx vitest run shared`. Esperado: PASA.
- [ ] **Step 6: Commit** `git commit -m "feat(shared): monorepo, tipos comunes y clasificación de objetos"`

---

### Task 2: Cliente de la API de Riot con limitador

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/riot/limitador.ts`, `server/src/riot/riotApi.ts`
- Test: `server/test/limitador.test.ts`, `server/test/riotApi.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Region = 'EUW' | 'LAN' | 'LAS';
  const REGIONES: Record<Region, { plataforma: 'euw1' | 'la1' | 'la2'; ruta: 'europe' | 'americas' }>;
  function crearLimitador(reglas?: { peticiones: number; ventanaMs: number }[]): { esperarTurno(): Promise<void> }; // por defecto [{20,1000},{100,120000}]
  class ErrorRiot extends Error { estado: number }
  interface RiotApi {
    entradasLiga(plataforma: string, tier: 'EMERALD' | 'DIAMOND', division: 'I'|'II'|'III'|'IV', pagina: number): Promise<{ puuid: string }[]>;
    ligaApex(plataforma: string, liga: 'challenger' | 'grandmaster' | 'master'): Promise<{ puuid: string }[]>; // entries[]
    idsPartidas(ruta: string, puuid: string, cantidad: number): Promise<string[]>; // queue=420
    partida(ruta: string, id: string): Promise<PartidaRiot | null>;
    lineaTiempo(ruta: string, id: string): Promise<LineaTiempoRiot | null>;
  }
  function crearRiotApi(opciones: { clave: string; fetch?: typeof fetch; esperar?: (ms: number) => Promise<void>; limitadores?: Map<string, ReturnType<typeof crearLimitador>> }): RiotApi;
  ```
  `PartidaRiot` y `LineaTiempoRiot` se tipan en `riotApi.ts` solo con los campos que usa la tarea 3: `metadata.matchId`, `info.gameVersion`, `info.queueId`, `info.participants[]` (`participantId`, `puuid`, `championName`, `teamPosition`, `win`, `summoner1Id`, `summoner2Id`, `perks.statPerks{offense,flex,defense}`, `perks.styles[]{style,selections[]{perk}}`) e `info.frames[].events[]` (`type`, `timestamp`, `participantId`, `itemId`, `beforeId`, `skillSlot`, `levelUpType`).

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// limitador: con reglas [{peticiones: 2, ventanaMs: 1000}] y temporizadores falsos de Vitest,
// la 3.ª llamada a esperarTurno() no se resuelve hasta avanzar 1000 ms.

// riotApi (fetch falso que registra las llamadas):
it('envía X-Riot-Token y usa el host de la plataforma o la ruta', …);   // https://euw1.api.riotgames.com/... , https://europe.api.riotgames.com/...
it('idsPartidas pide queue=420 y count', …);                          // URL contiene ?queue=420&count=20
it('429: espera Retry-After segundos y reintenta', async () => {
  // fetch: 1.ª respuesta 429 con Retry-After: 3, 2.ª 200 → partida devuelta; esperar() recibió 3000
});
it('429 cuatro veces seguidas → lanza ErrorRiot con estado 429', …);  // máximo 3 reintentos
it('404 → devuelve null', …);
it('500 → lanza ErrorRiot con estado 500', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run server/test/limitador.test.ts server/test/riotApi.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar `crearLimitador`** con una ventana deslizante por regla: guarda las marcas de tiempo y espera hasta que todas las reglas tengan hueco.
- [ ] **Step 4: Implementar `crearRiotApi`**: un limitador por host, creado bajo demanda. Si falta `Retry-After`, espera 10 s. `esperar` usa por defecto `setTimeout`.
- [ ] **Step 5: Ejecutar** las mismas pruebas. Esperado: PASA.
- [ ] **Step 6: Commit** `git commit -m "feat(server): cliente de la API de Riot con limitador y reintentos"`

---

### Task 3: Extracción de participaciones

**Files:**
- Create: `server/src/extraer.ts`
- Create: `server/test/fixtures/partida.json`, `server/test/fixtures/lineaTiempo.json` (partida mínima escrita a mano según el esquema de Match-v5: 2 participantes, unos 10 eventos)
- Test: `server/test/extraer.test.ts`

**Interfaces:**
- Consumes: `PartidaRiot`, `LineaTiempoRiot` (tarea 2) y `clasificarObjeto`, `ItemDDragonCrudo`, `PaginaRunas`, `Rol`, `Habilidad` (tarea 1).
- Produces:
  ```ts
  interface Participacion {
    matchId: string; campeon: string; rol: Rol; victoria: boolean; parche: string;
    runas: PaginaRunas; hechizos: [number, number];  // ordenados de menor a mayor
    iniciales: number[];                              // ordenados de menor a mayor
    compras: number[];                                // botas y legendarios en orden de compra, sin repetidos
    habilidades: Habilidad[];                         // en orden de subida
  }
  function extraerParticipaciones(partida: PartidaRiot, linea: LineaTiempoRiot, objetos: Record<number, ItemDDragonCrudo>): Participacion[];
  ```

- [ ] **Step 1: Escribir las pruebas que fallan** contra los fixtures:

```ts
it('omite participantes con teamPosition vacío', …);
it('runas: 4 de la rama principal, 2 de la secundaria y fragmentos ataque, flexible y defensa en ese orden', …);
it('parche "15.20" a partir de gameVersion "15.20.712.3456"', …);
it('iniciales = compras con timestamp < 60000, descontando las deshechas con ITEM_UNDO', …);
it('compras solo incluye botas y legendarios, en orden y sin repetir', …);
it('habilidades: skillSlot 1..4 → Q,W,E,R, solo levelUpType "NORMAL"', …);
it('hechizos ordenados: summoner1Id 14, summoner2Id 4 → [4, 14]', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run server/test/extraer.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar `extraerParticipaciones`**. Recorre los eventos de todos los frames filtrando por `participantId`. Con `ITEM_UNDO`, quita de las iniciales el `beforeId` añadido más recientemente.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(server): extracción de participaciones desde partida y línea de tiempo"`

---

### Task 4: Almacenamiento SQLite

**Files:**
- Create: `server/src/db.ts`
- Test: `server/test/db.test.ts`

**Interfaces:**
- Consumes: `Participacion` (tarea 3), `Build`, `Rol` (tarea 1), `Region` (tarea 2).
- Produces:
  ```ts
  interface Db {
    partidaVista(matchId: string): boolean;
    marcarVista(matchId: string): void;
    guardarParticipaciones(region: Region, ps: Participacion[]): void;   // en una transacción; también marca la partida como vista
    participacionesDe(campeon: string, rol: Rol, parches: string[]): Participacion[];
    combinaciones(parches: string[]): { campeon: string; rol: Rol }[];
    guardarBuild(b: Build): void;                                      // reemplaza
    build(campeon: string, rol: Rol): Build | null;
    roles(campeon: string, parche: string): { rol: Rol; partidas: number }[]; // de más a menos partidas
    borrarParchesAntiguos(conservar: string[]): void;                  // borra participaciones y builds de otros parches
    cerrar(): void;
  }
  function abrirDb(ruta: string): Db; // ':memory:' en las pruebas
  ```
  Tablas: `partidas_vistas(match_id PK)`, `participaciones(match_id, campeon, rol, parche, region, datos JSON, PK(match_id, campeon))` con índice `(campeon, rol, parche)`, y `builds(campeon, rol, parche, datos JSON, PK(campeon, rol))`.

- [ ] **Step 1: Escribir las pruebas que fallan** (sobre `':memory:'`): guardar y leer participaciones; `partidaVista` tras guardar; `combinaciones`; `guardarBuild` reemplaza la build anterior; `roles` ordenados de mayor a menor; `borrarParchesAntiguos(['15.20','15.19'])` elimina los datos de `15.18`.
- [ ] **Step 2: Ejecutar** `npx vitest run server/test/db.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar `abrirDb`** con better-sqlite3, sentencias preparadas y `journal_mode = WAL`.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(server): almacenamiento SQLite de partidas y builds"`

---

### Task 5: Agregador de builds

**Files:**
- Create: `server/src/agregador.ts`
- Test: `server/test/agregador.test.ts`

**Interfaces:**
- Consumes: `Participacion`, `Db`, `clasificarObjeto`, `ItemDDragonCrudo`.
- Produces:
  ```ts
  const MIN_PARTIDAS_PARCHE = 200, MIN_PARTIDAS_PUBLICAR = 20;
  function generarOrdenHabilidades(secuencias: Habilidad[][]): Habilidad[];
  function agregarBuild(ps: Participacion[], objetos: Record<number, ItemDDragonCrudo>, parche: string, mezclaParches: boolean, ahora?: Date): Build;
  function calcularBuilds(db: Db, objetos: Record<number, ItemDDragonCrudo>, parcheActual: string, parcheAnterior: string): number; // builds guardadas
  ```

Reglas de `agregarBuild`. "Moda" significa el valor más frecuente, comparado como JSON; en caso de empate gana el que aparece primero.
- `runas`, `hechizos` y `objetosIniciales`: moda.
- `nucleo`: moda de los 3 primeros legendarios (sin botas) en orden, entre las participaciones que tienen al menos 3. Si ninguna llega a 3, se usa la moda de los que haya.
- `botas`: moda de las primeras botas compradas. Si menos del 30 % compró botas, `null` (Cassiopeia).
- `situacionales`: los 5 legendarios más frecuentes que no están en `nucleo`.
- `partidas` = total de participaciones; `tasaVictoria` = victorias / partidas.

Algoritmo de `generarOrdenHabilidades` (no lo determinan las pruebas, se fija aquí):

```ts
// 1. inicio = moda de s.slice(0, 3) entre las secuencias con al menos 3 elementos.
// 2. Para cada secuencia, prioridad = [Q,W,E] ordenadas por el índice en que cada una llega a 5 puntos
//    (las que no llegan van al final, ordenadas por puntos totales descendentes). prioridad final = moda.
// 3. Construir los niveles 1..18:
//    nivel 6, 11 y 16 → 'R';  niveles 1..3 → inicio[nivel-1];
//    resto → primera habilidad de la prioridad con puntos < 5 y puntos < Math.ceil(nivel / 2).
```

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it('orden de habilidades: maximizar Q, luego E y luego W, con inicio Q,E,W', () => {
  const s: Habilidad[] = ['Q','E','W','Q','Q','R','Q','E','Q','E','R','E','E','W','W','R','W','W'];
  expect(generarOrdenHabilidades([s, s, s])).toEqual(s);
});
it('orden generado siempre tiene 18 niveles, R en 6/11/16 y ninguna básica por encima de ceil(nivel/2)', …);
it('núcleo = triple más frecuente en orden', …);
it('botas null si menos del 30 % compró botas', …);
it('situacionales excluye el núcleo y tiene como máximo 5', …);
it('tasaVictoria = victorias / partidas', …);
it('calcularBuilds: 250 partidas del parche actual → mezclaParches false', …);
it('calcularBuilds: 150 actuales + 100 anteriores → mezclaParches true y partidas 250', …);
it('calcularBuilds: 15 en total → no guarda build', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run server/test/agregador.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** las tres funciones según las reglas de arriba.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(server): agregador de builds y orden de habilidades"`

---

### Task 6: Recolector y programación

**Files:**
- Create: `server/src/recolector.ts`, `server/src/programacion.ts`
- Test: `server/test/recolector.test.ts`

**Interfaces:**
- Consumes: `RiotApi`, `REGIONES`, `Region` (tarea 2), `extraerParticipaciones` (tarea 3), `Db` (tarea 4), `calcularBuilds` (tarea 5), `URL_VERSIONES`, `urlDatosDDragon`, `parcheDeVersion` (tarea 1).
- Produces:
  ```ts
  function recolectar(api: RiotApi, db: Db, objetos: Record<number, ItemDDragonCrudo>,
                      opciones: { region: Region; parche: string; maxPartidas: number }): Promise<number>; // partidas nuevas guardadas
  function ejecutarCiclo(deps: { api: RiotApi; db: Db; fetch?: typeof fetch; maxPartidasPorRegion?: number }): Promise<void>;
  function iniciarProgramacion(deps: Parameters<typeof ejecutarCiclo>[0], intervaloMs?: number): () => void; // por defecto 6 h; ejecuta un ciclo al arrancar; devuelve la función para detener
  ```

Comportamiento de `recolectar`:
1. Reúne los jugadores de `ligaApex` (challenger, grandmaster y master) y de `entradasLiga` (DIAMOND y EMERALD, divisiones I-IV, página 1). Los baraja.
2. Para cada `puuid`, pide `idsPartidas(ruta, puuid, 20)`. Para cada id no visto: pide `partida`; si su parche ≠ `parche` o `queueId ≠ 420`, la marca como vista y continúa. Si no, pide `lineaTiempo`, extrae las participaciones y las guarda.
3. Se detiene al llegar a `maxPartidas`. Un `ErrorRiot` en una partida se registra y se pasa a la siguiente.

`ejecutarCiclo`:
1. Obtiene la versión de Data Dragon y los objetos (`item.json`) del parche actual.
2. El parche anterior es la versión anterior de `versions.json` con distinto major.minor.
3. Recolecta en las 3 regiones (por defecto `maxPartidasPorRegion` = 300).
4. Ejecuta `calcularBuilds`.
5. Ejecuta `borrarParchesAntiguos([actual, anterior])`.
6. Si falla, registra el error y no lanza nada (el siguiente ciclo lo reintenta).

- [ ] **Step 1: Escribir las pruebas que fallan** con una `RiotApi` falsa en memoria y `abrirDb(':memory:')`:

```ts
it('guarda las partidas nuevas y se detiene en maxPartidas', …);
it('no vuelve a pedir partidas ya vistas', …);
it('salta las partidas de otro parche y las marca como vistas', …);
it('un ErrorRiot en una partida no detiene la recolección', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run server/test/recolector.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `recolectar`, `ejecutarCiclo` e `iniciarProgramacion`.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(server): recolector de partidas y ciclo cada 6 horas"`

---

### Task 7: API HTTP, arranque y Docker del servidor

**Files:**
- Create: `server/src/http.ts`, `server/src/index.ts`, `server/Dockerfile`, `server/.env.example`
- Test: `server/test/http.test.ts`

**Interfaces:**
- Consumes: `Db` (tarea 4), `iniciarProgramacion` (tarea 6), `crearRiotApi` (tarea 2).
- Produces (contrato HTTP que usa la app en la tarea 9):
  - `GET /salud` → `200 {"ok":true}`
  - `GET /builds/:campeon/:rol` → `200 Build` | `400 {"error":"rol_invalido"}` | `404 {"error":"sin_datos"}`
  - `GET /roles/:campeon` → `200 RolesCampeon` (con `roles: []` si no hay datos)
  - `function crearServidor(db: Db): FastifyInstance`

- [ ] **Step 1: Escribir las pruebas que fallan** con `fastify.inject`: build existente → 200 con el mismo JSON; rol `SUPPORT` → 400; campeón sin datos → 404; `/roles/Ahri` ordenado de mayor a menor; `/salud`.
- [ ] **Step 2: Ejecutar** `npx vitest run server/test/http.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar `crearServidor` e `index.ts`**. `index.ts` lee `RIOT_API_KEY` (obligatoria: si falta, termina con un mensaje), `PUERTO` (por defecto 8080) y `RUTA_DB` (por defecto `./coach.db`) y `MAX_PARTIDAS` (opcional, sobrescribe `maxPartidasPorRegion`), llama a `iniciarProgramacion` y escucha en `0.0.0.0`. `/roles` usa el parche de la última build guardada del campeón.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Escribir el `Dockerfile`** (Node 24 slim, `npm ci`, compilación, volumen `/datos` para la base de datos) y `.env.example` (`RIOT_API_KEY=`, `PUERTO=8080`, `RUTA_DB=/datos/coach.db`).
- [ ] **Step 6: Verificación manual** con una clave de desarrollo real: `RIOT_API_KEY=… MAX_PARTIDAS=30 npm run dev -w server`, y después `curl http://localhost:8080/roles/Ahri`. Esperado: JSON con al menos un rol cuando haya datos. `MAX_PARTIDAS` sobrescribe `maxPartidasPorRegion`.
- [ ] **Step 7: Commit** `git commit -m "feat(server): API HTTP, arranque y Dockerfile"`

---

### Task 8: Esqueleto de la app (Electron), i18n, ajustes y log

**Files:**
- Create: `app/` con la plantilla `electron-vite` react-ts (`npm create @quick-start/electron@latest app -- --template react-ts`), ajustada a dos entradas de renderer: `principal` y `overlay`.
- Create: `app/src/shared/i18n/es.json`, `app/src/shared/i18n.ts`, `app/src/shared/tiposApp.ts`, `app/src/main/ajustes.ts`, `app/src/main/log.ts`
- Test: `app/test/i18n.test.ts`, `app/test/ajustes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function t(clave: string, params?: Record<string, string | number>): string; // interpola {param}; si la clave no existe, devuelve la clave
  type TipoAviso = 'compra' | 'habilidad' | 'objetivo' | 'vision' | 'fase';
  interface Ajustes {
    avisos: Record<TipoAviso, boolean>; voz: boolean; importacionAutomatica: boolean;
    teclaOverlay: string; posicionOverlay: { x: number; y: number } | null; urlServidor: string;
  }
  const AJUSTES_POR_DEFECTO: Ajustes; // avisos todos true, voz false, importacionAutomatica false, teclaOverlay 'CommandOrControl+Shift+O', posicionOverlay null
  function cargarAjustes(ruta: string): Ajustes;   // archivo ausente o corrupto → AJUSTES_POR_DEFECTO; mezcla campos que falten
  function guardarAjustes(ruta: string, a: Ajustes): void;
  function registrar(nivel: 'info' | 'aviso' | 'error', mensaje: string): void; // añade una línea a userData/logs/coach.log
  ```
  `urlServidor` por defecto: variable de entorno `COACH_SERVIDOR` en el momento de compilar, o `http://localhost:8080`.

- [ ] **Step 1: Escribir las pruebas que fallan**: `t('aviso.compra', {oro: 1250, objeto: 'Códice demoníaco'})` → `"Tienes 1250 de oro: ya puedes comprar Códice demoníaco"`; una clave inexistente devuelve la clave; `cargarAjustes` con archivo ausente, con JSON roto y con un JSON parcial (solo `voz: true`) → valores por defecto más el cambio.
- [ ] **Step 2: Ejecutar** `npx vitest run app/test/i18n.test.ts app/test/ajustes.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `i18n.ts`, `ajustes.ts` y `log.ts`, y crear `es.json` con todas las claves usadas en el plan. Textos fijados por el spec:
  - `aviso.compra`: "Tienes {oro} de oro: ya puedes comprar {objeto}"
  - `aviso.habilidad`: "Nivel {nivel}: sube la {habilidad}"
  - `aviso.objetivoPronto`: "{objetivo} aparece en {segundos} s"
  - `aviso.objetivoDisponible`: "{objetivo} disponible"
  - `aviso.vision`: "No llevas guardianes de control"
  - `estado.esperandoCliente`: "Esperando al cliente de League of Legends…"
  - `estado.sinConexion`: "Datos sin conexión (parche {parche})"
  - `estado.buildNoDisponible`: "Build no disponible"
  - `estado.parche`: "Datos del parche {parche}"
  - `aviso.pantallaCompleta`: "El overlay solo funciona en modo «Sin bordes». Cámbialo en Opciones → Vídeo → Modo de ventana."
  - `legal.aviso`: el aviso legal de las restricciones globales
  - `objetivo.dragon` "El dragón", `objetivo.heraldo` "El Heraldo", `objetivo.baron` "El Barón"
  - `rol.TOP` "Superior", `rol.JUNGLE` "Jungla", `rol.MIDDLE` "Central", `rol.BOTTOM` "Inferior", `rol.UTILITY` "Soporte"
  - `fase.<ROL>.<temprana|media|tardia>`: 15 consejos breves escritos para cada rol y fase, por ejemplo `fase.MIDDLE.media` "Fase media: agrupa con tu equipo para los objetivos"
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Verificación:** `npm run dev -w app` abre la ventana principal con `t('estado.esperandoCliente')`.
- [ ] **Step 6: Commit** `git commit -m "feat(app): esqueleto Electron, i18n en español, ajustes y log"`

---

### Task 9: Datos estáticos y cliente de builds con caché

**Files:**
- Create: `app/src/main/datos/estaticos.ts`, `app/src/main/builds/clienteBuilds.ts`
- Test: `app/test/estaticos.test.ts`, `app/test/clienteBuilds.test.ts`

**Interfaces:**
- Consumes: `urlDatosDDragon`, `URL_VERSIONES`, `parcheDeVersion`, `ItemDDragonCrudo`, `Build`, `Rol` (tarea 1); contrato HTTP de la tarea 7.
- Produces:
  ```ts
  interface DatosEstaticos {
    version: string; parche: string;
    campeones: Map<number, { id: string; nombre: string }>;          // clave numérica (championId) → id DDragon y nombre en español
    objetos: Record<number, ItemDDragonCrudo & { name: string }>;
    runas: Map<number, { nombre: string; icono: string }>;           // estilos y runas
    hechizos: Map<number, { nombre: string; imagen: string }>;       // por clave numérica
  }
  function cargarDatosEstaticos(dirCache: string, fetchFn?: typeof fetch): Promise<DatosEstaticos>; // red → guarda en dirCache/<version>; sin red → última caché; sin red ni caché → lanza
  type ResultadoBuild = { estado: 'ok' | 'sin_conexion'; build: Build } | { estado: 'no_disponible' };
  function crearClienteBuilds(o: { urlServidor: string; dirCache: string; fetch?: typeof fetch; tiempoEsperaMs?: number }): {
    obtenerBuild(campeon: string, rol: Rol): Promise<ResultadoBuild>; // tiempo de espera por defecto 1500 ms
    obtenerRoles(campeon: string): Promise<Rol[]>;                    // error → []
  };
  ```

- [ ] **Step 1: Escribir las pruebas que fallan** con `fetch` falso y un directorio temporal:

```ts
it('estáticos: mapea championId 103 → {id:"Ahri", nombre:"Ahri"} y usa es_MX', …);
it('estáticos: sin red usa la última versión en caché', …);
it('build: 200 → estado ok y la guarda en caché', …);
it('build: servidor caído con caché → estado sin_conexion con la build en caché', …);
it('build: 404 sin caché (campeón recién lanzado) → no_disponible', …);   // Review Focus 1
it('build: servidor caído sin caché → no_disponible', …);
it('build: respuesta más lenta que tiempoEsperaMs → se trata como caída', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run app/test/estaticos.test.ts app/test/clienteBuilds.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** ambos módulos. La caché de builds es `dirCache/builds/<campeon>-<rol>.json`.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(app): datos estáticos de Data Dragon y cliente de builds con caché"`

---

### Task 10: Conexión con el cliente (LCU) y selección de campeón

**Files:**
- Create: `app/src/main/lcu/lockfile.ts`, `app/src/main/lcu/cliente.ts`, `app/src/main/lcu/seleccion.ts`, `app/src/main/lcu/vigilante.ts`
- Create: `app/test/fixtures/sesionSeleccion.json` (sesión de `/lol-champ-select/v1/session` con `localPlayerCellId` y `myTeam`)
- Test: `app/test/lockfile.test.ts`, `app/test/seleccion.test.ts`, `app/test/vigilante.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface CredencialesLcu { puerto: number; password: string; protocolo: string }
  function parsearLockfile(texto: string): CredencialesLcu;            // "LeagueClient:1234:54321:abc:https"
  function encontrarDirectorioLol(ejecutar?: (cmd: string) => Promise<string>): Promise<string>;
    // lee la línea de comandos de LeagueClientUx.exe con PowerShell (Get-CimInstance Win32_Process) y extrae --install-directory=…; si falla → "C:\\Riot Games\\League of Legends"
  interface ClienteLcu {
    peticion<T = unknown>(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T>; // lanza ErrorLcu {estado} si no es 2xx
    suscribir(evento: string, cb: (datos: { uri: string; eventType: string; data: unknown }) => void): void; // WAMP [5, evento]
    cerrar(): void;
  }
  function crearClienteLcu(c: CredencialesLcu): Promise<ClienteLcu>; // https://127.0.0.1:<puerto>, Basic riot:<password>, certificado de Riot aceptado solo para 127.0.0.1
  interface SeleccionCampeon { campeonId: number; rol: Rol | null }
  function interpretarSeleccion(sesion: unknown): SeleccionCampeon | null; // championId || championPickIntent del jugador local; 0 → null; assignedPosition top/jungle/middle/bottom/utility → Rol; "" → null
  class VigilanteLcu extends EventEmitter { // eventos: 'conectado'(ClienteLcu, dirLol: string) · 'desconectado' · 'fase'(fase: string) · 'seleccion'(SeleccionCampeon)
    constructor(o?: { intervaloMs?: number; leerArchivo?: (ruta: string) => Promise<string>; conectar?: typeof crearClienteLcu; buscarDir?: typeof encontrarDirectorioLol });
    iniciar(): void; detener(): void; // intervalo por defecto 3000 ms
  }
  ```
  El vigilante se suscribe a `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase` y a `OnJsonApiEvent_lol-champ-select_v1_session`. Solo emite `seleccion` cuando cambian `campeonId` o `rol`.

- [ ] **Step 1: Escribir las pruebas que fallan**: parseo del lockfile; extracción de `--install-directory="D:\Juegos\Riot Games\League of Legends"` (con espacios); `interpretarSeleccion` con el fixture (campeón fijado, intención sin fijar, sin elegir, partida a ciegas sin `assignedPosition`); vigilante con lector y conector falsos: sin lockfile no emite nada, con lockfile emite `conectado`, si el lockfile desaparece emite `desconectado`, y no emite `seleccion` repetida.
- [ ] **Step 2: Ejecutar** `npx vitest run app/test/lockfile.test.ts app/test/seleccion.test.ts app/test/vigilante.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** los cuatro módulos (`ws` para el WebSocket y `https.Agent` para las peticiones).
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Verificación manual** con el cliente de LoL abierto: el log muestra `conectado` y la fase `ChampSelect` al entrar en una partida personalizada.
- [ ] **Step 6: Commit** `git commit -m "feat(app): conexión con el cliente de LoL y lectura de la selección de campeón"`

---

### Task 11: Importación de runas, hechizos y objetos

**Files:**
- Create: `app/src/main/lcu/importar.ts`
- Test: `app/test/importar.test.ts`

**Interfaces:**
- Consumes: `ClienteLcu` (tarea 10), `Build` (tarea 1), `t` (tarea 8).
- Produces:
  ```ts
  type ResultadoImportacion = { ok: true } | { ok: false; motivo: 'sin_paginas' | 'error' };
  function importarRunas(lcu: ClienteLcu, build: Build, titulo: string): Promise<ResultadoImportacion>;
  function importarHechizos(lcu: ClienteLcu, hechizos: [number, number]): Promise<ResultadoImportacion>;
  function importarObjetos(lcu: ClienteLcu, build: Build, campeonKey: number, titulo: string): Promise<ResultadoImportacion>;
  function importarTodo(lcu: ClienteLcu, build: Build, campeonKey: number, titulo: string): Promise<{ runas: ResultadoImportacion; hechizos: ResultadoImportacion; objetos: ResultadoImportacion }>;
  ```

Reglas:
- **Runas:**
  1. `GET /lol-perks/v1/pages` y `GET /lol-perks/v1/inventory` (`ownedPageCount`).
  2. Si existe una página editable cuyo nombre empieza por `Coach:`, `DELETE /lol-perks/v1/pages/{id}`.
  3. Si las páginas editables restantes son `>= ownedPageCount`, devuelve `sin_paginas` sin borrar nada.
  4. `POST /lol-perks/v1/pages` con `{ name: titulo, primaryStyleId, subStyleId, selectedPerkIds: build.runas.runas, current: true }`.
- **Hechizos:** lee `GET /lol-champ-select/v1/session` y toma `spell1Id` y `spell2Id` del jugador local (`myTeam[cellId == localPlayerCellId]`). Si el jugador lleva Destello (4) en la posición 2, Destello va en `spell2Id`; si no, en `spell1Id`. Después, `PATCH /lol-champ-select/v1/session/my-selection`.
- **Objetos:**
  1. `GET /lol-summoner/v1/current-summoner` → `summonerId`.
  2. `GET /lol-item-sets/v1/item-sets/{summonerId}/sets`.
  3. Quita los conjuntos cuyo título empieza por `Coach:` y añade `{ title: titulo, type: 'custom', map: 'any', mode: 'any', associatedChampions: [campeonKey], associatedMaps: [11], sortrank: 0, startedFrom: 'blank', preferredItemSlots: [], uid: randomUUID(), blocks }`.
  4. `PUT` del documento completo.
  
  Los bloques son `iniciales`, `nucleo`, `botas` (si no es null) y `situacionales`, con los títulos `t('conjunto.<bloque>')` e `items: [{ id: String(id), count: 1 }]`.
- Cualquier `ErrorLcu` se registra y devuelve `error`, sin lanzar.

- [ ] **Step 1: Escribir las pruebas que fallan** con un `ClienteLcu` falso que registra las llamadas:

```ts
it('reemplaza la página Coach: existente y crea la nueva como actual', …);
it('todas las páginas ocupadas por el jugador → sin_paginas y ningún DELETE', …);   // Review Focus 4
it('nunca borra páginas sin el prefijo Coach:', …);
it('hechizos: respeta Destello en la posición 2 del jugador', …);
it('objetos: conserva los conjuntos del jugador y reemplaza el de Coach:', …);
it('objetos: sin botas (null) no crea ese bloque', …);
it('error del LCU → {ok:false, motivo:"error"}', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run app/test/importar.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `importar.ts`.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(app): importación de runas, hechizos y conjunto de objetos"`

---

### Task 12: Ventana principal (selección de campeón)

**Files:**
- Create: `app/src/main/ventanas/principal.ts`, `app/src/preload/index.ts`, `app/src/renderer/principal/{App,VistaBuild,SelectorRol,Ajustes,PieLegal}.tsx`, `app/src/renderer/principal/estilos.css`
- Modify: `app/src/main/index.ts` (orquestador, primera parte), `app/src/shared/tiposApp.ts`
- Test: `app/test/VistaBuild.test.tsx` (Vitest + @testing-library/react + jsdom)

**Interfaces:**
- Consumes: `VigilanteLcu`, `interpretarSeleccion` (tarea 10), `importarTodo` (tarea 11), `crearClienteBuilds`, `cargarDatosEstaticos` (tarea 9), `cargarAjustes`, `guardarAjustes`, `t` (tarea 8).
- Produces: API del preload `window.coach`:
  ```ts
  interface EstadoPrincipal {
    cliente: 'esperando' | 'conectado';
    seleccion: { campeon: { id: string; nombre: string; key: number }; rol: Rol; rolesDisponibles: Rol[]; resultado: ResultadoBuild } | null;
    version: string; // Data Dragon, para las imágenes
  }
  window.coach = {
    alCambiarEstado(cb: (e: EstadoPrincipal) => void): void;
    importar(): Promise<{ runas; hechizos; objetos }>;
    cambiarRol(rol: Rol): Promise<void>;
    obtenerAjustes(): Promise<Ajustes>; guardarAjustes(a: Ajustes): Promise<void>;
    moverOverlay(activar: boolean): Promise<void>; // lo usa la tarea 15
  };
  ```

Orquestador:
- `seleccion`: rol = el asignado, o si no `obtenerRoles(...)[0]`, o si no `'MIDDLE'`. Llama a `obtenerBuild` y envía el estado. Si `importacionAutomatica` está activa y el resultado no es `no_disponible`, importa.
- El título de páginas y conjuntos es `Coach: ${nombre} ${t('rol.' + rol)}`.

Vista:
- Campeón y rol con selector.
- Runas, hechizos, objetos por bloques y orden de habilidades, con iconos de Data Dragon.
- `% victorias` y `partidas`. Si `mezclaParches`, una nota de que también se usan datos del parche anterior.
- `t('estado.sinConexion')` o `t('estado.parche')`.
- Botón "Importar". El resultado se muestra en español: con `sin_paginas` → "No quedan páginas de runas libres. Borra una página y vuelve a intentarlo."
- Pestaña de ajustes y pie con el aviso legal.

- [ ] **Step 1: Escribir las pruebas que fallan**: `VistaBuild` con una build → muestra "Importar", "Datos del parche 15.20" y el porcentaje; con `no_disponible` → "Build no disponible" y sin botón; con `sin_conexion` → texto sin conexión; `PieLegal` contiene el aviso legal.
- [ ] **Step 2: Ejecutar** `npx vitest run app/test/VistaBuild.test.tsx`. Esperado: FALLA.
- [ ] **Step 3: Implementar** la ventana, el preload, el orquestador y los componentes.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Verificación manual** en una partida personalizada: al elegir campeón aparece la build en menos de 2 s y "Importar" crea la página de runas, los hechizos y el conjunto de objetos en el cliente.
- [ ] **Step 6: Commit** `git commit -m "feat(app): ventana de selección de campeón con importación"`

---

### Task 13: Conector de partida y modo de ventana

**Files:**
- Create: `app/src/main/partida/normalizar.ts`, `app/src/main/partida/conector.ts`, `app/src/main/partida/modoVentana.ts`
- Create: `app/test/fixtures/allgamedata.json` (escrito a mano según el esquema documentado de `/liveclientdata/allgamedata`, con el Riot ID `Señor Ñandú#LAS1`)
- Test: `app/test/normalizar.test.ts`, `app/test/conector.test.ts`, `app/test/modoVentana.test.ts`

**Interfaces:**
- Produces (en `tiposApp.ts`):
  ```ts
  interface EventoPartida { nombre: string; tiempo: number }   // EventName, EventTime (s)
  interface EstadoPartida {
    tiempo: number; oro: number; nivel: number;
    campeon: string;                              // id DDragon a partir de rawChampionName "game_character_displayname_Ahri" → "Ahri"
    objetos: number[]; habilidades: Record<Habilidad, number>; eventos: EventoPartida[];
  }
  function normalizarDatosPartida(json: unknown): EstadoPartida | null;
    // null si: falta activePlayer, el jugador activo no está en allPlayers, o gameData.mapNumber !== 11
  function crearConectorPartida(o?: { url?: string; fetch?: typeof fetch; intervaloMs?: number }): EventEmitter & { iniciar(): void; detener(): void };
    // url por defecto: process.env.COACH_LIVE_URL ?? 'https://127.0.0.1:2999'; consulta /liveclientdata/allgamedata cada 1000 ms
    // eventos: 'estado'(EstadoPartida). Un error de red, un estado HTTP distinto de 2xx o un null se ignoran (se registran con nivel 'info').
  function leerModoVentana(dirLol: string, leer?: (ruta: string) => Promise<string>): Promise<'pantalla_completa' | 'ventana' | 'sin_bordes' | 'desconocido'>;
    // Config/game.cfg, línea WindowMode=0|1|2 → pantalla_completa|ventana|sin_bordes
  ```
  El jugador activo se identifica comparando `activePlayer.riotId` con `allPlayers[].riotId` tras normalizarlos con `String.prototype.normalize('NFC')`.

- [ ] **Step 1: Escribir las pruebas que fallan**:

```ts
it('normaliza el fixture: oro, nivel, objetos, habilidades y eventos', …);
it('encuentra al jugador con Riot ID "Señor Ñandú#LAS1" aunque esté en otra forma Unicode (NFD)', …); // Review Focus 3
it('mapa distinto de 11 (ARAM) → null', …);
it('sin activePlayer (espectador) → null', …);
it('conector: respuesta 404 y JSON incompleto durante la carga no emiten estado ni detienen el sondeo', …); // Review Focus 2
it('conector: tras la carga emite estado', …);
it('modoVentana: WindowMode=0 → pantalla_completa; WindowMode=2 → sin_bordes; archivo ausente → desconocido', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run app/test/normalizar.test.ts app/test/conector.test.ts app/test/modoVentana.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** los tres módulos. El `https.Agent` del conector acepta el certificado de Riot solo para `127.0.0.1`.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(app): conector de la partida en vivo y detección del modo de ventana"`

---

### Task 14: Motor de consejos

**Files:**
- Create: `app/src/main/consejos/objetivos.ts`, `app/src/main/consejos/motor.ts`
- Test: `app/test/motor.test.ts`

**Interfaces:**
- Consumes: `EstadoPartida` (tarea 13), `Build`, `Rol`, `clasificarObjeto` (tarea 1), `DatosEstaticos['objetos']` (tarea 9), `t` (tarea 8).
- Produces:
  ```ts
  interface Indicacion { tipo: TipoAviso; clave: string; texto: string }
  interface Panel { proximaCompra: string | null; proximoObjetivo: string | null }
  function generarIndicaciones(estado: EstadoPartida, build: Build | null, rol: Rol, objetos: DatosEstaticos['objetos']): Indicacion[];
  function resumenPanel(estado: EstadoPartida, build: Build | null, objetos: DatosEstaticos['objetos']): Panel;
  ```

Reglas (`objetivos.ts` contiene las constantes, revisables en cada parche):

- **Compra:**
  - Secuencia = `[nucleo[0], botas, ...nucleo.slice(1), ...situacionales]`, sin los `null` ni los objetos que ya se tienen.
  - Siguiente = el primer elemento de la secuencia.
  - Coste restante = `gold.total` del objeto menos el `gold.total` de cada id de su `from` que esté en el inventario (cada objeto del inventario cuenta una sola vez).
  - Si `oro >= costeRestante` → `{tipo:'compra', clave:'compra:<id>', texto: t('aviso.compra', {oro, objeto})}`.
  - Panel: `"<nombre> (<costeRestante> de oro)"`.
  - Sin build → no hay indicación de compra y `proximaCompra` es null.
- **Habilidad:** puntos = suma de `habilidades`. Si `nivel > puntos` y hay build → `t('aviso.habilidad', {nivel: puntos + 1, habilidad: ordenHabilidades[puntos]})`, con clave `habilidad:<puntos+1>`.
- **Objetivos:** `DRAGON = { aparece: 300, reaparece: 300, evento: 'DragonKill' }`, `HERALDO = { aparece: 900, reaparece: null, evento: 'HeraldKill' }`, `BARON = { aparece: 1200, reaparece: 360, evento: 'BaronKill' }`.
  - Próxima aparición = `aparece`, o el `tiempo` del último evento + `reaparece` (o ninguna si `reaparece` es null).
  - Si faltan entre 0 y 60 s → `objetivoPronto` (con los segundos redondeados), clave `objetivo:<nombre>:pronto:<aparicion>`.
  - Si ya apareció y no hay ningún evento posterior → `objetivoDisponible`, clave `objetivo:<nombre>:disp:<aparicion>`.
  - Panel: el objetivo más cercano, con los segundos restantes o "disponible".
- **Visión:** si `tiempo >= 300`, el inventario no incluye el 2055 y `oro >= 75` → `aviso.vision`, con clave `vision`.
- **Fase:** temprana `< 840 s`, media `< 1500 s`, tardía en adelante → `t('fase.<rol>.<fase>')`, con clave `fase:<fase>`.

- [ ] **Step 1: Escribir las pruebas que fallan**:

```ts
it('1250 de oro con Códice demoníaco pendiente (y sus componentes) → aviso de compra con el texto exacto', …);
it('descuenta del coste los componentes que ya se tienen', …);
it('nivel 4 con 3 puntos y orden Q,E,W,Q → "Nivel 4: sube la Q"', …);
it('minuto 4:00 → "El dragón aparece en 60 s"; 5:30 sin DragonKill → "El dragón disponible"', …);
it('DragonKill en 600 → siguiente dragón en 900', …);
it('el Heraldo no reaparece tras HeraldKill', …);
it('visión: a los 6 minutos sin guardián de control y con 100 de oro → aviso', …);
it('fase media a los 15 minutos para MIDDLE', …);
it('sin build: no hay avisos de compra ni de habilidad, pero sí de objetivos, visión y fase', …);  // Review Focus 1
it('ninguna indicación menciona enemigos (todos los textos salen de las claves aviso.*, objetivo.* y fase.*)', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run app/test/motor.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `objetivos.ts` y `motor.ts` como funciones puras.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(app): motor de consejos en español"`

---

### Task 15: Antispam, ventana overlay, voz y tecla rápida

**Files:**
- Create: `app/src/main/consejos/antispam.ts`, `app/src/main/ventanas/overlay.ts`, `app/src/renderer/overlay/{Overlay,Panel,Avisos}.tsx`, `app/src/renderer/overlay/voz.ts`, `app/src/renderer/overlay/estilos.css`
- Modify: `app/src/main/index.ts` (orquestador, segunda parte), `app/src/preload/index.ts`
- Test: `app/test/antispam.test.ts`

**Interfaces:**
- Consumes: `Indicacion`, `Panel`, `generarIndicaciones`, `resumenPanel` (tarea 14), `crearConectorPartida`, `leerModoVentana` (tarea 13), `Ajustes` (tarea 8), `VigilanteLcu` 'fase' (tarea 10).
- Produces:
  ```ts
  class FiltroAvisos {
    constructor(intervaloMs?: number); // 10000
    procesar(indicaciones: Indicacion[], ahoraMs: number, activos: Record<TipoAviso, boolean>): Indicacion | null;
    reiniciar(): void;
  }
  function crearVentanaOverlay(ajustes: Ajustes): BrowserWindow;
  // IPC hacia el overlay: 'overlay:panel'(Panel) · 'overlay:aviso'({texto, voz: boolean}) · 'overlay:mover'(boolean)
  ```

Reglas de `FiltroAvisos`:
- Prioridad: objetivo > compra > habilidad > vision > fase.
- Ignora los tipos desactivados.
- Una clave ya emitida no se vuelve a emitir mientras siga presente. Cuando desaparece de la lista se olvida, y si reaparece puede emitirse de nuevo.
- Como mucho emite una indicación cada `intervaloMs`. Las que se quedan fuera no se marcan como emitidas, así que pueden salir en el siguiente hueco.

Ventana overlay:
- `transparent`, `frame: false`, `alwaysOnTop: 'screen-saver'`, `skipTaskbar`, `focusable: false`, del tamaño de la pantalla principal.
- `setIgnoreMouseEvents(true, { forward: true })`.
- En modo mover, los clics dejan de pasar y el panel se puede arrastrar. Al salir del modo, la posición se guarda en `posicionOverlay`.

Orquestador:
- Fase `InProgress`: muestra el overlay e inicia el conector. Si `leerModoVentana` da `pantalla_completa`, envía `aviso.pantallaCompleta` a la ventana principal.
- Con cada `estado`: genera las indicaciones, envía el panel y, si el filtro deja pasar una, el aviso.
- Fases `EndOfGame`, `None` o `Lobby`, o `desconectado`: detiene el conector, oculta el overlay y reinicia el filtro.
- `globalShortcut.register(ajustes.teclaOverlay)` alterna la visibilidad del overlay.

Renderer del overlay:
- Panel compacto (próxima compra y próximo objetivo).
- Avisos que se desvanecen a los 5000 ms.
- `voz.ts`: si `voz` está activa, usa `speechSynthesis` con la primera voz cuyo `lang` empiece por `es-` (prefiere `es-MX` y después `es-ES`). Si no hay ninguna voz en español, no habla.

- [ ] **Step 1: Escribir las pruebas que fallan** (antispam):

```ts
it('emite como mucho una indicación cada 10 s', …);
it('prioriza un objetivo sobre una compra en el mismo instante', …);
it('no repite una clave mientras sigue presente', …);
it('una clave que desaparece y reaparece puede emitirse otra vez', …);
it('respeta los tipos desactivados en ajustes', …);
it('la indicación retenida por el intervalo sale en el siguiente hueco', …);
```

- [ ] **Step 2: Ejecutar** `npx vitest run app/test/antispam.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `FiltroAvisos`, la ventana overlay, el renderer, la voz y el resto del orquestador.
- [ ] **Step 4: Ejecutar** las pruebas. Esperado: PASA.
- [ ] **Step 5: Commit** `git commit -m "feat(app): overlay con avisos en español, voz y tecla rápida"`

---

### Task 16: Simulador de partida, grabador y prueba de punta a punta

**Files:**
- Create: `app/tools/simulador-partida.ts`, `app/tools/grabar-partida.ts`, `app/test/fixtures/grabacion-ejemplo.json` (lista de unos 6 fotogramas de `allgamedata` escritos a mano: 3:55, 4:00, 5:05, 5:30, 6:10 y 15:00)
- Modify: `app/package.json` (scripts `simular`, `grabar`)
- Test: `app/test/e2e-overlay.test.ts`

**Interfaces:**
- Consumes: `crearConectorPartida`, `generarIndicaciones`, `FiltroAvisos`.
- Produces:
  - `npm run simular -w app -- <grabacion.json> [velocidad]`: servidor HTTP en `127.0.0.1:2999` que sirve `/liveclientdata/allgamedata` y avanza un fotograma cada `1000 / velocidad` ms. La app se arranca con `COACH_LIVE_URL=http://127.0.0.1:2999`.
  - `npm run grabar -w app -- <salida.json>`: durante una partida real, guarda un fotograma cada 5 s.

- [ ] **Step 1: Escribir la prueba que falla**: arranca el simulador con `grabacion-ejemplo.json` a velocidad 100, conecta el conector, el motor y el filtro (sin Electron) y comprueba que la secuencia de avisos incluye "El dragón aparece en 60 s", un aviso de compra y "Fase media: …", en ese orden, y ningún texto vacío.
- [ ] **Step 2: Ejecutar** `npx vitest run app/test/e2e-overlay.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** el simulador y el grabador. En el orquestador, añadir la variable de depuración `COACH_FORZAR_PARTIDA=1`, que actúa como si llegara la fase `InProgress` sin cliente de LoL (con rol `MIDDLE` y build `null` si no hay selección).
- [ ] **Step 4: Ejecutar** la prueba. Esperado: PASA.
- [ ] **Step 5: Verificación visual:** `npm run simular -w app -- test/fixtures/grabacion-ejemplo.json 10` y, en otra terminal, `COACH_LIVE_URL=http://127.0.0.1:2999 npm run dev -w app`. Forzando la fase `InProgress` con la variable de depuración `COACH_FORZAR_PARTIDA=1`, el overlay muestra el panel y los avisos en español, y los clics pasan a la ventana de debajo.
- [ ] **Step 6: Commit** `git commit -m "feat(app): simulador y grabador de partidas, prueba de punta a punta"`

---

### Task 17: Empaquetado, actualizaciones y publicación en GitHub

**Files:**
- Create: `app/electron-builder.yml`, `README.md`, `.github/workflows/ci.yml`
- Modify: `app/src/main/index.ts` (electron-updater)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: instalador `Coach LoL IA Setup <versión>.exe` y el repositorio `pepeipto/coach-lol-ia`.

- [ ] **Step 1: `electron-builder.yml`**: `appId: com.coachlolia.app`, `productName: Coach LoL IA`, `win.target: nsis`, `nsis.oneClick: false`, `publish: { provider: github, owner: pepeipto, repo: coach-lol-ia }`.
- [ ] **Step 2: Actualizaciones**: `autoUpdater.checkForUpdatesAndNotify()` al arrancar, solo con la app empaquetada.
- [ ] **Step 3: CI**: el workflow ejecuta `npm ci` y `npm test` en `windows-latest` en cada push.
- [ ] **Step 4: README en español**: qué es; el aviso legal; instalación; uso (modo "Sin bordes", tecla rápida); qué no hace (Vanguard y normas de Riot); cómo arrancar el servidor con Docker y `RIOT_API_KEY`; y los pasos para pedir la clave de producción en el Developer Portal de Riot.
- [ ] **Step 5: Verificar**: `npm test` (todo pasa) y `npm run build -w app && npx electron-builder -w --publish never` dentro de `app` genera el `.exe`. Instalarlo y comprobar que arranca y muestra "Esperando al cliente de League of Legends…".
- [ ] **Step 6: Commit** `git commit -m "build: instalador de Windows, actualizaciones automáticas, CI y README"`
- [ ] **Step 7: Publicar en GitHub (solo con la confirmación del usuario):** `gh repo create pepeipto/coach-lol-ia --public --source . --push`.
