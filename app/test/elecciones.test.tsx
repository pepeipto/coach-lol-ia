// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build, EntradaCampeon, ListaCampeones } from '@coach/shared';
import { contraElRival, fuertesDelParche } from '../src/main/builds/elecciones';
import { indiceCampeones } from '../src/main/builds/counters';
import { interpretarRivales } from '../src/main/lcu/seleccion';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { t } from '../src/shared/i18n';
import type { CampeonDDragon, EstadoPrincipal, LineaEnfrentamientoVista } from '../src/shared/tiposApp';

afterEach(cleanup);

const NOMBRES: [number, string][] = [
  [238, 'Zed'], [103, 'Ahri'], [1, 'Annie'], [61, 'Orianna'], [90, 'Malzahar'], [134, 'Syndra'], [7, 'LeBlanc'], [112, 'Viktor'],
];
const datos = {
  version: '15.20.1', parche: '15.20',
  campeones: new Map(NOMBRES.map(([k, id]) => [k, { id, nombre: id }])),
  objetos: {}, runas: new Map(), hechizos: new Map(),
} as unknown as DatosEstaticos;
const INDICE = indiceCampeones(datos);
const c = (id: string): CampeonDDragon => INDICE.get(id.toLowerCase())!;

const entrada = (campeon: string, tier: EntradaCampeon['tier'], tasaVictoria: number, uso: number, extra: Partial<EntradaCampeon> = {}): EntradaCampeon => ({
  campeon, rol: 'MIDDLE', partidas: 500, tasaVictoria, uso, tier, datosLimitados: false, ...extra,
});
const LISTA: ListaCampeones = {
  parche: '15.20',
  campeones: [
    entrada('Ahri', 'A', 0.52, 0.12), // 0.0624
    entrada('Annie', 'S', 0.54, 0.05), // tier S: primero
    entrada('Orianna', 'A', 0.51, 0.06), // 0.0306
    entrada('Syndra', 'B', 0.5, 0.2),
    entrada('LeBlanc', 'A', 0.48, 0.2), // pierde: fuera
    entrada('Viktor', 'S', 0.58, 0.1, { datosLimitados: true }), // pocos datos: fuera
    entrada('Malzahar', 'S', 0.56, 0.1, { rol: 'TOP' }), // otro rol: fuera
    entrada('Zed', 'A', 0.505, 0.1), // 0.0505
  ],
};

describe('fuertesDelParche', () => {
  it('por tier y, a igual tier, por victorias × selección; sin los que pierden, de pocos datos ni de otro rol', () => {
    const r = fuertesDelParche({ rol: 'MIDDLE', lista: LISTA, indice: INDICE, excluir: new Set() })!;
    expect(r.map((i) => i.campeon.id)).toEqual(['Annie', 'Ahri', 'Zed', 'Orianna', 'Syndra']);
    expect(r[0]).toMatchObject({ tier: 'S', tasaVictoria: 0.54, partidas: 500 });
  });

  it('sin los excluidos (bloqueados o ya elegidos) y con menos de 3, nada', () => {
    const r = fuertesDelParche({ rol: 'MIDDLE', lista: LISTA, indice: INDICE, excluir: new Set([c('Annie').key]) })!;
    expect(r[0]!.campeon.id).toBe('Ahri');
    const excluir = new Set(['Annie', 'Ahri', 'Zed'].map((n) => c(n).key));
    expect(fuertesDelParche({ rol: 'MIDDLE', lista: LISTA, indice: INDICE, excluir })).toBeNull();
    expect(fuertesDelParche({ rol: 'MIDDLE', lista: null, indice: INDICE, excluir: new Set() })).toBeNull();
  });
});

describe('contraElRival', () => {
  const l = (id: string, tasaVictoria: number, datosLimitados = false): LineaEnfrentamientoVista => ({ campeon: c(id), partidas: 90, tasaVictoria, datosLimitados });
  it('los counters del rival sin excluidos ni datos limitados; con menos de 3, nada', () => {
    const buenas = [l('Annie', 0.57), l('Orianna', 0.55, true), l('Syndra', 0.54), l('Zed', 0.53), l('Viktor', 0.52)];
    expect(contraElRival(buenas, new Set([c('Syndra').key]))!.map((i) => i.campeon.id)).toEqual(['Annie', 'Zed', 'Viktor']);
    expect(contraElRival(buenas.slice(0, 3), new Set())).toBeNull();
  });
});

describe('sesión de champ select: elección hecha', () => {
  const sesion = (pick: object) => ({
    localPlayerCellId: 2, queueId: 420,
    myTeam: [{ cellId: 2, championId: 238, assignedPosition: 'middle' }],
    theirTeam: [],
    actions: [[{ type: 'pick', actorCellId: 7, completed: true }, { type: 'pick', actorCellId: 2, ...pick }]],
  });
  it('solo cuando TU turno de elección está completado', () => {
    expect(interpretarRivales(sesion({ completed: false, isInProgress: true }))).not.toHaveProperty('eleccionHecha');
    expect(interpretarRivales(sesion({ completed: true }))?.eleccionHecha).toBe(true);
  });
});

