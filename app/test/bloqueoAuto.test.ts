import { describe, expect, it, vi } from 'vitest';
import { crearBloqueoAutomatico, elegirMain, MARGEN_BLOQUEO_MS, noDisponibles, turnoPendiente } from '../src/main/lcu/bloqueoAuto';
import type { ClienteLcu } from '../src/main/lcu/cliente';

/** Sesión de clasificatoria: eres la celda 2 (central); tu turno de elegir es la acción 9. */
function sesion(o: { enCurso?: boolean; hecha?: boolean; marcado?: number; fase?: string; queda?: number; rol?: string } = {}) {
  return {
    localPlayerCellId: 2,
    queueId: 420,
    timer: { phase: o.fase ?? 'BAN_PICK', adjustedTimeLeftInPhase: o.queda ?? 20_000 },
    myTeam: [
      { cellId: 1, championId: 103, assignedPosition: 'top' },
      { cellId: 2, championId: 0, championPickIntent: o.marcado ?? 0, assignedPosition: o.rol ?? 'middle' },
    ],
    theirTeam: [{ cellId: 7, championId: 61 }],
    bans: { myTeamBans: [238], theirTeamBans: [] },
    actions: [
      [{ id: 1, type: 'ban', actorCellId: 2, championId: 238, completed: true }],
      [{ id: 9, type: 'pick', actorCellId: 2, championId: 0, completed: o.hecha ?? false, isInProgress: o.enCurso ?? true }],
    ],
  };
}

describe('3.18: bloqueo automático, piezas', () => {
  it('turno sin elegir: tu acción en curso, tu línea y el tiempo que queda', () => {
    expect(turnoPendiente(sesion())).toEqual({ accionId: 9, rol: 'MIDDLE', quedaMs: 20_000, marcado: 0 });
  });

  it('con campeón marcado lo trae en `marcado`', () => {
    expect(turnoPendiente(sesion({ marcado: 134 }))?.marcado).toBe(134);
  });

  it('nada si ya bloqueaste, si no es tu turno, fuera de BAN_PICK o sin línea', () => {
    expect(turnoPendiente(sesion({ hecha: true }))).toBeNull();
    expect(turnoPendiente(sesion({ enCurso: false }))).toBeNull();
    expect(turnoPendiente(sesion({ fase: 'PLANNING' }))).toBeNull();
    expect(turnoPendiente(sesion({ rol: '' }))).toBeNull();
    expect(turnoPendiente(null)).toBeNull();
  });

  it('no disponibles: bloqueados y elegidos por cualquiera', () => {
    expect([...noDisponibles(sesion())].sort((a, b) => a - b)).toEqual([61, 103, 238]);
  });

  it('elige tu main más jugado que puedes elegir y está libre', () => {
    expect(elegirMain([238, 99, 134, 7], [99, 134, 7], new Set([238, 99]))).toBe(134);
    expect(elegirMain([238], [238], new Set([238]))).toBeNull();
  });
});

describe('3.18: bloqueo automático, en marcha', () => {
  function montar(activo: boolean, sesionAlFinal: unknown = sesion({ queda: 2000 })) {
    let pendiente: (() => void) | null = null;
    let espera = -1;
    const peticion = vi.fn(async (metodo: string, ruta: string) => {
      if (ruta === '/lol-champ-select/v1/session') return sesionAlFinal;
      if (ruta === '/lol-champ-select/v1/pickable-champion-ids') return [238, 134, 7];
      return undefined;
    });
    const b = crearBloqueoAutomatico({
      activo: () => activo,
      mains: () => [238, 134, 7],
      programar: (fn, ms) => ((pendiente = fn), (espera = ms), 1),
      cancelar: () => (pendiente = null),
    });
    const cliente = { peticion } as unknown as ClienteLcu;
    return { b, cliente, peticion, disparar: async () => { pendiente?.(); await new Promise((r) => setTimeout(r, 0)); }, pendiente: () => pendiente, espera: () => espera };
  }

  it('apagado (por defecto): no programa nada', () => {
    const m = montar(false);
    m.b.alSesion(sesion(), m.cliente);
    expect(m.pendiente()).toBeNull();
  });

  it('encendido: al acabarse el tiempo fija tu main libre (no el bloqueado)', async () => {
    const m = montar(true);
    m.b.alSesion(sesion(), m.cliente);
    expect(m.espera()).toBe(20_000 - MARGEN_BLOQUEO_MS);
    await m.disparar();
    expect(m.peticion).toHaveBeenCalledWith('PATCH', '/lol-champ-select/v1/session/actions/9', { championId: 134, completed: true });
  });

  it('con un campeón marcado, al acabarse el tiempo lo bloquea (no cambia a tu main)', async () => {
    const m = montar(true, sesion({ marcado: 7, queda: 2000 }));
    m.b.alSesion(sesion({ marcado: 7 }), m.cliente);
    expect(m.pendiente()).not.toBeNull();
    await m.disparar();
    expect(m.peticion).toHaveBeenCalledWith('PATCH', '/lol-champ-select/v1/session/actions/9', { championId: 7, completed: true });
  });

  it('si ya bloqueaste antes de que acabe el tiempo, no toca nada', async () => {
    const m = montar(true, sesion({ hecha: true }));
    m.b.alSesion(sesion(), m.cliente);
    await m.disparar();
    expect(m.peticion).not.toHaveBeenCalledWith('PATCH', expect.anything(), expect.anything());
  });
});
