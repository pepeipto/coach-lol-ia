import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build, ItemDDragonCrudo, Rol } from '@coach/shared';
import { calcularBuilds } from '../src/agregador';
import { listaCampeones } from '../src/campeones';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';
import { recolectar } from '../src/recolector';
import type { LineaTiempoRiot, PartidaRiot, RiotApi } from '../src/riot/riotApi';
import { guardarBans, MIN_PARTIDAS_TASAS, tasasCampeones } from '../src/tasas';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const RUNAS = { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010, 9111, 9104, 8299, 8444, 8242, 5005, 5008, 5001] };
function participacion(matchId: string, campeon: string, rol: Rol, parche: string, modo: Participacion['modo'] = 'clasificatoria'): Participacion {
  return { matchId, campeon, rol: modo === 'clasificatoria' ? rol : null, modo, victoria: true, parche, runas: RUNAS, hechizos: [4, 12], iniciales: [], compras: [], habilidades: [] };
}

/** `n` partidas de clasificatoria del parche: Ahri (MIDDLE) en las `conAhri` primeras; Zed (MIDDLE) en el resto. Bloqueos: Yasuo en las `conYasuo` primeras. */
function partidas(db: Db, n: number, conAhri: number, conYasuo: number, parche = '15.20', prefijo = parche) {
  for (let i = 0; i < n; i++) {
    const id = `EUW1_${prefijo}_${i}`;
    db.guardarParticipaciones('EUW', [participacion(id, i < conAhri ? 'Ahri' : 'Zed', 'MIDDLE', parche), participacion(id, 'Garen', 'TOP', parche)]);
    guardarBans(db.sql, {
      matchId: id,
      parche,
      bans: i < conYasuo ? [157, 555] : [555],
      campeones: [
        { id: 103, nombre: 'Ahri' },
        { id: 238, nombre: 'Zed' },
        { id: 86, nombre: 'Garen' },
        { id: 157, nombre: 'Yasuo' },
      ],
    });
  }
}

describe('tasa de bloqueo y de selección', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('bloqueo = partidas bloqueado / partidas con bloqueos; selección = partidas jugadas / partidas del parche', () => {
    partidas(db, 200, 50, 80);
    const t = tasasCampeones(db.sql, '15.20', '15.19');
    expect(t.get('yasuo')).toEqual({ tasaBloqueo: 0.4 }); // bloqueado, nunca jugado
    expect(t.get('ahri')).toEqual({ tasaSeleccion: 0.25, tasaBloqueo: 0 });
    expect(t.get('garen')).toEqual({ tasaSeleccion: 1, tasaBloqueo: 0 });
    // Una clave numérica sin campeón conocido (555) no se publica.
    expect([...t.keys()].sort()).toEqual(['ahri', 'garen', 'yasuo', 'zed']);
  });

  it(`con menos de ${MIN_PARTIDAS_TASAS} partidas en el parche mezcla el anterior; sin llegar ni así, no hay tasa`, () => {
    partidas(db, 60, 60, 0, '15.20');
    expect(tasasCampeones(db.sql, '15.20', '15.19').size).toBe(0);
    partidas(db, 60, 0, 60, '15.19');
    const t = tasasCampeones(db.sql, '15.20', '15.19');
    expect(t.get('ahri')).toEqual({ tasaSeleccion: 0.5, tasaBloqueo: 0 });
    expect(t.get('yasuo')).toEqual({ tasaBloqueo: 0.5 });
  });

  it('las partidas antiguas sin bloqueos guardados cuentan para la selección, no para el bloqueo', () => {
    for (let i = 0; i < 150; i++) db.guardarParticipaciones('EUW', [participacion(`EUW1_vieja_${i}`, 'Ahri', 'MIDDLE', '15.20')]);
    const t = tasasCampeones(db.sql, '15.20', '15.19');
    expect(t.get('ahri')).toEqual({ tasaSeleccion: 1 });
  });

  it('solo cuenta clasificatoria', () => {
    for (let i = 0; i < 150; i++) db.guardarParticipaciones('EUW', [participacion(`EUW1_aram_${i}`, 'Ahri', 'MIDDLE', '15.20', 'aram')]);
    expect(tasasCampeones(db.sql, '15.20', '15.19').size).toBe(0);
  });

  it('borrarParchesAntiguos borra también los bloqueos', async () => {
    partidas(db, 120, 0, 120, '15.18');
    await db.borrarParchesAntiguos(['15.20', '15.19']);
    expect((db.sql.prepare('SELECT COUNT(*) AS n FROM bans_partidas').get() as { n: number }).n).toBe(0);
  });

  it('la build de clasificatoria y la lista de campeones llevan las dos tasas', () => {
    partidas(db, 200, 120, 30);
    const OBJETOS: Record<number, ItemDDragonCrudo> = {};
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    const ahri = db.build('Ahri', 'MIDDLE')!;
    expect(ahri.tasaSeleccion).toBeCloseTo(0.6);
    expect(ahri.tasaBloqueo).toBe(0);
    const lista = listaCampeones(db.builds());
    expect(lista.campeones.find((c) => c.campeon === 'Ahri')).toMatchObject({ tasaSeleccion: 0.6, tasaBloqueo: 0 });
  });

  it('listaCampeones no inventa tasas si la build no las trae', () => {
    const b = { campeon: 'Ahri', rol: 'MIDDLE', parche: '15.20', partidas: 50, tasaVictoria: 0.5 } as Build;
    const [e] = listaCampeones([b]).campeones;
    expect(e).not.toHaveProperty('tasaBloqueo');
    expect(e).not.toHaveProperty('tasaSeleccion');
  });
});

describe('el recolector guarda los bloqueos de clasificatoria', () => {
  it('con `teams` en la partida', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = abrirDb(':memory:');
    const base = partidaJson as unknown as PartidaRiot;
    const partida: PartidaRiot = {
      metadata: { matchId: 'B1' },
      info: {
        ...base.info,
        gameVersion: '15.20.1.1',
        queueId: 420,
        gameDuration: 1800,
        participants: base.info.participants.map((p, i) => ({ ...p, championId: 100 + i })),
        teams: [{ teamId: 100, bans: [{ championId: 157 }, { championId: -1 }] }, { teamId: 200, bans: [{ championId: 157 }] }],
      },
    };
    const api: RiotApi = {
      ligaApex: async () => [{ puuid: 'j1' }],
      entradasLiga: async () => [],
      idsPartidas: async () => ['B1'],
      partida: async () => partida,
      lineaTiempo: async () => lineaJson as unknown as LineaTiempoRiot,
    };
    expect(await recolectar(api, db, {}, { region: 'EUW', parche: '15.20', maxPartidas: 5, aleatorio: () => 0.5 })).toBe(1);
    expect(db.sql.prepare('SELECT parche, bans FROM bans_partidas WHERE match_id = ?').get('B1')).toEqual({ parche: '15.20', bans: '[157]' });
    db.cerrar();
    vi.restoreAllMocks();
  });
});