describe('orquestador: ideas para elegir', () => {
  const BUILD = {
    campeon: 'Zed', rol: 'MIDDLE', parche: '15.20', partidas: 60, tasaVictoria: 0.6, mezclaParches: false,
    runas: { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010] }, hechizos: [4, 14], objetosIniciales: [], nucleo: [], botas: null,
    situacionales: [], ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z',
  } as Build;
  function montar() {
    const obtenerCounters = vi.fn(async (campeon: string) => ({
      estado: 'ok',
      counters: {
        campeon, rol: 'MIDDLE', parche: '15.20', partidas: 900, enfrentamientos: [], faciles: [],
        // Para Ahri (el rival): quienes más le cuestan, con SU %: tu % es el inverso.
        dificiles: [
          { rival: 'Annie', partidas: 90, tasaVictoria: 0.43, datosLimitados: false },
          { rival: 'Zed', partidas: 120, tasaVictoria: 0.45, datosLimitados: false },
          { rival: 'Orianna', partidas: 80, tasaVictoria: 0.47, datosLimitados: false },
        ],
      },
    }));
    const o = crearOrquestadorSeleccion({
      dirCache: 'x',
      cargarDatos: async () => datos,
      obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: false }),
      enviar: () => undefined,
      crearBuilds: (() => ({
        obtenerRoles: async () => ['MIDDLE'],
        obtenerBuild: async () => ({ estado: 'ok', build: BUILD }),
        obtenerCampeones: async () => ({ estado: 'ok', lista: LISTA }),
        obtenerCounters,
        obtenerEnfrentamiento: async () => ({ estado: 'no_disponible' }),
      })) as never,
      importarTodo: vi.fn() as never,
    });
    o.conectado({} as ClienteLcu);
    return { o, obtenerCounters };
  }

  it('sin rival de línea: la tier list del parche en tu rol', async () => {
    const { o } = montar();
    await o.alSeleccionar({ campeonId: 238, rol: 'MIDDLE' });
    await o.alRivales({ rol: 'MIDDLE', rivales: [], bloqueados: [1] });
    const ideas = o.estado().enfrentamientos!.ideasEleccion!;
    expect(ideas.motivo).toBe('parche');
    expect(ideas.ideas.map((i) => i.campeon.id)).toEqual(['Ahri', 'Zed', 'Orianna', 'Syndra']);
  });

  it('con el rival de tu línea elegido: sus counters con tu %; tras fijar campeón, nada', async () => {
    const { o, obtenerCounters } = montar();
    await o.alSeleccionar({ campeonId: 238, rol: 'MIDDLE' });
    await o.alRivales({ rol: 'MIDDLE', rivales: [{ campeonId: 103, rol: 'MIDDLE' }] });
    const ideas = o.estado().enfrentamientos!.ideasEleccion!;
    expect(obtenerCounters).toHaveBeenCalledWith('Ahri', 'MIDDLE');
    expect(ideas.motivo).toBe('contra');
    expect(ideas.ideas.map((i) => i.campeon.id)).toEqual(['Annie', 'Zed', 'Orianna']);
    expect(ideas.ideas[0]!.tasaVictoria).toBeCloseTo(0.57);
    await o.alRivales({ rol: 'MIDDLE', rivales: [{ campeonId: 103, rol: 'MIDDLE' }], eleccionHecha: true });
    expect(o.estado().enfrentamientos?.ideasEleccion).toBeUndefined();
  });
});

describe('tarjeta «Ideas para elegir»', () => {
  const props = {
    importacion: null, onImportar: vi.fn(), onCambiarRol: vi.fn(), onCambiarOpcion: vi.fn(),
    plan: 'premium' as const, bannerCerrado: true, alCerrarBanner: vi.fn(), alVerPremium: vi.fn(),
  };
  const estado = (over: Partial<EstadoPrincipal>): EstadoPrincipal => ({
    cliente: 'conectado', version: '15.20.1', error: null, importacion: null, aviso: null,
    recursos: { objetos: {}, runas: {}, hechizos: {} }, seleccion: null, ...over,
  });

  it('contra el rival: motivo corto con tu % y tu campeón marcado; sustituye a «Buenas elecciones»', () => {
    const e = {
      rol: 'MIDDLE' as const, rival: { ...c('Ahri'), inferido: false }, counters: null, contra: null,
      buenasElecciones: [{ campeon: c('Annie'), partidas: 90, tasaVictoria: 0.57, datosLimitados: false }],
      ideasEleccion: {
        motivo: 'contra' as const,
        ideas: [
          { campeon: c('Annie'), partidas: 90, tasaVictoria: 0.57 },
          { campeon: c('Zed'), partidas: 120, tasaVictoria: 0.55 },
          { campeon: c('Orianna'), partidas: 80, tasaVictoria: 0.53 },
        ],
      },
    };
    render(<VistaCampeon {...props} estado={estado({ enfrentamientos: e })} />);
    const lista = screen.getByRole('list', { name: t('elecciones.titulo') });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3);
    expect(within(lista).getByText(t('elecciones.motivoContra', { rival: 'Ahri', porcentaje: '57', partidas: 90 }))).toBeTruthy();
    expect(screen.queryByRole('list', { name: t('enfrentamientos.buenasContra', { rival: 'Ahri' }) })).toBeNull();
    expect(screen.getByText(/Hecho con ayuda de IA/)).toBeTruthy();
  });

  it('tier del parche: tier y % de victorias', () => {
    const e = {
      rol: 'MIDDLE' as const, rival: null, counters: null, contra: null, buenasElecciones: [],
      ideasEleccion: {
        motivo: 'parche' as const,
        ideas: [
          { campeon: c('Annie'), partidas: 500, tasaVictoria: 0.54, tier: 'S' as const },
          { campeon: c('Ahri'), partidas: 500, tasaVictoria: 0.52, tier: 'A' as const },
          { campeon: c('Zed'), partidas: 500, tasaVictoria: 0.505, tier: 'A' as const },
        ],
      },
    };
    render(<VistaCampeon {...props} estado={estado({ enfrentamientos: e })} />);
    expect(screen.getByText(t('elecciones.parche', { rol: t('rol.MIDDLE') }))).toBeTruthy();
    expect(screen.getByText(t('elecciones.motivoParche', { tier: 'S', porcentaje: '54' }))).toBeTruthy();
  });
});
