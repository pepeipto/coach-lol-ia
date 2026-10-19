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

  it('DragonKill guarda el tipo de dragón y el equipo de quien lo mata (por nombre de juego o Riot ID)', () => {
    const d = copia();
    d.allPlayers[0].riotIdGameName = 'Otro';
    d.events.Events = [
      { EventID: 1, EventName: 'DragonKill', EventTime: 300, DragonType: 'Fire', Stolen: 'False', KillerName: 'Otro', Assisters: [] },
      { EventID: 2, EventName: 'DragonKill', EventTime: 900, DragonType: 'Elder', Stolen: 'False', KillerName: 'Señor Ñandú#LAS1' },
      { EventID: 3, EventName: 'DragonKill', EventTime: 1200, DragonType: 'Earth', KillerName: 'SRU_Desconocido' },
      { EventID: 4, EventName: 'HordeKill', EventTime: 500, KillerName: 'Otro' },
    ];
    expect(normalizarDatosPartida(d)?.eventos).toEqual([
      { nombre: 'DragonKill', tiempo: 300, dragon: 'Fire', equipo: 'CHAOS' },
      { nombre: 'DragonKill', tiempo: 900, dragon: 'Elder', equipo: 'ORDER' },
      { nombre: 'DragonKill', tiempo: 1200, dragon: 'Earth' },
      { nombre: 'HordeKill', tiempo: 500 },
    ]);
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
});
