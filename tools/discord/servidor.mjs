// Diseño del servidor oficial de Discord de Coach LoL IA: roles, categorías, canales, permisos, AutoMod y
// preguntas de «Canales y roles». Es la fuente única: crear-servidor.mjs lo aplica y docs/discord/ lo explica.
// Los textos de los mensajes fijados están en docs/discord/mensajes/ (un archivo por canal, ES y EN).

/** Permisos de @everyone en todo el servidor (lo que no aparece queda desactivado). */
export const PERMISOS_TODOS = [
  'ViewChannel',
  'CreateInstantInvite',
  'ChangeNickname',
  'SendMessages',
  'SendMessagesInThreads',
  'CreatePublicThreads',
  'EmbedLinks',
  'AttachFiles',
  'AddReactions',
  'UseExternalEmojis',
  'UseExternalStickers',
  'ReadMessageHistory',
  'UseApplicationCommands',
  'Connect',
  'Speak',
  'Stream',
  'UseVAD',
  'RequestToSpeak',
];

/** Permisos extra del rol Equipo: moderar sin ser administrador. */
const PERMISOS_EQUIPO = [
  'ManageMessages',
  'ManageThreads',
  'PinMessages',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
  'ManageNicknames',
  'ManageRoles',
  'ManageEvents',
  'CreateEvents',
  'MentionEveryone',
  'ViewAuditLog',
  'MuteMembers',
  'DeafenMembers',
  'MoveMembers',
  'PrioritySpeaker',
];

/**
 * Roles, de arriba abajo. `grupo` agrupa los autoasignables en la documentación y en «Canales y roles».
 * `mostrar`: se ven aparte en la lista de miembros.
 */
export const ROLES = [
  { nombre: 'Equipo', color: 0xc8aa6e, mostrar: true, permisos: PERMISOS_EQUIPO },
  { nombre: 'Beta tester', color: 0x0ac8b9, mostrar: true },
  { nombre: 'Streamer', color: 0x9146ff, mostrar: true },
  { nombre: 'Avisos de novedades', color: 0, grupo: 'avisos' },
  { nombre: 'Avisos de retos', color: 0, grupo: 'avisos' },
  { nombre: 'ES', color: 0, grupo: 'idioma' },
  { nombre: 'EN', color: 0, grupo: 'idioma' },
  { nombre: 'EUW', color: 0, grupo: 'region' },
  { nombre: 'EUNE', color: 0, grupo: 'region' },
  { nombre: 'LAN', color: 0, grupo: 'region' },
  { nombre: 'LAS', color: 0, grupo: 'region' },
  { nombre: 'NA', color: 0, grupo: 'region' },
  { nombre: 'BR', color: 0, grupo: 'region' },
  { nombre: 'Top', color: 0, grupo: 'posicion' },
  { nombre: 'Jungla', color: 0, grupo: 'posicion' },
  { nombre: 'Mid', color: 0, grupo: 'posicion' },
  { nombre: 'ADC', color: 0, grupo: 'posicion' },
  { nombre: 'Support', color: 0, grupo: 'posicion' },
  { nombre: 'Hierro', color: 0x5e5a59, grupo: 'rango' },
  { nombre: 'Bronce', color: 0x8c5a3c, grupo: 'rango' },
  { nombre: 'Plata', color: 0x9aa4af, grupo: 'rango' },
  { nombre: 'Oro', color: 0xd4a94a, grupo: 'rango' },
  { nombre: 'Platino', color: 0x4fa3a5, grupo: 'rango' },
  { nombre: 'Esmeralda', color: 0x2fa36b, grupo: 'rango' },
  { nombre: 'Diamante', color: 0x576bce, grupo: 'rango' },
  { nombre: 'Maestro+', color: 0xb73fd1, grupo: 'rango' },
];

