import { describe, expect, it, vi } from 'vitest';
import type { Build, ModoJuego, Rol } from '@coach/shared';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';

const base = (modo: ModoJuego): Build => ({
  campeon: 'Ahri',
  rol: modo === 'clasificatoria' ? 'MIDDLE' : null,
  ...(modo === 'clasificatoria' ? {} : { modo }),
  parche: '15.20',
  partidas: 500,
  tasaVictoria: 0.5,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655],
  botas: null,
  situacionales: [],
  ordenHabilidades: [],
  calculadoEn: '',
  ...(modo === 'caos' ? { aumentos: [{ id: 1205, partidas: 5, uso: 0.5, tasaVictoria: 0.5, posicionMedia: null }] } : {}),
  ...(modo === 'arena'
    ? {
        objetosArena: [
          { id: 1056, partidas: 9, uso: 0.9, tasaVictoria: 0.2, posicionMedia: 4 },
          { id: 3089, partidas: 8, uso: 0.8, tasaVictoria: 0.2, posicionMedia: 3 },
        ],
      }
    : {}),
});

const datos = {
  version: '15.20.1',
  parche: '15.20',
  campeones: new Map([[103, { id: 'Ahri', nombre: 'Ahri' }]]),
  objetos: {
    1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true }, into: [] },
    3089: { name: 'Sombrero', gold: { total: 3500, purchasable: true }, maps: { '11': true } },
  },
  runas: new Map(),
  hechizos: new Map(),
} as unknown as DatosEstaticos;

function montar() {
  const obtenerBuild = vi.fn(async (_c: string, _r: Rol | null, modo: ModoJuego = 'clasificatoria') => ({ estado: 'ok', build: base(modo) }));
  const obtenerRoles = vi.fn(async () => ['MIDDLE']);
  const importar = vi.fn(async () => ({ runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } }));
  const o = crearOrquestadorSeleccion({
    dirCache: 'x',
    cargarDatos: async () => datos,
    cargarAumentos: async () => new Map([[1205, { nombre: 'Daño Habilidoso', icono: null }]]),
    obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: true }),
    enviar: () => undefined,
    crearBuilds: (() => ({ obtenerRoles, obtenerBuild })) as never,
    importarTodo: importar as never,
  });
  o.conectado({} as ClienteLcu);
  return { o, obtenerBuild, obtenerRoles, importar };
}

describe('orquestador de selección por modo', () => {
  it('ARAM: pide la build del modo sin rol, sin roles, e importa con el conjunto de objetos del Abismo (mapa 12)', async () => {
    const { o, obtenerBuild, obtenerRoles, importar } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: null, modo: 'aram' });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', null, 'aram');
    expect(obtenerRoles).not.toHaveBeenCalled();
    expect(o.estado().seleccion).toMatchObject({ rol: null, modo: 'aram', rolesDisponibles: [] });
    expect(importar).toHaveBeenCalledWith(expect.anything(), expect.anything(), 103, 'Coach: Ahri ARAM', 12);
  });

  it('ARAM: Caos: añade los nombres de los aumentos a los recursos', async () => {
    const { o } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: null, modo: 'caos' });
    expect(o.estado().recursos.aumentos).toEqual({ 1205: { nombre: 'Daño Habilidoso', icono: null } });
  });

  it('Arena: no se importa nada y la próxima compra sale de los legendarios más elegidos', async () => {
    const { o, importar } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: null, modo: 'arena' });
    expect(importar).not.toHaveBeenCalled();
    expect((await o.importar()).runas.ok).toBe(false);
    const ctx = await o.contexto();
    expect(ctx?.modo).toBe('arena');
    expect(ctx?.build?.nucleo).toEqual([3089]);
  });

  it('sin modo (cola sin datos propios) usa clasificatoria con su rol y el mapa 11', async () => {
    const { o, obtenerBuild, importar } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', 'MIDDLE', 'clasificatoria');
    expect(o.estado().seleccion?.modo).toBeUndefined();
    expect(importar).toHaveBeenCalledWith(expect.anything(), expect.anything(), 103, 'Coach: Ahri Central', 11);
  });

  it('cambiar de rol fuera de clasificatoria se ignora', async () => {
    const { o, obtenerBuild } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: null, modo: 'aram' });
    await o.cambiarRol('TOP');
    expect(obtenerBuild).toHaveBeenCalledTimes(1);
  });
});
