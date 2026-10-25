import { LIMITES_NOTAS_PARCHE } from '@coach/shared';
import type { NotasExtraidas } from './notas';

/*
 * Prompt del resumen de las notas del parche. El de sistema es fijo (va en la caché de prompts) y en inglés, como los
 * del coach con IA; detrás va la instrucción de idioma de `coachIa/prompts.ts` (IDIOMA_IA).
 */

export const SISTEMA_PARCHE = `You are Coach LoL IA. You receive the champion and item changes of one League of Legends patch, taken from Riot's official patch notes, and you write a very short summary of each change for players, in your own words.

Rules:
- Copyright: never copy Riot's sentences. Write one short sentence of your own (at most 20 words, never longer than ${LIMITES_NOTAS_PARCHE.caracteres} characters) per champion and per item, saying what changes in plain words (for example "More mana growth, so he can use his abilities more freely in lane."). Do not list every number; mention at most one key number if it helps.
- "tipo": "mejora" if the change is overall a buff, "empeora" if it is overall a nerf, "ajuste" if it is mixed, a rework, a bug fix or neutral. Use Riot's own explanation and the before ⇒ after values to decide; when in doubt, use "ajuste".
- Base everything ONLY on the text you receive. Do not invent changes, champions or items. Use exactly the champion ids and item names given in the input, and include each of them once.
- "general": one or two sentences (at most ${LIMITES_NOTAS_PARCHE.general} characters) with the main idea of the patch for these champions and items. No hype, no predictions.
- Riot Games policy: never tell the player what to do in a game ("go", "gank", "invade", "pick X now"), never promise rank or LP, never mention win rates, tiers or hidden information. No links, no emojis, no quotes.
- Write naturally in the requested language, with the usual terms of the League of Legends community in that language. Keep champion and item names as players know them in that language.`;

/** Cambios extraídos en texto compacto (lo que lee el modelo). */
export function mensajeParche(n: NotasExtraidas): string {
  const lineas: string[] = [`Patch ${n.parcheJuego}.`, '', 'CHAMPIONS'];
  for (const c of n.campeones) lineas.push('', `### champion id: ${c.id} (${c.nombre})`, c.texto);
  lineas.push('', 'ITEMS');
  for (const o of n.objetos) lineas.push('', `### item name: ${o.nombre}`, o.texto);
  lineas.push('', 'Write the summary now.');
  return lineas.join('\n');
}

/** Esquema JSON del resumen (salida estructurada). Los tamaños y los ids se comprueban después (generar.ts). */
export const ESQUEMA_PARCHE = {
  type: 'object',
  additionalProperties: false,
  required: ['general', 'campeones', 'objetos'],
  properties: {
    general: { type: 'string', description: 'One or two sentences with the main idea of the patch.' },
    campeones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['campeon', 'tipo', 'resumen'],
        properties: {
          campeon: { type: 'string', description: 'Exact champion id from the input.' },
          tipo: { type: 'string', enum: ['mejora', 'empeora', 'ajuste'] },
          resumen: { type: 'string', description: 'One short sentence of your own.' },
        },
      },
    },
    objetos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['objeto', 'tipo', 'resumen'],
        properties: {
          objeto: { type: 'string', description: 'Exact item name from the input.' },
          tipo: { type: 'string', enum: ['mejora', 'empeora', 'ajuste'] },
          resumen: { type: 'string', description: 'One short sentence of your own.' },
        },
      },
    },
  },
} as const;
