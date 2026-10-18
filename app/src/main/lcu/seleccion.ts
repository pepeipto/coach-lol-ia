import type { Rol } from '@coach/shared';
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

/** Campeón (fijado o en intención) y rol del jugador local en la sesión de selección. */
export function interpretarSeleccion(sesion: unknown): SeleccionCampeon | null {
  if (typeof sesion !== 'object' || sesion === null) return null;
  const s = sesion as { localPlayerCellId?: number; myTeam?: Celda[] };
  if (typeof s.localPlayerCellId !== 'number' || !Array.isArray(s.myTeam)) return null;
  const yo = s.myTeam.find((c) => c.cellId === s.localPlayerCellId);
  if (!yo) return null;
  const campeonId = yo.championId || yo.championPickIntent || 0;
  if (!campeonId) return null;
  return { campeonId, rol: ROLES[yo.assignedPosition ?? ''] ?? null };
}
