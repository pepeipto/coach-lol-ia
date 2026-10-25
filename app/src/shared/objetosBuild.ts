import type { Build, HitosObjetos, RendimientoObjeto, TiemposObjetivo } from '@coach/shared';

/*
 * 3.10 · Tiempos objetivo (mejora 11) y rendimiento por objeto (mejora 13) de la build, tal como llegan del servidor
 * o de la caché: se validan aquí y lo que esté mal formado se descarta. El rendimiento por objeto es solo de la Grieta
 * y ARAM: en Arena sería un % de victorias de objetos de Arena, que Riot prohíbe («Products cannot display win rates
 * for Augments or Arena Mode items»), así que con una build de Arena siempre sale vacío.
 */

const esMinuto = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 120;
const esFraccion = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const esEntero = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;

const HITOS = ['objeto1', 'objeto2', 'objeto3', 'botas'] as const;

function hitosValidos(x: unknown): HitosObjetos | null {
  if (typeof x !== 'object' || x === null) return null;
  const h = x as Record<string, unknown>;
  const salida = {} as HitosObjetos;
  for (const k of HITOS) salida[k] = esMinuto(h[k]) ? h[k] : null;
  return salida;
}

const esArena = (b: Build) => b.modo === 'arena' || !!b.arena;

/** Tiempos objetivo de la build, si los trae y tienen la forma esperada; null en Arena o sin datos. */
export function tiemposDe(build: Build | null | undefined): TiemposObjetivo | null {
  if (!build || esArena(build) || typeof build.tiempos !== 'object' || build.tiempos === null) return null;
  const ganadas = hitosValidos(build.tiempos.ganadas);
  const todas = hitosValidos(build.tiempos.todas);
  if (!ganadas || !todas || !esEntero(build.tiempos.partidas)) return null;
  if (HITOS.every((k) => ganadas[k] === null && todas[k] === null)) return null;
  return { ganadas, todas, partidas: build.tiempos.partidas };
}

/**
 * Minuto objetivo de un hito: el de las partidas ganadas y, si no llega al mínimo, el de todas. Es la referencia de
 * la línea de la tarjeta de objetos y del aviso de voz.
 */
export function minutoObjetivo(tiempos: TiemposObjetivo | null, hito: keyof HitosObjetos): number | null {
  return tiempos ? (tiempos.ganadas[hito] ?? tiempos.todas[hito]) : null;
}

/** Solo el minuto de las partidas ganadas (el aviso de voz se compara solo con ellas). */
export function minutoGanadas(tiempos: TiemposObjetivo | null, hito: keyof HitosObjetos): number | null {
  return tiempos?.ganadas[hito] ?? null;
}

function esRendimiento(x: unknown): x is RendimientoObjeto {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    esEntero(o.id) &&
    esEntero(o.partidas) &&
    esFraccion(o.uso) &&
    esFraccion(o.tasaVictoria) &&
    (o.diferencia === null || (typeof o.diferencia === 'number' && Number.isFinite(o.diferencia) && Math.abs(o.diferencia) <= 100)) &&
    typeof o.datosLimitados === 'boolean'
  );
}

/** Rendimiento por objeto bien formado de la build; vacío en Arena (norma de Riot) o sin datos. */
export function rendimientoDe(build: Build | null | undefined): RendimientoObjeto[] {
  if (!build || esArena(build) || !Array.isArray(build.rendimientoObjetos)) return [];
  return build.rendimientoObjetos.filter(esRendimiento).map(({ id, partidas, uso, tasaVictoria, diferencia, datosLimitados }) => ({
    id,
    partidas,
    uso,
    tasaVictoria,
    diferencia,
    datosLimitados,
  }));
}

export type ClaveRendimiento = 'uso' | 'tasaVictoria' | 'diferencia';
export interface OrdenRendimiento {
  clave: ClaveRendimiento;
  direccion: 'asc' | 'desc';
}
export const ORDEN_RENDIMIENTO_POR_DEFECTO: OrdenRendimiento = { clave: 'uso', direccion: 'desc' };

/**
 * Ordena por la columna elegida; en empate, por uso y por id. Sin diferencia (casi todas las partidas lo hacen), va
 * siempre al final.
 */
export function ordenarRendimiento(lista: RendimientoObjeto[], orden: OrdenRendimiento): RendimientoObjeto[] {
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = a[orden.clave];
    const vb = b[orden.clave];
    if (va === null || vb === null) {
      if (va !== null) return -1;
      if (vb !== null) return 1;
    } else if (va !== vb) return signo * (va - vb);
    return b.uso - a.uso || a.id - b.id;
  });
}

/** Al pulsar una columna: la misma invierte la dirección; otra empieza de mayor a menor. */
export function siguienteOrdenRendimiento(actual: OrdenRendimiento, clave: ClaveRendimiento): OrdenRendimiento {
  if (actual.clave === clave) return { clave, direccion: actual.direccion === 'desc' ? 'asc' : 'desc' };
  return { clave, direccion: 'desc' };
}
