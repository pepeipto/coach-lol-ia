import { ROLES, type Rol } from '@coach/shared';
import { tipoCola } from '../../shared/colas';
import type { JugadorHistorial, PartidaHistorial } from '../../shared/perfil';
import {
  AVISO_PARTIDAS_PERSONAL,
  MINIMO_PARTIDAS_PERSONAL,
  type CampeonTierPersonal,
  type ConsultaPersonal,
  type CountersPersonales,
  type CrucePersonal,
  type EstadisticasPersonales,
  type RespuestaPersonal,
  type RivalPersonal,
  type TierPersonal,
} from '../../shared/personal';
import { kdaDe, yoEn } from './puntuaciones';

/*
 * 3.9: «Tus estadísticas»: tus counters, tu tier list y tus peores rivales, calculados en local con tu propio
 * historial (el de la LCU que ya guarda el Perfil). Solo partidas de la Grieta (clasificatoria y normales) que no son
 * rehechas y en las que se sabe tu rol. El rival de línea es el único enemigo con tu mismo rol; si no hay uno solo
 * (roles mal detectados), esa partida cuenta para la tier list pero no para los counters ni los rivales.
 * Nada se envía a ningún servidor y no hay comparación con otros jugadores.
 */

/** Partidas «a favor del 50 %» que se suman a cada grupo al suavizar el % de victorias. */
export const PRIOR_PARTIDAS = 10;

/** Una partida tuya de la Grieta: tu jugador, tu rol y el rival de línea (null si no está claro). */
interface PartidaPersonal {
  yo: JugadorHistorial;
  rol: Rol;
  rival: JugadorHistorial | null;
}

/** Partida de la Grieta (clasificatoria, Flex o normal) que no es rehecha. */
export const esPartidaPersonal = (p: PartidaHistorial): boolean => {
  if (p.rehecha) return false;
  const tipo = tipoCola(p.cola);
  return tipo === 'clasificatoria' || tipo === 'normales';
};

function partidasPersonales(partidas: PartidaHistorial[]): PartidaPersonal[] {
  const r: PartidaPersonal[] = [];
  for (const p of partidas) {
    if (!esPartidaPersonal(p)) continue;
    const yo = yoEn(p);
    if (!yo || !yo.rol) continue;
    const rivales = p.jugadores.filter((j) => j.equipo !== yo.equipo && j.rol === yo.rol);
    r.push({ yo, rol: yo.rol, rival: rivales.length === 1 ? rivales[0]! : null });
  }
  return r;
}

/** % de victorias suavizado: (victorias + 5) / (partidas + 10), como si cada grupo empezara con 5-5. */
export const winrateSuavizado = (victorias: number, partidas: number) => (victorias + PRIOR_PARTIDAS / 2) / (partidas + PRIOR_PARTIDAS);

/**
 * Puntos del tier personal (0–100):
 *   puntos = 0,6 × (100 × % de victorias suavizado) + 0,4 × nota media
 * El % de victorias se suaviza con 10 partidas imaginarias al 50 % (5 ganadas y 5 perdidas): con pocas partidas el
 * resultado se queda cerca del 50 % y solo se aleja cuando hay bastantes. Ejemplos: 3 de 3 → 61,5 %; 8 de 10 → 65 %.
 * La nota media (0–100, la del Perfil: 60 es rendir como la referencia del rol) pesa un 40 % para que una racha de
 * victorias con mala nota (o al revés) no lo decida todo. Un 50 % de victorias con nota 60 da 54 puntos (tier B).
 */
export function puntosTier(victorias: number, partidas: number, nota: number): number {
  return Math.round((0.6 * 100 * winrateSuavizado(victorias, partidas) + 0.4 * nota) * 10) / 10;
}

/** Cortes del tier: S ≥ 62, A ≥ 57, B ≥ 51, C ≥ 45 y D por debajo. */
export const CORTES_TIER: [TierPersonal, number][] = [
  ['S', 62],
  ['A', 57],
  ['B', 51],
  ['C', 45],
];

