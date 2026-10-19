# Coach LoL IA 3.0: plan (spec y plan en uno)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** turn Coach LoL IA into a mature, polished product:
- a modular in-game overlay (top objective bar, skill arrow, CS tracker, purchase toast, manual jungle timers);
- many more voice callouts;
- a loading-screen overlay with player and champion info;
- much more build data;
- first-run onboarding and a "Novedades" changelog;
- an updated website;
- a 9:16 promotional video for TikTok.

**Approved by the owner on 2026-10-19.** Base: main at 385fcec (v2.1.0, everything free, `PREMIUM_HABILITADO=false`).

## Global constraints
- All user-facing text in neutral Spanish (`app/src/shared/i18n/es.json` and the web markup).
- Only the official APIs: LCU, Live Client Data (127.0.0.1:2999), Riot API on the server, Data Dragon. Never read memory, inject code, capture or OCR the screen, or automate input.
- **Riot policy** (binding):
  - never show enemy summoner or ultimate cooldowns (not even with manual input);
  - never show enemy positions;
  - never shame players: no negative labels such as "malo", "troll" or "inting", and only neutral facts;
  - no MMR/ELO alternatives (show only the official rank).
- Everything is free for everyone; the Premium code stays dormant.
- Keep all existing tests passing. TDD for logic. Focused commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never touch port 8080 or processes you didn't start.

## Architecture
- The overlay stays ONE transparent, click-through, full-screen window, but its renderer becomes a set of independent **widgets**, each with its own position, enabled flag and scale:
  - `objetivos` (top bar)
  - `habilidad` (arrow)
  - `cs`
  - `compra` (toast)
  - `jungla` (manual timers)
  - `avisos` (toasts)

  The old fixed panel is removed. Move mode lets every widget be dragged, and positions are saved per widget in `Ajustes.overlay.widgets`.
- The loading screen is a NEW overlay mode (same window, `modo: 'carga' | 'partida'`). It is shown from gameflow `InProgress` until the first valid Live Client state arrives, plus while the game's own loading screen is up. It is hidden at the first valid estado or after 3 minutes.

## Shared contracts (exact)
`app/src/shared/tiposApp.ts` gains:

```ts
type IdWidget = 'objetivos' | 'habilidad' | 'cs' | 'compra' | 'jungla' | 'avisos';
interface ConfigWidget { activo: boolean; x: number | null; y: number | null; escala: number } // escala 0.75..1.5
interface AjustesOverlay { widgets: Record<IdWidget, ConfigWidget>; opacidad: number /*0.5..1*/; voz: AjustesVoz }
interface AjustesVoz { activa: boolean; volumen: number /*0..1*/; vozId: string | null; tipos: Record<TipoVoz, boolean> }
type TipoVoz = 'objetivo' | 'compra' | 'habilidad' | 'cs' | 'vision' | 'fase' | 'jungla';
interface ObjetivoEstado { id: 'dragon' | 'anciano' | 'larvas' | 'heraldo' | 'baron'; nombre: string; subtipo: string | null /* dragon type, e.g. 'Infernal' */; aparece: number | null; disponible: boolean }
interface EstadoCs { cs: number; porMinuto: number; objetivoPorMinuto: number; cs10: number | null }
interface EstadoOverlay {   // replaces Panel for the new renderer
  tiempo: number;
  objetivos: ObjetivoEstado[];
  proximaHabilidad: Habilidad | null;   // only when a point is available
  cs: EstadoCs | null;
  compra: { id: number; nombre: string; coste: number; puedeComprar: boolean } | null;
  version: string;                      // Data Dragon
}
interface JugadorCarga { equipo: 'aliado' | 'enemigo'; riotId: string; campeonId: number; campeon: string; rol: Rol | null;
  rango: { tier: string; division: string; lp: number; victorias: number; derrotas: number } | null;
  maestria: { nivel: number; puntos: number } | null;
  campeonWinrate: number | null;        // our aggregated data for campeón+rol
  etiquetas: { tipo: 'positivo' | 'neutro' | 'info'; texto: string }[] }
interface EstadoCarga { jugadores: JugadorCarga[]; version: string }
```

- `Ajustes` gains `overlay: AjustesOverlay`, with defaults and normalisation in `ajustes.ts`; old ajustes migrate.
- IPC to the overlay:
  - `overlay:estado` (EstadoOverlay)
  - `overlay:aviso` (AvisoOverlay, unchanged)
  - `overlay:modo` ('carga' | 'partida' | 'oculto')
  - `overlay:carga` (EstadoCarga)
  - `overlay:config` (AjustesOverlay)
  - `overlay:mover` (boolean)
  - `overlay:jungla-marcar` (overlay → main: campId)

