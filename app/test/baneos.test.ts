import { describe, expect, it, vi } from 'vitest';
import type { Build, EntradaCampeon, ListaCampeones } from '@coach/shared';
import { ideasBaneo, MAX_IDEAS_BANEO } from '../src/main/builds/baneos';
import { indiceCampeones } from '../src/main/builds/counters';
import { interpretarRivales } from '../src/main/lcu/seleccion';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import type { CampeonDDragon, CountersVista, LineaEnfrentamientoVista } from '../src/shared/tiposApp';

const NOMBRES: [number, string][] = [
  [122, 'Darius'], [86, 'Garen'], [17, 'Teemo'], [24, 'Jax'], [23, 'Tryndamere'], [114, 'Fiora'], [92, 'Riven'], [58, 'Renekton'], [39, 'Irelia'],
];
const datos = {
  version: '15.20.1', parche: '15.20',
  campeones: new Map(NOMBRES.map(([k, id]) => [k, { id, nombre: id }])),
  objetos: {}, runas: new Map(), hechizos: new Map(),
} as unknown as DatosEstaticos;
const INDICE = indiceCampeones(datos);
const c = (id: string): CampeonDDragon => INDICE.get(id.toLowerCase())!;

const entrada = (campeon: string, tasaVictoria: number, uso: number, extra: Partial<EntradaCampeon> = {}): EntradaCampeon => ({
  campeon, rol: 'TOP', partidas: 500, tasaVictoria, uso, tier: 'A', datosLimitados: false, ...extra,
});
const LISTA: ListaCampeones = {
  parche: '15.20',
  campeones: [
    entrada('Garen', 0.53, 0.1, { tasaBloqueo: 0.08 }), // 0.053
    entrada('Teemo', 0.52, 0.06, { tasaBloqueo: 0.2 }), // 0.0312
    entrada('Jax', 0.51, 0.12), // 0.0612
    entrada('Riven', 0.47, 0.2), // pierde: fuera
    entrada('Irelia', 0.56, 0.08, { datosLimitados: true }), // pocos datos: fuera
    entrada('Fiora', 0.505, 0.04), // 0.0202
    entrada('Renekton', 0.5, 0.05), // 0.025
    entrada('Tryndamere', 0.6, 0.3, { rol: 'MIDDLE' }), // otro rol: fuera
  ],
};
const linea = (id: string, tasaVictoria: number, datosLimitados = false): LineaEnfrentamientoVista => ({ campeon: c(id), partidas: 80, tasaVictoria, datosLimitados });
const COUNTERS: CountersVista = {
  parche: '15.20', partidas: 900, todos: [], faciles: [], sinConexion: false,
  dificiles: [linea('Teemo', 0.41), linea('Fiora', 0.44, true), linea('Renekton', 0.46), linea('Riven', 0.52)],
};

describe('ideasBaneo', () => {
  it('sin tu campeón: los más fuertes del rol por victorias × selección, con su tasa de bloqueo', () => {
    const r = ideasBaneo({ rol: 'TOP', campeon: null, counters: null, lista: LISTA, indice: INDICE, excluir: new Set() })!;
    expect(r.campeon).toBeNull();
    expect(r.ideas.map((i) => i.campeon.id)).toEqual(['Jax', 'Garen', 'Teemo', 'Renekton', 'Fiora']);
    expect(r.ideas.every((i) => i.motivo === 'fuerte')).toBe(true);
    expect(r.ideas[1]).toMatchObject({ tasaVictoria: 0.53, seleccionRol: 0.1, tasaBloqueo: 0.08 });
    expect(r.ideas[0]).not.toHaveProperty('tasaBloqueo');
  });

  it('con tu campeón: primero sus counters (perdiendo y con datos fiables), luego los fuertes, sin repetir', () => {
    const r = ideasBaneo({ rol: 'TOP', campeon: c('Darius'), counters: COUNTERS, lista: LISTA, indice: INDICE, excluir: new Set() })!;
    expect(r.ideas.map((i) => [i.campeon.id, i.motivo])).toEqual([
      ['Teemo', 'counter'],
      ['Renekton', 'counter'],
      ['Jax', 'fuerte'],
      ['Garen', 'fuerte'],
      ['Fiora', 'fuerte'],
    ]);
    expect(r.ideas[0]).toMatchObject({ tasaVictoria: 0.41, partidas: 80, tasaBloqueo: 0.2 });
    expect(r.ideas).toHaveLength(MAX_IDEAS_BANEO);
  });

  it('nunca propone los ya bloqueados, los de tus compañeros ni el tuyo', () => {
    const excluir = new Set([c('Teemo').key]);
    const r = ideasBaneo({ rol: 'TOP', campeon: c('Garen'), counters: COUNTERS, lista: LISTA, indice: INDICE, excluir })!;
    expect(r.ideas.map((i) => i.campeon.id)).toEqual(['Renekton', 'Jax', 'Fiora']);
  });

  it('con menos de 3 ideas no hay tarjeta: siempre varias opciones, nunca una sola', () => {
    const corta: ListaCampeones = { parche: '15.20', campeones: [entrada('Garen', 0.53, 0.1), entrada('Jax', 0.51, 0.12)] };
    expect(ideasBaneo({ rol: 'TOP', campeon: null, counters: null, lista: corta, indice: INDICE, excluir: new Set() })).toBeNull();
    expect(ideasBaneo({ rol: 'TOP', campeon: null, counters: null, lista: null, indice: INDICE, excluir: new Set() })).toBeNull();
  });
});

