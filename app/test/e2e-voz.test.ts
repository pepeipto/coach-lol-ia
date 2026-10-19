import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { HUECO_MS, URGENTE_HASTA } from '../src/main/consejos/regulador';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import { normalizarDatosPartida } from '../src/main/partida/normalizar';
import type { Ajustes, EstadoCarga, FraseVoz } from '../src/shared/tiposApp';
import { tiposDeNivel } from '../src/shared/vozCategorias';

/*
 * 3.1 · Partida completa de 30 minutos, de punta a punta y sin Electron ni red: respuestas de /allgamedata con la
 * forma de la Live Client Data API → normalizarDatosPartida → orquestador (motor, detector, regulador) → frases que
 * llegarían a la cola de voz del overlay. Comprueba que el coach habla de todo un poco, sin atosigar y sin repetirse.
 */

const ORDEN = ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'] as const;
const build = {
  campeon: 'Ahri', rol: 'MIDDLE', nucleo: [3108, 3089, 3157], botas: 3020, situacionales: [], ordenHabilidades: [...ORDEN],
} as unknown as Build;
const objetos = {
  1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true }, into: [] },
  3108: { name: 'Códice demoníaco', gold: { total: 1250, purchasable: true }, from: [], into: ['3089'] },
  3089: { name: 'Sombrero mortal de Rabadon', gold: { total: 3600, purchasable: true }, from: ['3108'], into: [] },
  3157: { name: 'Reloj de arena de Zhonya', gold: { total: 3250, purchasable: true }, from: [], into: [] },
  3020: { name: 'Botas del hechicero', gold: { total: 1100, purchasable: true }, tags: ['Boots'], from: ['1001'], into: [] },
  1001: { name: 'Botas', gold: { total: 300, purchasable: true }, tags: ['Boots'], into: ['3020'] },
  3340: { name: 'Tótem vigilante', gold: { total: 0, purchasable: true }, tags: ['Trinket'], into: [] },
  2055: { name: 'Guardián de control', gold: { total: 75, purchasable: true }, consumed: true },
} as unknown as DatosEstaticos['objetos'];

const EQUIPOS = {
  ORDER: [['Ahri', 'MIDDLE'], ['Garen', 'TOP'], ['Vi', 'JUNGLE'], ['Jinx', 'BOTTOM'], ['Lulu', 'UTILITY']],
  CHAOS: [['Zed', 'MIDDLE'], ['Darius', 'TOP'], ['LeeSin', 'JUNGLE'], ['Caitlyn', 'BOTTOM'], ['Thresh', 'UTILITY']],
} as const;
const nombre = (c: string) => `${c}Jugador`;

type Ev = Record<string, unknown>;
/** Lo que pasa en la partida (eventos oficiales, con los nombres de jugador como los da la API). */
function eventosDe(): Ev[] {
  const k = (t: number, killer: string, victim: string, assisters: string[] = []) => ({ EventName: 'ChampionKill', EventTime: t, KillerName: nombre(killer), VictimName: nombre(victim), Assisters: assisters.map(nombre) });
  const lista: Ev[] = [
    { EventName: 'GameStart', EventTime: 0.05 },
    { EventName: 'MinionsSpawning', EventTime: 65 },
    k(150, 'Ahri', 'Zed'),
    { EventName: 'FirstBlood', EventTime: 150, Recipient: nombre('Ahri') },
    { EventName: 'DragonKill', EventTime: 320, DragonType: 'Fire', Stolen: 'False', KillerName: nombre('Vi'), Assisters: [nombre('Ahri')] },
    k(400, 'Zed', 'Ahri', ['LeeSin']),
    { EventName: 'HordeKill', EventTime: 500, KillerName: nombre('LeeSin'), Assisters: [] },
    { EventName: 'HordeKill', EventTime: 505, KillerName: nombre('LeeSin'), Assisters: [] },
    { EventName: 'HordeKill', EventTime: 510, KillerName: nombre('LeeSin'), Assisters: [] },
    k(610, 'Ahri', 'Zed'),
    k(612, 'Ahri', 'LeeSin'),
    { EventName: 'Multikill', EventTime: 612, KillerName: nombre('Ahri'), KillStreak: 2 },
    { EventName: 'TurretKilled', EventTime: 700, TurretKilled: 'Turret_T2_C_05_A', KillerName: nombre('Ahri'), Assisters: [] },
    { EventName: 'FirstBrick', EventTime: 700, KillerName: nombre('Ahri') },
    k(800, 'Darius', 'Garen'),
    k(905, 'Zed', 'Ahri'),
    { EventName: 'HeraldKill', EventTime: 960, Stolen: 'False', KillerName: nombre('LeeSin'), Assisters: [] },
    k(1000, 'Zed', 'Ahri'),
    k(1100, 'Caitlyn', 'Ahri', ['Thresh']),
    { EventName: 'DragonKill', EventTime: 1150, DragonType: 'Water', Stolen: 'False', KillerName: nombre('LeeSin'), Assisters: [] },
    k(1250, 'Jinx', 'Caitlyn', ['Ahri', 'Lulu']),
    { EventName: 'BaronKill', EventTime: 1300, Stolen: 'True', KillerName: nombre('Vi'), Assisters: [] },
    { EventName: 'TurretKilled', EventTime: 1400, TurretKilled: 'Turret_T1_R_03_A', KillerName: nombre('Caitlyn'), Assisters: [] },
    { EventName: 'InhibKilled', EventTime: 1500, InhibKilled: 'Barracks_T1_C1', KillerName: nombre('Zed'), Assisters: [nombre('LeeSin')] },
    ...[1640, 1642, 1644, 1646, 1648].map((t, i) => k(t, ['Ahri', 'Jinx', 'Garen', 'Vi', 'Ahri'][i]!, ['Zed', 'Darius', 'LeeSin', 'Caitlyn', 'Thresh'][i]!)),
    { EventName: 'Ace', EventTime: 1648, Acer: nombre('Ahri'), AcingTeam: 'ORDER' },
    { EventName: 'InhibRespawned', EventTime: 1800, InhibRespawned: 'Barracks_T1_C1' },
  ];
  return lista.map((e, i) => ({ EventID: i, ...e }));
}