export function tierDe(puntos: number): TierPersonal {
  for (const [tier, corte] of CORTES_TIER) if (puntos >= corte) return tier;
  return 'D';
}

interface Acumulado {
  partidas: number;
  victorias: number;
  k: number;
  d: number;
  a: number;
  nota: number;
}

const nuevo = (): Acumulado => ({ partidas: 0, victorias: 0, k: 0, d: 0, a: 0, nota: 0 });
function sumar(acc: Acumulado, yo: JugadorHistorial): void {
  acc.partidas++;
  if (yo.victoria) acc.victorias++;
  acc.k += yo.asesinatos;
  acc.d += yo.muertes;
  acc.a += yo.asistencias;
  acc.nota += yo.puntuaciones.total;
}
const redondo = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;
const resumen = (acc: Acumulado) => ({
  partidas: acc.partidas,
  victorias: acc.victorias,
  winrate: redondo(acc.victorias / Math.max(1, acc.partidas), 4),
  nota: Math.round(acc.nota / Math.max(1, acc.partidas)),
  kda: kdaDe({ asesinatos: acc.k, muertes: acc.d, asistencias: acc.a }),
  pocas: acc.partidas < AVISO_PARTIDAS_PERSONAL,
});

function agrupar<K>(lista: PartidaPersonal[], clave: (p: PartidaPersonal) => K | null): Map<string, { clave: K; acc: Acumulado }> {
  const por = new Map<string, { clave: K; acc: Acumulado }>();
  for (const p of lista) {
    const k = clave(p);
    if (k === null) continue;
    const id = JSON.stringify(k);
    const g = por.get(id) ?? { clave: k, acc: nuevo() };
    sumar(g.acc, p.yo);
    por.set(id, g);
  }
  return por;
}

const faltanPara = (grupos: { acc: Acumulado }[]) =>
  Math.max(0, MINIMO_PARTIDAS_PERSONAL - grupos.reduce((m, g) => Math.max(m, g.acc.partidas), 0));

/** Del peor al mejor: % suavizado, luego nota y luego más partidas primero. */
const delPeor = (a: CrucePersonal, b: CrucePersonal) =>
  winrateSuavizado(a.victorias, a.partidas) - winrateSuavizado(b.victorias, b.partidas) || a.nota - b.nota || b.partidas - a.partidas || a.rivalId - b.rivalId;

function cruces(lista: PartidaPersonal[]): { filas: CrucePersonal[]; faltan: number } {
  const grupos = [...agrupar(lista, (p) => (p.rival ? ([p.yo.campeonId, p.rival.campeonId, p.rol] as const) : null)).values()];
  const filas = grupos
    .filter((g) => g.acc.partidas >= MINIMO_PARTIDAS_PERSONAL)
    .map(({ clave: [campeonId, rivalId, rol], acc }) => ({ campeonId, rivalId, rol, ...resumen(acc) }))
    .sort(delPeor);
  return { filas, faltan: faltanPara(grupos) };
}

function tierList(lista: PartidaPersonal[]): { filas: CampeonTierPersonal[]; faltan: number } {
  const grupos = [...agrupar(lista, (p) => [p.yo.campeonId, p.rol] as const).values()];
  const filas = grupos
    .filter((g) => g.acc.partidas >= MINIMO_PARTIDAS_PERSONAL)
    .map(({ clave: [campeonId, rol], acc }) => {
      const r = resumen(acc);
      const puntos = puntosTier(r.victorias, r.partidas, r.nota);
      return { campeonId, rol, ...r, winrateSuavizado: redondo(winrateSuavizado(r.victorias, r.partidas), 4), puntos, tier: tierDe(puntos) };
    })
    .sort((a, b) => b.puntos - a.puntos || b.partidas - a.partidas || a.campeonId - b.campeonId);
  return { filas, faltan: faltanPara(grupos) };
}

