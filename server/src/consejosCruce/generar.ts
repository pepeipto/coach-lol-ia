import Anthropic from '@anthropic-ai/sdk';
import { normalizarConsejosEnfrentamiento, type ConsejosEnfrentamiento, type IdiomaIa, type Rol } from '@coach/shared';
import { plano } from '../coachIa/filtro';
import { IDIOMA_IA } from '../coachIa/prompts';
import type { CrearMensajeIa } from '../coachIa/rutas';
import type { DatosCampeonFicha } from '../ficha/ddragon';
import { fraseProhibida } from '../ficha/generar';
import { ESQUEMA_CONSEJOS_CRUCE, mensajeConsejosCruce, SISTEMA_CONSEJOS_CRUCE, type CifrasCruce } from './prompts';

export const MAX_TOKENS_CONSEJOS_CRUCE = 6000;
const TIEMPO_CONSEJOS_CRUCE_MS = 90_000;

/**
 * Cifras de rendimiento en cualquiera de los cinco idiomas: porcentajes, «win rate», «tasa de victorias», tiers o
 * MMR/elo. Un consejo del cruce nunca las lleva (el prompt no se las da y, si el modelo se las inventa, se descarta).
 */
const CIFRAS_PROHIBIDAS = [
  /%|\bpercent\w*|\bporcent\w*|\bpourcent\w*|\bprozent\w*/,
  /\bwin ?rates?\b|\bwinrate\w*|\btasas? de victoria\w*|\btaxas? de vitoria\w*|\btaux de victoire\b|\bsieg(es)?rate\w*|\bsiegquote\w*/,
  /\bmmr\b|\belo\b|\btier ?(s|list)?\b/,
];

/** true si el consejo incumple la política (la de la ficha más cifras de rendimiento). */
export function consejoProhibido(texto: string): boolean {
  if (fraseProhibida(texto)) return true;
  const p = plano(texto);
  return CIFRAS_PROHIBIDAS.some((r) => r.test(p));
}

/** Lee y valida la salida del modelo. Null si no llega al mínimo de consejos válidos. */
export function leerConsejosCruce(
  texto: string,
  campeon: string,
  rival: string,
  rol: Rol,
  idioma: IdiomaIa,
  generadoEn: string,
): ConsejosEnfrentamiento | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== 'object' || crudo === null) return null;
  const c = crudo as Record<string, unknown>;
  const validas = (v: unknown) => (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === 'string' && !consejoProhibido(s));
  return normalizarConsejosEnfrentamiento({
    campeon,
    rival,
    idioma,
    rol,
    consejos: validas(c.consejos),
    combos: validas(c.combos),
    generadoEn,
  });
}

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** Parámetros de la llamada (exportados para las pruebas). */
export function paramsConsejosCruce(
  modelo: string,
  campeon: DatosCampeonFicha,
  rival: DatosCampeonFicha,
  rol: Rol,
  idioma: IdiomaIa,
  cifras: CifrasCruce | null,
): Params {
  const params: Params = {
    model: modelo,
    max_tokens: MAX_TOKENS_CONSEJOS_CRUCE,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_CONSEJOS_CRUCE as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SISTEMA_CONSEJOS_CRUCE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: IDIOMA_IA[idioma] },
    ],
    messages: [{ role: 'user', content: mensajeConsejosCruce(campeon, rival, rol, cifras) }],
  };
  if (/^claude-(sonnet|opus|fable)-/.test(modelo)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

/** Pide los consejos al modelo. Null si el modelo los rechaza o devuelve algo que no pasa la validación. */
export async function generarConsejosCruce(
  o: { crear: CrearMensajeIa; modelo: string; ahora?: () => number },
  campeon: DatosCampeonFicha,
  rival: DatosCampeonFicha,
  rol: Rol,
  idioma: IdiomaIa,
  cifras: CifrasCruce | null,
): Promise<ConsejosEnfrentamiento | null> {
  const r = await o.crear(paramsConsejosCruce(o.modelo, campeon, rival, rol, idioma, cifras), { timeout: TIEMPO_CONSEJOS_CRUCE_MS });
  const cruce = `${campeon.id} vs ${rival.id} (${rol}, ${idioma})`;
  if (r.stop_reason === 'refusal') {
    console.warn(`[consejos-cruce] El modelo rechazó ${cruce}`);
    return null;
  }
  if (r.stop_reason === 'max_tokens') console.warn(`[consejos-cruce] ${cruce} cortado por max_tokens`);
  const texto = r.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const consejos = leerConsejosCruce(texto, campeon.id, rival.id, rol, idioma, new Date((o.ahora ?? Date.now)()).toISOString());
  if (!consejos) console.warn(`[consejos-cruce] ${cruce} no pasó la validación`);
  return consejos;
}
