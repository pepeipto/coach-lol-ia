import type { Rol } from '@coach/shared';
import { registrar } from '../log';
import type { ClienteLcu } from './cliente';
import { interpretarRivales } from './seleccion';

/*
 * 3.18: bloqueo automático (opcional, APAGADO por defecto: `Ajustes.bloqueoAutomatico`). Si llega tu turno de elegir
 * y estás a punto de quedarte sin tiempo SIN haber elegido ni marcado ningún campeón, la app fija tu campeón más jugado
 * en esa línea que esté disponible (de tu historial local), para que no se cancele la partida por no elegir.
 * - Nunca actúa si ya has marcado o elegido un campeón: entonces eliges tú (y el cliente fija el marcado al acabarse
 *   el tiempo).
 * - Solo en tu turno de elección (acción 'pick' en curso) de la Grieta con línea asignada, una sola vez por turno.
 * - Solo campeones que puedes elegir (`pickable-champion-ids`) y que no están bloqueados ni elegidos.
 * Lo enciende cada jugador en Ajustes; nada se hace sin que lo active.
 */

/** Cuánto antes de que se acabe tu tiempo se fija el campeón: con 1 s en el reloj (las peticiones al cliente son locales, de milisegundos). */
export const MARGEN_BLOQUEO_MS = 1000;

const ROLES: Record<string, Rol> = { top: 'TOP', jungle: 'JUNGLE', middle: 'MIDDLE', bottom: 'BOTTOM', utility: 'UTILITY' };

interface Accion {
  id?: number;
  actorCellId?: number;
  championId?: number;
  completed?: boolean;
  isInProgress?: boolean;
  type?: string;
}
interface Celda {
  cellId?: number;
  championId?: number;
  championPickIntent?: number;
  assignedPosition?: string;
}

/** Tu turno de elección en curso, sin campeón marcado ni elegido: la acción, tu línea y el tiempo que queda. */
export interface TurnoEleccion {
  accionId: number;
  rol: Rol;
  quedaMs: number;
}

const acciones = (s: { actions?: unknown }): Accion[] =>
  (Array.isArray(s.actions) ? s.actions : []).flatMap((g) => (Array.isArray(g) ? g : [])).filter((a): a is Accion => typeof a === 'object' && a !== null);

/** Null si no es tu turno de elegir, si ya marcaste o elegiste campeón, o si no se sabe tu línea. */
export function turnoSinElegir(sesion: unknown): TurnoEleccion | null {
  if (typeof sesion !== 'object' || sesion === null) return null;
  const s = sesion as { localPlayerCellId?: number; myTeam?: Celda[]; actions?: unknown; timer?: { phase?: unknown; adjustedTimeLeftInPhase?: unknown } };
  if (typeof s.localPlayerCellId !== 'number' || !Array.isArray(s.myTeam)) return null;
  if (s.timer?.phase !== 'BAN_PICK') return null;
  const accion = acciones(s).find((a) => a.type === 'pick' && a.actorCellId === s.localPlayerCellId && a.isInProgress && !a.completed);
  if (!accion || typeof accion.id !== 'number') return null;
  const yo = s.myTeam.find((c) => c.cellId === s.localPlayerCellId);
  if (!yo || (accion.championId ?? 0) > 0 || (yo.championId ?? 0) > 0 || (yo.championPickIntent ?? 0) > 0) return null;
  const rol = ROLES[yo.assignedPosition ?? ''];
  if (!rol) return null;
  const queda = s.timer.adjustedTimeLeftInPhase;
  return { accionId: accion.id, rol, quedaMs: typeof queda === 'number' && Number.isFinite(queda) ? Math.max(0, queda) : 0 };
}

/** Campeones que ya no se pueden elegir: bloqueados y elegidos (o marcados) por cualquiera. */
export function noDisponibles(sesion: unknown): Set<number> {
  const s = (sesion ?? {}) as { myTeam?: Celda[]; theirTeam?: Celda[]; actions?: unknown };
  const r = interpretarRivales(sesion);
  const ids = [
    ...(r?.bloqueados ?? []),
    ...[...(s.myTeam ?? []), ...(s.theirTeam ?? [])].flatMap((c) => [c?.championId ?? 0, c?.championPickIntent ?? 0]),
    ...acciones(s as { actions?: unknown }).filter((a) => a.completed).map((a) => a.championId ?? 0),
  ];
  return new Set(ids.filter((x) => x > 0));
}

/** Tu main más jugado que puedes elegir y está libre; null si ninguno. `mains` va del más jugado al menos. */
export function elegirMain(mains: number[], elegibles: number[], ocupados: Set<number>): number | null {
  const puedes = new Set(elegibles);
  return mains.find((m) => puedes.has(m) && !ocupados.has(m)) ?? null;
}

export interface DependenciasBloqueo {
  activo: () => boolean;
  /** Tus campeones más jugados en un rol (claves de Riot), del más jugado al menos. */
  mains: (rol: Rol) => number[];
  programar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (t: unknown) => void;
}

export function crearBloqueoAutomatico(dep: DependenciasBloqueo) {
  const programar = dep.programar ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancelar = dep.cancelar ?? ((t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let temporizador: unknown = null;
  let accionProgramada: number | null = null;
  /** Turnos ya resueltos (fijado o descartado): una sola vez por turno. */
  const hechas = new Set<number>();

  function parar(): void {
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
    accionProgramada = null;
  }

  /** Al fin del plazo: vuelve a mirar la sesión y, si sigue sin elegir, fija tu main libre. */
  async function intentar(cliente: ClienteLcu, accionId: number): Promise<void> {
    temporizador = null;
    accionProgramada = null;
    if (!dep.activo() || hechas.has(accionId)) return;
    hechas.add(accionId);
    try {
      const sesion = await cliente.peticion('GET', '/lol-champ-select/v1/session');
      const turno = turnoSinElegir(sesion);
      if (!turno || turno.accionId !== accionId) return;
      const elegibles = await cliente.peticion<unknown>('GET', '/lol-champ-select/v1/pickable-champion-ids');
      const lista = Array.isArray(elegibles) ? elegibles.filter((x): x is number => typeof x === 'number') : [];
      const campeon = elegirMain(dep.mains(turno.rol), lista, noDisponibles(sesion));
      if (!campeon) {
        registrar('info', 'Bloqueo automático: ninguno de tus mains de esta línea está libre; no se elige nada.');
        return;
      }
      await cliente.peticion('PATCH', `/lol-champ-select/v1/session/actions/${accionId}`, { championId: campeon, completed: true });
      registrar('info', `Bloqueo automático: se fijó tu main ${campeon} en ${turno.rol} al acabarse el tiempo.`);
    } catch (e) {
      registrar('aviso', `Bloqueo automático fallido: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    /** Cada cambio de la sesión de selección: programa (o cancela) el bloqueo de tu turno. */
    alSesion(sesion: unknown, cliente: ClienteLcu): void {
      const turno = dep.activo() ? turnoSinElegir(sesion) : null;
      if (!turno || hechas.has(turno.accionId)) return parar();
      if (accionProgramada === turno.accionId) return;
      parar();
      accionProgramada = turno.accionId;
      temporizador = programar(() => void intentar(cliente, turno.accionId), Math.max(0, turno.quedaMs - MARGEN_BLOQUEO_MS));
    },
    /** Fin de la selección o cliente cerrado. */
    reiniciar(): void {
      parar();
      hechas.clear();
    },
  };
}
