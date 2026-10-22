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

  it('un lockfile que no cambia y con el que no se puede conectar se reintenta cada vez menos (hasta 60 s)', async () => {
    let lockfile = 'LeagueClient:1:2:pw:https';
    const { cliente } = clienteFalso('None', null);
    let conecta = false;
    const conectar = vi.fn(async () => {
      if (!conecta) throw new Error('ECONNREFUSED');
      return cliente;
    });
    const v = new VigilanteLcu({ intervaloMs: 3000, leerArchivo: async () => lockfile, conectar, buscarDir: async () => 'C:\LoL' });
    const ev: string[] = [];
    v.on('conectado', () => ev.push('conectado'));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(120_000); // 41 sondeos
    // t = 0, 3, 9, 21, 45, 93 s: la espera se dobla desde 3 s.
    expect(conectar).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(conectar.mock.calls.length).toBeLessThanOrEqual(6 + 11); // como mucho una vez por minuto
    // Un lockfile nuevo (el cliente se volvió a abrir) se prueba en el siguiente sondeo.
    const antes = conectar.mock.calls.length;
    lockfile = 'LeagueClient:9:8:otra:https';
    conecta = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(conectar.mock.calls.length).toBe(antes + 1);
    expect(ev).toEqual(['conectado']);
    v.detener();
  });

  describe('búsqueda del directorio de LoL', () => {
    const POR_DEFECTO = 'C:\\Riot Games\\League of Legends';

    it('con el cliente cerrado, PowerShell (buscarDir) se lanza cada vez menos (30 s, 60 s, 120 s… hasta 5 min)', async () => {
      const leidas: string[] = [];
      const buscarDir = vi.fn(async () => POR_DEFECTO);
      const v = new VigilanteLcu({
        intervaloMs: 3000,
        leerArchivo: async (ruta) => { leidas.push(ruta); throw new Error('ENOENT'); },
        conectar: async () => { throw new Error('no debería conectar'); },
        buscarDir,
      });
      v.iniciar();
      await vi.advanceTimersByTimeAsync(65_000); // 22 sondeos: t = 0, 3, …, 63 s
      expect(buscarDir).toHaveBeenCalledTimes(2); // t = 0 y 30 s (la siguiente, a los 90 s)
      await vi.advanceTimersByTimeAsync(30_000);
      expect(buscarDir).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(600_000);
      // 90 + 120 + 240 + 300 + 300… : como mucho una cada 5 min.
      expect(buscarDir.mock.calls.length).toBeLessThanOrEqual(6);
      // El directorio por defecto se comprueba en cada sondeo, sin PowerShell.
      expect(leidas.filter((r) => r.startsWith(POR_DEFECTO)).length).toBeGreaterThanOrEqual(22);
      v.detener();
    });

    it('3.6: la ruta de los metadatos de Riot se usa sin PowerShell', async () => {
      const { cliente } = clienteFalso('None', null);
      const buscarDir = vi.fn(async () => 'X:\\Nada');
      const v = new VigilanteLcu({
        intervaloMs: 100,
        leerArchivo: async (ruta) => {
          if (ruta.endsWith('product_settings.yaml')) return 'product_install_full_path: "E:/Juegos/League of Legends"\n';
          if (ruta === 'E:\\Juegos\\League of Legends\\lockfile') return 'LeagueClient:1:2:pw:https';
          throw new Error('ENOENT');
        },
        conectar: async () => cliente,
        buscarDir,
      });
      const dirs: string[] = [];
      v.on('conectado', (_c, dir: string) => dirs.push(dir));
      v.iniciar();
      await vi.advanceTimersByTimeAsync(50);
      expect(dirs).toEqual(['E:\\Juegos\\League of Legends']);
      expect(buscarDir).not.toHaveBeenCalled();
      v.detener();
    });

    it('si el lockfile está en el directorio por defecto no se lanza PowerShell', async () => {
      const { cliente } = clienteFalso('None', null);
      const buscarDir = vi.fn(async () => 'D:\\LoL');
      const v = new VigilanteLcu({
        intervaloMs: 100,
        leerArchivo: async (ruta) => {
          if (!ruta.startsWith(POR_DEFECTO)) throw new Error('ENOENT');
          return 'LeagueClient:1:2:pw:https';
        },
        conectar: async () => cliente,
        buscarDir,
      });
      const dirs: string[] = [];
      v.on('conectado', (_c, dir: string) => dirs.push(dir));
      v.iniciar();
      await vi.advanceTimersByTimeAsync(50);
      expect(dirs).toEqual([POR_DEFECTO]);
      expect(buscarDir).not.toHaveBeenCalled();
      v.detener();
    });

    it('recuerda el directorio encontrado y lo comprueba primero sin volver a lanzar PowerShell', async () => {
      const { cliente } = clienteFalso('None', null);
      let abierto = true;
      const buscarDir = vi.fn(async () => 'D:\\LoL');
      const v = new VigilanteLcu({
        intervaloMs: 100,
        leerArchivo: async (ruta) => {
          if (!abierto || !ruta.startsWith('D:\\LoL')) throw new Error('ENOENT');
          return 'LeagueClient:1:2:pw:https';
        },
        conectar: async () => cliente,
        buscarDir,
      });
      const ev: string[] = [];
      v.on('conectado', (_c, dir: string) => ev.push('conectado:' + dir));
      v.on('desconectado', () => ev.push('desconectado'));
      v.iniciar();
      await vi.advanceTimersByTimeAsync(50);
      expect(ev).toEqual(['conectado:D:\\LoL']);
      abierto = false;
      await vi.advanceTimersByTimeAsync(100);
      expect(ev).toEqual(['conectado:D:\\LoL', 'desconectado']);
      abierto = true;
      await vi.advanceTimersByTimeAsync(100);
      expect(ev).toEqual(['conectado:D:\\LoL', 'desconectado', 'conectado:D:\\LoL']);
      expect(buscarDir).toHaveBeenCalledTimes(1);
      v.detener();
    });
  });

  it('añade el modo con la cola de la sesión de gameflow y reemite la selección si la cola llega después', async () => {
    const subs: Record<string, (d: { uri: string; eventType: string; data: unknown }) => void> = {};
    let flujo: unknown = { gameData: { queue: { id: 450 } } };
    const cliente: ClienteLcu = {
      peticion: vi.fn(async (_m: string, ruta: string) => {
        if (ruta.includes('gameflow-phase')) return 'ChampSelect';
        if (ruta === '/lol-gameflow/v1/session') return flujo;
        return sesion;
      }) as never,
      suscribir: (e, cb) => { subs[e] = cb; },
      cerrar: vi.fn(),
    };
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => 'LeagueClient:1:2:pw:https',
      conectar: async () => cliente,
      buscarDir: async () => 'C:\LoL',
    });
    const sels: unknown[] = [];
    v.on('seleccion', (s) => sels.push(s));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(150);
    expect(sels).toEqual([{ campeonId: 103, rol: 'MIDDLE', modo: 'aram' }]);
    subs['OnJsonApiEvent_lol-gameflow_v1_session']({ uri: '', eventType: 'Update', data: { gameData: { queue: { id: 1700 } } } });
    expect(sels).toEqual([
      { campeonId: 103, rol: 'MIDDLE', modo: 'aram' },
      { campeonId: 103, rol: 'MIDDLE', modo: 'arena' },
    ]);
    flujo = null;
    subs['OnJsonApiEvent_lol-gameflow_v1_session']({ uri: '', eventType: 'Update', data: { gameData: { queue: { id: 1700 } } } });
    expect(sels).toHaveLength(2);
    v.detener();
  });

  it('mientras la cola no se sabe, la selección va marcada «modoPendiente» y se reemite al llegar', async () => {
    const subs: Record<string, (d: { uri: string; eventType: string; data: unknown }) => void> = {};
    let soltarFlujo: (v: unknown) => void = () => undefined;
    let fase = 'Lobby';
    const cliente: ClienteLcu = {
      peticion: vi.fn(async (_m: string, ruta: string) => {
        if (ruta.includes('gameflow-phase')) return fase;
        if (ruta === '/lol-gameflow/v1/session') return new Promise((r) => { soltarFlujo = r; });
        return sesion;
      }) as never,
      suscribir: (e, cb) => { subs[e] = cb; },
      cerrar: vi.fn(),
    };
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => 'LeagueClient:1:2:pw:https',
      conectar: async () => cliente,
      buscarDir: async () => 'C:\\LoL',
    });
    const sels: unknown[] = [];
    v.on('seleccion', (s) => sels.push(s));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(150);
    fase = 'ChampSelect';
    subs['OnJsonApiEvent_lol-gameflow_v1_gameflow-phase']({ uri: '', eventType: 'Update', data: 'ChampSelect' });
    subs['OnJsonApiEvent_lol-champ-select_v1_session']({ uri: '', eventType: 'Update', data: sesion });
    expect(sels).toEqual([{ campeonId: 103, rol: 'MIDDLE', modoPendiente: true }]);
    soltarFlujo({ gameData: { queue: { id: 2400 } } });
    await vi.advanceTimersByTimeAsync(0);
    expect(sels.at(-1)).toEqual({ campeonId: 103, rol: 'MIDDLE', modo: 'caos' });
    v.detener();
  });

  it('si la sesión de gameflow no trae cola, la selección deja de estar pendiente', async () => {
    const subs: Record<string, (d: { uri: string; eventType: string; data: unknown }) => void> = {};
    let soltarFlujo: (v: unknown) => void = () => undefined;
    const cliente: ClienteLcu = {
      peticion: vi.fn(async (_m: string, ruta: string) => {
        if (ruta.includes('gameflow-phase')) return 'Lobby';
        if (ruta === '/lol-gameflow/v1/session') return new Promise((r) => { soltarFlujo = r; });
        return sesion;
      }) as never,
      suscribir: (e, cb) => { subs[e] = cb; },
      cerrar: vi.fn(),
    };
    const v = new VigilanteLcu({
      intervaloMs: 100,
      leerArchivo: async () => 'LeagueClient:1:2:pw:https',
      conectar: async () => cliente,
      buscarDir: async () => 'C:\\LoL',
    });
    const sels: unknown[] = [];
    v.on('seleccion', (s) => sels.push(s));
    v.iniciar();
    await vi.advanceTimersByTimeAsync(150);
    subs['OnJsonApiEvent_lol-gameflow_v1_gameflow-phase']({ uri: '', eventType: 'Update', data: 'ChampSelect' });
    subs['OnJsonApiEvent_lol-champ-select_v1_session']({ uri: '', eventType: 'Update', data: sesion });
    soltarFlujo({});
    await vi.advanceTimersByTimeAsync(0);
    expect(sels).toEqual([
      { campeonId: 103, rol: 'MIDDLE', modoPendiente: true },
      { campeonId: 103, rol: 'MIDDLE' },
    ]);
    v.detener();
  });
});

