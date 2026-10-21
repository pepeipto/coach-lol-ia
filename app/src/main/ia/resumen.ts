import {
  LIMITES_IA,
  ROLES,
  type Build,
  type EstadisticasFinales,
  type IdiomaIa,
  type JugadorConsejo,
  type ModoJuego,
  type MomentoConsejo,
  type PeticionAnalisis,
  type PeticionConsejo,
  type ResultadoPartidaIa,
  type Rol,
} from '@coach/shared';
import type { EstadoOverlay, EstadoPartida } from '../../shared/tiposApp';
import { CS_OBJETIVO_POR_MINUTO } from '../consejos/objetivos';
import { objetivoDeEvento, type RegistroPartida } from './registro';

/*
 * Resúmenes compactos que la app manda al servidor para el coach con IA (3.2). Nunca llevan nombres de invocador ni
 * Riot ID: solo campeones, objetos, números y eventos públicos de la partida.
 */

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/** Lo que interesa de /lol-end-of-game/v1/eog-stats-block (estadísticas de fin de partida de la LCU). */
export interface EstadisticasEog {
  final: Partial<EstadisticasFinales>;
  resultado: ResultadoPartidaIa | null;
  equipos?: { aliados: number; enemigos: number };
  duracion?: number;
  rol?: Rol;
}

/** Valor de una estadística por cualquiera de sus nombres (la LCU usa CHAMPIONS_KILLED; algunas versiones, otros). */
function stat(stats: Obj, ...claves: string[]): number | undefined {
  for (const c of claves) {
    const v = numero(stats[c]);
    if (v !== undefined) return Math.round(v);
  }
  return undefined;
}

const POSICIONES: Record<string, Rol> = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MIDDLE', MID: 'MIDDLE', BOTTOM: 'BOTTOM', BOT: 'BOTTOM', ADC: 'BOTTOM', UTILITY: 'UTILITY', SUPPORT: 'UTILITY' };

/**
 * Lee el bloque de estadísticas de fin de partida de la LCU. Su forma no está documentada y cambia entre versiones:
 * se lee con cuidado y todo es opcional. Ignora los nombres de los jugadores.
 */
export function leerEog(json: unknown): EstadisticasEog | null {
  if (!esObj(json)) return null;
  const local = esObj(json.localPlayer) ? json.localPlayer : null;
  if (!local) return null;
  const stats = esObj(local.stats) ? local.stats : {};
  const final: Partial<EstadisticasFinales> = {};
  const poner = <K extends keyof EstadisticasFinales>(k: K, v: number | undefined) => {
    if (v !== undefined) (final as Record<string, unknown>)[k] = v;
  };
  poner('k', stat(stats, 'CHAMPIONS_KILLED', 'kills'));
  poner('d', stat(stats, 'NUM_DEATHS', 'deaths'));
  poner('a', stat(stats, 'ASSISTS', 'assists'));
  const subditos = stat(stats, 'MINIONS_KILLED', 'minionsKilled');
  const neutrales = stat(stats, 'NEUTRAL_MINIONS_KILLED', 'neutralMinionsKilled');
  if (subditos !== undefined || neutrales !== undefined) final.cs = (subditos ?? 0) + (neutrales ?? 0);
  poner('nivel', stat(stats, 'LEVEL', 'champLevel', 'level'));
  poner('oro', stat(stats, 'GOLD_EARNED', 'goldEarned'));
  poner('danoCampeones', stat(stats, 'TOTAL_DAMAGE_DEALT_TO_CHAMPIONS', 'totalDamageDealtToChampions'));
  poner('danoRecibido', stat(stats, 'TOTAL_DAMAGE_TAKEN', 'totalDamageTaken'));
  poner('vision', stat(stats, 'VISION_SCORE', 'visionScore'));
  poner('guardianes', stat(stats, 'WARD_PLACED', 'wardsPlaced'));
  poner('guardianesDestruidos', stat(stats, 'WARD_KILLED', 'wardsKilled'));
  poner('guardianesControl', stat(stats, 'VISION_WARDS_BOUGHT_IN_GAME', 'visionWardsBoughtInGame'));
  const items = Array.isArray(local.items) ? local.items : [0, 1, 2, 3, 4, 5, 6].map((i) => stats[`ITEM${i}`]);
  const objetos = items.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0).slice(0, LIMITES_IA.objetos);
  if (objetos.length) final.objetos = objetos;

  const r: EstadisticasEog = { final, resultado: null };
  const equipos = Array.isArray(json.teams) ? json.teams.filter(esObj) : [];
  const mio = equipos.find((e) => e.isPlayerTeam === true);
  const otro = equipos.find((e) => e.isPlayerTeam === false);
  if (mio && typeof mio.isWinningTeam === 'boolean') r.resultado = mio.isWinningTeam ? 'victoria' : 'derrota';
  else if (stats.WIN === 1 || stats.WIN === true) r.resultado = 'victoria';
  else if (stats.LOSE === 1 || stats.LOSE === true) r.resultado = 'derrota';
  const asesinatos = (e: Obj | undefined) => {
    if (!e) return undefined;
    const s = esObj(e.stats) ? stat(e.stats, 'CHAMPIONS_KILLED', 'kills') : undefined;
    if (s !== undefined) return s;
    const jug = Array.isArray(e.players) ? e.players.filter(esObj) : [];
    return jug.length ? jug.reduce((n, p) => n + (esObj(p.stats) ? (stat(p.stats, 'CHAMPIONS_KILLED', 'kills') ?? 0) : 0), 0) : undefined;
  };
  const a = asesinatos(mio);
  const e = asesinatos(otro);
  if (a !== undefined && e !== undefined) r.equipos = { aliados: a, enemigos: e };
  const duracion = numero(json.gameLength);
  if (duracion !== undefined) r.duracion = Math.round(duracion);
  const pos = typeof local.detectedTeamPosition === 'string' ? local.detectedTeamPosition : typeof local.selectedPosition === 'string' ? local.selectedPosition : '';
  const rol = POSICIONES[pos.toUpperCase()];
  if (rol) r.rol = rol;
  return r;
}

