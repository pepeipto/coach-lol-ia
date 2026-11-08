import { describe, expect, it, vi } from 'vitest';
import { crearContadorVoz, idPartidaVoz } from '../src/main/ia/vozPartidas';
import type { Ajustes, EstadoPartida } from '../src/shared/tiposApp';

const T = Date.UTC(2026, 10, 8, 20);
const estado = (tiempo: number, campeon = 'Ahri') =>
  ({
    modo: 'clasica',
    campeon,
    tiempo,
    jugadores: [
      { campeon, equipo: 'ORDER', posicion: null, castigo: false },
      { campeon: 'Zed', equipo: 'CHAOS', posicion: null, castigo: false },
    ],
  }) as unknown as EstadoPartida;

const respuesta = (j: unknown) => ({ ok: true, json: async () => j }) as unknown as Response;

describe('partidas con voz', () => {
  it('el id de la partida es el mismo aunque la app se reinicie a mitad', () => {
    expect(idPartidaVoz(estado(60), T)).toBe(idPartidaVoz(estado(900), T + 840_000));
    expect(idPartidaVoz(estado(60), T)).not.toBe(idPartidaVoz(estado(60, 'Lux'), T));
    expect(idPartidaVoz(estado(60), T)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('avisa una sola vez por partida y solo con la voz encendida', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => respuesta({ permitida: true, usadas: 1, limite: 0 }));
    const c = crearContadorVoz({ urlServidor: () => 'https://api', cabeceras: async () => ({ 'x-coach-dispositivo': 'd' }), fetch: f as unknown as typeof fetch, ahora: () => T });
    c.alEstado(estado(10), false);
    expect(f).not.toHaveBeenCalled();
    c.alEstado(estado(10), true);
    c.alEstado(estado(20), true);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f.mock.calls[0]![0]).toBe('https://api/api/premium/voz');
    c.finPartida();
    c.alEstado(estado(10, 'Lux'), true);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect(c.bloqueada()).toBe(false);
  });

  it('si el servidor corta la voz, se apaga en esa partida; sin conexión sigue', async () => {
    const a = { overlay: { voz: { activa: true } } } as unknown as Ajustes;
    const corta = crearContadorVoz({ urlServidor: () => 'https://api', cabeceras: async () => ({}), fetch: (async () => respuesta({ permitida: false, usadas: 3, limite: 3 })) as unknown as typeof fetch });
    corta.alEstado(estado(10), true);
    await vi.waitFor(() => expect(corta.bloqueada()).toBe(true));
    expect(corta.ajustar(a).overlay.voz.activa).toBe(false);
    corta.finPartida();
    expect(corta.ajustar(a).overlay.voz.activa).toBe(true);

    const caido = crearContadorVoz({ urlServidor: () => 'https://api', cabeceras: async () => ({}), fetch: (async () => { throw new Error('red'); }) as unknown as typeof fetch });
    caido.alEstado(estado(10), true);
    await new Promise((r) => setTimeout(r, 10));
    expect(caido.ajustar(a).overlay.voz.activa).toBe(true);
  });
});
