// Website copy in English. Same structure as es.ts (a test checks the keys match).
import { MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from '../../lib/cifras.ts';
import type { Textos } from './es.ts';

const CORREO = 'support@coachlolia.com';

export const en: Textos = {
  meta: {
    lema: 'Your League of Legends coach, in real time and in your language.',
    paginas: {
      inicio: {
        titulo: 'Coach LoL IA: free LoL builds, tier list and in-game overlay',
        descripcion:
          'Free League of Legends app: Emerald+ builds, one-click rune import, a tier list and an in-game coach with overlay and voice. Official Riot APIs only.',
      },
      descargar: {
        titulo: 'Download Coach LoL IA for free on Windows 10 and 11',
        descripcion:
          'Download Coach LoL IA for free on Windows 10 and 11: LoL builds, rune import and an overlay with voice alerts. Official installer with automatic updates.',
      },
      apoyar: {
        titulo: 'Support Coach LoL IA, the free League of Legends app',
        descripcion:
          'Coach LoL IA is free for everyone, with no ads inside the app. Learn how the project is funded and how you can support it with a voluntary donation.',
      },
      novedades: {
        titulo: 'Coach LoL IA changelog: every version and what it adds',
        descripcion:
          'Every Coach LoL IA release, newest first: widget overlay, loading screen, champion tier list, ARAM and Arena modes, selectable runes and much more.',
      },
      builds: {
        titulo: 'LoL builds and tier list from Emerald+ games | Coach LoL IA',
        descripcion:
          'How Coach LoL IA builds its League of Legends builds and tier list: Emerald+ ranked games from EUW, LAN and LAS, recalculated every 6 hours.',
      },
      guias: {
        titulo: 'LoL guides: safe overlays, tier lists and runes | Coach LoL IA',
        descripcion:
          'Practical League of Legends guides: how to use an overlay within Riot rules, how to read a tier list and how to import runes automatically.',
      },
      guiaOverlay: {
        titulo: 'How to use a League of Legends overlay safely | Coach LoL IA',
        descripcion:
          'What Riot allows a League of Legends overlay to do, the red flags that show an app crosses the line, and how to set one up in borderless mode.',
      },
      guiaTierList: {
        titulo: 'What is a LoL tier list and how to read it | Coach LoL IA',
        descripcion:
          'What S, A, B and C tiers mean in League of Legends, how a tier list is calculated from win rate and pick rate, and why sample size matters so much.',
      },
      guiaRunas: {
        titulo: 'How to import runes automatically in LoL | Coach LoL IA',
        descripcion:
          'Step by step: import runes, summoner spells and item sets in League of Legends with one click from champion select, without losing your rune pages.',
      },
      privacidad: {
        titulo: 'Privacy policy · Coach LoL IA',
        descripcion: 'What data Coach LoL IA processes, why, on what legal basis, and what your rights are over it.',
      },
      terminos: {
        titulo: 'Terms of use · Coach LoL IA',
        descripcion: 'Terms of use for Coach LoL IA, a free League of Legends app that only uses official Riot APIs.',
      },
      cookies: {
        titulo: 'Cookie policy · Coach LoL IA',
        descripcion: 'Which cookies the Coach LoL IA website uses, when ads are loaded and how to change your choice at any time.',
      },
      noEncontrada: {
        titulo: 'Page not found · Coach LoL IA',
        descripcion: 'The page you are looking for does not exist or has moved.',
      },
    },
    ogAlt: 'Coach LoL IA: builds, tier list and an in-game coach for League of Legends, for free.',
  },

  comun: {
    saltar: 'Skip to content',
    menuAbrir: 'Open menu',
    menuCerrar: 'Close menu',
    inicioAria: 'Coach LoL IA, home',
    navAria: 'Main',
    idioma: 'Language',
    idiomaAria: 'Change language',
    nav: {
      queHace: 'Features',
      enAccion: 'In action',
      builds: 'Builds & tier list',
      guias: 'Guides',
      faq: 'FAQ',
      novedades: 'Changelog',
    },
    descargar: 'Download',
    apoyar: 'Support',
    descargarWindows: 'Download for Windows',
    apoyaProyecto: 'Support the project',
    capturaReal: 'Real screenshot',
    publicidad: 'Advertisement',
    migas: 'Breadcrumb',
    inicio: 'Home',
    ayudaTitulo: 'Need help?',
    ayudaTexto: 'Write to us and we will get back to you as soon as we can.',
    discord: 'Join the Discord community',
    soporteAria: 'Support',
    leerGuia: 'Read the guide',
    actualizado: 'Updated on',
  },

  pie: {
    descripcion: 'Real-time coach for League of Legends, in 5 languages. Version',
    soporte: 'Support',
    producto: 'Product',
    proyecto: 'Project',
    legal: 'Legal',
    recursos: 'Resources',
    idiomas: 'Languages',
    enlaces: {
      descargar: 'Download',
      novedades: 'Changelog',
      apoyar: 'Support the project',
      hojaDeRuta: 'Roadmap',
      arquitectura: 'Architecture',
      seguridad: 'Safety and Vanguard',
      calidad: 'Quality',
      github: 'Source on GitHub',
      discord: 'Discord community',
      builds: 'Builds & tier list',
      guias: 'Guides',
      privacidad: 'Privacy',
      terminos: 'Terms',
      cookies: 'Cookies',
    },
    avisoRiot:
      "Coach LoL IA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.",
    marca:
      'League of Legends is a registered trademark of Riot Games, Inc. League of Legends images © Riot Games, Inc.',
  },

  cookies: {
    region: 'Cookie consent',
    titulo: 'Cookies and advertising',
    texto:
      'This website shows Google AdSense ads, which use third-party cookies. They only load if you accept them. You can change your mind at any time on the',
    enlace: 'cookies page',
    rechazar: 'Reject',
    aceptar: 'Accept',
  },

  asistente: {
    boton: 'AI assistant',
    titulo: 'Coach LoL IA AI assistant',
    cerrar: 'Close the assistant',
    intro: 'Ask me how to install the app, import builds or use the overlay.',
    conversacion: 'Conversation',
    pregunta: 'Your question',
    placeholder: 'Type your question…',
    enviar: 'Send',
    nota: `AI-generated answers; they may contain mistakes. If you have a problem, write to ${CORREO}.`,
    escribiendo: 'Typing…',
    tu: 'You: ',
    asistente: 'Assistant: ',
    errores: {
      noDisponible: `The assistant is not available yet. In the meantime, write to us at ${CORREO}.`,
      limite: 'You have asked a lot of questions in a row. Please wait a little and try again.',
      fallo: 'The assistant could not answer right now. Please try again in a few minutes.',
      noValido: 'Your message could not be sent. Please write a question of up to 1000 characters.',
      sinConexion: 'Could not reach the server. Check your connection and try again.',
    },
  },

  diagrama: {
    aria: 'Architecture diagram (scroll horizontally on narrow screens)',
    titulo: 'Coach LoL IA architecture',
    desc: 'On the player’s PC, the app (Electron) connects to the League of Legends client through the LCU API and to the game through the Live Client Data API on 127.0.0.1:2999. In the cloud, the build server (Fastify and SQLite) collects games from the Riot API, aggregates them every 6 hours and serves builds to the app over HTTPS. The app downloads names and icons from Data Dragon. The website (Astro, GitHub Pages) and the app’s Help view ask the server’s AI assistant, which generates answers with Anthropic. The app only uses official Riot APIs and never touches the game process.',
    pc: 'PLAYER’S PC · WINDOWS 10/11',
    nube: 'CLOUD',
    cliente: 'LoL client',
    clienteSub: 'lobby and champ select',
    partida: 'Game in progress',
    partidaSub: 'the game (untouched)',
    vanguard1: 'no memory reading or injection;',
    vanguard2: 'no screenshots or keystrokes',
    procesoPrincipal: 'MAIN PROCESS (Node.js)',
    conectorLcu: 'LCU connector',
    conectorPartida: 'Game connector · every 1 s',
    motor: 'Advice engine (rules)',
    clienteBuilds: 'Build client + cache',
    asistenteSoporte: 'Support assistant',
    datosEstaticos: 'Static data',
    ventana: 'Main window (React)',
    ventanaSub: 'build, import, settings',
    overlay: 'Overlay (React)',
    overlaySub: 'transparent, click-through, voice',
    servidor: 'Server · Fastify + SQLite',
    recolector: 'Collector',
    recolectorSub: 'Solo/Duo, Emerald+, EUW · LAN · LAS',
    agregador: 'Aggregator · every 6 h',
    agregadorSub: `≥ 200 games per patch · minimum ${MIN_PARTIDAS_BUILD}`,
    api: 'Public API',
    asistenteIa: 'AI assistant',
    asistenteIaSub: 'POST /api/asistente · rate limited',
    apiRiot: 'Riot API',
    modeloIa: 'AI assistant model',
    dataDragonSub: 'names and icons',
    estaWeb: 'This website',
    claves1: 'RIOT_API_KEY and ANTHROPIC_API_KEY only exist as',
    claves2: 'environment variables on the server.',
    ayuda: 'help',
    parche: 'patch',
    partidas: 'games',
    pie: 'Architecture diagram. Blue arrows are game and build data; gold arrows are questions to the AI assistant.',
    respuestas: 'answers',
  },

  inicio: {
    etiquetaVersion: 'New version',
    hero: {
      desc: 'The most popular builds among Emerald+ players, with their stats, in champion select, imported into the client in one click, a loading screen with both teams and a coach that keeps you posted during the game with a widget overlay and voice alerts. Using official Riot APIs only.',
      meta: 'Free · Windows 10/11 · Official Riot APIs only · Source on',
      capturaAlt:
        'Screenshot of Coach LoL IA’s Champion view: Ahri in the Mid role with her win rate, 33 games and patch 16.20 data, and the Import button; Domination and Sorcery runes, Flash and Ignite, starting items, core items and boots, and the skill order table with Q, W, E priority.',
      capturaPie: 'Champion view with real data from the build server.',
    },
    cifras: [
      ['Regions', 'EUW · LAN · LAS'],
      ['Games analyzed', 'Emerald+'],
      ['Build refresh', 'every 6 h'],
    ],
    cifraPruebas: 'Automated tests',

    enAccion: {
      antetitulo: 'In action',
      titulo: 'See it in action',
      intro:
        'Real clips: a Zed jungle game with the overlay on, and a tour of the app. The videos have no sound and only load when you scroll to them.',
      videos: {
        partida: {
          titulo: 'The coach in a real game',
          texto:
            'Objective timers, your CS and KDA live, and the arrow that shows which ability to level. Recorded in a real Zed jungle game.',
          etiqueta:
            'Video of a real League of Legends game with Zed in the jungle: the Coach LoL IA overlay shows objective timers at the top, Dragon at 0:38, the CS and KDA widget turning green and the golden arrow on level-up.',
        },
        tour: {
          titulo: 'A tour of Coach LoL IA 3.0',
          texto:
            'Loading screen (with sample players), Emerald+ build, one-click import, alerts, jungle timers, tier list and the ARAM and Arena modes.',
          etiqueta:
            'Coach LoL IA 3.0 promo video: loading screen with sample data, Ahri’s Mid build, the Import button, overlay with objectives, a purchase alert, CS and KDA, timers on a schematic minimap and the tier list by role and mode.',
        },
      },
      textosVideo: 'On-screen text is in Spanish; English subtitles are on by default.',
      reproducir: 'Play',
      fotos: [
        {
          nombre: 'partida-objetivos',
          alt: 'Screenshot of a real League of Legends game with Zed in the jungle at 4:22: Coach LoL IA’s objective bar at the top with Dragon at 0:38, and on the right the CS widget (20, at 4.6 per minute) and KDA 0/0/1.',
          pie: 'Objective bar and CS in a real game (minute 4).',
        },
        {
          nombre: 'partida-dragon',
          alt: 'Screenshot of a real League of Legends game: Zed right after the “Enemy slain” banner, with Coach LoL IA’s objective bar at the top (Dragon at 0:20) and the CS widget, already green at 6.4 per minute, in the top-right corner.',
          pie: 'The CS widget turns green once you beat your target.',
        },
      ],
    },

    queHace: {
      antetitulo: 'Features',
      titulo: 'Everything you need, from champ select to victory',
      intro:
        'Coach LoL IA is with you at the two moments that matter most: champion select, where it shows you the most popular options with their stats so you can choose, and the game itself, where it reminds you of what matters without you ever leaving the game.',
      funciones: [
        {
          icono: 'capas',
          titulo: 'Builds by champion and role',
          texto:
            'Up to 3 item options and 3 rune pages among the most played, each with its pick and win rates: you choose. Runes, summoner spells, starting items, 3-item core, boots, situational items and skill order, with their win rate and the number of games behind them. Builds are published from 10 games; those with few games carry a “Limited data” badge.',
        },
        {
          icono: 'grafico',
          titulo: 'Champions and tier list',
          texto:
            'The Champions section ranks every champion by role into S, A, B and C tiers based on win rate and pick rate, with search and the full build for each one.',
        },
        {
          icono: 'usuario',
          titulo: 'Loading screen',
          texto:
            'While the game loads, the overlay shows all ten players full screen, with your own card highlighted: official rank, champion mastery and the champion’s win rate in that role, with positive or neutral tags only. Space hides it.',
        },
        {
          icono: 'descarga',
          titulo: 'One-click import',
          texto:
            'Creates the “Coach: <Champion> <Role>” rune page, picks your summoner spells and adds an item set to the shop. It only touches pages with the “Coach:” prefix; if you have no free page left, it replaces one of yours only when you click “Import” and confirm it.',
        },
        {
          icono: 'brujula',
          titulo: 'Automatic role',
          texto:
            'Uses the role the client assigns you. If there is none, it picks the most played role for that champion, and you can change it with the role selector.',
        },
        {
          icono: 'monitor',
          titulo: 'Widget overlay',
          texto:
            'Objective bar at the top (with the next Dragon type), an arrow over the ability to level, your CS and KDA, the purchase alert and notifications. Every widget can be moved, scaled and turned off on its own.',
        },
        {
          icono: 'voz',
          titulo: 'Much more voice',
          texto:
            'A natural, offline neural voice in all 5 languages, with 460 lines per language plus variants: objectives, purchases, CS, vision, fights, game phases and jungle, one at a time with the most urgent first. You pick the detail level and which categories to hear.',
        },
        {
          icono: 'reloj',
          titulo: 'Jungle timers',
          texto:
            'Optional and off by default: you mark when you clear a camp on your side or a Scuttle Crab, and the app counts down to its respawn, also on top of the minimap.',
        },
        {
          icono: 'diana',
          titulo: 'ARAM, ARAM: Mayhem and Arena',
          texto:
            'Each mode has its own builds and tier list (with the most picked augments in ARAM: Mayhem and Arena), plus an overlay that only shows what makes sense in each mode.',
        },
        {
          icono: 'nube',
          titulo: 'Works offline',
          texto:
            'The latest builds are cached. If the server does not respond, the app uses the saved copy and tells you: “Offline data (patch X)”.',
        },
        {
          icono: 'refrescar',
          titulo: 'Updates itself',
          texto:
            'When you open it, the app downloads the latest version from GitHub Releases, installs it and reopens; never in the middle of a game, it waits until it ends. Data Dragon and the builds follow the current patch.',
        },
        {
          icono: 'idioma',
          titulo: 'In 5 languages',
          texto:
            'The app, overlay, voice and assistant in Spanish, English, Portuguese (Brazil), French and German. Choose the language in Settings; by default, your Windows language. This website too, in all five.',
        },
      ],
      vitrina: {
        titulo: 'You decide what the coach tells you',
        texto:
          'In the Overlay view you get a live preview of the widgets, choose which ones you want, their size and position, and decide what the voice tells you: the detail level (Basic, Normal or Full) and each category on its own.',
        lista: [
          'Preview of the widgets exactly as they will look in game',
          '“Move and calibrate” to place each widget where it covers nothing',
          'Global opacity, plus a size and an on/off switch for every widget',
          'Natural or Windows voice, volume, detail level and categories, with “Test voice”',
        ],
        alt: 'Screenshot of Coach LoL IA’s Overlay view: preview with the objective bar, CS and KDA, the “Level 6: level up R” alert, the arrow over R and the purchase alert; on the right, the “Move and calibrate” button, opacity and the switches and sizes of the Objectives, Ability arrow and Performance (CS and KDA) widgets.',
        pie: 'Overlay view: widgets, position, size and voice.',
      },
    },

    novedades3: {
      antetitulo: 'What’s new in 3.0',
      titulo: 'Before, during and between games',
      intro:
        'Version 3.0 adds the loading screen, the Champions section with its tier list, the ARAM, ARAM: Mayhem and Arena modes, and jungle timers. 3.0.1 and 3.0.2 add selectable runes, the “Shadow” theme and an overlay that adapts to 2K and 4K screens. All of it built on data the game or the official Riot API already provides. [See the full changelog](@novedades).',
      carga: {
        titulo: 'Loading screen',
        texto:
          'While the game loads, the overlay lays out all ten players just like the game: enemies on top, your team below. For each one you see their official Solo/Duo rank, their mastery with their champion and that champion’s win rate in its role.',
        lista: [
          'Positive or neutral tags only: “Ahri specialist”, “Scales into late game”',
          'No made-up MMR and no negative labels for anyone',
          'Hides itself as soon as the game starts',
        ],
        alt: 'Screenshot of the loading screen in the Coach LoL IA overlay: ten player cards with sample names, five enemies on top and five allies below, each with the champion, role, rank (Gold to Diamond, or Unranked), wins and losses, mastery, the champion’s win rate and tags such as “Darius specialist”, “On a winning streak this season” or “Protects the team”.',
        pie: 'Loading screen with sample players.',
      },
      campeones: {
        titulo: 'Champions and tier list',
        texto:
          'Every champion by role, with its tier (S, A, B or C) based on win rate and pick rate, the number of games and the full build in one click. A selector switches between Ranked, ARAM, ARAM: Mayhem and Arena.',
        lista: [
          'Search, role filter and sorting by tier, win rate, pick rate or games',
          '“Limited data” warning on champions with fewer than 30 games',
          'In Arena, average placement and top 4 rate',
        ],
        alt: 'Screenshot of Coach LoL IA’s Champions section: Ranked tier list with patch 16.20 data, the mode selector (Ranked, ARAM, ARAM: Mayhem, Arena), search, role filters and a table with champion, role, tier, win rate, pick rate and games; Yunara and Viego at the top in S tier, and further down B-tier champions with the limited data warning.',
        pie: 'Champions section: tier list by mode and role.',
        enlace: 'How builds and the tier list are calculated',
      },
      jungla: {
        titulo: 'Jungle timers, your way',
        texto:
          'Optional and off by default. When you clear a camp on your side or a Scuttle Crab, you mark it with a click or your own key, and the app counts down to its respawn on top of the minimap, just like the game’s own timers. Alt+Shift+L shows or hides them.',
        lista: [
          'Only your jungle and both Scuttle Crabs: never the enemy camps',
          'Gold for the last 30 seconds and a check mark once the camp is up',
          '“Gromp in 30 seconds” by voice, if you want it',
        ],
        alt: 'Close-up of Coach LoL IA’s jungle timers on a schematic blue-side minimap: countdowns of 15 s and 1:40 on two camps, 1:08 and 1:13 on two others, and a check mark on the ones that have already respawned.',
        pie: 'Timers on the minimap (schematic map).',
      },
    },

    comoFunciona: {
      antetitulo: 'How it works',
      titulo: 'From champion select to the game',
      intro: 'No setup needed: open the app before or after the client and it handles the rest.',
      pasos: [
        {
          titulo: 'Open the app and the LoL client',
          texto:
            'Coach LoL IA finds the client by reading its lockfile (local port and password). Until it finds it, it shows “Waiting for the League of Legends client…” and tries again every 3 seconds.',
          detalle: 'LCU API · WebSocket',
        },
        {
          titulo: 'Pick your champion',
          texto:
            'The client reports your champion and role over WebSocket. The app requests the build from the server and shows it in under 2 seconds. “Import” (or automatic import) applies the runes, summoner spells and items.',
          detalle: 'Champion select',
        },
        {
          titulo: 'Play with the coach',
          texto:
            'While the game loads, the overlay shows the loading screen with both teams. In game, the app polls the Live Client Data API at https://127.0.0.1:2999 every second. The advice engine compares your state with the build and shows objectives, the ability to level, your CS and KDA, the next purchase and alerts. Ctrl+Shift+O hides or shows it.',
          detalle: 'Live Client Data API',
        },
        {
          titulo: 'End of the game',
          texto:
            'When the game ends, the overlay hides and the app stops polling port 2999. The next champion select starts the cycle again.',
          detalle: 'No leftover processes',
        },
      ],
      overlay: {
        alt: 'Screenshot of the Coach LoL IA overlay over Jinx’s artwork: at the top, the objective bar (Voidgrubs up, Dragon at 0:38, Rift Herald at 5:38 and Baron at 10:38); on the right, CS (61, at 6.5 per minute against a target of 8); on the left, the “Level 6: level up R” alert; at the bottom, an arrow over R and the alert “You can buy Runaan’s Hurricane”.',
        pie: 'In-game overlay, with every widget in place.',
        titulo: 'What the coach tells you in game',
        avisos: [
          ['Purchase', '“You can buy Runaan’s Hurricane”'],
          ['Abilities', '“Level 6: level up R”'],
          ['Objectives', 'At 1 minute, at 30 seconds and on spawn, with the Dragon type'],
          ['CS', '“You are below your CS target” (at minutes 5, 10, 15 and 20)'],
          ['Vision', '“Buy a Control Ward”'],
          ['Jungle', '“Gromp in 30 seconds” (only if you use the timers)'],
          ['Enemy jungler', '“The enemy jungler just showed up bot (kill)”'],
          ['Game phase', '“Mid game: group with your team for objectives”'],
        ],
        nota: 'Each widget has its place: objectives at the top, the arrow over your ability bar and the rest wherever you like. The voice says one line at a time, most urgent first, and the same alert is not repeated until its condition changes. Your CS is compared with a benchmark for your role, with no red colors or negative messages.',
      },
      junglaEnemiga: {
        titulo: 'The enemy jungler, only with what the game already shows',
        nota1:
          'When the enemy jungler takes part in a kill, the game’s kill feed shows it and the app tells you: “The enemy jungler just showed up bot (kill)”. This is not tracking: the app does not know their position or cooldowns, and the alert is always about that kill.',
        nota2:
          'If you want, you can turn on an estimate of their usual pathing (off by default): which side that champion usually starts on and which lane they usually visit first, based on our games. It is what they usually do, not what they are doing in your game.',
        alt: 'Screenshot of the Coach LoL IA overlay with the alert “The enemy jungler just showed up bot (kill)”, next to the objective bar, CS, the arrow over R, the purchase alert and jungle timers on a schematic minimap.',
        pie: 'Alert based on the kill feed.',
      },
    },

    arquitectura: {
      antetitulo: 'Architecture',
      titulo: 'Three pieces working together',
      intro:
        'A monorepo with the desktop app, the build server and this website. The Riot API key lives only on the server; the distributed app contains no secrets.',
      piezas: [
        {
          titulo: 'Desktop app',
          texto:
            'Electron with two React windows. The main process brings together the **LCU connector** (client), the **game connector** (port 2999), the **advice engine** (a pure, deterministic function: game state + build + role → alerts), the build client with disk cache and Data Dragon data.',
        },
        {
          titulo: 'Build server',
          texto:
            'Node with Fastify and SQLite, packaged in Docker. The collector downloads games from the Riot API within its rate limits; the aggregator calculates builds every 6 hours and the public API serves them as JSON with the patch and calculation date.',
        },
        {
          titulo: 'Website and assistant',
          texto:
            'This static website (Astro) is published on GitHub Pages. Its AI assistant, like the app’s Help view, asks the server, which rate-limits usage and is the only one holding the model key.',
        },
      ],
    },

    seguridad: {
      antetitulo: 'Safety and Vanguard',
      titulo: 'Official APIs only. We never touch the game',
      intro:
        'Vanguard is Riot’s anti-cheat system and it watches the game process. Coach LoL IA is designed to stay well away from it: everything it knows comes from the interfaces Riot publishes for third-party tools.',
      si: {
        titulo: 'What it does',
        lista: [
          'Reads the client’s **lockfile** to connect to the **LCU API**, a password-protected local API.',
          'Queries the read-only **Live Client Data API** on `127.0.0.1:2999` during the game.',
          'Downloads names and icons from **Data Dragon**, Riot’s public service.',
          'Shows the overlay as a regular Windows window, transparent and click-through.',
          'Registers the hotkey with Electron’s global shortcut, without sending anything to the game.',
        ],
      },
      nunca: {
        titulo: 'What it never does',
        lista: [
          'Read or write the game’s memory.',
          'Inject code or DLLs into any process.',
          'Take screenshots to analyze them.',
          'Simulate keyboard or mouse input, or automate actions.',
          'Delete your rune pages or item sets.',
        ],
      },
      noMuestra: {
        titulo: 'What the overlay does not show',
        lista: [
          'Enemy summoner spell or ultimate timers.',
          'Enemy jungle camp timers: jungle timers are for your side only and you set them yourself.',
          'Enemy positions or any information you cannot see on screen. For the enemy jungler, it only repeats what is already in the kill feed.',
        ],
        nota: 'Before applying for Riot’s production key, every alert is reviewed against the current developer policy.',
      },
      datos:
        '**Your data:** the Riot API key lives only on the server as an environment variable. The app never sends your credentials. It requests the build for your champion and role and, for the loading screen, only the PUUID (Riot’s public identifier) of the ten players, with their champion and role; the Riot ID is not sent. With the PUUID, the server looks up rank and mastery in the official API and keeps the response in memory only, for 10 minutes at most. For the AI coach (post-game analysis and dead-moment tips) it sends the game’s stats, items and events, without your Riot ID; our AI provider processes them and they are not stored.',
      guia: 'Guide: how to use a LoL overlay safely',
    },

    datos: {
      antetitulo: 'Data',
      titulo: 'Builds from real games, recalculated every 6 h',
      intro:
        'The recommendations are not opinions: they come from recent ranked games of high-elo players, processed by our own server.',
      tuberia: [
        {
          icono: 'usuario',
          titulo: 'Collector',
          texto:
            'Uses League-v4 to find **Emerald or higher** players in **EUW, LAN and LAS**, and Match-v5 to download their **ranked Solo/Duo**, **ARAM**, **ARAM: Mayhem** and **Arena** games. It respects Riot’s limits and processes thousands of new games per region each cycle, split between modes; whatever a mode does not use goes to ranked.',
        },
        {
          icono: 'grafico',
          titulo: 'Aggregator',
          texto:
            'For each champion and role it calculates the most common rune page, summoner spells, starting items, 3-item core, boots, situational items and skill order, with their win rate and number of games. In ARAM and ARAM: Mayhem it groups by champion, and in Arena it adds the champion’s average placement and the most picked augments and items, with their pick rate only. It also calculates each champion’s tier in its role.',
        },
        {
          icono: 'reloj',
          titulo: 'Publishing',
          texto:
            'The cycle repeats **every 6 h**. The API serves each build with its patch and calculation date, and the app caches it so it works offline.',
        },
      ],
      umbrales: [
        {
          cifra: '200',
          texto:
            '**games on the current patch** to use current-patch data only. With fewer than 200 games, they are combined with the previous patch and the build says so (`mezclaParches`).',
        },
        {
          cifra: String(MIN_PARTIDAS_BUILD),
          texto: `**${MIN_PARTIDAS_BUILD} games in total** at minimum to publish a build. From ${MIN_PARTIDAS_BUILD} to ${PARTIDAS_DATOS_LIMITADOS - 1} games it carries the **“Limited data”** badge, and below ${MIN_PARTIDAS_BUILD} the app shows “Build not available” instead of making one up.`,
        },
        {
          cifra: '6 h',
          texto:
            '**between updates.** When a new patch comes out, the server and Data Dragon catch up on their own and the app shows “Patch X.Y data”.',
        },
      ],
    },

    tecnologias: {
      antetitulo: 'Technology',
      titulo: 'A modern stack, typed end to end',
      intro:
        'We ruled out Overwolf (it forces you to install its platform) and Tauri (its transparent click-through overlay is less mature on Windows). Electron gives the control the overlay needs with a single TypeScript codebase.',
      lista: [
        ['Electron', 'Desktop app: main window and transparent click-through overlay.'],
        ['React 19', 'UI for both windows, with custom CSS based on design tokens.'],
        ['TypeScript', 'All the code (app, server and shared types) with strict checking.'],
        ['Node.js 24', 'The app’s main process and the build server.'],
        ['SQLite', 'Server database (better-sqlite3): games and builds.'],
        ['Fastify', 'Server HTTP API: builds, roles and the AI assistant.'],
        ['Vitest', 'Automated tests for the app, server and shared code.'],
        ['Astro', 'This website: static, no client-side framework, published on GitHub Pages.'],
        ['electron-builder', 'Windows installer and automatic updates from GitHub Releases.'],
        ['Docker', 'Server image ready to deploy on any host.'],
        ['GitHub Actions', 'Continuous integration and website deployment.'],
      ],
    },

    calidad: {
      antetitulo: 'Quality',
      titulo: 'Tested before every change',
      cifra: 'automated Vitest tests across the app, server and shared code, run on every change.',
      tarjetas: [
        {
          icono: 'prueba',
          titulo: 'Tests with real data',
          texto:
            'The advice engine and the aggregator are tested with recorded games. A **game simulator** replays a real game as a fake Live Client Data API, and a **simulated LCU** lets us test champion select and import without opening LoL.',
        },
        {
          icono: 'ramas',
          titulo: 'Continuous integration',
          texto:
            'GitHub Actions type-checks every package and runs all tests on Windows on every push. It also builds the server’s Docker image and checks that SQLite loads inside it.',
        },
        {
          icono: 'revisar',
          titulo: 'Task-by-task review',
          texto:
            'Every version starts from a specification and a plan split into small tasks. Each task follows TDD (a failing test first, then the code) and passes a spec review and a quality review before it is merged.',
        },
        {
          icono: 'rayo',
          titulo: 'Real in-game testing',
          texto:
            'Every version is tested in a real practice game before release. This website has its own tests too: they build the site and check the generated HTML.',
        },
      ],
    },

    planes: {
      antetitulo: 'Free',
      titulo: 'Free for everyone',
      intro:
        'Coach LoL IA is free and everything is included. No paid plans, trials or keys: everyone gets the same app.',
      incluido: {
        titulo: 'Everything included',
        lista: [
          'Emerald+ builds by champion and role',
          'Champions section with tier list',
          'ARAM, ARAM: Mayhem and Arena modes, with augments',
          'Runes, summoner spells, items and skill order',
          'One-click import into the client',
          'Loading screen with both teams',
          'In-game coach: widget overlay, voice and jungle timers',
          'AI support assistant',
        ],
      },
      sinAnuncios: {
        titulo: 'No ads inside the app',
        texto:
          'The app has no ads or banners. The project is funded by **ads on the website** (only if you accept advertising cookies) and **voluntary donations**.',
      },
      apoya: {
        titulo: 'Support the project',
        texto:
          'Donations pay for the server, the build data and development. They are voluntary and give no advantages: the app is the same for everyone.',
        boton: 'How to support',
      },
    },

    hojaDeRuta: {
      antetitulo: 'Roadmap',
      titulo: 'Where we are and where we are heading',
      completada: 'Done',
      items: [
        {
          version: 'v1',
          estado: 'Done',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Emerald+ builds (EUW, LAN, LAS) from our own server',
            'One-click import of runes, summoner spells and items',
            'Overlay with alerts and optional voice',
            'Windows installer with automatic updates',
            'Game simulator and simulated LCU for testing',
          ],
        },
        {
          version: 'v2',
          estado: 'Done',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Brand-new professional UI: champion art, cards and micro-animations',
            'This product website',
            'AI support assistant on the website and in the app',
            'Everything free for everyone, no ads inside the app',
          ],
        },
        {
          version: 'v3',
          estado: 'Done',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Widget overlay: objectives, ability arrow, CS and KDA, purchases and alerts',
            'Loading screen with rank, mastery and champion win rate',
            'Manual jungle timers for your side, also on the minimap',
            'Champions section with tier list, plus ARAM, ARAM: Mayhem and Arena modes',
            'Selectable runes, “Shadow” theme and an overlay adapted to 2K and 4K',
          ],
        },
        {
          version: '3.1',
          estado: 'Available',
          clase: 'etiqueta-dorada',
          hecho: true,
          puntos: [
            'Natural, offline neural voice in 5 languages that downloads itself in the background (never during a game)',
            'Full-screen loading screen with your card highlighted: Space hides it, or choose cards only or off',
            '460 voice lines per language with variants, a detail level and per-category toggles',
          ],
        },
        {
          version: 'Later',
          estado: 'Ideas',
          clase: '',
          hecho: false,
          puntos: ['AI post-game analysis', 'User accounts and email notifications'],
        },
      ],
    },

    faq: {
      antetitulo: 'FAQ',
      titulo: 'Frequently asked questions',
      escribir: 'Write to',
      ayuda:
        'Can’t find your answer? Ask the **AI assistant**: it is behind the “AI assistant” button on this website and in the app’s “Help” view.',
      ayudaAlt:
        'Screenshot of Coach LoL IA’s Help view: the AI assistant chat with its greeting, the “Type your question…” field, the Send button and the note that answers are AI-generated.',
      preguntas: [
        {
          p: 'Can I get banned for using Coach LoL IA?',
          r: 'The app only uses the official local APIs that Riot offers to third-party tools (LCU API and Live Client Data API) and never touches the game process: no memory reading, no code injection, no screen capture and no simulated keys or clicks. On top of that, the overlay shows nothing you cannot already see on screen. Even so, Riot always has the final say on third-party tools, which is why we review every alert against their current policy.',
        },
        {
          p: 'Is it free?',
          r: 'Yes, all of it: builds, runes, import and the in-game coach (overlay and voice), for everyone and with no ads inside the app. The project is funded by ads on the website and voluntary donations.',
        },
        {
          p: 'Do I need Overwolf or any other program?',
          r: 'No. Coach LoL IA is a standalone Windows desktop app: it does not need Overwolf or any other platform. Just the League of Legends client.',
        },
        {
          p: 'Why can’t I see the overlay during the game?',
          r: 'The overlay is a Windows window on top of the game, so it only shows if LoL is in “Borderless” mode (Options → Video → Window mode). If the game is in full screen, the app warns you. During the game, Ctrl+Shift+O hides or shows it. To place each widget, open the app’s Overlay view, press “Move and calibrate”, drag it and press “Pin here” (or Esc or Ctrl+Shift+O). From that view you can also enable, scale or turn off every widget.',
        },
        {
          p: 'How do I import runes automatically?',
          r: 'In champion select, press “Import” in the app (or turn on automatic import in Settings). The app creates the “Coach: <Champion> <Role>” page, picks your summoner spells and adds the item set. We explain it step by step in the guide [How to import runes automatically](@guiaRunas).',
        },
        {
          p: 'How do the jungle timers work?',
          r: 'They are manual and off by default: you turn them on in the Overlay view. When you clear a camp on your side or a Scuttle Crab, you mark it with a click or a key of your choice, and the app counts down to its respawn, in a widget and on top of the minimap. Alt+Shift+L shows or hides them during the game. They only cover your jungle and the Scuttle Crabs, never the enemy camps: the app does not know when the enemy clears them, and Riot’s policies do not allow tracking what the enemy does outside your vision.',
        },
        {
          p: 'What does the loading screen show?',
          r: 'While the game loads, the overlay shows all ten players with their champion and role: their official Solo/Duo rank, their mastery with that champion and the champion’s win rate in that role according to our builds. It adds positive or neutral tags only, such as “Ahri specialist” or “Scales into late game”. It does not calculate its own MMR or put negative labels on anyone, and it hides as soon as the game starts. To get rank and mastery, the app only sends each player’s PUUID to the server (never their Riot ID), and the server keeps the response in memory for 10 minutes at most.',
        },
        {
          p: 'What does it tell me about the enemy jungler?',
          r: 'Only what the game already shows you. When the enemy jungler takes part in a kill, which appears in the kill feed, the app lets you know: “The enemy jungler just showed up bot (kill)”. There is also an option, off by default, with their usual pathing: an estimate from our games of which side that champion usually starts on and which lane they usually visit first. Neither one says where they are right now: the app cannot see their position or cooldowns.',
        },
        {
          p: 'Will it delete my rune pages?',
          r: 'Only if you confirm it. The app creates its own pages with the “Coach:” prefix and, if one of them exists, replaces that one. If you have no free page left and click “Import”, it asks before replacing one of yours (the selected one or the oldest; never a preset). Automatic import never deletes anything.',
        },
        {
          p: 'Where do the builds come from?',
          r: `From ranked Solo/Duo games of Emerald or higher players in EUW, LAN and LAS, which our server downloads from the official Riot API and aggregates every 6 hours. From those same players it also downloads their ARAM, ARAM: Mayhem and Arena games. Every build shows its number of games and its win rate. A build is published from ${MIN_PARTIDAS_BUILD} games; from ${MIN_PARTIDAS_BUILD} to ${PARTIDAS_DATOS_LIMITADOS - 1} it carries the “Limited data” badge, and below ${MIN_PARTIDAS_BUILD} the app says “Build not available” instead of making one up. [More about builds and the tier list](@builds).`,
        },
        {
          p: 'Which game modes are supported?',
          r: 'Ranked (by champion and role), ARAM and ARAM: Mayhem (by champion, with runes, summoner spells, items and abilities; in ARAM: Mayhem, also the most picked augments) and Arena (by champion, with the most picked augments and items and their pick rate, plus the champion’s average placement, top 4 and first place figures). Each mode has its own tier list in the Champions section. The app recognizes the mode in champion select and in game, and the overlay adapts: in ARAM and ARAM: Mayhem it removes objectives, CS and jungle and keeps KDA, the ability arrow and purchases; in Arena there is no ability arrow either.',
        },
        {
          p: 'What is the Champions tier list?',
          r: 'A section of the app with every champion by role and mode. Each one gets a tier (S, A, B or C) that combines its win rate and pick rate within the role. Champions with fewer than 30 games never go above B and are marked “Limited data”. Click a champion to see its full build. If you want to know how to read it, see the guide [What is a tier list](@guiaTierList).',
        },
        {
          p: 'Do the builds work if I play on another server?',
          r: 'Yes. Builds are calculated from EUW, LAN and LAS games, but they depend on the champion, role and patch, not on the server you play on.',
        },
        {
          p: 'Which languages is it available in?',
          r: 'The app, overlay, voice and assistant are available in Spanish, English, Portuguese (Brazil), French and German, and so is this website. By default the app uses your Windows language, and you can change it in Settings.',
        },
        {
          p: 'Will it make me climb?',
          r: 'We do not promise that. Coach LoL IA gives you information and reminders (data-backed builds, objectives, CS, purchases) so you can make your own decisions with more context. What happens in the game is up to how you play.',
        },
        {
          p: 'Do I need to create an account?',
          r: 'No. Download the app, open it alongside the League of Legends client and you are done: no accounts, keys or sign-ups.',
        },
        {
          p: 'Does the voice need an internet connection?',
          r: 'Only once: the natural voice model (about 124 MB) downloads itself from GitHub in the background, never during champ select, loading or a game. After that it works offline, on your PC. Until it finishes, the Windows voice is used.',
        },
        {
          p: 'What happens if I go offline?',
          r: 'The app uses the latest saved builds and tells you so. The in-game coach works the same, because it only needs the client and the game on your PC.',
        },
        {
          p: 'Does it work on Mac or Linux?',
          r: 'For now only on Windows 10 and 11, where the vast majority of LoL games are played. Mac and Linux are not supported in this version.',
        },
        {
          p: 'Need help?',
          r: `Write to us at ${CORREO}. If the problem is with the overlay, tell us your Windows version and whether the game is in “Borderless” mode.`,
          correo: true,
        },
        {
          p: 'Is Coach LoL IA an official Riot product?',
          r: 'No. It is an independent project that is not endorsed by Riot Games.',
        },
      ],
    },

    cta: {
      titulo: 'Your next game, with a coach',
      texto: 'Download Coach LoL IA for free and try the builds in your next champion select.',
    },
  },

  descargar: {
    antetitulo: 'Download',
    h1: 'Download Coach LoL IA for free on Windows',
    intro:
      'Free, in 5 languages and with automatic updates. The installer is published on GitHub Releases along with the notes for every version.',
    ultima: 'Latest version:',
    archivo: 'Download the file',
    archivoFin: 'and run it.',
    queTrae: 'What’s new in',
    requisitosTitulo: 'Requirements',
    requisitos: [
      ['System', '64-bit Windows 10 or 11.'],
      ['Game', 'League of Legends installed (Riot client).'],
      ['Overlay', 'The game in “Borderless” mode (Options → Video → Window mode).'],
      ['Connection', 'Internet to download builds; offline, it uses the latest saved ones.'],
    ],
    instalacionTitulo: 'Installation',
    instalacion: [
      'Open the [latest release](https://github.com/pepeipto/coach-lol-ia/releases/latest) and download the `.exe` installer.',
      'Run it. If Windows SmartScreen shows a warning, click “More info” and then “Run anyway”.',
      'Open Coach LoL IA and then the League of Legends client. The app detects it on its own and, the first time, a four-step welcome shows you the basics.',
      'You will see your build in champion select. Press “Import” to apply it.',
      'For the in-game coach, set the game to **Borderless** mode.',
    ],
    extras: [
      {
        titulo: 'Automatic updates',
        texto: 'The app checks for a new version at startup, downloads it in the background and installs it when you close it.',
      },
      {
        titulo: 'Official Riot APIs only',
        texto: 'It never touches the game process: no memory reading, no code injection. [More details](@inicio#seguridad).',
      },
      {
        titulo: 'Uninstall',
        texto: 'From Windows Settings → Apps → Coach LoL IA. Your runes and item sets in the client are left untouched.',
      },
      {
        titulo: 'Source on GitHub',
        texto:
          'The source code, change history and release notes are on [GitHub](https://github.com/pepeipto/coach-lol-ia).',
      },
      {
        titulo: 'Code signing and verification',
        texto:
          'Free code signing provided by SignPath.io, certificate by SignPath Foundation (application in progress). Every installer is built on GitHub Actions from the published source code (MIT license) and its SHA-256 is in `SHA256SUMS.txt`. [Code signing policy](https://github.com/pepeipto/coach-lol-ia/blob/main/CODE_SIGNING.md).',
      },
    ],
    ayuda:
      'The app does not detect the client or the overlay does not show up? Write to us with your Windows version and a description of the problem.',
  },

  apoyar: {
    antetitulo: 'Support the project',
    h1: 'Coach LoL IA is free for everyone',
    intro:
      'Every feature, including the in-game coach, is available to everyone, and the app has no ads. The project is funded by ads on the website and voluntary donations.',
    porQue: 'Why support it?',
    porQueTexto:
      'Running Coach LoL IA costs money every month. If you find it useful, a donation helps keep it free and make it better. Donating is voluntary and gives no advantages in the app: everyone gets the same.',
    quePagan: 'What donations pay for',
    destinos: [
      ['The server', 'Hosting for the server that downloads games, calculates builds every 6 hours and serves them to the app.'],
      ['The data', 'Storing and processing thousands of Emerald+ games from EUW, LAN and LAS, plus the AI support assistant.'],
      ['Development', 'Time to fix bugs, keep up with every League of Legends patch and add new features.'],
    ],
    cafe: 'Want to buy us a coffee? Any amount helps.',
    donar: 'Donate',
    pronto: 'Soon you will be able to support the project with a donation.',
    mientras: 'In the meantime, if you want to help, write to us at',
    otraForma: 'Another way to support it is to tell your friends or [download the app](@descargar) and use it.',
  },

  novedades: {
    antetitulo: 'Changelog',
    h1: 'What’s new in Coach LoL IA',
    intro:
      'Every version of the app, newest first. The app also shows them in its “What’s new” view and summarizes each new version the first time you open it.',
    notaIdioma:
      'Release notes are written in Spanish. The 3.x versions are translated below; older versions are shown in their original Spanish.',
    version: 'Version',
    ultima: 'Latest version',
    proxima: {
      titulo: 'New in 3.1',
      texto:
        'A natural, offline neural voice in all 5 languages that downloads itself in the background (never during champ select, loading or a game); a full-screen loading screen with your card highlighted that Space hides (or cards only, or off); and 460 voice lines per language with variants, a detail level and categories.',
    },
    cierre: 'Updates install themselves when you close the app. If you do not have it yet, download it for free.',
    notasGithub: 'Notes on GitHub',
    meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    formatoFecha: '{m} {d}, {a}',
  },

  legal: {
    antetitulo: 'Legal',
    plantilla:
      '**Template pending review.** This text is a reasonable template drafted for the project and must be reviewed by the owner (ideally with legal advice) before public launch. Fields in square brackets, such as *[name or company name]*, must be completed. It does not constitute legal advice.',
    actualizado: 'Last updated: October 20, 2026.',
    traduccion:
      'This is a translation of the Spanish original. In case of discrepancy, the Spanish version prevails.',
    privacidad: {
      h1: 'Privacy policy',
      secciones: [
        {
          h: '1. Data controller',
          p: [
            `Controller: *[name or company name]*, tax ID *[tax ID]*, with registered address at *[address]*. Contact for any privacy matter: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        { h: '2. What data we process and why', tabla: true },
        {
          h: '3. Data we do not collect',
          p: [
            'The app reads client and game data **on your own PC** (LCU API and Live Client Data API) to show you the build and alerts. That information is not sent to our server, except for the loading screen and AI coach data described in the previous section: we do not collect your credentials or keep a history of your games. There are no user accounts or passwords in Coach LoL IA either.',
          ],
        },
        {
          h: '4. Data stored on your PC',
          p: [
            'The app stores its settings, the build and Data Dragon cache, the natural voice model with its cache of lines, the history of your AI analyses (the last 50) and a local error log in your user folder. They are deleted when you uninstall the app and remove its data folder.',
          ],
        },
        {
          h: '5. Processors and recipients',
          lista: [
            '**Anthropic**, our AI provider (generates the AI assistant’s answers from the chat messages, and the AI coach’s analyses and tips from game data, without your Riot ID). It may process data outside the EEA with appropriate safeguards.',
            '**Google** (AdSense on this website, only with your consent).',
            '**GitHub** (hosting of this website, the app downloads and the natural voice model, about 124 MB, which the app downloads by itself; as with any download, GitHub receives your IP address).',
            '*[Server hosting provider]* (build server and AI assistant server).',
          ],
          p: [
            'If you make a donation, it is handled by the donation platform on its own website: we do not see or store your payment details.',
            'We do not sell your data or share it with third parties except where required by law.',
          ],
        },
        {
          h: '6. Retention',
          p: ['Server technical logs are kept for at most *[specify period]*. Assistant messages and the game data received by the AI coach are not stored.'],
        },
        {
          h: '7. Your rights',
          p: [
            `You can exercise your rights of access, rectification, erasure, objection, restriction and portability by writing to [${CORREO}](mailto:${CORREO}). If you believe we have not handled your request properly, you can lodge a complaint with the Spanish Data Protection Agency (aepd.es) or the supervisory authority of your country.`,
          ],
        },
        { h: '8. Cookies', p: ['See the [cookie policy](@cookies).'] },
      ],
      tabla: {
        cabecera: ['Source', 'Data', 'Purpose', 'Legal basis'],
        filas: [
          [
            'Desktop app',
            'Champion and role requested, and the IP address of the request.',
            'Serving builds.',
            'Performance of the service you request (Art. 6(1)(b) GDPR).',
          ],
          [
            'Loading screen (app)',
            'For the ten players in your game: their Riot identifier (PUUID), champion, role and team, and your client’s region. The Riot ID (name#tag) is not sent.',
            'Requesting each player’s Solo/Duo rank and mastery from the official Riot API for the loading screen. The server keeps the response in memory only, for 10 minutes at most, and does not write it to its database or logs.',
            'Performance of the service you request (Art. 6(1)(b) GDPR) and legitimate interest regarding the other players, using data Riot already makes public (Art. 6(1)(f) GDPR).',
          ],
          [
            'AI assistant (website and app)',
            'The messages you write in the assistant chat and the IP address of the request.',
            'Generating the answer: messages are sent to our server and to Anthropic, which processes the text with its AI model. Our server does not keep them beyond that processing. Do not write personal data in the chat.',
            'Performance of the service you request (Art. 6(1)(b) GDPR).',
          ],
          [
            'AI coach (app)',
            'Data from the game in progress or just finished, without your summoner name or Riot ID: your champion, role and mode; stats (KDA, CS, gold, level, damage, vision), items and purchases with their minute, deaths with their minute and objectives from the official events; for tips, also the champions, levels, items and kills shown on the scoreboard (TAB). And the IP address of the request.',
            'Generating the post-game analysis and the dead-moment tips (which you can turn on or off in Settings): the data is sent to our server and to Anthropic, which processes it with its AI model. Our server does not store it or write it to its logs: it only counts requests for its daily limits. Your analyses are only saved on your PC.',
            'Performance of the service you request (Art. 6(1)(b) GDPR).',
          ],
          [
            'Support',
            `Your email address and whatever you tell us when writing to ${CORREO}.`,
            'Answering your request.',
            'Legitimate interest in assisting you (Art. 6(1)(f) GDPR).',
          ],
          [
            'This website',
            'Your cookie choice (in your browser) and, only if you accept them, Google AdSense advertising cookies.',
            'Remembering your choice and showing ads.',
            'Consent (Art. 6(1)(a) GDPR).',
          ],
        ],
      },
    },
    terminos: {
      h1: 'Terms of use',
      secciones: [
        {
          h: '1. Who we are',
          p: [
            `Coach LoL IA is a service provided by *[name or company name]*, tax ID *[tax ID]*, with registered address at *[address]*. Contact: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        {
          h: '2. The service',
          p: [
            'Coach LoL IA is a free Windows desktop application that suggests builds in champion select and shows alerts during the game. Its recommendations are for guidance only and are based on game statistics; they do not guarantee any result.',
          ],
        },
        {
          h: '3. Use of the app',
          lista: [
            'We grant you a personal, non-exclusive and non-transferable license to use the app.',
            'You may not use it to break Riot Games’ rules or modify it to access the game by other means.',
            'The app only uses official Riot APIs. Even so, the use of third-party tools is subject to Riot’s policies, which may change.',
          ],
        },
        {
          h: '4. Price and donations',
          lista: [
            'Coach LoL IA is free: all its features are available to everyone and the app has no ads.',
            'The project is funded by ads on this website and by voluntary donations through [Support the project](@apoyar).',
            'Donating is voluntary and does not give access to features or advantages in the app.',
          ],
        },
        {
          h: '5. Availability',
          p: [
            'We try to keep the service available at all times, but there may be interruptions due to maintenance, patch changes or changes to Riot’s APIs. If the server does not respond, the app uses the latest saved data.',
          ],
        },
        {
          h: '6. Liability',
          p: [
            'The app is provided “as is”. To the extent permitted by law, we are not liable for indirect damages arising from its use. Nothing in these terms limits the rights granted to you by consumer protection law.',
          ],
        },
        {
          h: '7. Intellectual property and Riot Games',
          riot: true,
          p: [
            'League of Legends and its images are trademarks and content of Riot Games, Inc., used in accordance with its policy for third-party projects.',
          ],
        },
        {
          h: '8. Changes and governing law',
          p: [
            'We may update these terms; we will announce relevant changes on this website. They are governed by *[Spanish]* law and, for consumers, the courts of their place of residence have jurisdiction.',
          ],
        },
      ],
    },
    cookies: {
      h1: 'Cookie policy',
      queUsamos: 'What we use',
      queUsamosTexto:
        'This website does not use its own analytics or tracking cookies. It only stores your advertising choice and, if you accept, loads Google AdSense ads, which do use third-party cookies.',
      tabla: {
        cabecera: ['Name', 'Type', 'Purpose', 'Duration'],
        filas: [
          ['`coach-cookies` (local storage)', 'First-party, technical', 'Remembering whether you accepted or rejected advertising.', 'Until you delete it'],
          [
            'Google AdSense cookies',
            'Third-party, advertising',
            'Showing and measuring ads. Only loaded if you accept. More information in Google’s policy.',
            'As set by Google',
          ],
        ],
      },
      sinAnunciosApp: 'The desktop app never shows ads: ads only appear on this website.',
      cambiar: 'Change your choice',
      conAnuncios: 'Press the button to clear your choice; the cookie notice will appear again.',
      sinAnuncios:
        'This website does not show ads right now, so there is nothing to accept. If we turn them on, you will see a notice to choose.',
      boton: 'Reset my cookie choice',
      borradaBanner:
        ' Choice cleared. Choose again in the notice; if ads had already loaded, they will stop loading when you reload the page.',
      borrada: ' Choice cleared. The change applies when you reload the page.',
      navegador: 'You can also delete this site’s data from your browser settings.',
      contacto: 'Contact',
      contactoTexto: 'For any questions:',
    },
  },

  builds: {
    antetitulo: 'Builds & tier list',
    h1: 'LoL builds and tier list from Emerald+ games',
    intro:
      'Coach LoL IA calculates its League of Legends builds and tier list from real games of **Emerald or higher** players in EUW, LAN and LAS. They are not opinions or hand-made lists: every build shows how many games back it up and its win rate, and it is recalculated **every 6 hours**.',
    capturaAlt:
      'Screenshot of Coach LoL IA’s Champion view with Ahri’s Mid build: Domination and Sorcery runes, Flash and Ignite, starting items, core items and boots, and the skill order, with win rate, 33 games and patch 16.20.',
    capturaPie: 'Build by champion and role, with its number of games.',
    queIncluye: {
      titulo: 'What each build includes',
      lista: [
        '**Runes**: the most played page and, since 3.0.1, several pages to choose from, each with its win rate and games.',
        '**Summoner spells**, such as Flash and Ignite or Flash and Smite.',
        '**Items**: starting items, 3-item core, boots and situational items.',
        '**Skill order**, with the max priority (for example, Q > W > E).',
        'In **Arena**, the most picked augments and items, with their pick rate only.',
      ],
    },
    origen: {
      titulo: 'Where the data comes from',
      texto:
        'Our server uses the official Riot API: League-v4 to find Emerald+ players and Match-v5 to download their ranked Solo/Duo games, plus their ARAM, ARAM: Mayhem and Arena games. From them it calculates, for every champion and role, what gets played the most and how well it does.',
      puntos: [
        '**Current patch first:** with 200 or more games on the patch, only current-patch data is used; with fewer, it is combined with the previous patch and the build says so.',
        `**At least ${MIN_PARTIDAS_BUILD} games** to publish a build; from ${MIN_PARTIDAS_BUILD} to ${PARTIDAS_DATOS_LIMITADOS - 1} it carries the “Limited data” badge.`,
        '**Nothing made up:** if there are not enough games, the app says “Build not available”.',
      ],
    },
    tierList: {
      titulo: 'How the tier list is calculated',
      texto:
        'In the app’s Champions section, each champion gets a tier per role and per mode that combines its **win rate** and **pick rate** within that role. That way, a champion with a high win rate but very few games does not reach the top by chance.',
      tiers: [
        ['S', 'Performs above the norm in its role and is played enough for the data to be trustworthy.'],
        ['A', 'A solid pick on the current patch.'],
        ['B', 'Playable and balanced. Champions with fewer than 30 games also stay here.'],
        ['C', 'Below average this patch: it can work, but it is an uphill battle today.'],
      ],
      alt: 'Screenshot of Coach LoL IA’s Champions section: Ranked tier list with the mode selector, search, role filters and the champion table with tier, win rate, pick rate and games.',
      pie: 'The full tier list lives in the app, with current-patch data.',
    },
    modos: {
      titulo: 'Ranked, ARAM, ARAM: Mayhem and Arena',
      texto:
        'Each mode has its own builds and tier list. In ARAM and ARAM: Mayhem builds are per champion (no role), with the most picked augments in ARAM: Mayhem; in Arena you also get the champion’s average placement, top 4 and first place rates. Augments and Arena items show their pick rate only, with no win rate, as Riot’s policy requires. Modes with few games collected show “No data yet” until there is a large enough sample.',
    },
    importar: {
      titulo: 'From build to client in one click',
      texto:
        'In champion select, the app detects your champion and role and shows the build in under 2 seconds. “Import” creates the rune page, picks your summoner spells and adds the item set. [Step by step in the runes guide](@guiaRunas).',
    },
    honestidad: {
      titulo: 'What a tier list is not',
      texto:
        'A tier list summarizes statistics; it does not tell you which champion to play. How well you know the champion, your team and the enemy all matter a lot. That is why Coach LoL IA always shows the number of games and promises no results. [How to read a tier list](@guiaTierList).',
    },
    faq: [
      {
        p: 'How often are the builds updated?',
        r: 'Every 6 hours. When a new patch comes out, the server and Data Dragon catch up on their own and the app shows which patch the data is from.',
      },
      {
        p: 'Can I see the tier list on the website?',
        r: 'The full tier list, with search, filters and every champion’s build, is in the Champions section of the app, which is free. This page explains how it is calculated.',
      },
      {
        p: 'Why does a build say “Limited data”?',
        r: `Because it is based on fewer than ${PARTIDAS_DATOS_LIMITADOS} games. It is useful as guidance, but the sample is small and the win rate can change a lot with just a few more games.`,
      },
      {
        p: 'Do the builds work on other servers?',
        r: 'Yes: they depend on the champion, role and patch, not on the server you play on.',
      },
    ],
    cta: 'Download the app and check your champion’s build in your next champ select.',
  },

  guias: {
    antetitulo: 'Guides',
    h1: 'League of Legends guides',
    intro:
      'Short, practical guides on overlays, tier lists and runes, written by the Coach LoL IA team. We explain how things work, with no promises to make you climb.',
    otras: 'More guides',
    articulos: {
      guiaOverlay: {
        resumen: 'What Riot allows an overlay to do, which red flags to watch for and how to set it up properly.',
        h1: 'How to use a League of Legends overlay safely',
        entradilla:
          'A League of Legends overlay is a window drawn on top of the game to show you information: your build, objective timers or your CS. Done right, it follows Riot’s rules. Done wrong, it can put your account at risk. This guide helps you tell them apart.',
        secciones: [
          {
            h: 'What an overlay is and what it is not',
            p: [
              'A legitimate overlay is a regular Windows window, transparent and click-through, placed on top of the game. It is not part of the game and does not modify it: it only draws information on your screen.',
              'For it to show up, LoL has to be in **Borderless** mode (Options → Video → Window mode). In exclusive full screen, Windows draws the game above every other window.',
            ],
          },
          {
            h: 'What Riot allows third-party apps to do',
            p: [
              'Riot publishes official interfaces for third-party tools: the client’s **LCU API** (champion select, runes, items), the game’s **Live Client Data API** (on `127.0.0.1:2999`, read-only) and public services such as Data Dragon. An app that only uses these works with data Riot chooses to share.',
              'Riot’s policies also limit what can be shown. In general, an overlay should not give you information you would not have playing without it: no enemy summoner or ultimate timers, no positions of enemies you cannot see, and no decisions that play the game for you.',
            ],
          },
          {
            h: 'Red flags',
            lista: [
              'It reads **game memory** or injects code or DLLs into the process.',
              'It shows **enemy cooldowns**, positions outside your vision or enemy jungle timers.',
              'It **simulates keyboard or mouse input**, or automates actions such as dodging or casting abilities.',
              'It analyzes **screenshots** or the minimap to extract information.',
              'It asks for your **Riot password** or claims to be “undetectable”.',
            ],
          },
          {
            h: 'Checklist before installing an overlay',
            lista: [
              'It clearly states which APIs it uses and what it does not do to the game.',
              'It does not ask for credentials: the client is already open on your PC.',
              'Its privacy policy explains what data it sends to its servers.',
              'It includes Riot’s legal notice and does not present itself as an official product.',
              'You can hide it or turn off any part of it at any time.',
            ],
          },
          {
            h: 'How Coach LoL IA does it',
            p: [
              'Coach LoL IA only uses the LCU API, the Live Client Data API and Data Dragon. It does not read or write game memory, does not inject code, does not take screenshots to analyze them and does not simulate keys or clicks. Jungle timers are for your side only and you set them yourself, and for the enemy jungler it only repeats what is already in the kill feed.',
              'Even so, Riot always has the final say on third-party tools. That is why we review every alert against their current policy, and we recommend you do the same with any app you install. [See the safety section](@inicio#seguridad).',
            ],
          },
          {
            h: 'Set it up so it stays out of the way',
            lista: [
              'Put the game in **Borderless** mode.',
              'In the app’s Overlay view, use **“Move and calibrate”** to place each widget where it does not cover the HUD.',
              'Lower the opacity or turn off the widgets you do not use.',
              'During the game, **Ctrl+Shift+O** hides or shows the overlay.',
            ],
          },
        ],
      },
      guiaTierList: {
        resumen: 'What each tier means, how it is calculated and why the number of games matters.',
        h1: 'What is a tier list in LoL and how to read it',
        entradilla:
          'A tier list ranks League of Legends champions by how well they perform on the current patch, usually with letters: S, A, B, C. It is a useful tool to pick or discover champions, as long as you know where the data comes from and what it does not tell you.',
        secciones: [
          {
            h: 'What each tier means',
            p: [
              'There is no official standard, but almost all of them follow the same idea: **S** are the champions that stand out most in their role, **A** very solid picks, **B** balanced champions and **C** those having a harder time right now. Some add S+ or D.',
              'The key point is that tiers are **per role**: a champion can be S tier in the jungle and B tier in top lane.',
            ],
          },
          {
            h: 'How it is calculated',
            p: [
              'Data-driven tier lists mainly combine two numbers: **win rate** (how many games the champion wins in that role) and **pick rate** (how often it is picked). Some also factor in ban rate or performance in high elo.',
              'Other tier lists are **opinion-based**: a player or a team makes them from experience. They are not bad, but it helps to know which kind you are reading.',
            ],
          },
          {
            h: 'Why the number of games matters',
            p: [
              'A 60% win rate over 20 games says little: a few more losses and it could drop to 50%. A 52% win rate over thousands of games is far more reliable. That is why a good tier list shows the sample size, or at least does not let a champion with little data reach the top.',
              '**Which games** also matters: a champion does not perform the same in Iron as in Emerald+, and a new patch can change everything overnight.',
            ],
          },
          {
            h: 'How to use it without being misled',
            lista: [
              'Look at it for **your role** and on the **current patch**.',
              'A B-tier champion you have mastered usually performs better than an S-tier one you do not know.',
              'Use it to discover champions and to know what is strong against you.',
              'Be wary of numbers with no game count.',
            ],
          },
          {
            h: 'The Coach LoL IA tier list',
            p: [
              'In the app’s Champions section, each champion gets an S, A, B or C tier per role and per mode (Ranked, ARAM, ARAM: Mayhem and Arena) that combines win rate and pick rate, using games of Emerald+ players in EUW, LAN and LAS. Champions with fewer than 30 games never go above B and carry the “Limited data” warning. [More about the data](@builds).',
            ],
          },
        ],
      },
      guiaRunas: {
        resumen: 'Runes, summoner spells and items in one click from champion select, without losing your pages.',
        h1: 'How to import runes automatically in LoL',
        entradilla:
          'Setting up runes in every champion select takes time, especially if you swap champions at the last second. With an app that uses the client’s official API, you can import runes, summoner spells and items in one click. Here is how to do it with Coach LoL IA.',
        secciones: [
          {
            h: 'How import works',
            p: [
              'The League of Legends client has a local API, the **LCU API**, which Riot makes available to third-party tools. Through it, an app can create rune pages, pick summoner spells and add item sets to the shop, just as you would by hand.',
              'Coach LoL IA connects by reading the client’s *lockfile* (local port and password). It never asks for your Riot account or password.',
            ],
          },
          {
            h: 'Step by step',
            ordenada: true,
            lista: [
              '[Download Coach LoL IA](@descargar) and install it on Windows 10 or 11.',
              'Open the app and the LoL client, in any order. The app detects the client on its own.',
              'Enter champion select. The app recognizes your champion and the role the client assigns you.',
              'Check the build: runes (you can choose between several pages), summoner spells, items and skill order.',
              'Press **“Import”**. If you would rather not touch anything, turn on automatic import in Settings.',
            ],
          },
          {
            h: 'Your rune pages are safe',
            p: [
              'The app creates its own pages with the **“Coach:”** prefix, for example “Coach: Ahri Mid”, and replaces its own page if it already exists. If you have no free page left, it only replaces one of yours when you click “Import” and confirm it (never a preset); automatic import never deletes anything.',
            ],
          },
          {
            h: 'If something goes wrong',
            lista: [
              '**“Waiting for the League of Legends client…”**: open the client; the app tries again every 3 seconds.',
              '**“Build not available”**: there are fewer than 10 games for that champion in that role. Try another role or wait for the next update.',
              '**The page is not created**: check that you have a free page or a “Coach:” page that can be replaced.',
              'If it still fails, ask the AI assistant or write to us at support@coachlolia.com.',
            ],
          },
          {
            h: 'Doing it by hand is fine too',
            p: [
              'If you would rather not install anything, you can copy the build into the client by hand: create a rune page, pick your summoner spells and buy following the item order. Import just saves you that time in champion select.',
            ],
          },
        ],
      },
    },
  },

  noEncontrada: {
    h1: 'Page not found',
    texto: 'The page you are looking for does not exist or has moved.',
    volver: 'Go to the home page',
    otros: 'Other languages',
  },
};
