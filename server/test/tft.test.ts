import { describe, it, expect } from 'vitest';
import { abrirDb } from '../src/db';
import { crearServidor } from '../src/http';
import { ErrorRiot, type PartidaTftRiot, type RiotApiTft } from '../src/riot/riotApi';
import { crearAlmacenTft, type TableroTft } from '../src/tft/datos';
import { calcularComps, calcularObjetosCampeones, claveComp, recalcularTft, tierDe } from '../src/tft/estadisticas';
import { parcheTft, recolectarTft, tablerosDePartida } from '../src/tft/recolector';

const VERSION = 'Linux Version 15.20.712.3456 (Oct 08 2025/10:00:00) [PUBLIC] <Releases/15.20>';

function partida(id: string, opciones: { cola?: number; version?: string } = {}): PartidaTftRiot {
  return {
    metadata: { match_id: id },
    info: {
      game_version: opciones.version ?? VERSION,
      queue_id: opciones.cola ?? 1100,
      tft_set_number: 15,
      participants: Array.from({ length: 8 }, (_, i) => ({
        puuid: `p${i}`,
        placement: i + 1,
        level: 8,
        traits: [
          { name: 'TFT15_Duelista', num_units: 4, style: 2, tier_current: 2 },
          { name: 'TFT15_Guardian', num_units: 2, style: 1, tier_current: 1 },
          { name: 'TFT15_Unico', num_units: 1, style: 3, tier_current: 1 },
          { name: 'TFT15_Inactivo', num_units: 1, style: 0, tier_current: 0 },
        ],
        units: [
          { character_id: 'TFT15_Yasuo', tier: 2, itemNames: ['Filo', 'Sanguinaria', 'Guantelete'] },
          { character_id: 'TFT15_Leona', tier: 2, itemNames: ['Armadura'] },
          { character_id: 'TFT15_Garen', tier: 1 },
        ],
      })),
    },
  };
}

function tablero(puesto: number, portador = 'TFT15_Yasuo', rasgo = 'TFT15_Duelista'): TableroTft {
  return {
    matchId: `m${puesto}-${Math.random()}`,
    parche: '15.20',
    set: 15,
    puesto,
    nivel: 8,
    rasgos: [
      { nombre: rasgo, unidades: 4, estilo: 2 },
      { nombre: 'TFT15_Guardian', unidades: 2, estilo: 1 },
    ],
    unidades: [
      { id: portador, estrellas: 2, objetos: ['Filo', 'Sanguinaria', 'Guantelete'] },
      { id: 'TFT15_Leona', estrellas: 2, objetos: [] },
    ],
  };
}

describe('TFT: lectura de partidas', () => {
  it('saca el parche de la versión del juego', () => {
    expect(parcheTft(VERSION)).toBe('15.20');
    expect(parcheTft('Version 14.3.555.1234')).toBe('14.3');
    expect(parcheTft('raro')).toBeNull();
  });

  it('guarda solo clasificatorias del parche, sin rasgos inactivos', () => {
    expect(tablerosDePartida(partida('a', { cola: 1090 }), '15.20')).toBeNull();
    expect(tablerosDePartida(partida('a'), '15.19')).toBeNull();
    const ts = tablerosDePartida(partida('a'), '15.20')!;
    expect(ts).toHaveLength(8);
    expect(ts[0].rasgos.map((r) => r.nombre)).toEqual(['TFT15_Duelista', 'TFT15_Guardian', 'TFT15_Unico']);
    expect(ts[0].unidades[2]).toEqual({ id: 'TFT15_Garen', estrellas: 1, objetos: [] });
    // Política de Riot: nada de aumentos en lo guardado.
    expect(JSON.stringify(ts)).not.toMatch(/augment/i);
  });
});

describe('TFT: estadísticas', () => {
  it('la composición usa los 2 rasgos principales (sin únicos) y el portador', () => {
    const t = tablerosDePartida(partida('a'), '15.20')![0];
    expect(claveComp(t)).toBe('TFT15_Duelista+TFT15_Guardian|TFT15_Yasuo');
  });

  it('publica composiciones con muestra suficiente y su tier', () => {
    const ts = [
      ...Array.from({ length: 40 }, (_, i) => tablero((i % 4) + 1)),
      ...Array.from({ length: 10 }, () => tablero(8, 'TFT15_Jinx', 'TFT15_Tirador')),
    ];
    const comps = calcularComps(ts);
    expect(comps).toHaveLength(1);
    expect(comps[0]).toMatchObject({ portador: 'TFT15_Yasuo', tableros: 40, puestoMedio: 2.5, top4: 1, tier: 'S', nivelMedio: 8 });
    expect(comps[0].objetosPortador).toHaveLength(3);
    expect(comps[0].unidades.map((u) => u.id)).toEqual(['TFT15_Leona', 'TFT15_Yasuo']);
    expect(tierDe(4.1)).toBe('A');
    expect(tierDe(4.8)).toBe('C');
  });

  it('objetos por campeón: juegos de 3 con muestra mínima', () => {
    const ts = Array.from({ length: 25 }, (_, i) => tablero((i % 8) + 1));
    const yasuo = calcularObjetosCampeones(ts).find((o) => o.campeon === 'TFT15_Yasuo')!;
    expect(yasuo.juegos).toHaveLength(1);
    expect(yasuo.juegos[0].objetos).toEqual(['Filo', 'Guantelete', 'Sanguinaria']);
    expect(yasuo.populares[0].frecuencia).toBe(1);
  });
});

