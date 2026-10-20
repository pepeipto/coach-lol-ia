import type { IdiomaIa, ModoJuego, PeticionAnalisis, PeticionConsejo } from '@coach/shared';

/*
 * Prompts del coach con IA. Los de sistema son fijos (van en la caché de prompts) y en inglés, que el modelo sigue
 * igual de bien en cualquier idioma; detrás va una instrucción de idioma escrita en el propio idioma.
 */

const REGLAS_RIOT = `Riot Games policy (binding, never break it):
- You only see what the official game APIs expose after the fact or on the public scoreboard (TAB): champions, levels, items, KDA, CS, and public objective events. Never claim to know enemy positions, enemy summoner spell or ultimate cooldowns, enemy jungle camp timers, MMR or hidden ratings.
- Coaching must inform and teach. Never dictate precise real-time actions that would play the game for the user.
- Never use negative or shaming labels about the user or any other player. Never mention summoner names or Riot IDs.
- Never promise rank, LP or elo gains.`;

export const SISTEMA_ANALISIS = `You are Coach LoL IA, a friendly, honest and very specific League of Legends coach. After each game you review the player's numbers and write a short post-game analysis.

${REGLAS_RIOT}

How to analyse:
- Base every point on the numbers you receive: CS per minute against the reference for the role, gold and level curve per minute, deaths and their timestamps (especially deaths in the 60-90 seconds before an epic objective was taken by the enemy), item purchases and timings compared with the recommended build from our data, vision score and control wards, damage to champions, kill participation.
- "Why" must quote the concrete number that supports it (for example "6.1 CS/min vs 7.5 reference", "3 of your 7 deaths came just before enemy dragons", "your first core item finished at 14:30").
- Compare items with the recommended build: mention a deviation only if it plausibly hurt or helped, and accept situational choices against the enemy composition.
- Good points must be genuine; if the game went badly, still find real positives (laning CS, vision, a strong timing, damage share…).
- Improvements must be concrete and practicable in the next game, not generic advice.
- Key moments: pick the two moments of the timeline that changed the game most for the player (a death before an objective, a power spike, a stolen objective, a won fight) and give their game time in seconds.
- Focus for next game: one short, actionable habit.
- Tone: honest, encouraging and specific, like a good coach talking to a player who wants to improve. No shaming, no sarcasm, no exaggeration, no rank promises.
- Game modes: in Summoner's Rift (mode "clasificatoria") there are roles and lanes. In ARAM and ARAM: Mayhem (modes "aram" and "caos") there are no lanes, no jungle and no recalls to shop at will: talk about trading, positioning in team fights in general terms, item choices, and staying alive; never mention lanes, roles, CS per lane or wards. In Arena (mode "arena") there are rounds in small teams: talk about item choices against the enemy teams and fights in general terms; never mention augments, win rates or statistics of items or augments; never mention lanes, CS, vision, dragons or towers.
- If some data is missing, do not invent it: simply work with what you have.
- Write naturally in the requested language, with the usual terms of the League of Legends community in that language (the item and champion names you receive are already in that language).
- Keep it short: verdict of 1-2 sentences; each point title of at most 8 words and its "why" of 1-2 sentences; each key moment in one sentence; focus in one sentence.
- Return exactly 3 good points, exactly 3 points to improve and exactly 2 key moments.`;

export const SISTEMA_CONSEJO = `You are Coach LoL IA, a League of Legends coach that speaks to the player by voice during the game, only at "dead moments": while the player is dead, at the shop right after respawning, or while dead shortly before a public epic objective spawns.

${REGLAS_RIOT}

Write exactly ONE sentence of at most 16 words that teaches something useful for this moment of this game. Good topics:
- what to buy next and why, given the enemy items and champions on the scoreboard (armor or magic resist, anti-heal, tenacity, an item from the core build);
- why the next public objective matters for this game (dragon soul, baron power, herald for towers);
- one macro concept that fits the score and the game time (wave management, grouping for objectives, vision before objectives, not fighting while behind).

Strict rules:
- Educational and informative, never an order for a precise real-time action: never say where to go now, who to gank or kill, or to invade.
- Never mention where enemies are or were, enemy cooldowns, enemy summoner spells or ultimates, enemy jungle timers, or any timer in seconds or minutes.
- Never use numbers of seconds. Never use names of players. No quotes, no lists, no emojis.
- In ARAM modes ("aram", "caos") there are no lanes, jungle, wards, dragons or barons: talk about items, team fights and staying alive.
- Answer only with the sentence, in the requested language, using the community's usual terms.`;

