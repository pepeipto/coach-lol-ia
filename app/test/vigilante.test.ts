import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sesion from './fixtures/sesionSeleccion.json';
import { VigilanteLcu } from '../src/main/lcu/vigilante';
import type { ClienteLcu } from '../src/main/lcu/cliente';

function clienteFalso(fase: string, ses: unknown) {
  const subs: Record<string, (d: { uri: string; eventType: string; data: unknown }) => void> = {};
  const cliente: ClienteLcu = {
    peticion: vi.fn(async (_m: string, ruta: string) => (ruta.includes('gameflow-phase') ? fase : ses)) as never,
    suscribir: (e, cb) => { subs[e] = cb; },
    cerrar: vi.fn(),
  };
  return { cliente, subs };
}

describe('VigilanteLcu', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sin lockfile no emite nada; con lockfile conecta; al desaparecer desconecta', async () => {
    let existe = false;
    const { cliente } = clienteFalso('None', null);
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => { if (!existe) throw new Error('ENOENT'); return 'LeagueClient:1:2:pw:https'; },
      conectar: async () => cliente,
      buscarDir: async () => 'C:\\LoL',
    });
    const ev: string[] = [];
    v.on('conectado', (_c, dir) => ev.push('conectado:' + dir));
    v.on('desconectado', () => ev.push('desconectado'));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(350);
    expect(ev).toEqual([]);
    existe = true;
    await vi.advanceTimersByTimeAsync(150);
    expect(ev).toEqual(['conectado:C:\\LoL']);
    existe = false;
    await vi.advanceTimersByTimeAsync(150);
    expect(ev).toEqual(['conectado:C:\\LoL', 'desconectado']);
    expect(cliente.cerrar).toHaveBeenCalled();
    v.detener();
  });

  it('emite fase y selección inicial sin repetirla', async () => {
    const { cliente, subs } = clienteFalso('ChampSelect', sesion);
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => 'LeagueClient:1:2:pw:https',
      conectar: async () => cliente,
      buscarDir: async () => 'C:\\LoL',
    });
    const fases: string[] = [];
    const sels: unknown[] = [];
    v.on('fase', (f) => fases.push(f));
    v.on('seleccion', (s) => sels.push(s));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(150);
    expect(fases).toEqual(['ChampSelect']);
    expect(sels).toEqual([{ campeonId: 103, rol: 'MIDDLE' }]);
    subs['OnJsonApiEvent_lol-champ-select_v1_session']({ uri: '', eventType: 'Update', data: sesion });
    expect(sels).toHaveLength(1);
    subs['OnJsonApiEvent_lol-champ-select_v1_session']({ uri: '', eventType: 'Update', data: { ...sesion, localPlayerCellId: 1 } });
    expect(sels).toHaveLength(2);
    subs['OnJsonApiEvent_lol-gameflow_v1_gameflow-phase']({ uri: '', eventType: 'Update', data: 'InProgress' });
    expect(fases).toEqual(['ChampSelect', 'InProgress']);
    v.detener();
  });

  it('detener() durante una conexión en curso no deja la conexión abierta ni emite conectado', async () => {
    const { cliente } = clienteFalso('None', null);
    let resolver: (c: ClienteLcu) => void = () => undefined;
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => 'LeagueClient:1:2:pw:https',
      conectar: () => new Promise<ClienteLcu>((r) => { resolver = r; }),
      buscarDir: async () => 'C:\\LoL',
    });
    const ev: string[] = [];
    v.on('conectado', () => ev.push('conectado'));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(50);
    v.detener();
    resolver(cliente);
    await vi.advanceTimersByTimeAsync(300);
    expect(ev).toEqual([]);
    expect(cliente.cerrar).toHaveBeenCalled();
  });

  it('si conectar falla se libera y se reintenta en el siguiente intervalo', async () => {
    const { cliente } = clienteFalso('None', null);
    const conectar = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue(cliente);
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => 'LeagueClient:1:2:pw:https',
      conectar,
      buscarDir: async () => 'C:\\LoL',
    });
    const ev: string[] = [];
    v.on('conectado', () => ev.push('conectado'));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(50);
    expect(ev).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    expect(ev).toEqual(['conectado']);
    expect(conectar).toHaveBeenCalledTimes(2);
    v.detener();
  });
});
