import { describe, it, expect } from 'vitest';
import type { ItemDDragonCrudo } from '@coach/shared';
import { estadoEnMinuto, extraerBans, extraerParticipaciones } from '../src/extraer';
import type { PartidaRiot, LineaTiempoRiot } from '../src/riot/riotApi';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const partida = partidaJson as unknown as PartidaRiot;
const linea = lineaJson as unknown as LineaTiempoRiot;

const objetos: Record<number, ItemDDragonCrudo> = {
  1055: { gold: { total: 450, purchasable: true }, into: [] },
  1056: { gold: { total: 400, purchasable: true }, into: [] },
  2003: { gold: { total: 50, purchasable: true }, consumed: true },
  1001: { gold: { total: 300, purchasable: true }, tags: ['Boots'], into: ['3020'] },
  3020: { gold: { total: 1100, purchasable: true }, tags: ['Boots'], from: ['1001'] },
  6655: { gold: { total: 2900, purchasable: true }, maps: { '11': true } },
  3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } },
};

describe('extraerParticipaciones', () => {
  const resultado = extraerParticipaciones(partida, linea, objetos);

  it('omite participantes con teamPosition vacío', () => {
    expect(resultado).toHaveLength(1);
    expect(resultado[0].campeon).toBe('Ahri');
    expect(resultado[0].rol).toBe('MIDDLE');
    expect(resultado[0].matchId).toBe('EUW1_7000000001');
    expect(resultado[0].victoria).toBe(true);
  });

  it('runas: 4 de la rama principal, 2 de la secundaria y fragmentos ataque, flexible y defensa en ese orden', () => {
    expect(resultado[0].runas).toEqual({
      estiloPrincipal: 8100,
      estiloSecundario: 8200,
      runas: [8112, 8126, 8138, 8135, 8226, 8237, 5008, 5008, 5001],
    });
  });

  it('parche "15.20" a partir de gameVersion "15.20.712.3456"', () => {
    expect(resultado[0].parche).toBe('15.20');
  });

  it('iniciales = compras con timestamp < 60000, descontando las deshechas con ITEM_UNDO', () => {
    expect(resultado[0].iniciales).toEqual([1056, 2003]);
  });

  it('compras solo incluye botas y legendarios, en orden y sin repetir', () => {
    expect(resultado[0].compras).toEqual([6655, 3020, 3089]);
  });

  it('habilidades: skillSlot 1..4 → Q,W,E,R, solo levelUpType "NORMAL"', () => {
    expect(resultado[0].habilidades).toEqual(['Q', 'W', 'Q', 'E']);
  });

  it('hechizos ordenados: summoner1Id 14, summoner2Id 4 → [4, 14]', () => {
    expect(resultado[0].hechizos).toEqual([4, 14]);
  });
});

describe('extraerParticipaciones: KDA', () => {
  const conKda = (k: unknown, d: unknown, a: unknown): PartidaRiot => {
    const copia = structuredClone(partida);
    for (const p of copia.info.participants) Object.assign(p, { kills: k, deaths: d, assists: a });
    return copia;
  };

  it('guarda asesinatos, muertes y asistencias de cada participación', () => {
    const [p] = extraerParticipaciones(conKda(7, 2, 11), linea, objetos);
    expect(p).toMatchObject({ asesinatos: 7, muertes: 2, asistencias: 11 });
  });

  it('sin los tres datos (partidas antiguas o incompletas) no guarda ninguno', () => {
    const [sin] = extraerParticipaciones(partida, linea, objetos);
    expect(sin).not.toHaveProperty('asesinatos');
    const [incompleta] = extraerParticipaciones(conKda(7, undefined, 11), linea, objetos);
    expect(incompleta).not.toHaveProperty('asesinatos');
    expect(incompleta).not.toHaveProperty('muertes');
  });
});

describe('extraerParticipaciones: fase de líneas (minuto 14)', () => {
  const conFrames = (frames: LineaTiempoRiot['info']['frames']): LineaTiempoRiot => ({ info: { frames: [...linea.info.frames, ...frames] } });
  const pf = (oro: number, cs: number, jungla: number, xp: number) => ({ '1': { totalGold: oro, minionsKilled: cs, jungleMinionsKilled: jungla, xp } });

  it('guarda oro, CS (súbditos y monstruos) y experiencia del frame del minuto 14', () => {
    const l = conFrames([
      { timestamp: 780050, events: [], participantFrames: pf(4000, 90, 0, 5000) },
      { timestamp: 840120, events: [], participantFrames: pf(5100, 110, 8, 6400) },
      { timestamp: 900200, events: [], participantFrames: pf(5800, 125, 8, 7000) },
    ]);
    const [p] = extraerParticipaciones(partida, l, objetos);
    expect(p!.minuto14).toEqual({ oro: 5100, cs: 118, xp: 6400 });
  });

  it('si la partida acaba antes del minuto 14 (o falta el dato) no guarda nada', () => {
    const corta = conFrames([{ timestamp: 820000, events: [], participantFrames: pf(4900, 100, 0, 6000) }]);
    expect(extraerParticipaciones(partida, corta, objetos)[0]).not.toHaveProperty('minuto14');
    const sinOro = conFrames([{ timestamp: 840000, events: [], participantFrames: { '1': { xp: 6000, minionsKilled: 100 } } }]);
    expect(extraerParticipaciones(partida, sinOro, objetos)[0]).not.toHaveProperty('minuto14');
    expect(estadoEnMinuto(linea, 1)).toBeNull();
  });

  it('solo en clasificatoria (los modos sin roles no tienen fase de líneas)', () => {
    const l = conFrames([{ timestamp: 840000, events: [], participantFrames: pf(5000, 100, 0, 6000) }]);
    for (const p of extraerParticipaciones(partida, l, objetos, 'aram')) expect(p).not.toHaveProperty('minuto14');
  });
});

describe('extraerBans', () => {
  it('bloqueos de los dos equipos, sin -1 ni repetidos, y las claves de los campeones de la partida', () => {
    const copia = structuredClone(partida);
    copia.info.participants.forEach((p, i) => Object.assign(p, { championId: 100 + i }));
    copia.info.teams = [
      { teamId: 100, bans: [{ championId: 55 }, { championId: -1 }, { championId: 7 }] },
      { teamId: 200, bans: [{ championId: 7 }, { championId: 238 }] },
    ];
    const b = extraerBans(copia)!;
    expect(b).toMatchObject({ matchId: 'EUW1_7000000001', parche: '15.20', bans: [7, 55, 238] });
    expect(b.campeones).toContainEqual({ id: 100, nombre: copia.info.participants[0]!.championName });
  });

  it('sin `teams` no hay datos de bloqueos', () => {
    expect(extraerBans(partida)).toBeNull();
  });
});
