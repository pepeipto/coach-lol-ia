import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import type { EstadoPrincipal } from '../src/shared/tiposApp';

const build = (campeon: string): Build => ({
  campeon, rol: 'MIDDLE', parche: '15.20', partidas: 500, tasaVictoria: 0.5, mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  hechizos: [4, 14], objetosIniciales: [1056], nucleo: [6655], botas: null, situacionales: [],
  ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z',
});

const datos = {
  version: '15.20.1', parche: '15.20',
  campeones: new Map([[103, { id: 'Ahri', nombre: 'Ahri' }], [1, { id: 'Annie', nombre: 'Annie' }]]),
  objetos: {}, runas: new Map(), hechizos: new Map(),
} as unknown as DatosEstaticos;

function montar(opciones: { auto?: boolean; obtenerBuild?: (c: string) => Promise<unknown>; importar?: () => Promise<unknown> } = {}) {
  const estados: EstadoPrincipal[] = [];
  const importar = vi.fn(opciones.importar ?? (async () => ({ runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } })));
  const o = crearOrquestadorSeleccion({
    dirCache: 'x',
    cargarDatos: async () => datos,
    obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: opciones.auto ?? false }),
    enviar: (e) => estados.push(e),
    crearBuilds: (() => ({
      obtenerRoles: async () => ['MIDDLE'],
      obtenerBuild: opciones.obtenerBuild ?? (async (c: string) => ({ estado: 'ok', build: build(c) })),
    })) as never,
    importarTodo: importar as never,
  });
  o.conectado({} as ClienteLcu);
  return { o, estados, importar };
}