// Plantillas de permisos por canal. Cada entrada: rol ('@everyone' o nombre de ROLES) → { permitir, denegar }.
const SOLO_LECTURA = {
  '@everyone': { denegar: ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions'] },
  Equipo: { permitir: ['SendMessages', 'AddReactions'] },
};
const SOLO_LECTURA_CON_REACCIONES = {
  '@everyone': { denegar: ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads'] },
  Equipo: { permitir: ['SendMessages'] },
};
const PRIVADO_EQUIPO = {
  '@everyone': { denegar: ['ViewChannel'] },
  Equipo: { permitir: ['ViewChannel'] },
};

/**
 * Categorías y canales, en orden. Tipos: 'texto', 'anuncios' (se pueden «seguir» desde otros servidores), 'foro',
 * 'voz' y 'escenario'. `mensajes`: archivo de docs/discord/mensajes/ que se publica y fija (en un foro, se publica
 * como primera publicación fijada). `lento`: segundos de modo lento. `predeterminado`: canal que ve todo miembro
 * nuevo (Discord pide al menos 7, y 5 de ellos con permiso de escribir). En un foro, `etiquetasEquipo` solo las pone
 * el equipo.
 */
export const CATEGORIAS = [
  {
    nombre: '📌 Bienvenida',
    canales: [
      { nombre: 'bienvenida', tipo: 'texto', tema: 'Empieza aquí · Start here', permisos: SOLO_LECTURA_CON_REACCIONES, mensajes: 'bienvenida', predeterminado: true },
      { nombre: 'reglas', tipo: 'texto', tema: 'Normas del servidor · Server rules', permisos: SOLO_LECTURA, mensajes: 'reglas', predeterminado: true },
      { nombre: 'roles', tipo: 'texto', tema: 'Elige región, rango, posición e idioma · Pick your roles', permisos: SOLO_LECTURA, mensajes: 'roles' },
    ],
  },
  {
    nombre: '📣 Coach LoL IA',
    canales: [
      { nombre: 'anuncios', tipo: 'anuncios', tema: 'Anuncios oficiales · Official announcements', permisos: SOLO_LECTURA_CON_REACCIONES, predeterminado: true },
      { nombre: 'novedades', tipo: 'anuncios', tema: 'Cada versión nueva, publicada sola desde GitHub · Every release, posted from GitHub', permisos: SOLO_LECTURA_CON_REACCIONES, mensajes: 'novedades', predeterminado: true, webhook: true },
      { nombre: 'descargas-y-faq', tipo: 'texto', tema: 'Descarga oficial y preguntas frecuentes · Download and FAQ', permisos: SOLO_LECTURA, mensajes: 'descargas-y-faq', predeterminado: true },
      {
        nombre: 'beta',
        tipo: 'texto',
        tema: 'Versiones de prueba antes que nadie · Early test builds',
        permisos: { '@everyone': { denegar: ['ViewChannel'] }, 'Beta tester': { permitir: ['ViewChannel'] }, Equipo: { permitir: ['ViewChannel'] } },
        mensajes: 'beta',
      },
    ],
  },
  {
    nombre: '🛠️ Ayuda',
    canales: [
      { nombre: 'ayuda', tipo: 'texto', tema: 'Dudas rápidas sobre la app · Quick questions', lento: 5, mensajes: 'ayuda', predeterminado: true },
      {
        nombre: 'soporte-y-bugs',
        tipo: 'foro',
        tema: 'Un hilo por problema. Usa la plantilla de la publicación fijada · One thread per issue, use the pinned template',
        etiquetas: ['🐞 Bug', '💿 Instalación', '🖥️ Overlay', '🔊 Voz', '🧠 Análisis IA', '📦 Builds y runas', '✅ Resuelto'],
        etiquetasEquipo: ['Resuelto'],
        mensajes: 'soporte-y-bugs',
        predeterminado: true,
      },
      {
        nombre: 'sugerencias',
        tipo: 'foro',
        tema: 'Una idea por hilo; vota con 👍 · One idea per thread, vote with 👍',
        etiquetas: ['💡 Idea', '🔍 En estudio', '🗓️ Planeada', '✅ Hecha', '❌ Descartada'],
        etiquetasEquipo: ['En estudio', 'Planeada', 'Hecha', 'Descartada'],
        reaccion: '👍',
        mensajes: 'sugerencias',
        predeterminado: true,
      },
    ],
  },
  {
    nombre: '🎮 Comunidad',
    canales: [
      { nombre: 'general', tipo: 'texto', tema: 'Charla en español sobre LoL y la app', predeterminado: true },
      { nombre: 'english', tipo: 'texto', tema: 'English chat about LoL and the app', predeterminado: true },
      { nombre: 'builds-y-runas', tipo: 'texto', tema: 'Comparte builds y runas (con capturas o el código de la app) · Share builds and runes', predeterminado: true },
      { nombre: 'clips', tipo: 'texto', tema: 'Tus mejores jugadas y clips con el overlay · Your best plays', lento: 30, predeterminado: true },
      {
        nombre: 'retos-de-la-semana',
        tipo: 'texto',
        tema: 'Un reto nuevo cada lunes; responde en el hilo del reto · New challenge every Monday',
        permisos: {
          '@everyone': { denegar: ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads'], permitir: ['SendMessagesInThreads'] },
          Equipo: { permitir: ['SendMessages', 'CreatePublicThreads'] },
        },
        mensajes: 'retos',
        predeterminado: true,
      },
      { nombre: 'buscar-duo', tipo: 'texto', tema: 'Busca dúo o equipo (usa la plantilla fijada) · Find a duo or team', lento: 120, mensajes: 'buscar-duo', predeterminado: true },
      {
        nombre: 'directos',
        tipo: 'texto',
        tema: 'Directos y vídeos de los streamers de la comunidad · Community streams',
        permisos: {
          '@everyone': { denegar: ['SendMessages', 'CreatePublicThreads'] },
          Streamer: { permitir: ['SendMessages', 'EmbedLinks'] },
          Equipo: { permitir: ['SendMessages'] },
        },
        mensajes: 'directos',
      },
      { nombre: 'off-topic', tipo: 'texto', tema: 'De todo lo que no es LoL · Anything else', predeterminado: true },
    ],
  },
  {
    nombre: '🔊 Voz',
    canales: [
      { nombre: 'Sala general', tipo: 'voz' },
      { nombre: 'Dúo 1', tipo: 'voz', limite: 2 },
      { nombre: 'Dúo 2', tipo: 'voz', limite: 2 },
      { nombre: 'Flex · 5', tipo: 'voz', limite: 5 },
      { nombre: 'Clash · 5', tipo: 'voz', limite: 5 },
      { nombre: 'Charlas y eventos', tipo: 'escenario' },
    ],
  },
  {
    nombre: '🔒 Equipo',
    permisos: PRIVADO_EQUIPO,
    canales: [
      { nombre: 'equipo', tipo: 'texto', tema: 'Coordinación del equipo' },
      { nombre: 'moderacion', tipo: 'texto', tema: 'Alertas de AutoMod y avisos de Discord para la comunidad' },
    ],
  },
];

/** Canal de normas y canal de avisos de Discord que pide el modo Comunidad. */
export const CANAL_REGLAS = 'reglas';
export const CANAL_MODERACION = 'moderacion';
/** Canal de los mensajes de sistema (bienvenida a cada miembro nuevo). */
export const CANAL_SISTEMA = 'general';
/** Canal al que apunta la invitación permanente. */
export const CANAL_INVITACION = 'bienvenida';

/**
 * Reglas de AutoMod (moderación nativa de Discord, gratis y sin bot). Bloquean el mensaje y avisan en #moderacion.
 * Comodines: `*` al principio o al final. Van contra lo que prohíben Riot y las reglas: trampas, venta de cuentas,
 * subir de elo por dinero, apuestas y estafas típicas.
 */
export const AUTOMOD = [
  {
    nombre: 'Trampas, cuentas y elo boost',
    aviso: 'Este servidor no permite trampas, venta de cuentas ni elo boost. · No cheats, account selling or elo boosting.',
    palabras: [
      'elo boost*', 'eloboost*', 'elo-boost*', 'boost de elo', 'boosteo de elo', 'duo boost*', 'boosting service*',
      'vendo cuenta*', 'compro cuenta*', 'venta de cuenta*', 'cuentas en venta', 'selling account*', 'buy account*',
      'account for sale', 'smurf for sale', 'cuenta smurf en venta',
      'orbwalker', 'evade script*', 'scripts de lol', 'lol script*', 'script de lol', 'cheat engine', 'aimbot', 'wallhack',
      'hack de lol', 'lol hack*', 'map hack*', 'maphack*',
    ],
  },
  {
    nombre: 'Apuestas y estafas',
    aviso: 'Nada de apuestas, sorteos de RP falsos ni enlaces de estafa. · No betting or scam links.',
    palabras: [
      'apuesta*', 'casino*', 'bet365', 'stake.com', 'gamdom', 'csgoroll', 'betting',
      'rp gratis', 'free rp', 'rp generator', 'generador de rp', 'skins gratis', 'free skins',
      'nitro gratis', 'free nitro', 'discord-nitro*', 'steamcommunlty*', 'dlscord*',
    ],
  },
  {
    nombre: 'Invitaciones a otros servidores',
    aviso: 'Para promocionar otro servidor, pregunta antes al equipo. · Ask the team before posting server invites.',
    palabras: ['discord.gg/*', 'discord.com/invite/*', 'discordapp.com/invite/*'],
    // crear-servidor.mjs añade aquí el código de la invitación oficial.
    exentos: ['Equipo', 'Streamer'],
  },
];

/**
 * Preguntas de «Canales y roles» (Onboarding de Discord): cada miembro elige al entrar y puede cambiarlo cuando
 * quiera desde el menú del servidor. Sustituye a los bots de roles por reacción.
 */
export const PREGUNTAS = [
  { titulo: '¿En qué idioma prefieres hablar? · Language', grupo: 'idioma', unica: false, obligatoria: true, emojis: ['🇪🇸', '🇬🇧'] },
  { titulo: '¿En qué región juegas? · Region', grupo: 'region', unica: false, obligatoria: false, emojis: ['🇪🇺', '🌍', '🌎', '🌎', '🇺🇸', '🇧🇷'] },
  { titulo: '¿Cuál es tu rango actual? · Rank', grupo: 'rango', unica: true, obligatoria: false, emojis: ['⚫', '🟤', '⚪', '🟡', '🔷', '🟢', '💎', '👑'] },
  { titulo: '¿Qué posiciones juegas? · Roles', grupo: 'posicion', unica: false, obligatoria: false, emojis: ['🛡️', '🌲', '✨', '🏹', '💚'] },
  { titulo: '¿Qué avisos quieres recibir? · Pings', grupo: 'avisos', unica: false, obligatoria: false, emojis: ['🆕', '🏆'] },
];

/** Ajustes generales del servidor. */
export const AJUSTES = {
  /** Icono (solo si el servidor no tiene uno), relativo a la raíz del repositorio. */
  icono: 'web/public/iconos/icono-512.png',
  descripcion: 'Comunidad oficial de Coach LoL IA: la app gratuita de coaching para League of Legends. Ayuda, builds, retos y dúos.',
  idioma: 'es-ES',
  /** 2 = Media: cuenta con correo verificado y registrada hace más de 5 minutos. */
  verificacion: 2,
  /** 2 = Analizar el contenido multimedia de todos los miembros. */
  filtroContenido: 2,
  /** 1 = Notificar solo menciones (imprescindible en servidores con mucha gente). */
  notificaciones: 1,
};
