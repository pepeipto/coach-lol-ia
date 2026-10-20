import { describe, expect, it } from 'vitest';
import fixture from './fixtures/allgamedata.json';
import { normalizarDatosPartida } from '../src/main/partida/normalizar';

const copia = () => structuredClone(fixture) as any;

describe('normalizarDatosPartida', () => {
  it('normaliza el fixture: oro, nivel, objetos, habilidades y eventos', () => {
    expect(normalizarDatosPartida(copia())).toEqual({
      tiempo: 640.7,
      oro: 1234.5,
      nivel: 9,
      campeon: 'Ahri',
      objetos: [1056, 3020, 2003],
      habilidades: { Q: 3, W: 1, E: 2, R: 1 },
      eventos: [
        { nombre: 'GameStart', tiempo: 0.05 },
        { nombre: 'DragonKill', tiempo: 312.4 },
        { nombre: 'HeraldKill', tiempo: 515.9 },
      ],
      equipo: 'ORDER',
      modo: 'clasificatoria',
      jugadores: [
        { campeon: 'Zed', equipo: 'CHAOS', posicion: null, castigo: false, nombre: 'Zed', nivel: 8, objetos: [3142] },
        { campeon: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false, nombre: 'Ahri', nivel: 9, objetos: [1056, 3020, 2003] },
      ],
    });
  });

  it('lee el CS (scores.creepScore) y el equipo del jugador activo', () => {
    const d = copia();
    d.allPlayers[1].scores = { creepScore: 87, kills: 1 };
    d.allPlayers[1].team = 'CHAOS';
    const e = normalizarDatosPartida(d);
    expect(e?.cs).toBe(87);
    expect(e?.equipo).toBe('CHAOS');
  });

  it('lee el KDA (scores.kills, deaths y assists) del jugador activo', () => {
    const d = copia();
    d.allPlayers[1].scores = { creepScore: 87, kills: 4, deaths: 2, assists: 9 };
    expect(normalizarDatosPartida(d)?.kda).toEqual({ k: 4, d: 2, a: 9 });
  });

  it('sin los tres datos del KDA no lo inventa', () => {
    const d = copia();
    d.allPlayers[1].scores = { creepScore: 87, kills: 1 };
    expect(normalizarDatosPartida(d)).not.toHaveProperty('kda');
  });

  it('lee el terreno del mapa (mapTerrain) salvo «Default»', () => {
    const d = copia();
    d.gameData.mapTerrain = 'Infernal';
    expect(normalizarDatosPartida(d)?.terreno).toBe('Infernal');
    d.gameData.mapTerrain = 'Default';
    expect(normalizarDatosPartida(d)).not.toHaveProperty('terreno');
  });

  it('sin scores ni equipo válido, cs y equipo quedan ausentes', () => {
    const d = copia();
    d.allPlayers[1].team = 'NEUTRAL';
    const e = normalizarDatosPartida(d);
    expect(e).not.toHaveProperty('cs');
    expect(e).not.toHaveProperty('equipo');
  });

  it('DragonKill (y desde la 3.1 los demás objetivos) guardan el tipo de dragón y el equipo de quien lo mata (por nombre de juego o Riot ID)', () => {
    const d = copia();
    d.allPlayers[0].riotIdGameName = 'Otro';
    d.events.Events = [
      { EventID: 1, EventName: 'DragonKill', EventTime: 300, DragonType: 'Fire', Stolen: 'False', KillerName: 'Otro', Assisters: [] },
      { EventID: 2, EventName: 'DragonKill', EventTime: 900, DragonType: 'Elder', Stolen: 'False', KillerName: 'Señor Ñandú#LAS1' },
      { EventID: 3, EventName: 'DragonKill', EventTime: 1200, DragonType: 'Earth', KillerName: 'SRU_Desconocido' },
      { EventID: 4, EventName: 'HordeKill', EventTime: 500, KillerName: 'Otro' },
    ];
    const sinParticipantes = normalizarDatosPartida(d)?.eventos.map(({ nombre, tiempo, dragon, equipo }) => ({
      nombre,
      tiempo,
      ...(dragon !== undefined && { dragon }),
      ...(equipo !== undefined && { equipo }),
    }));
    expect(sinParticipantes).toEqual([
      { nombre: 'DragonKill', tiempo: 300, dragon: 'Fire', equipo: 'CHAOS' },
      { nombre: 'DragonKill', tiempo: 900, dragon: 'Elder', equipo: 'ORDER' },
      { nombre: 'DragonKill', tiempo: 1200, dragon: 'Earth' },
      { nombre: 'HordeKill', tiempo: 500, equipo: 'CHAOS' },
    ]);
  });

  it('3.0.2: objetivos y estructuras guardan EventID, quién lo hizo, quién asistió y la estructura (TurretKilled / InhibKilled)', () => {
    const d = copia();
    d.allPlayers[0].riotIdGameName = 'Otro';
    const otro = normalizarDatosPartida(d)!.jugadores!.find((j) => j.equipo === 'CHAOS')!.campeon;
    d.events.Events = [
      { EventID: 5, EventName: 'BaronKill', EventTime: 1500, Stolen: 'False', KillerName: 'Señor Ñandú#LAS1', Assisters: ['Otro'] },
      { EventID: 6, EventName: 'TurretKilled', EventTime: 600, TurretKilled: 'Turret_T1_L_03_A', KillerName: 'Otro', Assisters: [] },
      { EventID: 7, EventName: 'InhibKilled', EventTime: 1600, InhibKilled: 'Barracks_T1_R1', KillerName: 'Minion_T200L0S0N0', Assisters: ['Otro'] },
    ];
    const [baron, torre, inhib] = normalizarDatosPartida(d)!.eventos;
    expect(baron).toMatchObject({ nombre: 'BaronKill', id: 5, asistentes: [otro] });
    expect(baron!.asesino).toBeTruthy();
    expect(torre).toMatchObject({ nombre: 'TurretKilled', id: 6, asesino: otro, asistentes: [], estructura: 'Turret_T1_L_03_A' });
    expect(inhib).toMatchObject({ nombre: 'InhibKilled', id: 7, asistentes: [otro], estructura: 'Barracks_T1_R1' });
    expect(inhib).not.toHaveProperty('asesino');
  });

  it('encuentra al jugador con Riot ID "Señor Ñandú#LAS1" aunque esté en otra forma Unicode (NFD)', () => {
    const d = copia();
    d.activePlayer.riotId = 'Señor Ñandú#LAS1'.normalize('NFD');
    expect(d.activePlayer.riotId).not.toBe(d.allPlayers[1].riotId);
    expect(normalizarDatosPartida(d)?.campeon).toBe('Ahri');
  });

  it('mapa distinto de 11 (ARAM) → null', () => {
    const d = copia();
    d.gameData.mapNumber = 12;
    expect(normalizarDatosPartida(d)).toBeNull();
  });

  it('ARAM, ARAM: Caos y Arena se reconocen por gameMode en su mapa', () => {
    const casos: [string, number, string][] = [
      ['ARAM', 12, 'aram'],
      ['KIWI', 12, 'caos'],
      ['CHERRY', 30, 'arena'],
      ['CLASSIC', 11, 'clasificatoria'],
    ];
    for (const [gameMode, mapNumber, modo] of casos) {
      const d = copia();
      Object.assign(d.gameData, { gameMode, mapNumber });
      expect(normalizarDatosPartida(d)?.modo).toBe(modo);
    }
  });

  it('URF, Uno para todos y la Herramienta de práctica en la Grieta usan el overlay de la Grieta', () => {
    for (const gameMode of ['URF', 'ONEFORALL', 'PRACTICETOOL']) {
      const d = copia();
      Object.assign(d.gameData, { gameMode, mapNumber: 11 });
      expect(normalizarDatosPartida(d)?.modo).toBe('clasificatoria');
    }
  });

  it('un gameMode desconocido en el mapa 30 es Arena; en un mapa sin datos (TFT) no hay estado', () => {
    const d = copia();
    Object.assign(d.gameData, { gameMode: 'NUEVOMODO', mapNumber: 30 });
    expect(normalizarDatosPartida(d)?.modo).toBe('arena');
    Object.assign(d.gameData, { gameMode: 'TFT', mapNumber: 22 });
    expect(normalizarDatosPartida(d)).toBeNull();
  });

  it('un gameMode conocido fuera de su mapa → null', () => {
    const d = copia();
    Object.assign(d.gameData, { gameMode: 'ARAM', mapNumber: 11 });
    expect(normalizarDatosPartida(d)).toBeNull();
  });

  it('sin gameMode, el modo de su mapa', () => {
    const d = copia();
    delete d.gameData.gameMode;
    expect(normalizarDatosPartida(d)?.modo).toBe('clasificatoria');
    d.gameData.mapNumber = 12;
    expect(normalizarDatosPartida(d)?.modo).toBe('aram');
  });

  it('sin activePlayer (espectador) → null', () => {
    const d = copia();
    delete d.activePlayer;
    expect(normalizarDatosPartida(d)).toBeNull();
    d.activePlayer = { error: 'No active player' };
    expect(normalizarDatosPartida(d)).toBeNull();
  });

  it('jugador activo ausente de allPlayers o entrada inválida → null', () => {
    const d = copia();
    d.allPlayers = [];
    expect(normalizarDatosPartida(d)).toBeNull();
    expect(normalizarDatosPartida(null)).toBeNull();
    expect(normalizarDatosPartida('x')).toBeNull();
  });

  describe('registro de muertes (ChampionKill) y jugadores', () => {
    const conJungla = () => {
      const d = copia();
      d.allPlayers[0] = {
        ...d.allPlayers[0],
        riotIdGameName: 'Otro',
        position: 'JUNGLE',
        summonerSpells: { summonerSpellOne: { rawDisplayName: 'GeneratedTip_SummonerSpell_SummonerSmite_DisplayName' }, summonerSpellTwo: { rawDisplayName: 'GeneratedTip_SummonerSpell_SummonerFlash_DisplayName' } },
      };
      d.allPlayers.push({ riotId: 'Tercero#LAS', riotIdGameName: 'Tercero', rawChampionName: 'game_character_displayname_Garen', team: 'ORDER', position: 'TOP' });
      d.allPlayers.push({ riotId: 'Cuarto#LAS', summonerName: 'Viejo', rawChampionName: 'game_character_displayname_LeeSin', team: 'CHAOS', position: '' });
      return d;
    };

    it('cada jugador con su campeón, equipo, posición (si la da la API) y si lleva Castigo', () => {
      const e = normalizarDatosPartida(conJungla());
      expect(e?.jugadores).toEqual([
        { campeon: 'Zed', equipo: 'CHAOS', posicion: 'JUNGLE', castigo: true, nombre: 'Zed', nivel: 8, objetos: [3142] },
        { campeon: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false, nombre: 'Ahri', nivel: 9, objetos: [1056, 3020, 2003] },
        { campeon: 'Garen', equipo: 'ORDER', posicion: 'TOP', castigo: false },
        { campeon: 'LeeSin', equipo: 'CHAOS', posicion: null, castigo: false },
      ]);
    });

    it('ChampionKill: asesino, víctima y asistentes como campeones (por nombre de juego, Riot ID o nombre antiguo)', () => {
      const d = conJungla();
      d.events.Events.push({ EventID: 9, EventName: 'ChampionKill', EventTime: 200, KillerName: 'Otro', VictimName: 'Tercero#LAS', Assisters: ['Viejo', 'Desconocido'] });
      d.events.Events.push({ EventID: 10, EventName: 'ChampionKill', EventTime: 210, KillerName: 'Turret_T2_L_03_A', VictimName: 'Tercero' });
      const ev = normalizarDatosPartida(d)!.eventos.filter((x) => x.nombre === 'ChampionKill');
      expect(ev[0]).toEqual({ nombre: 'ChampionKill', tiempo: 200, id: 9, asesino: 'Zed', victima: 'Garen', asistentes: ['LeeSin'] });
      expect(ev[1]).toEqual({ nombre: 'ChampionKill', tiempo: 210, id: 10, victima: 'Garen', asistentes: [] });
    });
  });
});

