import { LIMITES_CONSEJOS_ENFRENTAMIENTO, type Rol } from '@coach/shared';
import type { DatosCampeonFicha } from '../ficha/ddragon';

/*
 * Prompt de los consejos del enfrentamiento («Claves del cruce»). Como el de la ficha: el de sistema es fijo (va en la
 * caché de prompts) y en inglés; detrás va la instrucción de idioma de `coachIa/prompts.ts` (IDIOMA_IA).
 */

const L = LIMITES_CONSEJOS_ENFRENTAMIENTO;

export const SISTEMA_CONSEJOS_CRUCE = `You are Coach LoL IA. You write the "matchup keys" for one League of Legends lane matchup: what the player should know about the enemy laner BEFORE the game starts, like the matchup tips of champion sites.

Riot Games policy (binding, never break it):
- This is static, pre-game knowledge about the two kits and how they interact. It is read in champion select, never during the game.
- Never dictate precise real-time actions that would play the game for the user (no "go to", "gank now", "invade", "follow this route", "right now"). Phrase everything as tips about the matchup: "watch out for their E at level 2", "their power window is…", "you trade well when…".
- Never mention hidden information: enemy positions, enemy summoner spell or ultimate cooldowns, jungle timers, MMR or hidden ratings. Never promise rank, LP or elo.
- Never write win rates, percentages, tiers, statistics or patch strength. If you receive an assessment of the matchup from aggregated data, use it only to set the tone (favourable, even or hard), never as a number.

Rules:
- Base every tip only on the data you receive (abilities, passives, tags and Riot's tips for both champions). Do not invent mechanics. Avoid exact numbers that change between patches (damage values, cooldown seconds, ranges); level breakpoints such as "level 2", "level 3" or "level 6" are fine.
- "consejos": ${L.consejos.min}-${L.consejos.max} short tips specific to THIS matchup (the player's champion against this enemy in this role): the enemy ability to respect, the enemy power spikes or windows, when the player's champion trades well and what the enemy is weak to. Each tip is one sentence of at most 22 words (never longer than ${L.caracteres} characters). No lists inside tips, no emojis, no quotes, no links.
- "combos": 0-${L.combos.max} combos of the PLAYER's champion that are useful in this matchup, written only with ability keys, auto attacks (AA) and summoner spells joined by "→", for example "E → Q → W" or "AA → Q → AA". At most ${L.caracteresCombo} characters each. Leave the list empty if the champion has no meaningful combo.
- Write naturally in the requested language, with the usual terms of the League of Legends community in that language (the champion data you receive is already in that language).`;

/** Cifras agregadas del cruce que se pasan al modelo como contexto (nunca se citan). */
export interface CifrasCruce {
  partidas: number;
  tasaVictoria: number;
  tasaFaseLineas?: number;
}

const NOMBRE_ROL: Record<Rol, string> = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'bot (ADC)', UTILITY: 'support' };

function bloque(titulo: string, d: DatosCampeonFicha): string[] {
  const l: string[] = [];
  l.push(`${titulo}: ${d.id} — ${d.nombre}, ${d.titulo}`);
  l.push(`Tags: ${d.tags.join(', ') || '—'}; resource: ${d.recurso || '—'}`);
  l.push(`Passive — ${d.pasiva.nombre}: ${d.pasiva.descripcion}`);
  for (const h of d.habilidades) l.push(`${h.tecla} — ${h.nombre}: ${h.descripcion}`);
  if (d.consejosAliado.length) l.push(`Riot tips for playing it: ${d.consejosAliado.join(' | ')}`);
  if (d.consejosRival.length) l.push(`Riot tips for playing against it: ${d.consejosRival.join(' | ')}`);
  return l;
}

/** Cómo de favorable es el cruce, en palabras (lo único que el modelo debe sacar de las cifras). */
export function valoracionCruce(c: CifrasCruce): string {
  const v = c.tasaVictoria;
  const tono = v >= 0.53 ? 'favourable for the player' : v <= 0.47 ? 'hard for the player' : 'roughly even';
  const fase =
    c.tasaFaseLineas === undefined ? '' : c.tasaFaseLineas >= 0.53 ? '; the player usually wins the laning phase' : c.tasaFaseLineas <= 0.47 ? '; the player usually loses the laning phase' : '; the laning phase is usually even';
  return `${tono}${fase}`;
}

/** Datos de los dos campeones y del cruce en texto compacto (lo que lee el modelo). */
export function mensajeConsejosCruce(campeon: DatosCampeonFicha, rival: DatosCampeonFicha, rol: Rol, cifras: CifrasCruce | null): string {
  const lineas: string[] = [];
  lineas.push(`Role: ${NOMBRE_ROL[rol]}`);
  lineas.push(...bloque("Player's champion", campeon));
  lineas.push('');
  lineas.push(...bloque('Enemy laner', rival));
  lineas.push('');
  if (cifras) {
    // Solo la valoración en palabras: el modelo no recibe ningún porcentaje que pudiera repetir.
    lineas.push(`Aggregated ranked data for this matchup (context only, never quote it): ${valoracionCruce(cifras)}.`);
  } else {
    lineas.push('No aggregated data for this matchup: judge it only from the kits.');
  }
  lineas.push('Write the matchup keys now.');
  return lineas.join('\n');
}

/** Esquema JSON de la salida (salida estructurada). Los tamaños se comprueban después. */
export const ESQUEMA_CONSEJOS_CRUCE = {
  type: 'object',
  additionalProperties: false,
  required: ['consejos', 'combos'],
  properties: {
    consejos: { type: 'array', description: `${L.consejos.min}-${L.consejos.max} short pre-game tips for this matchup.`, items: { type: 'string' } },
    combos: { type: 'array', description: `0-${L.combos.max} combos of the player's champion, like "E → Q → W".`, items: { type: 'string' } },
  },
} as const;