## Track A: modular overlay and voice (branch `v3-overlay`)
**Files:** app/src/main/consejos/**, app/src/main/orquestador/partida.ts, app/src/main/partida/normalizar.ts (add creepScore + active player team), app/src/main/voz or the renderer voz, app/src/renderer/overlay/**, app/src/renderer/principal/vistas/VistaOverlay.tsx, app/src/main/ajustes.ts, app/src/shared/tiposApp.ts (contracts above), es.json (keys under `overlay.*`, `voz.*`, `jungla.*` only).

- [ ] **A1 · Data:**
  - `normalizar` reads `allPlayers[me].scores.creepScore` and the team.
  - `resumenOverlay(estado, build, rol, objetos, version): EstadoOverlay` is pure and replaces `resumenPanel`. It covers the objective list with dragon subtype from `DragonKill.DragonType` / the next dragon type when known, otherwise null; the next skill; CS (target/min by rol: TOP 7, JUNGLE 6 (camps count), MIDDLE 7.5, BOTTOM 8, UTILITY 1.5; cs10 = CS at the first state ≥ 600 s); and the next purchase.
  - Tests.
- [ ] **A2 · Widgets:**
  - **Objective bar:** centred at the top, compact icons (Data Dragon / local SVG icons) with countdowns. It pulses at ≤60 s and highlights when available.
  - **Skill arrow:** a big animated arrow with the Q/W/E/R letter, positioned over the HUD ability slot. Default positions are computed for 1920×1080 with the default HUD scale and scaled by screen size; the user can calibrate by dragging in move mode. Hide it when no point is available.
  - **CS widget:** CS, CS/min vs the target with a colour (green ≥ target, amber within 15 %, neutral below — never red or shaming), and CS@10.
  - **Purchase toast:** the item icon and «Ya puedes comprar X»; it auto-hides after 6 s and re-appears only for a new item.
  - **Avisos:** the existing toasts.
  - Every widget has a configurable position, scale and opacity, and can be turned off. Remove the old fixed panel.
  - Renderer component tests.
- [ ] **A3 · Manual jungle timers** (OFF by default; only your own side's camps + both Scuttle crabs):
  - A small widget with buttons for your side's Gromp, Azul, Lobos, Aviar (Raptors), Rojo, Krugs and the Escarabajos top/bot. Clicking one starts a countdown; there are optional global hotkeys (configurable, off by default).
  - **Respawn times:** research the current patch (16.x) with web sources and record them in `consejos/jungla.ts` with the source and date. Initial spawn times are shown from game start.
  - Your side comes from the team (ORDER = blue side).
  - Voice: «<campamento> en 30 segundos» if enabled.
  - Tests: the timer math and that no enemy camps exist in the list.
- [ ] **A4 · Voice:** a central queue with priorities and no overlap (max one utterance at a time, drop stale ones). Callouts:
  - objective at 60 s, at 30 s and when spawned (with the dragon type);
  - «Puedes comprar X»;
  - «Sube la Q» on level-up;
  - «Vas por debajo del objetivo de CS» once at 10:00 if below 85 %;
  - the control ward reminder;
  - the phase changes;
  - jungle timers.

  Settings: on/off, volume, voice (the Spanish voices available), and toggles per TipoVoz. Tests for the queue and the triggers.
- [ ] **A5 · VistaOverlay** (main window): per-widget toggles and scale sliders, opacity, a «Mover y calibrar» button, voice settings with a «Probar voz» button, and a jungle timers toggle with an explanatory note («desactivado por defecto; marca tú cuándo se limpia cada campamento»).
- Verification: `npm test`, `tsc -p app`, `npm run build -w app`.

## Track B: loading screen (branch `v3-carga`)
**Files:** server/src/jugadores/** (new), server/src/http.ts (register the route), app/src/main/orquestador/carga.ts (new), app/src/main/lcu/** (read-only additions), app/src/renderer/overlay/carga/** (new components only), es.json (keys under `carga.*` only), app/src/shared/tiposApp.ts (only the JugadorCarga/EstadoCarga contract above, added verbatim).

- [ ] **B1 · Server:** `POST /api/partida/jugadores`
  - **Request:** body `{ region: 'EUW'|'LAN'|'LAS', jugadores: { puuid: string, campeonId: number, rol: Rol|null, equipo }[] }` (max 10).
  - **Lookups per player:**
    - league-v4 entries by puuid → the RANKED_SOLO_5x5 rank;
    - champion-mastery-v4 by puuid and champion;
    - our build DB → the campeón+rol winrate.
  - **Cache:** 10 min per puuid and champion.
  - **Rate limit:** per IP, 6 requests/min.
  - **Errors:** a 404 from Riot → null fields; never fail the whole response.
  - **Labels (`etiquetas`, neutral/positive only):**
    - mastery ≥ 100k → «Especialista en <campeón>»;
    - mastery level ≤ 2 or 0 points → «Poca experiencia con este campeón»;
    - winrate ≥ 55 % with ≥ 20 games → «Racha positiva esta temporada»;
    - a champion strength/weakness line from a small static table `server/src/jugadores/rasgos.ts` (e.g. «Fuerte al principio», «Escala a final de partida»), keyed by Data Dragon tags (Assassin, Tank, …) plus the champion info difficulty.
  - **NEVER** negative or shaming text; a test asserts the list contains no forbidden words.
  - **Returns** `EstadoCarga.jugadores` (without version).
  - **Tests** with a fake Riot client.
- [ ] **B2 · App:**
  - When gameflow becomes `InProgress` (or `GameStart`), read `GET /lol-gameflow/v1/session` (`gameData.teamOne` / `teamTwo`, with puuid, championId and selectedPosition) and the player's region (`/riotclient/region-locale` → map to EUW/LAN/LAS).
  - Call the server, then send `overlay:modo 'carga'` + `overlay:carga`.
  - Switch to 'partida' at the first valid Live Client estado, or after 3 min.
  - Tests with fakes.
- [ ] **B3 · Renderer:** a loading-screen layout of two rows of 5 cards (allies on the bottom, enemies on top, like the game), each with the champion icon, Riot ID, rank badge, mastery, the champion winrate in its role and the labels. The design is translucent and matches the new overlay. Component tests.
- Verification: as Track A, plus the server tests.

## Track C: polish and data (branch `v3-acabado`)
**Files:** app/src/renderer/principal/** (except VistaOverlay.tsx), app/src/main/ventanas/principal.ts if needed, server/src/agregador.ts (+ tests), es.json (keys under `bienvenida.*`, `novedades.*`, `datos.*` only), `CHANGELOG.md` (new), app/package.json version.

- [ ] **C1 · Builds:**
  - `MIN_PARTIDAS_PUBLICAR` 20 → 10.
  - Add `Build.datosLimitados: boolean` (partidas < 30); the app shows the badge «Datos limitados».
  - Tests.
- [ ] **C2 · First-run onboarding:** a 4-step modal (bienvenida → «Pon LoL en modo Sin bordes» → «Cómo se importa» → «El overlay y la tecla Ctrl+Mayús+O»), stored as `ajustes.bienvenidaVista`. Tests.
- [ ] **C3 · Novedades:**
  - Write a CHANGELOG with real history: 1.0 (v1), 2.0 (interface, options, assistant), 2.1 (todo gratis), 3.0 (this).
  - Add a «Novedades» view in the sidebar, rendered from a JSON generated from CHANGELOG at build time, or a TS module.
  - After an update, show «Novedades de la versión X» once.
  - Tests.
- [ ] **C4 · App version** 3.0.0.

## Phase 2 (after merging A, B and C): integration, web, video
- [ ] Merge the branches, resolve es.json/tiposApp conflicts, and run the full verification.
- [ ] Regenerate the screenshots: new overlay widgets over a blurred splash, the loading screen, Campeón with options, onboarding. Extend `tools/capturas.ts`.
- [ ] Web: update the sections and FAQ with the 3.0 features (overlay widgets, loading screen, voice, jungle timers as manual and optional, CS), a «Novedades» page from the CHANGELOG, and the new screenshots.
- [ ] Video (`video/`):
  - a 9:16 1080×1920 MP4, 30–40 s, 30 fps, no music;
  - big Spanish captions;
  - scenes:
    1. hook «¿Juegas LoL? Mira esto»;
    2. the loading screen with player info;
    3. the champion build with options and «Importar»;
    4. the in-game top objective bar plus the skill arrow plus CS;
    5. voice callout captions;
    6. «Gratis · Solo API oficiales de Riot»;
    7. CTA «www.coachlolia.com».
  - Built from the real screenshots with HTML/CSS animations rendered frame by frame (Electron offscreen or headless Chromium) and assembled with ffmpeg (installed: Gyan.FFmpeg 9.0.2 via winget).
  - Also export a 1080×1080 cut for Instagram and a cover thumbnail.
  - Include the Riot legal line in the last frame.
- [ ] Release 3.0.0: server deploy, web deploy, installer + GitHub release, push notification to the owner.

## Phase 3 (after 3.0 is published): multiple languages (approved by the owner on 2026-10-19)
- **Languages:** Spanish (es, current), English (en), Brazilian Portuguese (pt-BR), French (fr) and German (de).
- **App:**
  - one i18n file per language (en.json, pt-BR.json, fr.json, de.json) with the same keys as es.json, plus a test that every key exists in every file;
  - a language selector in Ajustes; the default comes from the system language, falling back to Spanish;
  - Data Dragon in the matching locale (en_US, pt_BR, fr_FR, de_DE, es_MX);
  - voice in the language you pick.
- **AI assistant:** answers in the user's language; the knowledge base stays the same.
- **Web:** Astro i18n with routes /, /en/, /pt-br/, /fr/, /de/, a language selector and `hreflang` tags. The legal pages are translated too.
- **Server:** add the BR1 and NA1 regions to the collector, since they share the americas routing; the build data is language-independent.
- **Quality:** natural translations reviewed by a native-level pass (not literal), with LoL terminology as each language's community uses it.

## Track D: «Campeones» section (owner request, 2026-10-19), branch `v3-campeones` cut from the final `v3-acabado`
- **Server:**
  - `GET /campeones` → `{ parche, campeones: { campeon, rol, partidas, tasaVictoria, uso /* share of the role's games in the patch, 0..1 */, tier: 'S'|'A'|'B'|'C', datosLimitados }[] }`. It reads the stored builds (top-level global aggregation) and is cached in memory until the builds are recomputed.
  - **Tier formula:** the score is `z(tasaVictoria) * 0.7 + z(uso) * 0.3` within the role (z-score). S ≥ +1.0, A ≥ +0.25, B ≥ −0.5, otherwise C. Entries with partidas < 30 are always B or worse and marked datosLimitados.
  - Tests.
- **App:**
  - A new sidebar entry «Campeones» with a grid view (Data Dragon icons and Spanish names, a search box, role filter tabs, sorting by tier/WR/uso/partidas). Every champion appears; the ones without data are shown greyed out with «Sin datos todavía».
  - Clicking a champion+role opens a detail view that reuses the Campeón components (options, runes, spells, items, skills) in read-only mode: no «Importar» button unless in champ select.
  - Loading and error states. It uses the main process to fetch, via IPC `coach:campeones` and `coach:build-de(campeon, rol)` with validated arguments.
  - Component and IPC tests.
- es.json keys under `campeones.*`.

## Track E: game modes ARAM, ARAM Caos (Mayhem) and Arena (owner request, 2026-10-19), after Track D
- **Research first** (web sources, cite them in code comments):
  - the current queue IDs for ARAM (450), ARAM Mayhem/«Caos» (verify) and Arena (1700/1710, verify);
  - the Live Client Data `gameMode` values;
  - where the augment names and icons live (e.g. CommunityDragon cherry-augments / Mayhem augments JSON, in Spanish if available);
  - the Match-v5 fields (playerAugment1..6, placement, playerSubteamId).
- **Server:**
  - Split the per-region match budget across modes (Ranked 60 %, ARAM 15 %, Mayhem 10 %, Arena 15 %).
  - Store `modo` per participation.
  - **Aggregation per mode:**
    - ranked: as now, by role;
    - ARAM and Mayhem: by champion only (rol = null), with builds, runes, spells and skills, plus augments for Mayhem;
    - Arena: by champion, with items and augments ranked by pick rate and by average placement, and the stats as average placement, top 4 % and win (1st) %.
  - **API:**
    - `GET /builds/:campeon/:rol?modo=` (modo default 'clasificatoria'; rol ignored for non-ranked);
    - `GET /campeones?modo=`.
  - Tests per mode.
- **App:**
  - Detect the mode from the LCU champ select queueId / gameflow session and from the Live Client gameMode.
  - The Campeón view and the champ-select flow show the mode's build, with augments shown with their icons for Mayhem and Arena.
  - The overlay is mode-aware: in ARAM/Mayhem/Arena it hides the objective bar, CS and jungle; it keeps purchase, the skill arrow and the relevant voice callouts.
  - The «Campeones» section gets a mode selector.
  - Tests.
- **Web:** mention the supported modes.

### Owner decision (2026-10-19) on Phase 3
The multilingual work covers the **app only** (es, en, pt-BR, fr, de, plus the assistant and voice). The **website stays in Spanish** for now; translating it is postponed. Focus is on the application.