const mismoCampeon = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Nombres (en el idioma de la app) de los objetos de la lista, para que el modelo no tenga que adivinar ids. */
export function nombresDe(ids: Iterable<number>, objetos: Record<number, { name?: string }>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const id of ids) {
    if (Object.keys(r).length >= LIMITES_IA.nombresObjetos) break;
    const nombre = objetos[id]?.name?.replace(/[^\p{L}\p{N}\p{M} .,:;'’()\-+/!?&%·]/gu, '').replace(/\s+/g, ' ').trim().slice(0, LIMITES_IA.textoNombre);
    if (nombre) r[String(id)] = nombre;
  }
  return r;
}

export interface ContextoAnalisis {
  idioma: IdiomaIa;
  modo: ModoJuego;
  /** Build de la selección (solo se usa si es del campeón que se jugó). */
  build: Build | null;
  /** Rol de la selección, si la hubo. */
  rol: Rol | null;
  objetos: Record<number, { name?: string }>;
  nombreCampeon?: string;
}

/** Petición del análisis a partir del registro de la partida y, si se pudieron leer, las estadísticas de la LCU. */
export function peticionAnalisis(registro: RegistroPartida, eog: EstadisticasEog | null, ctx: ContextoAnalisis): PeticionAnalisis | null {
  const u = registro.ultimo;
  if (!u || !registro.conDatos) return null;
  const kda = u.kda ?? { k: 0, d: 0, a: 0 };
  const final: EstadisticasFinales = {
    k: kda.k,
    d: kda.d,
    a: kda.a,
    cs: u.cs ?? 0,
    nivel: Math.max(1, Math.min(30, u.nivel || 1)),
    objetos: u.objetos.filter((id) => id > 0).slice(0, LIMITES_IA.objetos),
    ...(u.vision !== undefined ? { vision: Math.round(u.vision) } : {}),
    ...eog?.final,
  };
  const modo = ctx.modo;
  const yo = u.jugadores?.find((j) => mismoCampeon(j.campeon, u.campeon) && j.equipo === u.equipo);
  const rol: Rol | null = modo !== 'clasificatoria' ? null : (eog?.rol ?? yo?.posicion ?? ctx.rol ?? null);
  const build = ctx.build && mismoCampeon(ctx.build.campeon, u.campeon) ? ctx.build : null;
  const marcador = marcadorDe(u);
  const ids = new Set<number>([...final.objetos, ...registro.compras.map((c) => c.id), ...(build ? [...build.nucleo, ...(build.botas ? [build.botas] : []), ...build.situacionales] : [])]);
  const p: PeticionAnalisis = {
    idioma: ctx.idioma,
    modo,
    campeon: u.campeon,
    rol: rol && ROLES.includes(rol) ? rol : null,
    resultado: eog?.resultado ?? registro.resultado,
    duracion: Math.max(60, Math.round(eog?.duracion ?? u.tiempo)),
    final,
    linea: registro.linea.slice(0, LIMITES_IA.minutos),
    muertes: registro.muertes.slice(-LIMITES_IA.muertes),
    compras: registro.compras.slice(0, LIMITES_IA.compras),
    objetivos: registro.objetivos.slice(0, LIMITES_IA.objetivos),
    // En Arena no se manda la build (sin estadísticas de objetos de Arena desde la 3.2).
    build: build && modo !== 'arena' ? { nucleo: build.nucleo.slice(0, 8), botas: build.botas, situacionales: build.situacionales.slice(0, 12) } : null,
    csObjetivoMinuto: modo === 'clasificatoria' && rol ? CS_OBJETIVO_POR_MINUTO[rol] : null,
    nombresObjetos: nombresDe(ids, ctx.objetos),
  };
  const equipos = eog?.equipos ?? marcador;
  if (equipos) p.equipos = equipos;
  if (ctx.nombreCampeon) p.nombreCampeon = ctx.nombreCampeon.slice(0, LIMITES_IA.textoNombre);
  return p;
}

/** Asesinatos de cada equipo según el marcador de la Live Client (suma de los de cada jugador). */
export function marcadorDe(estado: EstadoPartida): { aliados: number; enemigos: number } | undefined {
  if (!estado.equipo || !estado.jugadores?.length) return undefined;
  let aliados = 0;
  let enemigos = 0;
  for (const j of estado.jugadores) {
    if (j.equipo === estado.equipo) aliados += j.asesinatos ?? 0;
    else enemigos += j.asesinatos ?? 0;
  }
  return { aliados, enemigos };
}

/** Sucesos recientes (últimos 3 minutos) en texto corto en inglés, sin nombres de jugadores. */
export function sucesosRecientes(estado: EstadoPartida): string[] {
  const desde = estado.tiempo - 180;
  const r: string[] = [];
  for (const e of estado.eventos) {
    if (e.tiempo < desde) continue;
    if (e.nombre === 'ChampionKill') {
      if (mismoCampeon(e.victima, estado.campeon)) r.push(e.asesino ? `you were killed by ${e.asesino}` : 'you died');
      else if (mismoCampeon(e.asesino, estado.campeon)) r.push(e.victima ? `you killed ${e.victima}` : 'you got a kill');
      continue;
    }
    const o = objetivoDeEvento(e, estado.equipo);
    if (o) r.push(`${o.equipo === 'aliado' ? 'allies' : 'enemies'} took ${o.tipo}${o.subtipo ? ` (${o.subtipo})` : ''}`);
  }
  return r.slice(-LIMITES_IA.recientes).map((s) => s.slice(0, LIMITES_IA.textoReciente));
}

const OBJETIVOS_CONSEJO = new Set(['dragon', 'anciano', 'heraldo', 'baron', 'larvas']);

/** Petición de un consejo de momento muerto. */
export function peticionConsejo(
  estado: EstadoPartida,
  resumen: EstadoOverlay | null,
  momento: MomentoConsejo,
  ctx: { idioma: IdiomaIa; modo: ModoJuego; rol: Rol | null; objetos: Record<number, { name?: string }> },
  objetivosTomados: PeticionConsejo['objetivos'],
): PeticionConsejo {
  const kda = estado.kda ?? { k: 0, d: 0, a: 0 };
  const jugador = (j: NonNullable<EstadoPartida['jugadores']>[number]): JugadorConsejo => ({
    campeon: j.campeon,
    nivel: Math.max(1, Math.min(30, j.nivel ?? 1)),
    // Objetos del marcador (TAB), públicos para todos.
    objetos: (j.objetos ?? []).filter((id) => id > 0).slice(0, LIMITES_IA.objetos),
    ...(j.asesinatos !== undefined ? { k: j.asesinatos } : {}),
  });
  const todos = (estado.jugadores ?? []).filter((j) => /^[A-Za-z][A-Za-z0-9]{0,29}$/.test(j.campeon));
  const yo = todos.find((j) => mismoCampeon(j.campeon, estado.campeon) && j.equipo === estado.equipo);
  const aliados = todos.filter((j) => j !== yo && j.equipo === estado.equipo).slice(0, LIMITES_IA.jugadoresEquipo - 1).map(jugador);
  const enemigos = todos.filter((j) => j.equipo !== estado.equipo).slice(0, LIMITES_IA.jugadoresEquipo).map(jugador);
  const modo = ctx.modo;
  const p: PeticionConsejo = {
    idioma: ctx.idioma,
    modo,
    momento,
    tiempo: Math.round(estado.tiempo),
    yo: {
      campeon: estado.campeon,
      rol: modo === 'clasificatoria' ? (yo?.posicion ?? ctx.rol) : null,
      nivel: Math.max(1, Math.min(30, estado.nivel || 1)),
      oro: Math.round(estado.oro),
      objetos: estado.objetos.filter((id) => id > 0).slice(0, LIMITES_IA.objetos),
      k: kda.k,
      d: kda.d,
      a: kda.a,
      cs: estado.cs ?? 0,
    },
    aliados,
    enemigos,
    marcador: marcadorDe(estado) ?? { aliados: 0, enemigos: 0 },
    objetivos: objetivosTomados.slice(-20),
    recientes: sucesosRecientes(estado),
    nombresObjetos: {},
  };
  const proximo = resumen?.objetivos.find((o) => OBJETIVOS_CONSEJO.has(o.id) && !o.disponible && o.aparece !== null && o.aparece <= 90);
  if (proximo && proximo.aparece !== null) {
    p.proximoObjetivo = { tipo: proximo.id as Exclude<typeof proximo.id, 'inhibidor'>, enSegundos: Math.round(proximo.aparece), ...(proximo.subtipo && /^[A-Za-z]{1,20}$/.test(proximo.subtipo) ? { subtipo: proximo.subtipo } : {}) };
  }
  p.nombresObjetos = nombresDe(new Set([...p.yo.objetos, ...aliados.flatMap((j) => j.objetos), ...enemigos.flatMap((j) => j.objetos)]), ctx.objetos);
  return p;
}
