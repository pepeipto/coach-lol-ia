import { describe, expect, it, vi } from 'vitest';
import { crearAtajoCarga, TECLA_OCULTAR_CARGA } from '../src/main/atajoCarga';
import { crearOrquestadorCarga, DURACION_MAXIMA_CARGA_MS } from '../src/main/orquestador/carga';
import type { AjustesCarga } from '../src/shared/tiposApp';

vi.mock('../src/main/log', () => ({ registrar: vi.fn() }));

/** globalShortcut de mentira: qué teclas hay reservadas ahora mismo. */
function atajosFalsos() {
  const reservadas = new Map<string, () => void>();
  return {
    reservadas,
    register: vi.fn((tecla: string, cb: () => void) => {
      if (reservadas.has(tecla)) return false;
      reservadas.set(tecla, cb);
      return true;
    }),
    unregister: vi.fn((tecla: string) => void reservadas.delete(tecla)),
    pulsar: (tecla: string) => reservadas.get(tecla)?.(),
  };
}

const VISIBLE = { cargaVisible: true, activado: true, enPartida: false };

describe('Espacio para ocultar la pantalla de carga: cuándo se reserva', () => {
  it('es la barra espaciadora', () => {
    expect(TECLA_OCULTAR_CARGA).toBe('Space');
  });

  it('solo con la carga a la vista, el ajuste encendido y sin partida', () => {
    const g = atajosFalsos();
    const a = crearAtajoCarga(g, () => {});
    a.sincronizar(VISIBLE);
    expect(g.reservadas.has('Space')).toBe(true);
    a.sincronizar(VISIBLE);
    expect(g.register).toHaveBeenCalledTimes(1);
    for (const e of [
      { ...VISIBLE, cargaVisible: false },
      { ...VISIBLE, activado: false },
      { ...VISIBLE, enPartida: true },
    ]) {
      a.sincronizar(VISIBLE);
      expect(g.reservadas.has('Space')).toBe(true);
      a.sincronizar(e);
      expect(g.reservadas.has('Space')).toBe(false);
    }
  });

  it('al pulsarla se suelta antes de avisar', () => {
    const g = atajosFalsos();
    let reservadaAlAvisar: boolean | null = null;
    const a = crearAtajoCarga(g, () => (reservadaAlAvisar = g.reservadas.has('Space')));
    a.sincronizar(VISIBLE);
    g.pulsar('Space');
    expect(reservadaAlAvisar).toBe(false);
    expect(g.reservadas.has('Space')).toBe(false);
  });

  it('liberar (al cerrar la app) la suelta; si otra app la tiene, no falla ni se la quita', () => {
    const g = atajosFalsos();
    const a = crearAtajoCarga(g, () => {});
    a.sincronizar(VISIBLE);
    a.liberar();
    expect(g.reservadas.size).toBe(0);
    g.reservadas.set('Space', () => {});
    const b = crearAtajoCarga(g, () => {});
    expect(() => b.sincronizar(VISIBLE)).not.toThrow();
    b.liberar();
    expect(g.reservadas.has('Space')).toBe(true);
  });
});

/**
 * Como en main (index.ts): el orquestador de la carga avisa de si se ve y el atajo se sincroniza con eso, con el ajuste
 * y con la partida. Espacio nunca debe quedar reservado en la partida (centra la cámara).
 */