function rivales(lista: PartidaPersonal[]): { filas: RivalPersonal[]; faltan: number } {
  const grupos = [...agrupar(lista, (p) => (p.rival ? ([p.rival.campeonId, p.rol] as const) : null)).values()];
  const filas = grupos
    .filter((g) => g.acc.partidas >= MINIMO_PARTIDAS_PERSONAL)
    .map(({ clave: [rivalId, rol], acc }) => {
      const r = resumen(acc);
      return {
        rivalId,
        rol,
        partidas: r.partidas,
        victorias: r.victorias,
        derrotas: r.partidas - r.victorias,
        winrate: r.winrate,
        winrateSuavizado: redondo(winrateSuavizado(r.victorias, r.partidas), 4),
        nota: r.nota,
        pocas: r.pocas,
      };
    })
    // Contra los que más pierdes primero: % suavizado más bajo, luego más derrotas.
    .sort((a, b) => a.winrateSuavizado - b.winrateSuavizado || b.derrotas - a.derrotas || a.rivalId - b.rivalId);
  return { filas, faltan: faltanPara(grupos) };
}

/** Las tres tablas de «Tus estadísticas». */
export function estadisticasPersonales(partidas: PartidaHistorial[]): EstadisticasPersonales {
  const lista = partidasPersonales(partidas);
  const c = cruces(lista);
  const t = tierList(lista);
  const r = rivales(lista);
  return {
    partidas: lista.length,
    partidasConRival: lista.filter((p) => p.rival).length,
    counters: c.filas,
    tierList: t.filas,
    peoresRivales: r.filas,
    faltan: { tierList: t.faltan, counters: c.faltan, rivales: r.faltan },
  };
}

/** Tus counters con un campeón en un rol: contra quién te va peor y mejor (cruces con 3 partidas o más). */
export function calcularCountersPersonales(partidas: PartidaHistorial[], campeon: number, rol: Rol): CountersPersonales {
  const lista = partidasPersonales(partidas).filter((p) => p.yo.campeonId === campeon && p.rol === rol);
  const filas = cruces(lista).filas;
  return {
    campeonId: campeon,
    rol,
    partidas: lista.filter((p) => p.rival).length,
    peores: filas.filter((f) => f.winrate < 0.5),
    mejores: filas.filter((f) => f.winrate >= 0.5).reverse(),
  };
}

/** Tu historial con `campeon` contra `rival` en `rol`; null si no llega al mínimo de partidas. */
export function calcularEnfrentamientoPersonal(partidas: PartidaHistorial[], campeon: number, rival: number, rol: Rol): CrucePersonal | null {
  const lista = partidasPersonales(partidas).filter((p) => p.yo.campeonId === campeon && p.rival?.campeonId === rival && p.rol === rol);
  return cruces(lista).filas[0] ?? null;
}

const esId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const esRol = (v: unknown): v is Rol => typeof v === 'string' && (ROLES as string[]).includes(v);

/** Valida lo que llega por la IPC 'coach:personal-stats' (null si no es válido). */
export function consultaPersonal(v: unknown): ConsultaPersonal | null {
  if (v === undefined || v === null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  const { campeon, rol, rival } = v as Record<string, unknown>;
  if (campeon !== undefined && !esId(campeon)) return null;
  if (rol !== undefined && !esRol(rol)) return null;
  if (rival !== undefined && !esId(rival)) return null;
  return { campeon, rol, rival } as ConsultaPersonal;
}

/** Respuesta de 'coach:personal-stats' para una consulta ya validada. */
export function respuestaPersonal(partidas: PartidaHistorial[], c: ConsultaPersonal): RespuestaPersonal {
  const conCampeon = c.campeon !== undefined && c.rol !== undefined;
  return {
    estadisticas: estadisticasPersonales(partidas),
    counters: conCampeon ? calcularCountersPersonales(partidas, c.campeon!, c.rol!) : null,
    enfrentamiento: conCampeon && c.rival !== undefined ? calcularEnfrentamientoPersonal(partidas, c.campeon!, c.rival, c.rol!) : null,
  };
}
