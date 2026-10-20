import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import type { ResultadoBuild } from '../src/main/builds/clienteBuilds';
import { registrarIpcCampeones } from '../src/main/campeones';
import type { DatosEstaticos } from '../src/main/datos/estaticos';

const BUILD: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 500,
  tasaVictoria: 0.52,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655],
  botas: 3020,
  situacionales: [],
  ordenHabilidades: [],
  calculadoEn: '',
};

const DATOS: DatosEstaticos = {
  version: '15.20.1',
  parche: '15.20',
  campeones: new Map([
    [103, { id: 'Ahri', nombre: 'Ahri' }],
    [9, { id: 'Fiddlesticks', nombre: 'Fiddlesticks' }],
    [62, { id: 'MonkeyKing', nombre: 'Wukong' }],
  ]),
  objetos: { 1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true } } } as DatosEstaticos['objetos'],
  runas: new Map([[8100, { nombre: 'Dominación', icono: 'x.png' }]]),
  hechizos: new Map([[4, { nombre: 'Destello', imagen: 'SummonerFlash.png' }]]),
};

const LISTA = { parche: '15.20', campeones: [] };

function montar(o: { cargarDatos?: () => Promise<DatosEstaticos>; build?: Build } = {}) {
  const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
  const ipc = { handle: (c: string, h: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(c, h) };
  const builds = {
    obtenerCampeones: vi.fn(async () => ({ estado: 'ok' as const, lista: LISTA })),
    obtenerBuild: vi.fn(async (): Promise<ResultadoBuild> => ({ estado: 'ok', build: o.build ?? BUILD })),
    obtenerRoles: vi.fn(async () => ['MIDDLE' as const]),
  };
  const principal = {};
  registrarIpcCampeones(ipc, {
    esPrincipal: (s) => s === principal,
    cargarDatos: o.cargarDatos ?? (async () => DATOS),
    builds: () => builds,
    cargarAumentos: async () => new Map([[1205, { nombre: 'Daño Habilidoso', icono: 'https://raw.communitydragon.org/x.png' }]]),
  });
  const invocar = (canal: string, sender: unknown, ...args: unknown[]) =>
    Promise.resolve().then(() => manejadores.get(canal)!({ sender }, ...args));
  return { invocar, builds, principal };
}

describe("IPC 'coach:campeones'", () => {
  it('solo atiende a la ventana principal', async () => {
    const { invocar, builds } = montar();
    await expect(invocar('coach:campeones', {})).rejects.toThrow('Remitente no permitido');
    expect(builds.obtenerCampeones).not.toHaveBeenCalled();
  });

  it('devuelve todos los campeones de Data Dragon, ordenados por nombre, con la lista del servidor', async () => {
    const { invocar, principal, builds } = montar();
    const r = await invocar('coach:campeones', principal);
    expect(builds.obtenerCampeones).toHaveBeenCalledWith('clasificatoria');
    expect(r).toEqual({
      ok: true,
      modo: 'clasificatoria',
      version: '15.20.1',
      campeones: [
        { id: 'Ahri', nombre: 'Ahri', key: 103 },
        { id: 'Fiddlesticks', nombre: 'Fiddlesticks', key: 9 },
        { id: 'MonkeyKing', nombre: 'Wukong', key: 62 },
      ],
      resultado: { estado: 'ok', lista: LISTA },
    });
  });

  it('acepta un filtro con el modo y rechaza filtros no válidos', async () => {
    const { invocar, principal, builds } = montar();
    await invocar('coach:campeones', principal, { modo: 'clasificatoria' });
    await invocar('coach:campeones', principal, {});
    expect(builds.obtenerCampeones).toHaveBeenCalledTimes(2);
    for (const malo of ['x', 3, null, [], { modo: 'urf' }, { modo: 1 }]) {
      await expect(invocar('coach:campeones', principal, malo)).rejects.toThrow('Filtro no válido');
    }
    expect(builds.obtenerCampeones).toHaveBeenCalledTimes(2);
  });

  it('sin datos de Data Dragon responde error «datos»', async () => {
    const { invocar, principal } = montar({ cargarDatos: async () => Promise.reject(new Error('sin red')) });
    expect(await invocar('coach:campeones', principal)).toEqual({ ok: false, error: 'datos' });
  });
});

describe("IPC 'coach:build-de'", () => {
  it('solo atiende a la ventana principal', async () => {
    const { invocar, builds } = montar();
    await expect(invocar('coach:build-de', {}, 'Ahri', 'MIDDLE')).rejects.toThrow('Remitente no permitido');
    expect(builds.obtenerBuild).not.toHaveBeenCalled();
  });

  it('valida el campeón y el rol', async () => {
    const { invocar, principal, builds } = montar();
    const malos: [unknown, unknown][] = [
      [1, 'MIDDLE'],
      ['', 'MIDDLE'],
      ['../Ahri', 'MIDDLE'],
      ['A'.repeat(41), 'MIDDLE'],
      ['Ahri', 'MID'],
      ['Ahri', null],
    ];
    for (const [c, r] of malos) {
      await expect(invocar('coach:build-de', principal, c, r)).rejects.toThrow('Argumentos no válidos');
    }
    expect(builds.obtenerBuild).not.toHaveBeenCalled();
  });

  it('un campeón que no está en Data Dragon responde error «campeon»', async () => {
    const { invocar, principal, builds } = montar();
    expect(await invocar('coach:build-de', principal, 'Inventado', 'MIDDLE')).toEqual({ ok: false, error: 'campeon' });
    expect(builds.obtenerBuild).not.toHaveBeenCalled();
  });

  it('devuelve la build, los roles con datos, la versión y los nombres e iconos', async () => {
    const { invocar, principal, builds } = montar();
    const r = await invocar('coach:build-de', principal, 'Ahri', 'MIDDLE');
    expect(builds.obtenerBuild).toHaveBeenCalledWith('Ahri', 'MIDDLE', 'clasificatoria');
    expect(r).toEqual({
      ok: true,
      campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
      rol: 'MIDDLE',
      modo: 'clasificatoria',
      rolesDisponibles: ['MIDDLE'],
      resultado: { estado: 'ok', build: BUILD },
      version: '15.20.1',
      recursos: {
        objetos: { 1056: 'Anillo de Doran', 6655: '6655', 3020: '3020' },
        runas: { 8100: { nombre: 'Dominación', icono: 'x.png' } },
        hechizos: { 4: { nombre: 'Destello', imagen: 'SummonerFlash.png' } },
      },
    });
  });

  it('sin build disponible no rellena los recursos', async () => {
    const { invocar, principal, builds } = montar();
    builds.obtenerBuild.mockResolvedValueOnce({ estado: 'no_disponible' });
    const r = (await invocar('coach:build-de', principal, 'Ahri', 'TOP')) as { resultado: unknown; recursos: unknown };
    expect(r.resultado).toEqual({ estado: 'no_disponible' });
    expect(r.recursos).toEqual({ objetos: {}, runas: {}, hechizos: {} });
  });

  it('sin datos de Data Dragon responde error «datos»', async () => {
    const { invocar, principal } = montar({ cargarDatos: async () => Promise.reject(new Error('sin red')) });
    expect(await invocar('coach:build-de', principal, 'Ahri', 'MIDDLE')).toEqual({ ok: false, error: 'datos' });
  });
});

describe("IPC 'coach:build-de' por modo", () => {
  const CAOS: Build = { ...BUILD, rol: null, modo: 'caos', aumentosPopulares: [{ id: 1205, partidas: 10, uso: 0.5 }] };

  it('fuera de clasificatoria acepta rol null, no pide roles y añade los aumentos con nombre e icono', async () => {
    const { invocar, principal, builds } = montar({ build: CAOS });
    const r = (await invocar('coach:build-de', principal, 'Ahri', null, 'caos')) as { ok: true; rol: null; modo: string; recursos: { aumentos?: unknown } };
    expect(builds.obtenerBuild).toHaveBeenCalledWith('Ahri', null, 'caos');
    expect(builds.obtenerRoles).not.toHaveBeenCalled();
    expect(r.rol).toBeNull();
    expect(r.modo).toBe('caos');
    expect(r.recursos.aumentos).toEqual({ 1205: { nombre: 'Daño Habilidoso', icono: 'https://raw.communitydragon.org/x.png' } });
  });

  it('en un modo sin roles el rol que llegue se ignora', async () => {
    const { invocar, principal, builds } = montar({ build: CAOS });
    await invocar('coach:build-de', principal, 'Ahri', 'TOP', 'aram');
    expect(builds.obtenerBuild).toHaveBeenCalledWith('Ahri', null, 'aram');
  });

  it('rechaza un modo desconocido y el rol null en clasificatoria', async () => {
    const { invocar, principal, builds } = montar();
    await expect(invocar('coach:build-de', principal, 'Ahri', null, 'urf')).rejects.toThrow('Argumentos no válidos');
    await expect(invocar('coach:build-de', principal, 'Ahri', null, 'clasificatoria')).rejects.toThrow('Argumentos no válidos');
    await expect(invocar('coach:build-de', principal, 'Ahri', 'MIDDLE', 7)).rejects.toThrow('Argumentos no válidos');
    expect(builds.obtenerBuild).not.toHaveBeenCalled();
  });
});