/** Mis muertes: [desde, hasta] en segundos de partida (isDead y respawnTimer del marcador). */
const MUERTO = [[400, 418], [905, 930], [1000, 1028], [1100, 1131]] as const;

function frame(t: number, eventos: Ev[]): unknown {
  const visibles = eventos.filter((e) => (e.EventTime as number) <= t);
  const nivel = Math.min(18, 1 + Math.floor(t / 95));
  // Recién subido de nivel, el punto aún no está gastado (2 s).
  const puntos = t % 95 < 2 && nivel > 1 ? nivel - 1 : nivel;
  const habilidades = { Q: 0, W: 0, E: 0, R: 0 } as Record<string, number>;
  for (const h of ORDEN.slice(0, puntos)) habilidades[h]!++;
  const muerte = MUERTO.find(([a, b]) => t >= a && t < b);
  const items = t < 400 ? [1056, 3340] : t < 905 ? [1056, 3108, 1001, 3340] : t < 1100 ? [1056, 3089, 3020, 3340] : [1056, 3089, 3020, 3157, 3340, 2055];
  const oro = t < 400 ? 500 + t * 2 : t < 905 ? 300 + (t - 400) * 2 : 200 + ((t * 2) % 900);
  const kills = (c: string) => visibles.filter((e) => e.EventName === 'ChampionKill' && e.KillerName === nombre(c)).length;
  const muertes = (c: string) => visibles.filter((e) => e.EventName === 'ChampionKill' && e.VictimName === nombre(c)).length;
  const jugador = (c: string, rol: string, team: string) => ({
    riotId: `${nombre(c)}#EUW`,
    riotIdGameName: nombre(c),
    rawChampionName: `game_character_displayname_${c}`,
    championName: c,
    team,
    position: '',
    level: c === 'Zed' ? Math.max(1, nivel - (t > 500 && t < 700 ? 1 : 0)) : nivel,
    isDead: c === 'Ahri' ? !!muerte : false,
    respawnTimer: c === 'Ahri' && muerte ? muerte[1] - t : 0,
    items: (c === 'Ahri' ? items : [1056]).map((itemID, slot) => ({ itemID, slot })),
    scores: { kills: kills(c), deaths: muertes(c), assists: 0, creepScore: c === 'Ahri' ? Math.floor((t / 60) * 6.6) : 0, wardScore: (t / 60) * 0.5 },
    summonerSpells: { summonerSpellOne: { rawDisplayName: rol === 'JUNGLE' ? 'SummonerSmite' : 'SummonerFlash' }, summonerSpellTwo: { rawDisplayName: 'SummonerFlash' } },
  });
  return {
    activePlayer: { riotId: `${nombre('Ahri')}#EUW`, level: nivel, currentGold: oro, abilities: Object.fromEntries(Object.entries(habilidades).map(([k, v]) => [k, { abilityLevel: v }])) },
    allPlayers: [...EQUIPOS.ORDER.map(([c, r]) => jugador(c, r, 'ORDER')), ...EQUIPOS.CHAOS.map(([c, r]) => jugador(c, r, 'CHAOS'))],
    events: { Events: visibles },
    gameData: { gameTime: t, mapNumber: 11, gameMode: 'CLASSIC', mapTerrain: t > 1200 ? 'Ocean' : 'Default' },
  };
}

