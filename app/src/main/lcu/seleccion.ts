import { modoDeCola, type Rol } from '@coach/shared';
import type { SeleccionCampeon } from '../../shared/tiposApp';

export type { SeleccionCampeon };

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