describe('Espacio con el orquestador de la carga (ciclo completo)', () => {
  const SESION = {
    map: { id: 11 },
    gameData: {
      teamOne: [{ puuid: '', championId: 103, selectedPosition: 'MIDDLE' }],
      teamTwo: [{ puuid: '', championId: 62, selectedPosition: 'TOP' }],
    },
  };
  const cliente = {
    async peticion<T>(_m: string, ruta: string): Promise<T> {
      if (ruta === '/lol-gameflow/v1/session') return SESION as T;
      return null as T;
    },
  };

  function montar(ajustes: AjustesCarga = { modo: 'completa', ocultarConEspacio: true }) {
    const g = atajosFalsos();
    let enPartida = false;
    const eventos: string[] = [];
    const carga = crearOrquestadorCarga({
      urlServidor: () => 'https://servidor.test',
      datos: async () => null,
      enviarModo: (m) => eventos.push(`modo:${m}`),
      enviarCarga: () => {},
      mostrar: () => eventos.push('mostrar'),
      ocultar: () => eventos.push('ocultar'),
      enPartida: () => enPartida,
      ajustesCarga: () => ajustes,
      alCambiarVisible: () => sincronizar(),
      enviarOcultar: () => eventos.push('fundido'),
    });
    const atajo = crearAtajoCarga(g, () => {
      if (!enPartida) carga.ocultarPorUsuario();
    });
    function sincronizar() {
      atajo.sincronizar({ cargaVisible: carga.visible(), activado: ajustes.ocultarConEspacio, enPartida });
    }
    carga.conectado(cliente);
    /** Lo que hace main cuando empieza la partida (alCambiarPartida). */
    const empezarPartida = () => {
      enPartida = true;
      carga.partidaIniciada();
      sincronizar();
    };
    return { g, carga, atajo, eventos, empezarPartida, sincronizar };
  }

  it('se reserva al salir la carga y se suelta al empezar la partida', async () => {
    const { g, carga, empezarPartida } = montar();
    expect(g.reservadas.has('Space')).toBe(false);
    await carga.fase('InProgress');
    expect(g.reservadas.has('Space')).toBe(true);
    empezarPartida();
    expect(g.reservadas.has('Space')).toBe(false);
  });

  it('pulsarla oculta la carga y la suelta al instante (en la partida Espacio vuelve a ser del juego)', async () => {
    const { g, carga, eventos, empezarPartida } = montar();
    await carga.fase('InProgress');
    g.pulsar('Space');
    expect(eventos).toContain('fundido');
    expect(g.reservadas.has('Space')).toBe(false);
    expect(carga.visible()).toBe(false);
    empezarPartida();
    expect(g.reservadas.has('Space')).toBe(false);
    expect(g.register).toHaveBeenCalledTimes(1);
  });

  it('con «Ocultar con Espacio» apagado nunca se reserva', async () => {
    const { g, carga } = montar({ modo: 'completa', ocultarConEspacio: false });
    await carga.fase('InProgress');
    expect(carga.visible()).toBe(true);
    expect(g.register).not.toHaveBeenCalled();
  });

  it('con la pantalla de carga desactivada nunca se reserva', async () => {
    const { g, carga } = montar({ modo: 'desactivada', ocultarConEspacio: true });
    await carga.fase('InProgress');
    expect(g.register).not.toHaveBeenCalled();
  });

  it('se suelta si la carga termina sola (2 minutos) o se cierra el cliente', async () => {
    vi.useFakeTimers();
    try {
      const a = montar();
      await a.carga.fase('InProgress');
      expect(a.g.reservadas.has('Space')).toBe(true);
      await vi.advanceTimersByTimeAsync(DURACION_MAXIMA_CARGA_MS);
      expect(a.g.reservadas.has('Space')).toBe(false);

      const b = montar();
      await b.carga.fase('InProgress');
      expect(b.g.reservadas.has('Space')).toBe(true);
      b.carga.desconectado();
      expect(b.g.reservadas.has('Space')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('al cerrar la app (will-quit) se suelta', async () => {
    const { g, carga, atajo } = montar();
    await carga.fase('InProgress');
    atajo.liberar();
    expect(g.reservadas.has('Space')).toBe(false);
  });

  it('nunca queda reservada en la partida aunque llegue tarde una sincronización', async () => {
    const { g, carga, empezarPartida, sincronizar } = montar();
    await carga.fase('InProgress');
    empezarPartida();
    sincronizar();
    expect(g.reservadas.has('Space')).toBe(false);
    // Una pulsación que llegara en la partida no oculta nada.
    expect(carga.ocultarPorUsuario()).toBe(false);
  });
});
