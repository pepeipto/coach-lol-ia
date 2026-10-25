import { esColaGrietaNormal, modoDeCola, type Rol } from '@coach/shared';
import type { RivalesSeleccion, SeleccionCampeon } from '../../shared/tiposApp';

export type { RivalesSeleccion, SeleccionCampeon };

const ROLES: Record<string, Rol> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  middle: 'MIDDLE',
  bottom: 'BOTTOM',
  utility: 'UTILITY',
};

interface Celda {
  cellId?: number;
  championId?: number;
  championPickIntent?: number;
  assignedPosition?: string;
}

/**
 * Campeón (fijado o en intención) y rol del jugador local en la sesión de selección. Si la sesión trae `queueId`
 * de un modo con datos, también el modo; si no, lo pone el vigilante con la cola de la sesión de gameflow.
 */
export function interpretarSeleccion(sesion: unknown): SeleccionCampeon | null {
  if (typeof sesion !== 'object' || sesion === null) return null;
  const s = sesion as { localPlayerCellId?: number; myTeam?: Celda[]; queueId?: unknown };
  if (typeof s.localPlayerCellId !== 'number' || !Array.isArray(s.myTeam)) return null;
  const yo = s.myTeam.find((c) => c.cellId === s.localPlayerCellId);
  if (!yo) return null;
  const campeonId = yo.championId || yo.championPickIntent || 0;
  if (!campeonId) return null;
  const modo = modoDeCola(s.queueId);
  // 3.8: una cola que no es de los cuatro modos (normal de la Grieta o modo rotativo) viaja tal cual.
  const cola = !modo && typeof s.queueId === 'number' && Number.isInteger(s.queueId) && s.queueId > 0 ? s.queueId : null;
  return { campeonId, rol: ROLES[yo.assignedPosition ?? ''] ?? null, ...(modo ? { modo } : {}), ...(cola !== null ? { cola } : {}) };
}

/**
 * 3.9: rol del jugador local y campeones ya elegidos por el equipo rival en la sesión de selección (lo mismo que el
 * cliente enseña en pantalla; nada oculto). En clasificatoria el cliente no dice el rol de los rivales
 * (`assignedPosition` vacío): entonces es null y se deduce después. Null fuera de la Grieta (ARAM, Arena, modos
 * rotativos) o si la sesión no tiene la forma esperada.
 */
interface Accion {
  championId?: number;
  completed?: boolean;
  isInProgress?: boolean;
  type?: string;
}

const clavesValidas = (xs: unknown[]): number[] => [...new Set(xs.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0))];

/**
 * 3.9.2: fase de bloqueos y campeones ya bloqueados de la sesión de champ select. Las acciones (`actions`) son
 * grupos de turnos `{ type: 'ban' | 'pick' | …, completed, isInProgress, championId }`; `timer.phase` es
 * 'PLANNING' (declarar intención, antes de los bloqueos), 'BAN_PICK' o 'FINALIZATION'. Hay fase de bloqueos si queda
 * algún bloqueo sin hacer y hay uno en curso o aún se está en la planificación. Lo mismo que el cliente enseña.
 */
function bloqueosDe(s: { actions?: unknown; bans?: unknown; timer?: unknown }): Pick<RivalesSeleccion, 'faseBloqueos' | 'bloqueados'> {
  const acciones = (Array.isArray(s.actions) ? s.actions : [])
    .flatMap((g) => (Array.isArray(g) ? g : []))
    .filter((a): a is Accion => typeof a === 'object' && a !== null && (a as Accion).type === 'ban');
  const pendientes = acciones.filter((a) => !a.completed);
  const fase = (s.timer as { phase?: unknown } | undefined)?.phase;
  const enFase = pendientes.length > 0 && (pendientes.some((a) => a.isInProgress) || fase === 'PLANNING');
  const bans = (s.bans ?? {}) as { myTeamBans?: unknown; theirTeamBans?: unknown };
  const bloqueados = clavesValidas([
    ...(Array.isArray(bans.myTeamBans) ? bans.myTeamBans : []),
    ...(Array.isArray(bans.theirTeamBans) ? bans.theirTeamBans : []),
    ...acciones.filter((a) => a.completed).map((a) => a.championId),
  ]);
  return { ...(enFase ? { faseBloqueos: true as const } : {}), ...(bloqueados.length > 0 ? { bloqueados } : {}) };
}

export function interpretarRivales(sesion: unknown, colaConocida: number | null = null): RivalesSeleccion | null {
  if (typeof sesion !== 'object' || sesion === null) return null;
  const s = sesion as { localPlayerCellId?: number; myTeam?: Celda[]; theirTeam?: Celda[]; queueId?: unknown; actions?: unknown; bans?: unknown; timer?: unknown };
  if (typeof s.localPlayerCellId !== 'number' || !Array.isArray(s.myTeam)) return null;
  const cola = typeof s.queueId === 'number' && s.queueId > 0 ? s.queueId : colaConocida;
  const modo = modoDeCola(cola);
  if (modo && modo !== 'clasificatoria') return null;
  if (!modo && typeof cola === 'number' && cola > 0 && !esColaGrietaNormal(cola)) return null;
  const yo = s.myTeam.find((c) => c.cellId === s.localPlayerCellId);
  const rivales = (Array.isArray(s.theirTeam) ? s.theirTeam : [])
    .filter((c) => typeof c?.championId === 'number' && c.championId > 0)
    .map((c) => ({ campeonId: c.championId!, rol: ROLES[c.assignedPosition ?? ''] ?? null }));
  const aliados = clavesValidas(s.myTeam.filter((c) => c && c.cellId !== s.localPlayerCellId).map((c) => c.championId || c.championPickIntent));
  return { rol: ROLES[yo?.assignedPosition ?? ''] ?? null, rivales, ...bloqueosDe(s), ...(aliados.length > 0 ? { aliados } : {}) };
}