describe('3.1: más datos de la Live Client Data API para la voz', () => {
  it('muerto, segundos para reaparecer, puntuación de visión y asesinatos y nivel de cada jugador', () => {
    const d = copia();
    d.allPlayers[1] = { ...d.allPlayers[1], isDead: true, respawnTimer: 12.5, scores: { kills: 3, deaths: 1, assists: 2, creepScore: 80, wardScore: 9.4 } };
    d.allPlayers[0] = { ...d.allPlayers[0], scores: { kills: 4, deaths: 2, assists: 0 } };
    const e = normalizarDatosPartida(d)!;
    expect(e).toMatchObject({ muerto: true, reaparece: 12.5, vision: 9.4 });
    expect(e.jugadores).toEqual([
      { campeon: 'Zed', equipo: 'CHAOS', posicion: null, castigo: false, nombre: 'Zed', nivel: 8, asesinatos: 4, objetos: [3142] },
      { campeon: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false, nombre: 'Ahri', nivel: 9, asesinatos: 3, objetos: [1056, 3020, 2003] },
    ]);
    // Sin esos campos (versiones antiguas de la API), no se inventan.
    const viejo = normalizarDatosPartida(copia())!;
    expect(viejo.muerto).toBeUndefined();
    expect(viejo.reaparece).toBeUndefined();
    expect(viejo.vision).toBeUndefined();
  });

  it('Multikill, FirstBlood, Ace, robos, reaparición de inhibidores y final de la partida', () => {
    const d = copia();
    d.allPlayers[0].riotIdGameName = 'Otro';
    d.events.Events = [
      { EventID: 1, EventName: 'FirstBlood', EventTime: 100, Recipient: 'Otro' },
      { EventID: 2, EventName: 'Multikill', EventTime: 200, KillerName: 'Señor Ñandú#LAS1', KillStreak: 3 },
      { EventID: 3, EventName: 'Ace', EventTime: 210, Acer: 'Otro', AcingTeam: 'CHAOS' },
      { EventID: 4, EventName: 'BaronKill', EventTime: 1300, Stolen: 'True', KillerName: 'Otro', Assisters: [] },
      { EventID: 5, EventName: 'InhibRespawned', EventTime: 1500, InhibRespawned: 'Barracks_T1_L1' },
      { EventID: 6, EventName: 'GameEnd', EventTime: 1800, Result: 'Win' },
    ];
    const ev = normalizarDatosPartida(d)!.eventos;
    expect(ev[0]).toMatchObject({ nombre: 'FirstBlood', asesino: 'Zed' });
    expect(ev[1]).toMatchObject({ nombre: 'Multikill', id: 2, asesino: 'Ahri', racha: 3 });
    expect(ev[2]).toMatchObject({ nombre: 'Ace', id: 3, equipo: 'CHAOS' });
    expect(ev[3]).toMatchObject({ nombre: 'BaronKill', robado: true, equipo: 'CHAOS', asesino: 'Zed' });
    expect(ev[4]).toMatchObject({ nombre: 'InhibRespawned', estructura: 'Barracks_T1_L1' });
    expect(ev[5]).toMatchObject({ nombre: 'GameEnd', resultado: 'Win' });
  });
});