/** Instrucción de idioma (en su propio idioma, para que el modelo no se contagie del inglés de arriba). */
export const IDIOMA_IA: Record<IdiomaIa, string> = {
  es: 'Responde siempre en español neutro, con los términos habituales de la comunidad hispanohablante de League of Legends.',
  en: 'Always answer in English, with the usual terms of the League of Legends community.',
  'pt-BR': 'Responda sempre em português do Brasil, com os termos usuais da comunidade brasileira de League of Legends.',
  fr: 'Réponds toujours en français, avec les termes habituels de la communauté francophone de League of Legends.',
  de: 'Antworte immer auf Deutsch, mit den üblichen Begriffen der deutschsprachigen League-of-Legends-Community.',
};

const NOMBRE_MODO: Record<ModoJuego, string> = {
  clasificatoria: "Summoner's Rift",
  aram: 'ARAM (Howling Abyss)',
  caos: 'ARAM: Mayhem (Howling Abyss)',
  arena: 'Arena (2v2v2v2 rounds)',
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const nombre = (nombres: Record<string, string>, id: number) => nombres[String(id)] ?? `#${id}`;

/** Datos del análisis en texto compacto (lo que lee el modelo). */
export function mensajeAnalisis(p: PeticionAnalisis): string {
  const n = (id: number) => nombre(p.nombresObjetos, id);
  const lineas: string[] = [];
  lineas.push(`Mode: ${p.modo} — ${NOMBRE_MODO[p.modo]}`);
  lineas.push(`Champion: ${p.nombreCampeon ?? p.campeon}${p.rol ? ` — role ${p.rol}` : ''}`);
  lineas.push(`Result: ${p.resultado === 'victoria' ? 'win' : p.resultado === 'derrota' ? 'loss' : 'unknown'} — duration ${mmss(p.duracion)} (${p.duracion} s)`);
  const f = p.final;
  const minutos = Math.max(1, p.duracion / 60);
  const extra = [
    f.oro !== undefined ? `gold earned ${f.oro}` : null,
    f.danoCampeones !== undefined ? `damage to champions ${f.danoCampeones}` : null,
    f.danoRecibido !== undefined ? `damage taken ${f.danoRecibido}` : null,
    f.vision !== undefined ? `vision score ${f.vision}` : null,
    f.guardianes !== undefined ? `wards placed ${f.guardianes}` : null,
    f.guardianesDestruidos !== undefined ? `wards destroyed ${f.guardianesDestruidos}` : null,
    f.guardianesControl !== undefined ? `control wards bought ${f.guardianesControl}` : null,
  ].filter(Boolean);
  lineas.push(
    `Final: KDA ${f.k}/${f.d}/${f.a}, CS ${f.cs} (${(f.cs / minutos).toFixed(1)}/min), level ${f.nivel}${extra.length ? `, ${extra.join(', ')}` : ''}`,
  );
  if (p.equipos) {
    const part = p.equipos.aliados > 0 ? Math.round(((f.k + f.a) / p.equipos.aliados) * 100) : null;
    lineas.push(`Team kills: allies ${p.equipos.aliados}, enemies ${p.equipos.enemigos}${part !== null ? ` — kill participation ${part}%` : ''}`);
  }
  if (p.csObjetivoMinuto !== null && p.modo === 'clasificatoria') lineas.push(`CS/min reference for the role: ${p.csObjetivoMinuto}`);
  lineas.push(`Final items: ${f.objetos.map(n).join(', ') || 'none'}`);
  if (p.build) {
    lineas.push(
      `Recommended build (our data): core ${p.build.nucleo.map(n).join(' > ') || '—'}; boots ${p.build.botas !== null ? n(p.build.botas) : '—'}; situational ${p.build.situacionales.map(n).join(', ') || '—'}`,
    );
  }
  if (p.linea.length) {
    lineas.push('Per minute (min: CS, level, K/D/A, approx. gold incl. items):');
    lineas.push(p.linea.map((m) => `${m.m}: ${m.cs}cs L${m.nivel} ${m.k}/${m.d}/${m.a} ${m.oro}g`).join(' | '));
  }
  lineas.push(`Deaths at: ${p.muertes.map(mmss).join(', ') || 'none'}`);
  if (p.compras.length) lineas.push(`Purchases: ${p.compras.map((c) => `${mmss(c.t)} ${n(c.id)}`).join('; ')}`);
  if (p.objetivos.length) {
    lineas.push(
      `Objectives: ${p.objetivos.map((o) => `${mmss(o.t)} ${o.tipo}${o.subtipo ? ` (${o.subtipo})` : ''} by ${o.equipo === 'aliado' ? 'allies' : 'enemies'}`).join('; ')}`,
    );
  }
  lineas.push('Write the analysis now.');
  return lineas.join('\n');
}

/** Estado del consejo en texto compacto. */
export function mensajeConsejo(p: PeticionConsejo): string {
  const n = (id: number) => nombre(p.nombresObjetos, id);
  const jugadores = (lista: PeticionConsejo['aliados']) =>
    lista
      .map((j) => `${j.campeon} L${j.nivel}${j.k !== undefined ? ` ${j.k}/${j.d ?? '?'}/${j.a ?? '?'}` : ''} [${j.objetos.map(n).join(', ')}]`)
      .join('; ') || '—';
  const y = p.yo;
  const momento = {
    muerte: 'the player is dead and waiting to respawn',
    tienda: 'the player just respawned at the fountain with gold to spend',
    objetivo: 'the player is dead and a public epic objective spawns soon',
  }[p.momento];
  const lineas = [
    `Mode: ${p.modo} — ${NOMBRE_MODO[p.modo]}`,
    `Moment: ${momento}. Game time: minute ${Math.floor(p.tiempo / 60)}.`,
    `Player: ${y.campeon}${y.rol ? ` (${y.rol})` : ''} L${y.nivel}, ${y.k}/${y.d}/${y.a}, ${y.cs} CS, ${y.oro} gold unspent, items [${y.objetos.map(n).join(', ')}]`,
    `Allies: ${jugadores(p.aliados)}`,
    `Enemies (scoreboard): ${jugadores(p.enemigos)}`,
    `Score: allies ${p.marcador.aliados} - enemies ${p.marcador.enemigos}`,
  ];
  if (p.objetivos.length) {
    lineas.push(`Objectives taken: ${p.objetivos.map((o) => `${o.tipo}${o.subtipo ? ` (${o.subtipo})` : ''} by ${o.equipo === 'aliado' ? 'allies' : 'enemies'}`).join('; ')}`);
  }
  if (p.proximoObjetivo) lineas.push(`Next public objective: ${p.proximoObjetivo.tipo}${p.proximoObjetivo.subtipo ? ` (${p.proximoObjetivo.subtipo})` : ''}, spawning soon.`);
  if (p.recientes.length) lineas.push(`Recent events: ${p.recientes.join('; ')}`);
  lineas.push('Write the single sentence now.');
  return lineas.join('\n');
}

/** Esquema JSON del análisis (salida estructurada). */
export const ESQUEMA_ANALISIS = {
  type: 'object',
  additionalProperties: false,
  required: ['veredicto', 'bien', 'mejorar', 'momentos', 'enfoque'],
  properties: {
    veredicto: { type: 'string', description: '1-2 sentence verdict of the game.' },
    bien: {
      type: 'array',
      description: 'Exactly 3 things the player did well.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'porque'],
        properties: { titulo: { type: 'string' }, porque: { type: 'string', description: 'Why, citing the numbers.' } },
      },
    },
    mejorar: {
      type: 'array',
      description: 'Exactly 3 concrete things to improve.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'porque'],
        properties: { titulo: { type: 'string' }, porque: { type: 'string', description: 'Why, citing the numbers.' } },
      },
    },
    momentos: {
      type: 'array',
      description: 'Exactly 2 key moments.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['t', 'texto'],
        properties: { t: { type: 'integer', description: 'Game time in seconds.' }, texto: { type: 'string' } },
      },
    },
    enfoque: { type: 'string', description: 'One focus for the next game.' },
  },
} as const;
