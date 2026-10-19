import { describe, expect, it, vi } from 'vitest';
import type { Build, OpcionRunas } from '@coach/shared';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { recursosDe } from '../src/main/builds/recursos';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import { registrarIpcRunas } from '../src/main/ipcOpcion';
import { buildElegida, opcionesRunasDe, runasValida } from '../src/shared/opciones';
import type { EstadoPrincipal } from '../src/shared/tiposApp';

const pagina = (clave: number, secundario: number) => ({ estiloPrincipal: 8100, estiloSecundario: secundario, runas: [clave, 2, 3, 4, 5, 6, 7, 8, 9] });
const opcionRunas = (clave: number, secundario: number, partidas: number): OpcionRunas => ({
  runas: pagina(clave, secundario),
  partidas,
  tasaVictoria: 0.5,
  popularidad: partidas / 200,
  datosLimitados: partidas < 30,
});
const PAGINAS = [opcionRunas(8112, 8300, 120), opcionRunas(8128, 8200, 60), opcionRunas(8010, 8300, 20)];

const build = (campeon: string, extra: Partial<Build> = {}): Build => ({
  campeon, rol: 'MIDDLE', parche: '15.20', partidas: 200, tasaVictoria: 0.5, mezclaParches: false,
  runas: pagina(9999, 8000), hechizos: [4, 14], objetosIniciales: [1056], nucleo: [6655], botas: null, situacionales: [],
  ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z', ...extra,
});
/** Dos opciones de objetos (cada una con sus runas, como en 3.0) y las páginas elegibles de 3.0.1. */
const conPaginas = (c: string): Build => {
  const a = build(c, { nucleo: [6655], hechizos: [4, 14], runas: pagina(7777, 8000) });
  const b = build(c, { nucleo: [3135], hechizos: [4, 12], runas: pagina(6666, 8000) });
  return { ...a, opciones: [a, b], opcionesRunas: PAGINAS };
};

const datos = {
  version: '15.20.1', parche: '15.20',
  campeones: new Map([[103, { id: 'Ahri', nombre: 'Ahri' }], [1, { id: 'Annie', nombre: 'Annie' }]]),
  objetos: {}, runas: new Map(), hechizos: new Map(),
} as unknown as DatosEstaticos;

function montar(o: { auto?: boolean; build?: (c: string) => Build } = {}) {
  const estados: EstadoPrincipal[] = [];
  const importar = vi.fn(async () => ({ runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } }));
  const orq = crearOrquestadorSeleccion({
    dirCache: 'x',
    cargarDatos: async () => datos,
    obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: o.auto ?? false }),
    enviar: (e) => estados.push(e),
    crearBuilds: (() => ({
      obtenerRoles: async () => ['MIDDLE'],
      obtenerBuild: async (c: string) => ({ estado: 'ok', build: (o.build ?? conPaginas)(c) }),
    })) as never,
    importarTodo: importar as never,
  });
  orq.conectado({} as ClienteLcu);
  const importada = () => (importar.mock.calls.at(-1) as unknown as [unknown, Build])[1];
  return { o: orq, estados, importar, importada };
}

describe('opciones de runas: utilidades', () => {
  it('opcionesRunasDe descarta las entradas mal formadas y es vacía sin el campo', () => {
    const rota = { ...PAGINAS[0]!, tasaVictoria: 3 } as OpcionRunas;
    const sinRunas = { ...PAGINAS[0]!, runas: { estiloPrincipal: 1, estiloSecundario: 2, runas: [] } } as OpcionRunas;
    expect(opcionesRunasDe(build('Ahri', { opcionesRunas: [rota, PAGINAS[1]!, sinRunas] }))).toEqual([PAGINAS[1]]);
    expect(opcionesRunasDe(build('Ahri'))).toEqual([]);
    expect(opcionesRunasDe(build('Ahri', { opcionesRunas: 'x' as never }))).toEqual([]);
  });

  it('runasValida comprueba el índice contra las páginas', () => {
    const b = conPaginas('Ahri');
    expect(runasValida(b, 2)).toBe(true);
    for (const malo of [-1, 3, 1.5, '1', Number.NaN]) expect(runasValida(b, malo)).toBe(false);
    expect(runasValida(build('Ahri'), 0)).toBe(false);
  });

  it('buildElegida: runas de la página elegida y lo demás de la opción de objetos', () => {
    const b = conPaginas('Ahri');
    const elegida = buildElegida(b, 1, 2);
    expect(elegida.runas).toEqual(PAGINAS[2]!.runas);
    expect(elegida.nucleo).toEqual([3135]);
    expect(elegida.hechizos).toEqual([4, 12]);
    expect(buildElegida(b, 0, 9).runas).toEqual(PAGINAS[0]!.runas); // índice fuera de rango: la más jugada
  });

  it('sin opcionesRunas (servidor anterior) se usan las runas de la opción, como antes', () => {
    const { opcionesRunas: _, ...viejo } = conPaginas('Ahri');
    expect(buildElegida(viejo, 1, 2).runas).toEqual(pagina(6666, 8000));
  });

  it('recursosDe incluye las runas de todas las páginas elegibles', () => {
    const conRunas = {
      ...datos,
      runas: new Map([8112, 8128, 8010, 8300, 8200].map((id) => [id, { nombre: `R${id}`, icono: `${id}.png` }])),
    } as unknown as DatosEstaticos;
    const r = recursosDe(conPaginas('Ahri'), conRunas);
    for (const id of [8112, 8128, 8010, 8300, 8200]) expect(r.runas[id]?.nombre).toBe(`R${id}`);
  });
});

