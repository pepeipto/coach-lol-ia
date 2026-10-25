import Anthropic from '@anthropic-ai/sdk';
import { LIMITES_FICHA, normalizarFicha, type FichaCampeon, type IdiomaIa } from '@coach/shared';
import { PATRONES_PROHIBIDOS, plano } from '../coachIa/filtro';
import { IDIOMA_IA } from '../coachIa/prompts';
import type { CrearMensajeIa } from '../coachIa/rutas';
import type { CampeonLista, DatosCampeonFicha } from './ddragon';
import { ESQUEMA_FICHA, mensajeFicha, SISTEMA_FICHA } from './prompts';

export const MAX_TOKENS_FICHA = 8000;
const TIEMPO_FICHA_MS = 90_000;

/**
 * Motivos del filtro del coach que también valen para una ficha: órdenes en tiempo real, posiciones de enemigos y
 * enlaces. (Los de enfriamientos y segundos no: una ficha puede hablar del enfriamiento de las habilidades propias.)
 */
const MOTIVOS_FICHA = new Set(['orden', 'posicion', 'enlace']);

/** true si la frase incumple la política (orden en tiempo real, posición de enemigos o enlace). */
export function fraseProhibida(texto: string): boolean {
  const p = plano(texto);
  return PATRONES_PROHIBIDOS.some(({ motivo, patron }) => MOTIVOS_FICHA.has(motivo) && patron.test(p));
}

/**
 * Lee y valida la salida del modelo: frases sin lo que prohíbe la política, `parecidos` solo con ids reales de Data
 * Dragon (escritos con su forma exacta) y los tamaños del contrato. Null si algo no llega al mínimo.
 */
export function leerFicha(
  texto: string,
  campeon: string,
  idioma: IdiomaIa,
  campeones: Map<string, CampeonLista>,
  generadoEn: string,
): Omit<FichaCampeon, 'danio'> | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== 'object' || crudo === null) return null;
  const c = crudo as Record<string, unknown>;
  const frases = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === 'string' && s.length <= LIMITES_FICHA.caracteres && !fraseProhibida(s));
  const parecidos = (Array.isArray(c.parecidos) ? c.parecidos : [])
    .map((p) => (typeof p === 'string' ? campeones.get(p.trim().toLowerCase())?.id : undefined))
    .filter((p): p is string => !!p);
  const ficha = normalizarFicha({
    campeon,
    idioma,
    claves: frases(c.claves),
    fortalezas: frases(c.fortalezas),
    debilidades: frases(c.debilidades),
    parecidos,
    generadoEn,
  });
  if (!ficha) return null;
  const { danio: _sinDanio, ...resto } = ficha;
  return resto;
}

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** Parámetros de la llamada (exportados para las pruebas). */
export function paramsFicha(modelo: string, datos: DatosCampeonFicha, idioma: IdiomaIa, campeones: Map<string, CampeonLista>): Params {
  const params: Params = {
    model: modelo,
    max_tokens: MAX_TOKENS_FICHA,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_FICHA as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SISTEMA_FICHA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: IDIOMA_IA[idioma] },
    ],
    messages: [{ role: 'user', content: mensajeFicha(datos, campeones.values()) }],
  };
  if (/^claude-(sonnet|opus|fable)-/.test(modelo)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

/** Pide la ficha al modelo. Null si el modelo la rechaza o devuelve algo que no pasa la validación. */
export async function generarFicha(
  o: { crear: CrearMensajeIa; modelo: string; ahora?: () => number },
  datos: DatosCampeonFicha,
  idioma: IdiomaIa,
  campeones: Map<string, CampeonLista>,
): Promise<Omit<FichaCampeon, 'danio'> | null> {
  const r = await o.crear(paramsFicha(o.modelo, datos, idioma, campeones), { timeout: TIEMPO_FICHA_MS });
  if (r.stop_reason === 'refusal') {
    console.warn(`[ficha] El modelo rechazó la ficha de ${datos.id}`);
    return null;
  }
  if (r.stop_reason === 'max_tokens') console.warn(`[ficha] Ficha de ${datos.id} cortada por max_tokens`);
  const texto = r.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const ficha = leerFicha(texto, datos.id, idioma, campeones, new Date((o.ahora ?? Date.now)()).toISOString());
  if (!ficha) console.warn(`[ficha] La ficha de ${datos.id} (${idioma}) no pasó la validación`);
  return ficha;
}
