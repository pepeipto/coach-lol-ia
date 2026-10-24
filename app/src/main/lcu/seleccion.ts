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
export function interpretarRivales(sesion: unknown, colaConocida: number | null = null): RivalesSeleccion | null {
  if (typeof sesion !== 'object' || sesion === null) return null;
  const s = sesion as { localPlayerCellId?: number; myTeam?: Celda[]; theirTeam?: Celda[]; queueId?: unknown };
  if (typeof s.localPlayerCellId !== 'number' || !Array.isArray(s.myTeam)) return null;
  const cola = typeof s.queueId === 'number' && s.queueId > 0 ? s.queueId : colaConocida;
  const modo = modoDeCola(cola);
  if (modo && modo !== 'clasificatoria') return null;
  if (!modo && typeof cola === 'number' && cola > 0 && !esColaGrietaNormal(cola)) return null;
  const yo = s.myTeam.find((c) => c.cellId === s.localPlayerCellId);
  const rivales = (Array.isArray(s.theirTeam) ? s.theirTeam : [])
    .filter((c) => typeof c?.championId === 'number' && c.championId > 0)
    .map((c) => ({ campeonId: c.championId!, rol: ROLES[c.assignedPosition ?? ''] ?? null }));
  return { rol: ROLES[yo?.assignedPosition ?? ''] ?? null, rivales };
}