describe('orquestador: página de runas elegida', () => {
  it('por defecto, la más jugada (0); la importación usa sus runas y los hechizos y objetos de la opción', async () => {
    const { o, importada } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(o.estado().seleccion?.opcionRunas).toBe(0);
    await o.importar();
    expect(importada().runas).toEqual(PAGINAS[0]!.runas);
    await o.cambiarOpcion(1);
    await o.cambiarRunas(1);
    await o.importar();
    expect(importada()).toMatchObject({ runas: PAGINAS[1]!.runas, nucleo: [3135], hechizos: [4, 12] });
  });

  it('un índice no válido (o una build sin páginas) se ignora', async () => {
    const { o, estados } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await o.cambiarRunas(2);
    const n = estados.length;
    for (const malo of [-1, 3, 1.5, Number.NaN, '1' as unknown as number]) await o.cambiarRunas(malo);
    expect(o.estado().seleccion?.opcionRunas).toBe(2);
    expect(estados).toHaveLength(n);
    const viejo = montar({ build: (c) => build(c) });
    await viejo.o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await viejo.o.cambiarRunas(1);
    expect(viejo.o.estado().seleccion?.opcionRunas).toBe(0);
  });

  it('se recuerda por campeón, modo y rol durante la sesión, aparte de la opción de objetos', async () => {
    const { o } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await o.cambiarRunas(2);
    await o.alSeleccionar({ campeonId: 1, rol: 'MIDDLE' });
    expect(o.estado().seleccion?.opcionRunas).toBe(0);
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE', modo: 'aram' });
    expect(o.estado().seleccion?.opcionRunas).toBe(0);
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(o.estado().seleccion?.opcionRunas).toBe(2);
    expect(o.estado().seleccion?.opcion).toBe(0);
  });

  it('con la importación automática, cambiar de página importa la nueva', async () => {
    const { o, importar, importada } = montar({ auto: true });
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    expect(importar).toHaveBeenCalledTimes(1);
    await o.cambiarRunas(1);
    expect(importar).toHaveBeenCalledTimes(2);
    expect(importada().runas).toEqual(PAGINAS[1]!.runas);
  });

  it('sin importación automática, solo se reimporta si ya se importó en esta selección de campeones', async () => {
    const { o, importar, importada } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await o.cambiarRunas(1);
    expect(importar).not.toHaveBeenCalled(); // aún no se había importado
    await o.importar();
    await o.cambiarRunas(2);
    expect(importar).toHaveBeenCalledTimes(2);
    expect(importada().runas).toEqual(PAGINAS[2]!.runas);
    // Al salir de la selección de campeones se olvida: un cambio ya no reimporta.
    o.fase('InProgress');
    await o.cambiarRunas(0);
    expect(importar).toHaveBeenCalledTimes(2);
  });

  it('el contexto de la partida lleva la página elegida', async () => {
    const { o } = montar();
    await o.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await o.cambiarRunas(1);
    expect((await o.contexto())?.build?.runas).toEqual(PAGINAS[1]!.runas);
  });
});

describe("IPC 'coach:cambiar-runas'", () => {
  it('solo atiende a la ventana principal y valida el índice', async () => {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const cambiar = vi.fn(async () => undefined);
    const principal = {};
    registrarIpcRunas({ handle: (c, h) => void manejadores.set(c, h) }, { cambiar, esPrincipal: (s) => s === principal });
    const invocar = (sender: unknown, i: unknown) => Promise.resolve().then(() => manejadores.get('coach:cambiar-runas')!({ sender }, i));
    await invocar(principal, 1);
    expect(cambiar).toHaveBeenCalledWith(1);
    await expect(invocar({}, 1)).rejects.toThrow();
    for (const malo of [-1, 1.5, '1', null]) await expect(invocar(principal, malo)).rejects.toThrow();
    expect(cambiar).toHaveBeenCalledTimes(1);
  });
});
