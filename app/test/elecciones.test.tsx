// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build, EntradaCampeon, ListaCampeones } from '@coach/shared';
import { contraElRival, fuertesDelParche, mainsParaElegir, tasaEnRol } from '../src/main/builds/elecciones';
import { indiceCampeones } from '../src/main/builds/counters';
import { interpretarRivales } from '../src/main/lcu/seleccion';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { textoVentaja } from '../src/renderer/principal/vistas/TarjetasEnfrentamientos';
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

describe('3.18: tus mains para esta partida', () => {
  const m = (id: string, tasaVictoria: number | null, partidas = 4) => ({
    campeon: c(id), tuyas: { partidas, victorias: 2 }, datos: tasaVictoria === null ? null : { tasaVictoria, partidas: 300 },
  });
  it('de más a menos ventaja (su % menos el 50 %), sin excluidos ni los que no tienen datos', () => {
    const r = mainsParaElegir([m('Zed', 0.48), m('Ahri', 0.586), m('Annie', null), m('Orianna', 0.52), m('Syndra', 0.6)], 'contra', new Set([c('Syndra').key]))!;
    expect(r.motivo).toBe('contra');
    expect(r.mains.map((x) => x.campeon.id)).toEqual(['Ahri', 'Orianna', 'Zed']);
    expect(r.mains[0]!.ventaja).toBeCloseTo(0.086);
    expect(r.mains[2]!.ventaja).toBeCloseTo(-0.02);
  });
  it('con menos de 2 opciones no se enseña (son opciones, nunca un «elige X»)', () => {
    expect(mainsParaElegir([m('Zed', 0.55), m('Ahri', null)], 'parche', new Set())).toBeNull();
  });
  it('la tasa del parche en el rol, sin los de datos limitados', () => {
    expect(tasaEnRol(LISTA, 'MIDDLE', c('Ahri'))).toEqual({ tasaVictoria: 0.52, partidas: 500 });
    expect(tasaEnRol(LISTA, 'MIDDLE', c('Viktor'))).toBeNull();
    expect(tasaEnRol(LISTA, 'MIDDLE', c('Malzahar'))).toBeNull();
  });
  it('la ventaja se escribe con su signo', () => {
    expect(textoVentaja(0.086)).toMatch(/^\+8[,.]6 %$/);
    expect(textoVentaja(-0.021)).toMatch(/^−2[,.]1 %$/);
    expect(textoVentaja(0)).toBe('±0 %');
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
  function montar(mains: { campeonId: number; partidas: number; victorias: number }[] = [], obtenerEnfrentamiento: (a: string, b: string) => Promise<unknown> = async () => ({ estado: 'no_disponible' })) {
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
        obtenerEnfrentamiento,
      })) as never,
      importarTodo: vi.fn() as never,
      historialPersonal: () => ({ countersPersonales: () => ({ campeonId: 0, rol: 'MIDDLE', partidas: 0, peores: [], mejores: [] }), enfrentamientoPersonal: () => null, mainsPersonales: () => mains }),
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

  it('3.18: tus mains sin rival, con la ventaja del parche y sin los bloqueados; tras fijar campeón, nada', async () => {
    const { o } = montar([
      { campeonId: 103, partidas: 6, victorias: 4 }, // Ahri 0.52
      { campeonId: 238, partidas: 5, victorias: 2 }, // Zed 0.505
      { campeonId: 1, partidas: 4, victorias: 3 }, // Annie: bloqueada
    ]);
    await o.alRivales({ rol: 'MIDDLE', rivales: [], bloqueados: [1] });
    const mains = o.estado().enfrentamientos!.mainsEleccion!;
    expect(mains.motivo).toBe('parche');
    expect(mains.mains.map((x) => x.campeon.id)).toEqual(['Ahri', 'Zed']);
    expect(mains.mains[0]).toMatchObject({ tuyas: { partidas: 6, victorias: 4 }, partidasServidor: 500 });
    expect(mains.mains[0]!.ventaja).toBeCloseTo(0.02);
    await o.alRivales({ rol: 'MIDDLE', rivales: [], bloqueados: [1], eleccionHecha: true });
    expect(o.estado().enfrentamientos?.mainsEleccion).toBeUndefined();
  });

  it('3.18: con rival de línea, la ventaja de cada main contra él', async () => {
    const cruce = vi.fn(async (a: string) => ({
      estado: 'ok',
      enfrentamiento: { partidas: 80, tasaVictoria: a === 'Zed' ? 0.586 : 0.47, datosLimitados: false },
    }));
    const { o } = montar([{ campeonId: 61, partidas: 6, victorias: 4 }, { campeonId: 238, partidas: 3, victorias: 1 }], cruce);
    await o.alRivales({ rol: 'MIDDLE', rivales: [{ campeonId: 103, rol: 'MIDDLE' }] });
    const mains = o.estado().enfrentamientos!.mainsEleccion!;
    expect(cruce).toHaveBeenCalledWith('Zed', 'Ahri', 'MIDDLE');
    expect(mains.motivo).toBe('contra');
    expect(mains.mains.map((x) => [x.campeon.id, x.ventaja])).toEqual([['Zed', 0.086], ['Orianna', -0.03]]);
  });

  it('3.18: sin historial o con un solo main, no hay tarjeta', async () => {
    const { o } = montar([{ campeonId: 103, partidas: 6, victorias: 4 }]);
    await o.alRivales({ rol: 'MIDDLE', rivales: [] });
    expect(o.estado().enfrentamientos?.mainsEleccion).toBeUndefined();
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

  it('3.18: «Tus mains» con la ventaja encima de cada retrato y tu historial', () => {
    const e = {
      rol: 'MIDDLE' as const, rival: { ...c('Ahri'), inferido: false }, counters: null, contra: null, buenasElecciones: [],
      mainsEleccion: {
        motivo: 'contra' as const,
        mains: [
          { campeon: c('Zed'), ventaja: 0.086, partidasServidor: 80, tuyas: { partidas: 6, victorias: 4 } },
          { campeon: c('Orianna'), ventaja: -0.03, partidasServidor: 70, tuyas: { partidas: 3, victorias: 1 } },
        ],
      },
    };
    render(<VistaCampeon {...props} estado={estado({ enfrentamientos: e })} />);
    const lista = screen.getByRole('list', { name: t('mains.titulo') });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(within(filas[0]!).getByText(textoVentaja(0.086))).toBeTruthy();
    expect(filas[0]!.className).toContain('sube');
    expect(filas[1]!.className).toContain('baja');
    expect(screen.getByText(t('mains.contra', { rival: 'Ahri' }))).toBeTruthy();
    expect(screen.getByText(/eliges tú/)).toBeTruthy();
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
