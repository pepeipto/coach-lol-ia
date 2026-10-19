import type { CalleJungla, RutaJungla } from '@coach/shared';
import type { LineaTiempoRiot } from './riot/riotApi';

/*
 * Track F2 · Ruta habitual de cada jungla, estimada con datos agregados de partidas ya terminadas:
 * las posiciones de los minutos 1 a 4 (`participantFrames[*].position`) de las líneas de tiempo de Match-v5.
 * Nunca es la posición de nadie en una partida en curso.
 *
 * Geometría de la Grieta del Invocador: coordenadas de 0 a 14870 en los dos ejes. El lado azul (ORDER, equipo 100)
 * tiene la base abajo a la izquierda y el rojo (CHAOS, 200), arriba a la derecha.
 * - El río va de arriba a la izquierda a abajo a la derecha (x + y = 14870): separa la mitad de cada equipo.
 * - La calle de mid sigue la otra diagonal (y = x) y parte la jungla de cada equipo en dos cuadrantes: arriba de mid
 *   están el bufo azul del lado azul y el bufo rojo del lado rojo; abajo, el bufo rojo del lado azul y el azul del rojo.
 * - La calle de arriba va por el borde izquierdo y el de arriba; la de abajo, por el borde de abajo y el derecho
 *   (la esquina de bot está abajo a la derecha).
 */

export const TAMANO_MAPA = 14870;
/** Distancia máxima (unidades del juego) a la línea central de una calle para contar como «en la calle». */
export const CERCA_CALLE = 900;
/** Mid es más estrecha y tiene los Aves y los lobos cerca: pasillo más estrecho. */
export const CERCA_MID = 600;
/** Alrededor de cada campamento de la jungla no se cuenta ninguna calle (el jungla está limpiando, no gankeando). */
export const RADIO_CAMPAMENTO = 700;
/** Con menos partidas que estas no se publica la ruta. */
export const MIN_PARTIDAS_RUTA = 30;
/** El lado de inicio se publica si al menos este porcentaje de las partidas con lado claro coincide. */
export const FRACCION_LADO = 0.6;
/** La calle del primer gank se publica si aparece en al menos este porcentaje de todas las partidas (y 5 o más). */
export const FRACCION_GANK = 0.25;
const MIN_GANKS = 5;
/** En la base o cerca del río no se sabe por qué lado empieza. */
const RADIO_BASE = 2500;
const MARGEN_RIO = 400;
const MARGEN_MID = 500;
/** Un frame de la línea de tiempo cuenta como «minuto m» si su timestamp está a menos de 20 s de m:00. */
const TOLERANCIA_MS = 20_000;

type Punto = { x: number; y: number };
export type Equipo = 100 | 200;
export interface RutaPartida {
  inicio: 'rojo' | 'azul' | null;
  primerGank: { calle: CalleJungla; minuto: number } | null;
}

const FUENTE: Record<Equipo, Punto> = { 100: { x: 400, y: 420 }, 200: { x: 14340, y: 14390 } };

/** Líneas centrales aproximadas de las calles (de torre exterior a torre exterior, con su esquina). */
const CALLES: Record<CalleJungla, Punto[]> = {
  top: [
    { x: 1100, y: 5000 },
    { x: 1200, y: 13600 },
    { x: 10000, y: 13800 },
  ],
  mid: [
    { x: 3800, y: 3800 },
    { x: 11000, y: 11000 },
  ],
  bot: [
    { x: 5000, y: 1100 },
    { x: 13600, y: 1200 },
    { x: 13800, y: 10000 },
  ],
};

/**
 * Campamentos de la jungla (aproximados, mapas de la comunidad): bufo azul, Gromp, lobos, Aves, bufo rojo y Krugs
 * de cada lado.
 */
export const CAMPAMENTOS: Punto[] = [
  { x: 3821, y: 8101 },
  { x: 2288, y: 8448 },
  { x: 3783, y: 6495 },
  { x: 7061, y: 5325 },
  { x: 7762, y: 4011 },
  { x: 8394, y: 2641 },
  { x: 11031, y: 6990 },
  { x: 12703, y: 6444 },
  { x: 11008, y: 8387 },
  { x: 7852, y: 9425 },
  { x: 7101, y: 10900 },
  { x: 6476, y: 12142 },
];

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

function distanciaSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return distancia(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * La calle más cercana si está a menos de CERCA_CALLE de su línea central (CERCA_MID en mid); null en la jungla
 * (a menos de RADIO_CAMPAMENTO de un campamento), el río o la base.
 */
export function calleCercana(p: Punto): CalleJungla | null {
  if (CAMPAMENTOS.some((c) => distancia(p, c) < RADIO_CAMPAMENTO)) return null;
  let mejor: { calle: CalleJungla; d: number } | null = null;
  for (const calle of Object.keys(CALLES) as CalleJungla[]) {
    const puntos = CALLES[calle];
    const maximo = calle === 'mid' ? CERCA_MID : CERCA_CALLE;
    for (let i = 0; i + 1 < puntos.length; i++) {
      const d = distanciaSegmento(p, puntos[i]!, puntos[i + 1]!);
      if (d <= maximo && (!mejor || d < mejor.d)) mejor = { calle, d };
    }
  }
  return mejor?.calle ?? null;
}

/**
 * Lado del primer campamento, relativo al equipo: 'azul' (su bufo azul) o 'rojo' (su bufo rojo). Null en la base,
 * en el río, junto a mid o en la jungla rival.
 */
export function ladoInicio(p: Punto, equipo: Equipo): 'rojo' | 'azul' | null {
  if (distancia(p, FUENTE[equipo]) < RADIO_BASE) return null;
  const suma = p.x + p.y;
  const enSuMitad = equipo === 100 ? suma < TAMANO_MAPA - MARGEN_RIO : suma > TAMANO_MAPA + MARGEN_RIO;
  if (!enSuMitad || Math.abs(p.y - p.x) < MARGEN_MID) return null;
  const arribaDeMid = p.y > p.x;
  if (equipo === 100) return arribaDeMid ? 'azul' : 'rojo';
  return arribaDeMid ? 'rojo' : 'azul';
}

type Frame = LineaTiempoRiot['info']['frames'][number];

/** Posición del participante en el minuto m (el frame de m:00), si la línea de tiempo la trae. */
function posicionEn(linea: LineaTiempoRiot, participante: number, minuto: number): Punto | null {
  const frames = linea.info.frames;
  const objetivo = minuto * 60_000;
  const frame: Frame | undefined =
    frames.find((f) => typeof f.timestamp === 'number' && Math.abs(f.timestamp - objetivo) <= TOLERANCIA_MS) ??
    (frames[minuto] && typeof frames[minuto]!.timestamp !== 'number' ? frames[minuto] : undefined);
  const pos = frame?.participantFrames?.[String(participante)]?.position;
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
  return { x: pos.x, y: pos.y };
}

/** Primer minuto entre el 2 y el 4 en que el jungla está cerca de una calle (su primer gank), con esa calle. */
export function primerGank(linea: LineaTiempoRiot, participante: number): RutaPartida['primerGank'] {
  for (const minuto of [2, 3, 4]) {
    const p = posicionEn(linea, participante, minuto);
    const calle = p ? calleCercana(p) : null;
    if (calle) return { calle, minuto };
  }
  return null;
}

/** Ruta del jungla en una partida; null si la línea de tiempo no trae ninguna posición de los minutos 1 a 4. */
export function rutaDePartida(linea: LineaTiempoRiot, participante: number, equipo: Equipo): RutaPartida | null {
  if (![1, 2, 3, 4].some((m) => posicionEn(linea, participante, m))) return null;
  let inicio: RutaPartida['inicio'] = null;
  for (const minuto of [1, 2]) {
    const p = posicionEn(linea, participante, minuto);
    inicio = p ? ladoInicio(p, equipo) : null;
    if (inicio) break;
  }
  return { inicio, primerGank: primerGank(linea, participante) };
}

function mediana(ns: number[]): number {
  const o = [...ns].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

/** Ruta habitual de un campeón a partir de sus partidas; null con menos de MIN_PARTIDAS_RUTA. */
export function agregarRuta(rutas: RutaPartida[]): RutaJungla | null {
  if (rutas.length < MIN_PARTIDAS_RUTA) return null;

  const lados = rutas.map((r) => r.inicio).filter((l): l is 'rojo' | 'azul' => l !== null);
  const rojos = lados.filter((l) => l === 'rojo').length;
  const masLado = rojos >= lados.length - rojos ? 'rojo' : 'azul';
  const cuentaLado = masLado === 'rojo' ? rojos : lados.length - rojos;
  const inicio = lados.length > 0 && cuentaLado / lados.length >= FRACCION_LADO ? masLado : null;

  const minutos = new Map<CalleJungla, number[]>();
  for (const r of rutas) {
    if (!r.primerGank) continue;
    minutos.set(r.primerGank.calle, [...(minutos.get(r.primerGank.calle) ?? []), r.primerGank.minuto]);
  }
  let primerGankHabitual: RutaJungla['primerGank'] = null;
  const [calle, ms] = [...minutos.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (calle && ms && ms.length >= Math.max(MIN_GANKS, FRACCION_GANK * rutas.length)) {
    primerGankHabitual = { calle, minuto: mediana(ms) };
  }
  return { inicio, primerGank: primerGankHabitual, partidas: rutas.length };
}
