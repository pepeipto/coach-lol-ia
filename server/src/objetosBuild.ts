import { clasificarObjeto, type HitosObjetos, type ItemDDragonCrudo, type RendimientoObjeto, type TiemposObjetivo } from '@coach/shared';
import type { Participacion } from './extraer';

/*
 * 3.10 · Objetos de la build (mejoras 11 y 13 del estudio de la competencia), con lo que ya se descarga: la línea de
 * tiempo de Match-v5 de cada partida de clasificatoria y ARAM (sin llamadas nuevas a la API de Riot).
 *
 * - Tiempos objetivo: minuto mediano en que se completa el 1.er, 2.º y 3.er legendario y las botas, en las partidas
 *   ganadas y en todas. Solo las participaciones con `minutosCompras` (guardadas desde la 3.10) cuentan.
 * - Rendimiento por objeto: uso, % de victorias al completarlo y diferencia frente a no completarlo, suavizados.
 *   NUNCA en Arena: la política de juego de Riot dice «Products cannot display win rates for Augments or Arena Mode
 *   items» (developer.riotgames.com/docs/lol). Arena ni siquiera tiene línea de tiempo y su build no pasa por aquí;
 *   `politica.ts` (shared) además lo quita de cualquier build de Arena.
 */

/** Partidas mínimas con un hito (p. ej. el 2.º objeto) para publicar su minuto mediano. */
export const MIN_PARTIDAS_TIEMPOS = 30;

/** Un objeto entra en el rendimiento si se completa en esta fracción de las partidas o más… */
export const FRACCION_MIN_RENDIMIENTO = 0.05;
/** …y en al menos estas partidas (con menos, la cifra sería solo ruido aunque lleve «datos limitados»). */
export const MIN_PARTIDAS_RENDIMIENTO = 10;
/** Por debajo de estas partidas con el objeto, «datos limitados». */
export const PARTIDAS_FIABLES_RENDIMIENTO = 50;
/**
 * Suavizado: K partidas «imaginarias» con el % de victorias del campeón. (victorias + K·p) / (partidas + K): con 20
 * partidas un objeto apenas se separa de la media del campeón; con 500, el suavizado casi no pesa.
 */
export const SUAVIZADO_RENDIMIENTO = 20;
/** Partidas sin el objeto necesarias para dar la diferencia (si casi todos lo hacen, no hay con qué comparar). */
export const MIN_PARTIDAS_SIN_OBJETO = 10;

type Tipo = (id: number) => 'botas' | 'legendario' | 'otro';

function tipoDe(objetos: Record<number, ItemDDragonCrudo>, mapa: number): Tipo {
  return (id) => (objetos[id] ? clasificarObjeto(id, objetos[id], mapa) : 'otro');
}

/** Mediana con un decimal; null si la lista está vacía. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  const x = v.length % 2 === 1 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
  return Math.round(x * 10) / 10;
}

/** Minutos de los hitos de una participación (solo los que alcanzó); null si no tiene el minuto de las compras. */
export function hitosDe(p: Participacion, tipo: Tipo): Partial<Record<keyof HitosObjetos, number>> | null {
  const minutos = p.minutosCompras;
  if (!Array.isArray(minutos) || minutos.length !== p.compras.length) return null;
  const hitos: Partial<Record<keyof HitosObjetos, number>> = {};
  let legendarios = 0;
  p.compras.forEach((id, i) => {
    const m = minutos[i]!;
    const t = tipo(id);
    if (t === 'botas' && hitos.botas === undefined) hitos.botas = m;
    else if (t === 'legendario' && legendarios < 3) hitos[(['objeto1', 'objeto2', 'objeto3'] as const)[legendarios++]!] = m;
  });
  return hitos;
}

const HITOS: (keyof HitosObjetos)[] = ['objeto1', 'objeto2', 'objeto3', 'botas'];

