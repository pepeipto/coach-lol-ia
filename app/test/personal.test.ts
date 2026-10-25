import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Rol } from '@coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  calcularCountersPersonales,
  calcularEnfrentamientoPersonal,
  consultaPersonal,
  esPartidaPersonal,
  estadisticasPersonales,
  puntosTier,
  respuestaPersonal,
  tierDe,
  winrateSuavizado,
} from '../src/main/perfil/personal';
import { crearServicioPerfil } from '../src/main/perfil/servicio';
import type { JugadorHistorial, PartidaHistorial } from '../src/shared/perfil';

const ROLES_EQUIPO: Rol[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
let siguiente = 1;

/** Partida tuya (participante 1) con `campeon` en `rol` contra `rival` en el mismo rol del otro equipo. */
function partida(o: { campeon: number; rival: number; rol?: Rol; gano: boolean; nota?: number; cola?: number; duracion?: number; rolRival?: Rol | null }): PartidaHistorial {
  const rol = o.rol ?? 'MIDDLE';
  const otros = ROLES_EQUIPO.filter((r) => r !== rol);
  const jugador = (participante: number, equipo: 100 | 200, campeonId: number, rolJ: Rol | null, victoria: boolean, nota = 50): JugadorHistorial => ({
    participante,
    equipo,
    campeonId,
    nombre: `J${participante}`,
    rol: rolJ,
    asesinatos: 4,
    muertes: 2,
    asistencias: 6,
    cs: 150,
    oro: 10000,
    dano: 15000,
    danoRecibido: 15000,
    vision: 20,
    nivel: 15,
    objetos: [],
    hechizos: [4, 12],
    victoria,
    puntuaciones: { combate: nota, farmeo: nota, vision: nota, total: nota },
    etiquetas: [],
  });
  const jugadores: JugadorHistorial[] = [jugador(1, 100, o.campeon, rol, o.gano, o.nota ?? 60)];
  otros.forEach((r, i) => jugadores.push(jugador(2 + i, 100, 500 + i, r, o.gano)));
  jugadores.push(jugador(6, 200, o.rival, o.rolRival === undefined ? rol : o.rolRival, !o.gano));
  otros.forEach((r, i) => jugadores.push(jugador(7 + i, 200, 600 + i, r, !o.gano)));
  const id = siguiente++;
  return {
    id,
    fecha: new Date(Date.UTC(2026, 9, 1) + id * 3_600_000).toISOString(),
    duracion: o.duracion ?? 1800,
    cola: o.cola ?? 420,
    modo: o.cola === undefined || o.cola === 420 ? 'clasificatoria' : o.cola === 450 ? 'aram' : 'otro',
    yo: 1,
    victoria: o.gano,
    rehecha: (o.duracion ?? 1800) < 300,
    jugadores,
  };
}

const varias = (n: number, ganadas: number, o: Omit<Parameters<typeof partida>[0], 'gano'>) =>
  Array.from({ length: n }, (_, i) => partida({ ...o, gano: i < ganadas }));

const AHRI = 103;
const ZED = 238;
const YASUO = 157;
const SYNDRA = 134;

describe('Tus estadísticas: fórmulas', () => {
  it('suaviza el % de victorias con 10 partidas al 50 %', () => {
    expect(winrateSuavizado(0, 0)).toBe(0.5);
    expect(winrateSuavizado(3, 3)).toBeCloseTo(8 / 13);
    expect(winrateSuavizado(8, 10)).toBeCloseTo(0.65);
  });

  it('puntos = 0,6 × % suavizado + 0,4 × nota y cortes S/A/B/C/D', () => {
    expect(puntosTier(5, 10, 60)).toBe(54);
    expect(tierDe(puntosTier(5, 10, 60))).toBe('B');
    expect(tierDe(puntosTier(8, 10, 70))).toBe('S'); // 39 + 28 = 67
    expect(tierDe(puntosTier(3, 3, 60))).toBe('A'); // 36,9 + 24 = 60,9: 3 de 3 no basta para la S
    expect(tierDe(puntosTier(3, 6, 50))).toBe('C'); // 30 + 20 = 50
    expect(tierDe(puntosTier(1, 6, 40))).toBe('D'); // 22,5 + 16 = 38,5
  });

  it('solo cuentan la Grieta (clasificatoria, Flex y normales) sin rehechas', () => {
    expect(esPartidaPersonal(partida({ campeon: AHRI, rival: ZED, gano: true }))).toBe(true);
    expect(esPartidaPersonal(partida({ campeon: AHRI, rival: ZED, gano: true, cola: 440 }))).toBe(true);
    expect(esPartidaPersonal(partida({ campeon: AHRI, rival: ZED, gano: true, cola: 400 }))).toBe(true);
    expect(esPartidaPersonal(partida({ campeon: AHRI, rival: ZED, gano: true, cola: 450 }))).toBe(false);
    expect(esPartidaPersonal(partida({ campeon: AHRI, rival: ZED, gano: true, cola: 1700 }))).toBe(false);
    expect(esPartidaPersonal(partida({ campeon: AHRI, rival: ZED, gano: true, duracion: 200 }))).toBe(false);
  });
});

describe('Tus estadísticas: tablas', () => {
  const historial = [
    ...varias(4, 1, { campeon: AHRI, rival: ZED }), // Ahri vs Zed: 1 de 4
    ...varias(5, 4, { campeon: AHRI, rival: YASUO }), // Ahri vs Yasuo: 4 de 5
    ...varias(2, 0, { campeon: AHRI, rival: SYNDRA }), // por debajo del mínimo
    ...varias(3, 0, { campeon: SYNDRA, rival: ZED }), // Syndra vs Zed: 0 de 3
    ...varias(3, 3, { campeon: AHRI, rival: ZED, cola: 450 }), // ARAM: no cuenta
    ...varias(3, 3, { campeon: AHRI, rival: ZED, duracion: 200 }), // rehechas: no cuentan
    ...varias(9, 6, { campeon: 222, rival: 51, rol: 'BOTTOM', nota: 70 }),
  ];

  it('counters: cruces con 3 o más partidas, del peor al mejor, con aviso por debajo de 8', () => {
    const e = estadisticasPersonales(historial);
    expect(e.partidas).toBe(4 + 5 + 2 + 3 + 9);
    expect(e.partidasConRival).toBe(e.partidas);
    expect(e.counters.map((c) => [c.campeonId, c.rivalId, c.partidas, c.victorias])).toEqual([
      [SYNDRA, ZED, 3, 0],
      [AHRI, ZED, 4, 1],
      [222, 51, 9, 6],
      [AHRI, YASUO, 5, 4],
    ]);
    const ahriZed = e.counters.find((c) => c.campeonId === AHRI && c.rivalId === ZED)!;
    expect(ahriZed).toMatchObject({ rol: 'MIDDLE', winrate: 0.25, nota: 60, pocas: true });
    expect(e.counters.find((c) => c.campeonId === 222)!.pocas).toBe(false);
  });

  it('tier list: por campeón y rol con KDA, nota y tier', () => {
    const e = estadisticasPersonales(historial);
    expect(e.tierList.map((c) => [c.campeonId, c.rol, c.partidas])).toEqual([
      [222, 'BOTTOM', 9],
      [AHRI, 'MIDDLE', 11],
      [SYNDRA, 'MIDDLE', 3],
    ]);
    const jinx = e.tierList[0]!;
    expect(jinx.kda).toBe(5);
    expect(jinx.nota).toBe(70);
    expect(jinx.tier).toBe('S');
    expect(jinx.pocas).toBe(false);
    const ahri = e.tierList[1]!;
    expect(ahri.victorias).toBe(5);
    expect(ahri.tier).toBe(tierDe(puntosTier(5, 11, 60)));
    expect(e.tierList[2]!.pocas).toBe(true);
  });

  it('peores rivales: por rival y rol, juegues con lo que juegues', () => {
    const e = estadisticasPersonales(historial);
    expect(e.peoresRivales[0]).toMatchObject({ rivalId: ZED, rol: 'MIDDLE', partidas: 7, victorias: 1, derrotas: 6 });
    // Syndra rival (2 partidas) no llega al mínimo.
    expect(e.peoresRivales.some((r) => r.rivalId === SYNDRA)).toBe(false);
    expect(e.peoresRivales.map((r) => r.rivalId)).toEqual([ZED, 51, YASUO]);
  });

  it('sin rival de línea claro: cuenta para la tier list, no para counters ni rivales', () => {
    const e = estadisticasPersonales(varias(4, 2, { campeon: AHRI, rival: ZED, rolRival: 'TOP' }));
    expect(e.partidas).toBe(4);
    expect(e.partidasConRival).toBe(0);
    expect(e.tierList).toHaveLength(1);
    expect(e.counters).toEqual([]);
    expect(e.peoresRivales).toEqual([]);
    expect(e.faltan).toEqual({ tierList: 0, counters: 3, rivales: 3 });
  });

  it('pocos datos: cuántas partidas faltan para cada tabla', () => {
    expect(estadisticasPersonales([]).faltan).toEqual({ tierList: 3, counters: 3, rivales: 3 });
    const e = estadisticasPersonales([...varias(2, 1, { campeon: AHRI, rival: ZED }), partida({ campeon: SYNDRA, rival: ZED, gano: true })]);
    expect(e.faltan).toEqual({ tierList: 1, counters: 1, rivales: 0 });
    expect(e.peoresRivales).toHaveLength(1);
  });

  it('countersPersonales y enfrentamientoPersonal para la selección', () => {
    const c = calcularCountersPersonales(historial, AHRI, 'MIDDLE');
    expect(c.partidas).toBe(11);
    expect(c.peores.map((x) => x.rivalId)).toEqual([ZED]);
    expect(c.mejores.map((x) => x.rivalId)).toEqual([YASUO]);
    expect(calcularCountersPersonales(historial, AHRI, 'TOP')).toMatchObject({ partidas: 0, peores: [], mejores: [] });
    expect(calcularEnfrentamientoPersonal(historial, AHRI, YASUO, 'MIDDLE')).toMatchObject({ partidas: 5, victorias: 4, winrate: 0.8 });
    expect(calcularEnfrentamientoPersonal(historial, AHRI, SYNDRA, 'MIDDLE')).toBeNull();
  });

  it('valida la consulta de la IPC', () => {
    expect(consultaPersonal(undefined)).toEqual({});
    expect(consultaPersonal({ campeon: AHRI, rol: 'MIDDLE', rival: ZED })).toEqual({ campeon: AHRI, rol: 'MIDDLE', rival: ZED });
    expect(consultaPersonal({ campeon: 'Ahri' })).toBeNull();
    expect(consultaPersonal({ campeon: AHRI, rol: 'MID' })).toBeNull();
    expect(consultaPersonal([1])).toBeNull();
    const r = respuestaPersonal(historial, { campeon: AHRI, rol: 'MIDDLE', rival: ZED });
    expect(r.counters?.campeonId).toBe(AHRI);
    expect(r.enfrentamiento).toMatchObject({ rivalId: ZED, partidas: 4 });
    expect(respuestaPersonal(historial, {})).toMatchObject({ counters: null, enfrentamiento: null });
  });

  it('las tablas no llevan nombres ni datos de otros jugadores', () => {
    const texto = JSON.stringify(estadisticasPersonales(historial));
    expect(texto).not.toMatch(/"J\d+"|nombre|puuid/);
  });
});

describe('Tus estadísticas: servicio del perfil', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('lee el historial guardado de la cuenta sin el cliente abierto', () => {
    dir = mkdtempSync(join(tmpdir(), 'personal-'));
    const partidas = varias(5, 1, { campeon: AHRI, rival: ZED });
    writeFileSync(join(dir, 'perfil.json'), JSON.stringify({ version: 1, invocador: null, puuid: 'x', rangos: [], pl: [], partidas, reto: null, actualizado: null }));
    const s = crearServicioPerfil({ dir, lcu: () => null, campeones: async () => ({ version: '', porId: {} }) });
    expect(s.estadisticasPersonales().estadisticas.tierList).toHaveLength(1);
    expect(s.countersPersonales(AHRI, 'MIDDLE').peores[0]).toMatchObject({ rivalId: ZED, partidas: 5, victorias: 1 });
    expect(s.enfrentamientoPersonal(AHRI, ZED, 'MIDDLE')?.winrate).toBe(0.2);
  });
});