describe('orquestador de selección', () => {
  it('una respuesta antigua no pisa a la selección nueva', async () => {
    let soltarAhri!: () => void;
    const { o, estados } = montar({
      obtenerBuild: (c) =>
        c === 'Ahri'
          ? new Promise((r) => { soltarAhri = () => r({ estado: 'ok', build: build('Ahri') }); })
          : Promise.resolve({ estado: 'ok', build: build('Annie') }),
    });
    const primera = o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await vi.waitFor(() => expect(soltarAhri).toBeTypeOf('function'));
    await o.alSeleccionar({ campeonId: 1, rol: 'MIDDLE' });
    soltarAhri();
    await primera;
    expect(o.estado().seleccion?.campeon.id).toBe('Annie');
    expect(estados.filter((e) => e.seleccion?.campeon.id === 'Ahri')).toHaveLength(0);
  });

  it('una selección duplicada se importa automáticamente una sola vez', async () => {
    const { o, importar } = montar({ auto: true });
    await Promise.all([o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' }), o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' })]);
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(importar).toHaveBeenCalledTimes(1);
  });

  it('las importaciones no se solapan', async () => {
    let activas = 0, maxima = 0;
    const { o } = montar({
      importar: async () => {
        maxima = Math.max(maxima, ++activas);
        await new Promise((r) => setTimeout(r, 5));
        activas--;
        return { runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } };
      },
    });
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await Promise.all([o.importar(), o.importar(), o.importar()]);
    expect(maxima).toBe(1);
  });

  it('el resultado de la importación automática llega al estado (sin_paginas)', async () => {
    const r = { runas: { ok: false, motivo: 'sin_paginas' }, hechizos: { ok: true }, objetos: { ok: true } };
    const { o } = montar({ auto: true, importar: async () => r });
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(o.estado().importacion).toEqual(r);
  });

  it('3.1: la importación automática nunca pide sustituir una página de runas; «Importar» pasa la confirmación', async () => {
    const { o, importar } = montar({ auto: true });
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(importar).toHaveBeenCalledTimes(1);
    expect(importar.mock.calls[0]!.at(-1)).toEqual({});
    await o.importar({ sustituir: 42 });
    expect(importar.mock.calls[1]!.at(-1)).toEqual({ sustituir: 42 });
  });

  it('un fallo al obtener la build no produce un rechazo sin tratar', async () => {
    const { o } = montar({ obtenerBuild: () => Promise.reject(new Error('boom')) });
    await expect(o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' })).resolves.toBeUndefined();
  });
  it('al salir de la selección de campeones, la misma elección se importa otra vez en la partida siguiente', async () => {
    const { o, importar } = montar({ auto: true });
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    o.fase('ChampSelect');
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(importar).toHaveBeenCalledTimes(1);
    o.fase('InProgress');
    o.fase('EndOfGame');
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(importar).toHaveBeenCalledTimes(2);
  });

  it('expone la build y el rol de la selección para el overlay', async () => {
    const { o } = montar();
    expect(await o.contexto()).toMatchObject({ build: null, rol: 'MIDDLE' });
    await o.alSeleccionar({ campeonId: 103, rol: 'TOP' });
    const ctx = await o.contexto();
    expect(ctx?.build?.campeon).toBe('Ahri');
    expect(ctx?.rol).toBe('TOP');
  });

  it('sin build, el contexto usa igualmente el rol de la selección', async () => {
    const { o } = montar({ obtenerBuild: async () => ({ estado: 'no_disponible' }) });
    await o.alSeleccionar({ campeonId: 103, rol: 'UTILITY' });
    expect(await o.contexto()).toMatchObject({ build: null, rol: 'UTILITY' });
  });

  it('avisar publica y borra el aviso de la ventana principal', () => {
    const { o, estados } = montar();
    o.avisar('hola');
    expect(estados.at(-1)?.aviso).toBe('hola');
    o.avisar(null);
    expect(estados.at(-1)?.aviso).toBeNull();
  });

  describe('opciones de build', () => {
    const conOpciones = (c: string): Build => {
      const a = { ...build(c), nucleo: [6655], popularidad: 0.5 };
      const b = { ...build(c), nucleo: [3135], tasaVictoria: 0.6, popularidad: 0.3 };
      const d = { ...build(c), nucleo: [3157], tasaVictoria: 0.4, popularidad: 0.2 };
      return { ...a, opciones: [a, b, d] };
    };
    const montarOpciones = (auto = false) => montar({ auto, obtenerBuild: async (c) => ({ estado: 'ok', build: conOpciones(c) }) });

    it('por defecto se usa la opción 0', async () => {
      const { o } = montarOpciones();
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      expect(o.estado().seleccion?.opcion).toBe(0);
      expect((await o.contexto())?.build?.nucleo).toEqual([6655]);
    });

    it('cambiar de opción actualiza el estado, lo que se importa y lo que usa el overlay', async () => {
      const { o, importar, estados } = montarOpciones();
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      await o.cambiarOpcion(2);
      expect(o.estado().seleccion?.opcion).toBe(2);
      expect(estados.at(-1)?.seleccion?.opcion).toBe(2);
      await o.importar();
      expect((importar.mock.calls.at(-1) as unknown[])[1]).toMatchObject({ nucleo: [3157] });
      expect((await o.contexto())?.build?.nucleo).toEqual([3157]);
    });

    it('un índice no válido se ignora', async () => {
      const { o, estados } = montarOpciones();
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      await o.cambiarOpcion(1);
      const n = estados.length;
      for (const malo of [-1, 3, 1.5, Number.NaN, '1' as unknown as number]) await o.cambiarOpcion(malo);
      expect(o.estado().seleccion?.opcion).toBe(1);
      expect(estados).toHaveLength(n);
    });

    it('la elección se recuerda por campeón y rol durante la sesión', async () => {
      const { o } = montarOpciones();
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      await o.cambiarOpcion(1);
      await o.alSeleccionar({ campeonId: 1, rol: 'MIDDLE' });
      expect(o.estado().seleccion?.opcion).toBe(0);
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      expect(o.estado().seleccion?.opcion).toBe(1);
    });

    it('con la importación automática, cambiar de opción importa la nueva', async () => {
      const { o, importar } = montarOpciones(true);
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      expect(importar).toHaveBeenCalledTimes(1);
      await o.cambiarOpcion(1);
      expect(importar).toHaveBeenCalledTimes(2);
      expect((importar.mock.calls.at(-1) as unknown[])[1]).toMatchObject({ nucleo: [3135] });
    });

    it('la build global de arriba no se usa si hay opciones: por defecto, opciones[0]', async () => {
      const global = { ...build('Ahri'), nucleo: [1111] };
      const op0 = { ...build('Ahri'), nucleo: [2222] };
      const op1 = { ...build('Ahri'), nucleo: [3333] };
      const { o, importar } = montar({ obtenerBuild: async () => ({ estado: 'ok', build: { ...global, opciones: [op0, op1] } }) });
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      expect((await o.contexto())?.build?.nucleo).toEqual([2222]);
      await o.importar();
      expect((importar.mock.calls.at(-1) as unknown[])[1]).toMatchObject({ nucleo: [2222] });
    });

    it('una build de v1 sin opciones es la única opción', async () => {
      const { o } = montar();
      await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
      expect(o.estado().seleccion?.opcion).toBe(0);
      await o.cambiarOpcion(1);
      expect(o.estado().seleccion?.opcion).toBe(0);
    });
  });
});