function medianas(lista: Partial<Record<keyof HitosObjetos, number>>[]): HitosObjetos {
  const salida = {} as HitosObjetos;
  for (const h of HITOS) {
    const valores = lista.map((x) => x[h]).filter((m): m is number => m !== undefined);
    salida[h] = valores.length >= MIN_PARTIDAS_TIEMPOS ? mediana(valores) : null;
  }
  return salida;
}

/**
 * Tiempos objetivo del campeón (y rol): medianas de cada hito en las partidas ganadas y en todas, cada una solo con
 * 30 partidas o más que lo alcanzan (el minuto del 3.er objeto sale de las partidas que llegan a tenerlo). Null si
 * ningún hito llega al mínimo.
 */
export function calcularTiempos(ps: Participacion[], objetos: Record<number, ItemDDragonCrudo>, mapa: number): TiemposObjetivo | null {
  const tipo = tipoDe(objetos, mapa);
  const con = ps.map((p) => ({ victoria: p.victoria, hitos: hitosDe(p, tipo) })).filter((x) => x.hitos !== null);
  const todas = medianas(con.map((x) => x.hitos!));
  const ganadas = medianas(con.filter((x) => x.victoria).map((x) => x.hitos!));
  if (HITOS.every((h) => todas[h] === null && ganadas[h] === null)) return null;
  return { ganadas, todas, partidas: con.length };
}

const suavizada = (victorias: number, partidas: number, media: number) =>
  (victorias + SUAVIZADO_RENDIMIENTO * media) / (partidas + SUAVIZADO_RENDIMIENTO);

/**
 * Rendimiento de los legendarios del campeón (y rol), de más a menos usados (en empate, por partidas y por id):
 * - uso = partidas en que se completó / partidas;
 * - % de victorias suavizado = (victorias con él + K·p) / (partidas con él + K), con p el % del campeón y K = 20;
 * - diferencia = suavizado con él − suavizado sin él, en puntos porcentuales con un decimal (null con menos de 10
 *   partidas sin él);
 * - entra con el 5 % de las partidas o más (y al menos 10); «datos limitados» por debajo de 50.
 * Completar = haberlo comprado entero alguna vez (está en `compras`), lo venda o no después.
 */
export function calcularRendimiento(ps: Participacion[], objetos: Record<number, ItemDDragonCrudo>, mapa: number): RendimientoObjeto[] {
  const total = ps.length;
  if (total === 0) return [];
  const tipo = tipoDe(objetos, mapa);
  const victoriasTotal = ps.filter((p) => p.victoria).length;
  const media = victoriasTotal / total;
  const cuentas = new Map<number, { partidas: number; victorias: number }>();
  for (const p of ps) {
    for (const id of new Set(p.compras)) {
      if (tipo(id) !== 'legendario') continue;
      const c = cuentas.get(id) ?? { partidas: 0, victorias: 0 };
      c.partidas++;
      if (p.victoria) c.victorias++;
      cuentas.set(id, c);
    }
  }
  const minimo = Math.max(MIN_PARTIDAS_RENDIMIENTO, FRACCION_MIN_RENDIMIENTO * total);
  return [...cuentas.entries()]
    .filter(([, c]) => c.partidas >= minimo)
    .map(([id, c]): RendimientoObjeto => {
      const con = suavizada(c.victorias, c.partidas, media);
      const sinPartidas = total - c.partidas;
      const sin = suavizada(victoriasTotal - c.victorias, sinPartidas, media);
      return {
        id,
        partidas: c.partidas,
        uso: c.partidas / total,
        tasaVictoria: Math.round(con * 10000) / 10000,
        diferencia: sinPartidas >= MIN_PARTIDAS_SIN_OBJETO ? Math.round((con - sin) * 1000) / 10 : null,
        datosLimitados: c.partidas < PARTIDAS_FIABLES_RENDIMIENTO,
      };
    })
    .sort((a, b) => b.uso - a.uso || b.partidas - a.partidas || a.id - b.id);
}