describe('fase de bloqueos en la sesión de champ select', () => {
  const sesion = (extra: object = {}) => ({
    localPlayerCellId: 2,
    queueId: 420,
    myTeam: [
      { cellId: 2, championId: 0, championPickIntent: 122, assignedPosition: 'top' },
      { cellId: 3, championId: 0, championPickIntent: 24, assignedPosition: 'jungle' },
    ],
    theirTeam: [],
    ...extra,
  });

  it('un bloqueo en curso: fase de bloqueos, con los ya bloqueados y las intenciones de tus compañeros', () => {
    const r = interpretarRivales(
      sesion({
        timer: { phase: 'BAN_PICK' },
        actions: [[{ type: 'ban', completed: true, championId: 17 }, { type: 'ban', completed: false, isInProgress: true, championId: 0 }], [{ type: 'pick', completed: false }]],
        bans: { myTeamBans: [], theirTeamBans: [114] },
      }),
    )!;
    expect(r.faseBloqueos).toBe(true);
    expect(r.bloqueados?.sort()).toEqual([114, 17]);
    expect(r.aliados).toEqual([24]);
  });

  it('en la planificación con bloqueos pendientes también; con los bloqueos hechos, ya no', () => {
    const pendiente = [[{ type: 'ban', completed: false, isInProgress: false }]];
    expect(interpretarRivales(sesion({ timer: { phase: 'PLANNING' }, actions: pendiente }))?.faseBloqueos).toBe(true);
    const hechos = [[{ type: 'ban', completed: true, championId: 17 }], [{ type: 'pick', completed: false, isInProgress: true }]];
    expect(interpretarRivales(sesion({ timer: { phase: 'BAN_PICK' }, actions: hechos }))).not.toHaveProperty('faseBloqueos');
    // Una cola sin bloqueos (normal a ciegas): nunca.
    expect(interpretarRivales(sesion({ queueId: 430, timer: { phase: 'BAN_PICK' } }))).not.toHaveProperty('faseBloqueos');
  });
});

describe('orquestador: ideas para banear y fase de líneas en «Contra»', () => {
  const BUILD = {
    campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 60, tasaVictoria: 0.6, mezclaParches: false,
    runas: { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010] }, hechizos: [4, 12], objetosIniciales: [], nucleo: [], botas: null,
    situacionales: [], ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z',
  } as Build;
  function montar() {
    const obtenerCampeones = vi.fn(async () => ({ estado: 'ok', lista: LISTA }));
    const o = crearOrquestadorSeleccion({
      dirCache: 'x',
      cargarDatos: async () => datos,
      obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: false }),
      enviar: () => undefined,
      crearBuilds: (() => ({
        obtenerRoles: async () => ['TOP'],
        obtenerBuild: async () => ({ estado: 'ok', build: BUILD }),
        obtenerCampeones,
        obtenerCounters: async () => ({
          estado: 'ok',
          counters: { campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 900, enfrentamientos: [], faciles: [], dificiles: [{ rival: 'Teemo', partidas: 90, tasaVictoria: 0.4, datosLimitados: false }] },
        }),
        obtenerEnfrentamiento: async () => ({
          estado: 'ok',
          enfrentamiento: { campeon: 'Darius', rival: 'Garen', rol: 'TOP', parche: '15.20', partidas: 120, tasaVictoria: 0.58, datosLimitados: false, tasaFaseLineas: 0.62, partidasFaseLineas: 100, puntuacion: 14.2 },
        }),
      })) as never,
      importarTodo: vi.fn() as never,
    });
    o.conectado({} as ClienteLcu);
    return { o, obtenerCampeones };
  }

  it('en la fase de bloqueos, sin campeón: ideas con los más fuertes del rol, sin los ya bloqueados', async () => {
    const { o } = montar();
    await o.alRivales({ rol: 'TOP', rivales: [], faseBloqueos: true, bloqueados: [24] });
    const ideas = o.estado().enfrentamientos?.ideasBaneo;
    expect(ideas?.campeon).toBeNull();
    expect(ideas?.ideas.map((i) => i.campeon.id)).toEqual(['Garen', 'Teemo', 'Renekton', 'Fiora']);
  });

  it('con tu campeón en intención: primero sus counters; fuera de la fase de bloqueos, nada', async () => {
    const { o } = montar();
    await o.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    await o.alRivales({ rol: 'TOP', rivales: [], faseBloqueos: true });
    const ideas = o.estado().enfrentamientos!.ideasBaneo!;
    expect(ideas.campeon?.id).toBe('Darius');
    expect(ideas.ideas[0]).toMatchObject({ campeon: { id: 'Teemo' }, motivo: 'counter', tasaVictoria: 0.4 });
    await o.alRivales({ rol: 'TOP', rivales: [] });
    expect(o.estado().enfrentamientos?.ideasBaneo).toBeUndefined();
  });

  it('«Contra {rival}» lleva la fase de líneas y la puntuación del cruce', async () => {
    const { o } = montar();
    await o.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    await o.alRivales({ rol: 'TOP', rivales: [{ campeonId: 86, rol: 'TOP' }] });
    expect(o.estado().enfrentamientos?.contra).toMatchObject({ tasaVictoria: 0.58, tasaFaseLineas: 0.62, partidasFaseLineas: 100, puntuacion: 14.2 });
  });
});
