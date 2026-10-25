import Anthropic from '@anthropic-ai/sdk';
import {
  LIMITES_NOTAS_PARCHE,
  normalizarNotasParche,
  parcheJuegoDeDDragon,
  TIPOS_CAMBIO_PARCHE,
  urlNotasParche,
  type CambioCampeonParche,
  type CambioObjetoParche,
  type IdiomaIa,
  type NotasParche,
  type TipoCambioParche,
} from '@coach/shared';
import { PATRONES_PROHIBIDOS, plano } from '../coachIa/filtro';
import { IDIOMA_IA } from '../coachIa/prompts';
import type { CrearMensajeIa } from '../coachIa/rutas';
import { claveNombre, type NotasExtraidas } from './notas';
import { ESQUEMA_PARCHE, mensajeParche, SISTEMA_PARCHE } from './prompts';

export const MAX_TOKENS_PARCHE = 16000;
const TIEMPO_PARCHE_MS = 120_000;
/** Palabras seguidas iguales a las notas a partir de las que una frase se considera copiada. */
export const PALABRAS_COPIA = 8;

/** Los motivos del filtro del coach que valen aquí (las notas sí hablan de enfriamientos y segundos). */
const MOTIVOS = new Set(['orden', 'posicion', 'enlace']);

export function fraseProhibidaParche(texto: string): boolean {
  const p = plano(texto);
  return PATRONES_PROHIBIDOS.some(({ motivo, patron }) => MOTIVOS.has(motivo) && patron.test(p));
}

const palabras = (t: string) => plano(t).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Todas las secuencias de PALABRAS_COPIA palabras del texto de las notas (para detectar frases copiadas). */
export function secuenciasFuente(n: NotasExtraidas): Set<string> {
  const s = new Set<string>();
  for (const b of [...n.campeones, ...n.objetos]) {
    const p = palabras(b.texto);
    for (let i = 0; i + PALABRAS_COPIA <= p.length; i++) s.add(p.slice(i, i + PALABRAS_COPIA).join(' '));
  }
  return s;
}

/** true si la frase repite PALABRAS_COPIA o más palabras seguidas de las notas de Riot. */
export function copiaDeLaFuente(frase: string, fuente: Set<string>): boolean {
  const p = palabras(frase);
  for (let i = 0; i + PALABRAS_COPIA <= p.length; i++) if (fuente.has(p.slice(i, i + PALABRAS_COPIA).join(' '))) return true;
  return false;
}

/**
 * Lee y valida la salida del modelo: solo campeones y objetos que están en las notas (con su id de Data Dragon), sin
 * frases prohibidas ni copiadas, con los tamaños del contrato. Null si el modelo no devuelve nada aprovechable.
 */
export function leerResumen(
  texto: string,
  extraidas: NotasExtraidas,
  parche: string,
  idioma: IdiomaIa,
  generadoEn: string,
): NotasParche | null {
  const parcheJuego = parcheJuegoDeDDragon(parche);
  if (!parcheJuego) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== 'object' || crudo === null) return null;
  const c = crudo as Record<string, unknown>;
  const fuente = secuenciasFuente(extraidas);
  const valida = (x: unknown, max: number = LIMITES_NOTAS_PARCHE.caracteres): string | null => {
    if (typeof x !== 'string') return null;
    const t = x.replace(/\s+/g, ' ').trim();
    if (!t || t.length > max || fraseProhibidaParche(t) || copiaDeLaFuente(t, fuente)) return null;
    return t;
  };
  const esTipo = (x: unknown): x is TipoCambioParche => TIPOS_CAMBIO_PARCHE.includes(x as TipoCambioParche);

  const idsCampeon = new Map(extraidas.campeones.map((e) => [e.id.toLowerCase(), e.id]));
  const campeones: CambioCampeonParche[] = [];
  for (const e of Array.isArray(c.campeones) ? c.campeones : []) {
    const r = e as Record<string, unknown>;
    const id = typeof r?.campeon === 'string' ? idsCampeon.get(r.campeon.trim().toLowerCase()) : undefined;
    const resumen = valida(r?.resumen);
    if (!id || !esTipo(r.tipo) || !resumen || campeones.some((x) => x.campeon === id)) continue;
    campeones.push({ campeon: id, tipo: r.tipo, resumen });
  }

  const objetosNotas = new Map(extraidas.objetos.map((o) => [claveNombre(o.nombre), o]));
  const objetos: CambioObjetoParche[] = [];
  for (const e of Array.isArray(c.objetos) ? c.objetos : []) {
    const r = e as Record<string, unknown>;
    const o = typeof r?.objeto === 'string' ? objetosNotas.get(claveNombre(r.objeto)) : undefined;
    const resumen = valida(r?.resumen);
    if (!o || !esTipo(r.tipo) || !resumen || objetos.some((x) => x.objeto === o.nombre)) continue;
    objetos.push({ objeto: o.nombre, ...(o.id ? { id: o.id } : {}), tipo: r.tipo, resumen });
  }

  // Si había campeones en las notas y no queda ninguno (o casi), el resumen no sirve.
  if (extraidas.campeones.length > 0 && campeones.length < Math.ceil(extraidas.campeones.length / 2)) return null;
  if (campeones.length === 0 && objetos.length === 0) return null;
  const general = valida(c.general, LIMITES_NOTAS_PARCHE.general);
  return normalizarNotasParche({
    parche,
    parcheJuego,
    idioma,
    url: urlNotasParche(parcheJuego, idioma),
    ...(general ? { general } : {}),
    campeones,
    objetos,
    generadoEn,
  });
}

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** Parámetros de la llamada (exportados para las pruebas). */
export function paramsParche(modelo: string, extraidas: NotasExtraidas, idioma: IdiomaIa): Params {
  const params: Params = {
    model: modelo,
    max_tokens: MAX_TOKENS_PARCHE,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_PARCHE as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SISTEMA_PARCHE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: IDIOMA_IA[idioma] },
    ],
    messages: [{ role: 'user', content: mensajeParche(extraidas) }],
  };
  if (/^claude-(sonnet|opus|fable)-/.test(modelo)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

/** Pide el resumen al modelo. Null si lo rechaza o devuelve algo que no pasa la validación. */
export async function generarResumen(
  o: { crear: CrearMensajeIa; modelo: string; ahora?: () => number },
  extraidas: NotasExtraidas,
  parche: string,
  idioma: IdiomaIa,
): Promise<NotasParche | null> {
  const r = await o.crear(paramsParche(o.modelo, extraidas, idioma), { timeout: TIEMPO_PARCHE_MS });
  if (r.stop_reason === 'refusal') {
    console.warn(`[parche] El modelo rechazó el resumen del parche ${parche} (${idioma})`);
    return null;
  }
  if (r.stop_reason === 'max_tokens') console.warn(`[parche] Resumen del parche ${parche} (${idioma}) cortado por max_tokens`);
  const texto = r.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const notas = leerResumen(texto, extraidas, parche, idioma, new Date((o.ahora ?? Date.now)()).toISOString());
  if (!notas) console.warn(`[parche] El resumen del parche ${parche} (${idioma}) no pasó la validación`);
  return notas;
}
