import { esColaGrietaNormal, type Rol } from '@coach/shared';
import type { Etiqueta, JugadorHistorial, PartidaHistorial, Puntuaciones, Tendencia } from '../../shared/perfil';
import { CS_OBJETIVO_POR_MINUTO } from '../consejos/objetivos';

/*
 * 3.5: puntuaciones de 0 a 100 (combate, farmeo y visión), etiquetas y tendencias de cada partida, calculadas en
 * local con las estadísticas de fin de partida del cliente. La referencia de cada rol vale 60: un 100 es rendir
 * bastante por encima de lo normal (≈ 1,7 veces la referencia).
 */

/** Visión por minuto de referencia por rol (la de un jugador medio-alto). */
export const VISION_POR_MINUTO: Record<Rol, number> = { TOP: 0.7, JUNGLE: 1.1, MIDDLE: 0.8, BOTTOM: 0.7, UTILITY: 2 };
/** Oro por minuto de referencia por rol. */
export const ORO_POR_MINUTO: Record<Rol, number> = { TOP: 400, JUNGLE: 380, MIDDLE: 410, BOTTOM: 420, UTILITY: 280 };
/** Cuota del daño del equipo de referencia por rol. */
export const CUOTA_DANO: Record<Rol, number> = { TOP: 0.22, JUNGLE: 0.18, MIDDLE: 0.26, BOTTOM: 0.27, UTILITY: 0.1 };
/** En ARAM (sin roles): CS y oro por minuto de referencia. */
const CS_ARAM = 3.5;
const ORO_ARAM = 600;

const nota = (valor: number, referencia: number) => (referencia > 0 ? Math.max(0, Math.min(100, Math.round((60 * valor) / referencia))) : 0);
const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

export interface ContextoEquipo {
  /** Asesinatos de su equipo. */
  asesinatosEquipo: number;
  /** Daño a campeones de su equipo. */
  danoEquipo: number;
}

/** Participación en asesinatos (0–1). */
export const participacion = (j: Pick<JugadorHistorial, 'asesinatos' | 'asistencias'>, c: ContextoEquipo) =>
  c.asesinatosEquipo > 0 ? Math.min(1, (j.asesinatos + j.asistencias) / c.asesinatosEquipo) : 0;
export const cuotaDano = (j: Pick<JugadorHistorial, 'dano'>, c: ContextoEquipo) => (c.danoEquipo > 0 ? j.dano / c.danoEquipo : 0);
export const kdaDe = (j: Pick<JugadorHistorial, 'asesinatos' | 'muertes' | 'asistencias'>) =>
  Math.round(((j.asesinatos + j.asistencias) / Math.max(1, j.muertes)) * 100) / 100;

/** Puntuaciones de un jugador. `rol` null = ARAM (o un modo sin roles): sin visión. */
export function puntuar(
  j: Pick<JugadorHistorial, 'asesinatos' | 'muertes' | 'asistencias' | 'cs' | 'oro' | 'dano' | 'vision'>,
  rol: Rol | null,
  duracionS: number,
  c: ContextoEquipo,
): Puntuaciones {
  const min = Math.max(1, duracionS / 60);
  const combate = media([nota(kdaDe(j), 3), nota(participacion(j, c), 0.5), nota(cuotaDano(j, c), rol ? CUOTA_DANO[rol] : 0.2)]);
  const farmeo = media([nota(j.cs / min, rol ? CS_OBJETIVO_POR_MINUTO[rol] : CS_ARAM), nota(j.oro / min, rol ? ORO_POR_MINUTO[rol] : ORO_ARAM)]);
  if (!rol) return { combate, farmeo, vision: 0, total: media([combate, farmeo]) };
  const vision = nota(j.vision / min, VISION_POR_MINUTO[rol]);
  return { combate, farmeo, vision, total: media([combate, farmeo, vision]) };
}

/** Contexto de equipo de cada equipo de la partida. */
export function contextos(jugadores: Pick<JugadorHistorial, 'equipo' | 'asesinatos' | 'dano'>[]): Record<100 | 200, ContextoEquipo> {
  const de = (eq: 100 | 200) => {
    const del = jugadores.filter((j) => j.equipo === eq);
    return { asesinatosEquipo: del.reduce((s, j) => s + j.asesinatos, 0), danoEquipo: del.reduce((s, j) => s + j.dano, 0) };
  };
  return { 100: de(100), 200: de(200) };
}

