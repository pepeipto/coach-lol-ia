import type { IdiomaIa, MensajePersonal, PeticionPersonal, ResumenPersonal } from '@coach/shared';
import { IDIOMAS_IA, ROLES } from '@coach/shared';
import { IDIOMA_IA, REGLAS_RIOT } from './prompts';

/*
 * 3.5: coach personal (estilo Project AVA de Razer): conversación con un coach que conoce el perfil del jugador
 * (cifras agregadas de sus últimas partidas, sin nombres ni Riot ID). POST /api/coach/personal.
 */

export const MAX_MENSAJES_PERSONAL = 12;
export const MAX_CARACTERES_USUARIO = 600;
export const MAX_CARACTERES_COACH = 2000;
export const MAX_TOKENS_PERSONAL = 700;
export const MAX_CUERPO_PERSONAL = 24 * 1024;

export const SISTEMA_PERSONAL = `You are Coach LoL IA, the player's personal League of Legends coach: a warm, sharp and honest companion who knows this player's recent history (the profile summary below every conversation). Think of a real coach sitting next to the player between games.

${REGLAS_RIOT}

How you talk:
- Use the profile data: their champions, their scores (0-100, where 60 is typical for the role), their trends (last 10 games vs previous 10) and their active practice challenge. Quote concrete numbers when they help ("your deaths went from 6.1 to 4.3").
- Be specific and practical: one or two clear ideas the player can apply in the next game, not a lecture. Explain the why.
- Be encouraging and real: celebrate genuine progress; when something is weak, frame it as the next step, never as a flaw of the person.
- You can talk about champion matchups, builds, macro, mindset, tilt, warm-up routines and how to use Coach LoL IA's features (Profile, challenges, overlay, voice). Do not invent statistics you were not given (no win rates of champions, augments or items).
- If the player asks something unrelated to League of Legends or self-improvement in games, say kindly that you are their LoL coach and bring it back.
- If the profile has no games yet, say so and suggest opening the League client so the app can read their history.
- Keep answers short: at most 120 words, plain text, no markdown headings, at most 3 short bullet points when listing.`;

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : null;
const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t && t.length <= max ? t : null;
};
const esObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function validarResumen(v: unknown): ResumenPersonal | null {
  if (!esObj(v)) return null;
  const rango = v.rango === '' ? '' : texto(v.rango, 40);
  const partidas = num(v.partidas, 0, 200);
  if (rango === null || partidas === null) return null;
  const campeones: ResumenPersonal['campeones'] = [];
  for (const c of Array.isArray(v.campeones) ? v.campeones.slice(0, 8) : []) {
    if (!esObj(c)) return null;
    const campeon = texto(c.campeon, 30);
    const vals = [num(c.partidas, 0, 200), num(c.victorias, 0, 200), num(c.kda, 0, 100), num(c.csMin, 0, 20), num(c.nota, 0, 100)];
    if (!campeon || vals.some((x) => x === null)) return null;
    const [p, vi, kda, csMin, nota] = vals as number[];
    campeones.push({ campeon, partidas: p!, victorias: vi!, kda: kda!, csMin: csMin!, nota: nota! });
  }
  const tendencias: ResumenPersonal['tendencias'] = [];
  for (const t of Array.isArray(v.tendencias) ? v.tendencias.slice(0, 8) : []) {
    if (!esObj(t)) return null;
    const id = texto(t.id, 20);
    const valor = num(t.valor, -1000, 1000);
    const cambio = t.cambio === null ? null : num(t.cambio, -1000, 1000);
    if (!id || valor === null || (t.cambio !== null && cambio === null)) return null;
    tendencias.push({ id, valor, cambio });
  }
  let reto: ResumenPersonal['reto'] = null;
  if (v.reto !== null && v.reto !== undefined) {
    if (!esObj(v.reto)) return null;
    const id = texto(v.reto.id, 20);
    const hechas = num(v.reto.hechas, 0, 50);
    const objetivo = num(v.reto.objetivo, 1, 50);
    if (!id || hechas === null || objetivo === null) return null;
    reto = { id, hechas, objetivo };
  }
  const ultimas: ResumenPersonal['ultimas'] = [];
  for (const u of Array.isArray(v.ultimas) ? v.ultimas.slice(0, 10) : []) {
    if (!esObj(u)) return null;
    const campeon = texto(u.campeon, 30);
    const modo = texto(u.modo, 20);
    const rol = u.rol === null ? null : ROLES.includes(u.rol as never) ? (u.rol as ResumenPersonal['ultimas'][number]['rol']) : undefined;
    const vals = [num(u.k, 0, 100), num(u.d, 0, 100), num(u.a, 0, 100), num(u.csMin, 0, 20), num(u.nota, 0, 100), num(u.minutos, 0, 120)];
    if (!campeon || !modo || rol === undefined || typeof u.victoria !== 'boolean' || vals.some((x) => x === null)) return null;
    const [k, d, a, csMin, nota, minutos] = vals as number[];
    ultimas.push({ campeon, modo, rol, victoria: u.victoria, k: k!, d: d!, a: a!, csMin: csMin!, nota: nota!, minutos: minutos! });
  }
  return { rango, partidas, campeones, tendencias, reto, ultimas };
}

