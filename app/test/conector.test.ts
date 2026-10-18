import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registrar } from '../src/main/log';
import fixture from './fixtures/allgamedata.json';
import { crearConectorPartida } from '../src/main/partida/conector';
import type { EstadoPartida } from '../src/shared/tiposApp';

const resp = (status: number, cuerpo: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo }) as Response;

vi.mock('../src/main/log', () => ({ registrar: vi.fn() }));

beforeEach(() => {
  vi.mocked(registrar).mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('crearConectorPartida', () => {
  it('respuesta 404 y JSON incompleto durante la carga no emiten estado ni detienen el sondeo', async () => {
    const parcial = { activePlayer: (fixture as any).activePlayer, allPlayers: [], gameData: (fixture as any).gameData };
    const f = vi
      .fn()
      .mockResolvedValueOnce(resp(404, {}))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(resp(200, parcial))
      .mockResolvedValue(resp(200, fixture));
    const c = crearConectorPartida({ url: 'http://x', fetch: f as any, intervaloMs: 1000 });
    const estados: EstadoPartida[] = [];
    c.on('estado', (e) => estados.push(e));
    c.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f).toHaveBeenCalledTimes(3);
    expect(estados).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f).toHaveBeenCalledTimes(4);
    expect(estados).toHaveLength(1);
    c.detener();
  });

  it('conector: tras la carga emite estado y consulta la ruta allgamedata', async () => {
    const f = vi.fn().mockResolvedValue(resp(200, fixture));
    const c = crearConectorPartida({ url: 'http://x:2999', fetch: f as any, intervaloMs: 1000 });
    const estados: EstadoPartida[] = [];
    c.on('estado', (e) => estados.push(e));
    c.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(estados[0]?.campeon).toBe('Ahri');
    expect(String(f.mock.calls[0][0])).toBe('http://x:2999/liveclientdata/allgamedata');
    c.detener();
  });

  it('no solapa peticiones y detener() para el sondeo', async () => {
    let resolver!: (r: Response) => void;
    const f = vi.fn().mockImplementation(() => new Promise<Response>((r) => (resolver = r)));
    const c = crearConectorPartida({ url: 'http://x', fetch: f as any, intervaloMs: 1000 });
    c.iniciar();
    await vi.advanceTimersByTimeAsync(3500);
    expect(f).toHaveBeenCalledTimes(1);
    resolver(resp(200, fixture));
    await vi.advanceTimersByTimeAsync(1000);
    expect(f).toHaveBeenCalledTimes(2);
    c.detener();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('registro de fallos', () => {
  it('fallos idénticos consecutivos se registran una vez; uno distinto vuelve a registrarse', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(resp(404, {}))
      .mockResolvedValueOnce(resp(404, {}))
      .mockResolvedValueOnce(resp(404, {}))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(resp(200, fixture));
    const c = crearConectorPartida({ url: 'http://x', fetch: f as any, intervaloMs: 1000 });
    c.iniciar();
    await vi.advanceTimersByTimeAsync(2000);
    expect(f).toHaveBeenCalledTimes(3);
    expect(registrar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(registrar).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(registrar).toHaveBeenCalledTimes(3); // recuperada
    c.detener();
  });
});