function apiFalsa(partidas: Record<string, PartidaTftRiot>, error?: Error): RiotApiTft & { pedidas: string[] } {
  const pedidas: string[] = [];
  return {
    pedidas,
    tftLigaApex: async (_p, liga) => {
      if (error) throw error;
      return liga === 'challenger' ? [{ puuid: 'j1' }, { puuid: 'j2' }] : [];
    },
    tftEntradasLiga: async () => [],
    tftIdsPartidas: async () => Object.keys(partidas),
    tftPartida: async (_r, id) => {
      pedidas.push(id);
      return partidas[id] ?? null;
    },
  };
}

describe('TFT: recolector', () => {
  it('guarda las clasificatorias nuevas y no repite partidas', async () => {
    const db = abrirDb(':memory:');
    const almacen = crearAlmacenTft(db.sql);
    const api = apiFalsa({ a: partida('a'), b: partida('b', { cola: 1090 }), c: partida('c') });
    const nuevas = await recolectarTft(api, almacen, { region: 'EUW', parche: '15.20', maxPartidas: 10, aleatorio: () => 0 });
    expect(nuevas).toBe(2);
    expect(almacen.partidas('15.20')).toBe(2);
    expect(api.pedidas.sort()).toEqual(['a', 'b', 'c']);
    // Segundo jugador con las mismas partidas: ya están vistas, no se piden otra vez.
    expect(almacen.partidaVista('b')).toBe(true);
  });

  it('respeta el presupuesto', async () => {
    const db = abrirDb(':memory:');
    const almacen = crearAlmacenTft(db.sql);
    const api = apiFalsa({ a: partida('a'), c: partida('c') });
    expect(await recolectarTft(api, almacen, { region: 'EUW', parche: '15.20', maxPartidas: 1 })).toBe(1);
  });

  it('un 403 explica que falta activar TFT', async () => {
    const db = abrirDb(':memory:');
    const api = apiFalsa({}, new ErrorRiot(403));
    await expect(recolectarTft(api, crearAlmacenTft(db.sql), { region: 'EUW', parche: '15.20', maxPartidas: 5 })).rejects.toThrow(
      /TFT activado/,
    );
  });
});

describe('TFT: rutas', () => {
  it('404 sin datos y las composiciones tras recalcular', async () => {
    const db = abrirDb(':memory:');
    const app = crearServidor(db);
    expect((await app.inject({ method: 'GET', url: '/tft/comps' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/tft/estado' })).json()).toEqual({ activo: false });
    expect((await app.inject({ method: 'GET', url: '/tft/campeon/../x' })).statusCode).not.toBe(200);
    expect((await app.inject({ method: 'GET', url: '/tft/campeon/hola' })).statusCode).toBe(400);

    const almacen = crearAlmacenTft(db.sql);
    almacen.guardarTableros('EUW', Array.from({ length: 40 }, (_, i) => tablero((i % 4) + 1)));
    expect(recalcularTft(almacen, '15.20', '15.19')?.comps).toHaveLength(1);

    const comps = await app.inject({ method: 'GET', url: '/tft/comps' });
    expect(comps.statusCode).toBe(200);
    expect(comps.json().comps[0].tier).toBe('S');
    const yasuo = await app.inject({ method: 'GET', url: '/tft/campeon/TFT15_Yasuo' });
    expect(yasuo.statusCode).toBe(200);
    expect(yasuo.json().juegos[0].objetos).toHaveLength(3);
    await app.close();
  });
});

describe('TFT: ciclo', () => {
  it('guarda el estado del último ciclo con el error de cada región', async () => {
    const { ejecutarCiclo } = await import('../src/programacion');
    const db = abrirDb(':memory:');
    const fetchFalso = (async (url: string) =>
      new Response(JSON.stringify(String(url).endsWith('versions.json') ? ['15.20.1'] : { data: {} }))) as unknown as typeof fetch;
    const apiLol = { ligaApex: async () => [], entradasLiga: async () => [], idsPartidas: async () => [], partida: async () => null, lineaTiempo: async () => null };
    await ejecutarCiclo({
      api: apiLol,
      db,
      fetch: fetchFalso,
      regiones: [],
      rotativos: null,
      tft: { api: apiFalsa({}, new ErrorRiot(403)), maxPartidas: 5, regiones: ['EUW'] },
    });
    const app = crearServidor(db);
    const estado = (await app.inject({ method: 'GET', url: '/tft/estado' })).json();
    expect(estado.parche).toBe('15.20');
    expect(estado.regiones.EUW.error).toMatch(/TFT activado/);
    await app.close();
  });
});