/**
 * Etiquetas de la partida, solo positivas: MVP (mejor puntuación total), más daño, más oro, más visión (en la
 * Grieta), más asesinatos, más daño recibido («muro»), más CS y sin muertes (en partidas de 15 min o más).
 */
export function etiquetar(jugadores: JugadorHistorial[], duracionS: number, conVision: boolean): Map<number, Etiqueta[]> {
  const etiquetas = new Map<number, Etiqueta[]>(jugadores.map((j) => [j.participante, []]));
  const mejor = (valor: (j: JugadorHistorial) => number, etiqueta: Etiqueta) => {
    const max = Math.max(...jugadores.map(valor));
    if (!(max > 0)) return;
    // Solo uno: en empate, el primero de la lista.
    const j = jugadores.find((x) => valor(x) === max)!;
    etiquetas.get(j.participante)!.push(etiqueta);
  };
  mejor((j) => j.puntuaciones.total, 'mvp');
  mejor((j) => j.dano, 'masDano');
  mejor((j) => j.oro, 'masOro');
  if (conVision) mejor((j) => j.vision, 'masVision');
  mejor((j) => j.asesinatos, 'masAsesinatos');
  mejor((j) => j.danoRecibido, 'muroDefensivo');
  mejor((j) => j.cs, 'farmeador');
  if (duracionS >= 15 * 60) for (const j of jugadores) if (j.muertes === 0) etiquetas.get(j.participante)!.push('sinMuertes');
  return etiquetas;
}

/** Mis datos de una partida (null si el jugador no está). */
export function yoEn(p: PartidaHistorial): JugadorHistorial | null {
  return p.jugadores.find((j) => j.participante === p.yo) ?? null;
}

/** Valores de una partida para las tendencias y los retos. */
export function metricas(p: PartidaHistorial) {
  const yo = yoEn(p);
  if (!yo) return null;
  const c = contextos(p.jugadores)[yo.equipo];
  const min = Math.max(1, p.duracion / 60);
  return {
    csMin: yo.cs / min,
    kp: participacion(yo, c),
    muertes: yo.muertes,
    vision: yo.vision / min,
    dano: cuotaDano(yo, c),
    puntuacion: yo.puntuaciones.total,
    victoria: yo.victoria,
    rol: yo.rol,
    // 3.8: las normales de la Grieta también son la Grieta (CS y visión con sentido).
    grieta: p.modo === 'clasificatoria' || esColaGrietaNormal(p.cola),
  };
}

/** Partidas que cuentan para tendencias y retos: no rehechas y de la Grieta o ARAM. */
export const cuenta = (p: PartidaHistorial) => !p.rehecha && p.modo !== 'otro' && p.modo !== 'arena';

const BLOQUE = 10;

/**
 * Tendencias: media de las 10 últimas partidas que cuentan y su cambio frente a las 10 anteriores. `filtro` (3.8)
 * elige otras partidas (las de un tipo de cola en el Perfil); por defecto, las que cuentan (`cuenta`).
 */
export function tendencias(partidas: PartidaHistorial[], filtro: (p: PartidaHistorial) => boolean = cuenta): Tendencia[] {
  const validas = partidas.filter(filtro).map(metricas).filter((m): m is NonNullable<ReturnType<typeof metricas>> => !!m);
  const grieta = validas.filter((m) => m.grieta);
  const def: [Tendencia['id'], (m: (typeof validas)[number]) => number, boolean, boolean][] = [
    ['puntuacion', (m) => m.puntuacion, true, false],
    ['csMin', (m) => m.csMin, true, true],
    ['kp', (m) => m.kp, true, false],
    ['muertes', (m) => m.muertes, false, false],
    ['vision', (m) => m.vision, true, true],
    ['dano', (m) => m.dano, true, false],
  ];
  const r: Tendencia[] = [];
  for (const [id, valor, mejorSiSube, soloGrieta] of def) {
    const lista = soloGrieta ? grieta : validas;
    if (!lista.length) continue;
    const prom = (xs: typeof lista) => xs.reduce((s, m) => s + valor(m), 0) / xs.length;
    const actual = lista.slice(0, BLOQUE);
    const anterior = lista.slice(BLOQUE, 2 * BLOQUE);
    const redondo = (v: number) => Math.round(v * 100) / 100;
    r.push({
      id,
      valor: redondo(prom(actual)),
      cambio: anterior.length >= 3 ? redondo(prom(actual) - prom(anterior)) : null,
      mejorSiSube,
    });
  }
  return r;
}