const carga: EstadoCarga = {
  version: '16.20.1',
  jugadores: [...EQUIPOS.ORDER.map(([c, r]) => ['aliado', c, r] as const), ...EQUIPOS.CHAOS.map(([c, r]) => ['enemigo', c, r] as const)].map(([equipo, campeon, rol]) => ({
    equipo, riotId: `${campeon}#1`, campeonId: 1, campeon, nombre: campeon, rol, rango: null, maestria: null, campeonWinrate: null, etiquetas: [],
  })),
};

async function jugar(ajustesVoz: Partial<Ajustes['overlay']['voz']>) {
  const conector = Object.assign(new EventEmitter(), { iniciar: vi.fn(), detener: vi.fn() });
  const dichas: { ms: number; frase: FraseVoz }[] = [];
  let ahora = 0;
  const overlay = {
    mostrar: vi.fn(), ocultar: vi.fn(), alternar: vi.fn(), enviarEstado: vi.fn(), enviarAviso: vi.fn(), enviarModo: vi.fn(), enviarJungla: vi.fn(),
    enviarVoz: vi.fn((frase: FraseVoz) => dichas.push({ ms: ahora, frase })),
  };
  const ajustes: Ajustes = { ...AJUSTES_POR_DEFECTO, overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, ...ajustesVoz } } };
  const p = crearOrquestadorPartida({
    crearConector: () => conector,
    overlay,
    obtenerAjustes: () => ajustes,
    contexto: async () => ({ build, rol: 'MIDDLE', objetos, version: '16.20.1' }),
    avisar: vi.fn(),
    leerModo: async () => 'sin_bordes',
    ahora: () => ahora,
    esPremium: () => true,
    cargaActual: () => carga,
  });
  await p.fase('InProgress');
  const eventos = eventosDe();
  let estados = 0;
  for (let t = 1; t <= 1810; t++) {
    ahora = t * 1000;
    const estado = normalizarDatosPartida(frame(t, eventos));
    expect(estado, `t=${t}`).not.toBeNull();
    conector.emit('estado', estado);
    estados++;
    await new Promise((r) => setImmediate(r));
  }
  await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(estados));
  return dichas;
}

describe('partida completa con la voz en «Completo» (3.1)', () => {
  it('habla de todo un poco, sin atosigar ni repetirse', async () => {
    const dichas = await jugar({ tipos: tiposDeNivel('completo') });
    const textos = dichas.map((d) => d.frase.texto);
    if (process.env.VOZ_TRAZA) for (const d of dichas) console.log(String(d.ms / 1000).padStart(5), d.frase.tipo.padEnd(13), d.frase.prioridad, d.frase.texto);
    const tipos = new Set(dichas.map((d) => d.frase.tipo));
    // Variedad: casi todas las categorías de la Grieta aparecen en una partida normal.
    for (const tipo of ['objetivo', 'habilidad', 'nivel', 'compra', 'economia', 'cs', 'vision', 'combate', 'equipo', 'muerte', 'animo', 'fase', 'junglaEnemiga'] as const) {
      expect(tipos.has(tipo), `falta ${tipo}`).toBe(true);
    }
    // Ni mudo ni pesado: entre 60 y 220 frases en 30 minutos.
    expect(dichas.length).toBeGreaterThanOrEqual(60);
    expect(dichas.length).toBeLessThanOrEqual(220);
    // Nunca la misma frase dos veces seguidas.
    for (let i = 1; i < textos.length; i++) expect(textos[i], `repetida: ${textos[i]}`).not.toBe(textos[i - 1]);
    // Las no urgentes, separadas al menos 5 s entre sí.
    const tranquilas = dichas.filter((d) => d.frase.prioridad > URGENTE_HASTA);
    for (let i = 1; i < tranquilas.length; i++) expect(tranquilas[i]!.ms - tranquilas[i - 1]!.ms).toBeGreaterThanOrEqual(HUECO_MS);
    // En ningún minuto más de 12 frases (incluidas las urgentes de una pelea grande).
    for (let m = 0; m < 31; m++) expect(dichas.filter((d) => d.ms >= m * 60_000 && d.ms < (m + 1) * 60_000).length, `minuto ${m}`).toBeLessThanOrEqual(12);
    // Ninguna frase vacía ni con una clave sin traducir.
    for (const x of textos) expect(x).not.toMatch(/^voz\.|\{\w+\}|undefined|null/);
  }, 30_000);

  it('en «Básico» solo lo esencial', async () => {
    const dichas = await jugar({ tipos: tiposDeNivel('basico') });
    const tipos = new Set(dichas.map((d) => d.frase.tipo));
    expect([...tipos].every((x) => ['objetivo', 'habilidad', 'compra', 'jungla', 'junglaEnemiga'].includes(x))).toBe(true);
    expect(dichas.length).toBeLessThan(80);
  }, 30_000);
});
