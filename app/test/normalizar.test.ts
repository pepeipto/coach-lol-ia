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
    });
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
