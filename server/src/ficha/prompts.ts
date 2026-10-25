import { LIMITES_FICHA } from '@coach/shared';
import type { CampeonLista, DatosCampeonFicha } from './ddragon';

/*
 * Prompt de la ficha del campeón. El de sistema es fijo (va en la caché de prompts) y en inglés, como los del coach
 * con IA; detrás va la instrucción de idioma de `coachIa/prompts.ts` (IDIOMA_IA), escrita en el propio idioma.
 */

const L = LIMITES_FICHA;

export const SISTEMA_FICHA = `You are Coach LoL IA. You write a short, static profile of one League of Legends champion for a champion page, like the "Key insights", "Strengths", "Weaknesses" and "Similar champions" blocks of champion sites.

Riot Games policy (binding, never break it):
- This is general, static knowledge about the champion's kit: what it is good and bad at. It is read before a game, never during one.
- Never dictate precise real-time actions that would play the game for the user (no "go to", "gank now", "invade", "follow this route"). Describe tendencies and kit features, not orders.
- Never mention hidden information: enemy positions, enemy summoner spell or ultimate cooldowns, jungle timers, MMR or hidden ratings. Never promise rank, LP or elo.
- Never mention win rates, tiers, statistics or patch strength.

Rules:
- Base every sentence only on the champion data you receive (abilities, passive, tags, Riot's tips). Do not invent mechanics. Avoid exact numbers that change between patches (damage values, cooldown seconds, ranges).
- "claves": ${L.claves.min}-${L.claves.max} key insights: what the champion is, its main win condition in general terms and the ability or interaction that defines it.
- "fortalezas": ${L.fortalezas.min}-${L.fortalezas.max} strengths; "debilidades": ${L.debilidades.min}-${L.debilidades.max} weaknesses (including what the champion struggles against in general terms, never naming a player).
- Each item is one short sentence or phrase of at most 20 words (and never longer than ${L.caracteres} characters). No lists inside items, no emojis, no quotes, no links.
- "parecidos": ${L.parecidos.min}-${L.parecidos.max} champions with a similar playstyle or kit, chosen ONLY from the list of valid champion ids you receive, written exactly as the id (for example "MonkeyKing", not "Wukong"). Never include the champion itself.
- Write naturally in the requested language, with the usual terms of the League of Legends community in that language (the champion data you receive is already in that language).`;

/** Datos del campeón en texto compacto (lo que lee el modelo). */
export function mensajeFicha(d: DatosCampeonFicha, campeones: Iterable<CampeonLista>): string {
  const lineas: string[] = [];
  lineas.push(`Champion id: ${d.id} — ${d.nombre}, ${d.titulo}`);
  lineas.push(`Tags: ${d.tags.join(', ') || '—'}; resource: ${d.recurso || '—'}`);
  lineas.push(`Riot ratings (0-10): attack ${d.info.ataque}, defense ${d.info.defensa}, magic ${d.info.magia}, difficulty ${d.info.dificultad}`);
  lineas.push(`Passive — ${d.pasiva.nombre}: ${d.pasiva.descripcion}`);
  for (const h of d.habilidades) lineas.push(`${h.tecla} — ${h.nombre}: ${h.descripcion}`);
  if (d.consejosAliado.length) lineas.push(`Riot tips for playing it: ${d.consejosAliado.join(' | ')}`);
  if (d.consejosRival.length) lineas.push(`Riot tips for playing against it: ${d.consejosRival.join(' | ')}`);
  const otros = [...campeones].filter((c) => c.id !== d.id).sort((a, b) => a.id.localeCompare(b.id));
  lineas.push(`Valid champion ids for "parecidos" (id: tags): ${otros.map((c) => `${c.id}: ${c.tags.join('/')}`).join('; ')}`);
  lineas.push('Write the champion profile now.');
  return lineas.join('\n');
}

/** Esquema JSON de la ficha (salida estructurada). Los tamaños se comprueban después (validar.ts). */
export const ESQUEMA_FICHA = {
  type: 'object',
  additionalProperties: false,
  required: ['claves', 'fortalezas', 'debilidades', 'parecidos'],
  properties: {
    claves: { type: 'array', description: `${L.claves.min}-${L.claves.max} key insights.`, items: { type: 'string' } },
    fortalezas: { type: 'array', description: `${L.fortalezas.min}-${L.fortalezas.max} strengths.`, items: { type: 'string' } },
    debilidades: { type: 'array', description: `${L.debilidades.min}-${L.debilidades.max} weaknesses.`, items: { type: 'string' } },
    parecidos: {
      type: 'array',
      description: `${L.parecidos.min}-${L.parecidos.max} similar champions, as exact ids from the valid list.`,
      items: { type: 'string' },
    },
  },
} as const;