/** Comprueba el cuerpo; null si no vale. La conversación debe terminar con un mensaje del usuario. */
export function validarPersonal(cuerpo: unknown): PeticionPersonal | null {
  if (!esObj(cuerpo)) return null;
  const idioma = IDIOMAS_IA.includes(cuerpo.idioma as IdiomaIa) ? (cuerpo.idioma as IdiomaIa) : null;
  const perfil = validarResumen(cuerpo.perfil);
  if (!idioma || !perfil || !Array.isArray(cuerpo.mensajes)) return null;
  const crudos = cuerpo.mensajes.slice(-MAX_MENSAJES_PERSONAL);
  const mensajes: MensajePersonal[] = [];
  for (const m of crudos) {
    if (!esObj(m) || (m.rol !== 'usuario' && m.rol !== 'coach')) return null;
    const t = texto(m.texto, m.rol === 'usuario' ? MAX_CARACTERES_USUARIO : MAX_CARACTERES_COACH);
    if (!t) return null;
    mensajes.push({ rol: m.rol, texto: t });
  }
  if (!mensajes.length || mensajes.at(-1)!.rol !== 'usuario') return null;
  return { idioma, perfil, mensajes };
}

/** El resumen del perfil como texto para el modelo (va delante de la conversación). */
export function textoPerfil(p: ResumenPersonal): string {
  const l: string[] = ['PLAYER PROFILE (from their own LoL client, last games):'];
  l.push(`- Rank (Solo/Duo): ${p.rango || 'unranked'}; games in summary: ${p.partidas}`);
  if (p.campeones.length)
    l.push(`- Champions: ${p.campeones.map((c) => `${c.campeon} (${c.partidas} games, ${c.victorias} wins, KDA ${c.kda}, ${c.csMin} CS/min, score ${c.nota})`).join('; ')}`);
  if (p.tendencias.length)
    l.push(`- Trends (avg last 10${p.tendencias.some((t) => t.cambio !== null) ? ', change vs previous 10' : ''}): ${p.tendencias.map((t) => `${t.id} ${t.valor}${t.cambio === null ? '' : ` (${t.cambio >= 0 ? '+' : ''}${t.cambio})`}`).join(', ')}`);
  l.push(p.reto ? `- Active practice challenge: ${p.reto.id} (${p.reto.hechas}/${p.reto.objetivo} games done)` : '- No active practice challenge');
  for (const u of p.ultimas)
    l.push(`- Game: ${u.campeon}, ${u.modo}${u.rol ? ` ${u.rol}` : ''}, ${u.victoria ? 'win' : 'loss'}, ${u.k}/${u.d}/${u.a}, ${u.csMin} CS/min, score ${u.nota}, ${u.minutos} min`);
  l.push('Scores: 0-100, 60 = typical for the role. Challenge ids: cs7/cs8 = CS per minute, muertes4 = 4 deaths or fewer, kp50 = kill participation 50%, vision1 = 1 vision/min, dano25 = 25% of team damage, puntuacion60 = score 60+, victorias3 = win 3 games.');
  return l.join('\n');
}

/** Mensajes para la API: el perfil va como primer turno del usuario, delante de la conversación. */
export function mensajesPersonal(p: PeticionPersonal): { role: 'user' | 'assistant'; content: string }[] {
  const conv = p.mensajes.map((m) => ({ role: m.rol === 'usuario' ? ('user' as const) : ('assistant' as const), content: m.texto }));
  // La API exige empezar por el usuario: el perfil se une al primer mensaje del usuario.
  const primero = conv.findIndex((m) => m.role === 'user');
  const desde = conv.slice(primero);
  desde[0] = { role: 'user', content: `${textoPerfil(p.perfil)}\n\n---\n${desde[0]!.content}` };
  return desde;
}

export const sistemaPersonal = (idioma: IdiomaIa) => [
  { type: 'text' as const, text: SISTEMA_PERSONAL, cache_control: { type: 'ephemeral' as const } },
  { type: 'text' as const, text: IDIOMA_IA[idioma] },
];
