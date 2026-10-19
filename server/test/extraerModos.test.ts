import { describe, it, expect } from 'vitest';
import type { ItemDDragonCrudo } from '@coach/shared';
import { extraerParticipaciones, extraerParticipacionesArena } from '../src/extraer';
import type { PartidaRiot, LineaTiempoRiot, ParticipanteRiot } from '../src/riot/riotApi';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const base = partidaJson as unknown as PartidaRiot;
const linea = lineaJson as unknown as LineaTiempoRiot;
const objetos: Record<number, ItemDDragonCrudo> = {
  1001: { gold: { total: 300, purchasable: true }, tags: ['Boots'], into: ['3020'] },
  3020: { gold: { total: 1100, purchasable: true }, tags: ['Boots'], from: ['1001'] },
  6655: { gold: { total: 2900, purchasable: true }, maps: { '11': true } },
  3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } },
};

function conCola(queueId: number, extra: Partial<ParticipanteRiot>[] = []): PartidaRiot {
  const p = structuredClone(base);
  p.info.queueId = queueId;
  p.info.participants = p.info.participants.map((x, i) => ({ ...x, teamPosition: '', ...(extra[i] ?? {}) }));
  return p;
}

describe('extraerParticipaciones en ARAM y ARAM: Caos', () => {
  it('ARAM: todos los participantes, sin rol, con modo aram y sin aumentos', () => {
    const ps = extraerParticipaciones(conCola(450), linea, objetos, 'aram');
    expect(ps.length).toBe(base.info.participants.length);
    expect(ps.every((p) => p.rol === null && p.modo === 'aram')).toBe(true);
    expect(ps[0].aumentos).toBeUndefined();
    expect(ps.find((p) => p.campeon === 'Ahri')!.compras).toEqual([6655, 3020, 3089]);
  });

  it('ARAM: Caos: los aumentos de playerAugment1..6 distintos de 0, en orden', () => {
    const ps = extraerParticipaciones(
      conCola(2400, [{ playerAugment1: 1205, playerAugment2: 0, playerAugment3: 1141, playerAugment6: 1327 }]),
      linea,
      objetos,
      'caos',
    );
    expect(ps[0].modo).toBe('caos');
    expect(ps[0].aumentos).toEqual([1205, 1141, 1327]);
    expect(ps[1].aumentos).toEqual([]);
  });

  it('clasificatoria sigue igual: solo con teamPosition y sin modo explícito distinto', () => {
    const ps = extraerParticipaciones(base, linea, objetos);
    expect(ps).toHaveLength(1);
    expect(ps[0].rol).toBe('MIDDLE');
    expect(ps[0].modo).toBe('clasificatoria');
  });
});

describe('extraerParticipacionesArena', () => {
  const partida = conCola(1700, [
    { placement: 1, playerSubteamId: 3, playerAugment1: 10, playerAugment2: 20, item0: 3089, item1: 0, item2: 6655, item3: 3089, item6: 3340 } as Partial<ParticipanteRiot>,
    { placement: 0, subteamPlacement: 6, playerAugment1: 10 },
  ]);
  const ps = extraerParticipacionesArena(partida);

  it('sin línea de tiempo: puesto, aumentos y objetos finales (sin abalorio ni repetidos)', () => {
    expect(ps[0]).toMatchObject({
      modo: 'arena',
      rol: null,
      posicion: 1,
      victoria: true,
      aumentos: [10, 20],
      compras: [3089, 6655],
      habilidades: [],
      iniciales: [],
    });
  });

  it('sin placement usa subteamPlacement; victoria solo con el 1.er puesto', () => {
    expect(ps[1].posicion).toBe(6);
    expect(ps[1].victoria).toBe(false);
  });

  it('descarta a quien no tiene un puesto válido', () => {
    const sinPuesto = conCola(1700, [{ placement: 0 }, { placement: 9 }]);
    sinPuesto.info.participants = sinPuesto.info.participants.slice(0, 2);
    expect(extraerParticipacionesArena(sinPuesto)).toEqual([]);
  });

  it('runas vacías si no hay página de runas', () => {
    const sinRunas = conCola(1700, [{ placement: 2, perks: { statPerks: { offense: 0, flex: 0, defense: 0 }, styles: [] } }]);
    expect(extraerParticipacionesArena(sinRunas)[0].runas).toEqual({ estiloPrincipal: 0, estiloSecundario: 0, runas: [] });
  });
});

describe('KDA por modo', () => {
  it('ARAM, ARAM: Caos y Arena guardan asesinatos, muertes y asistencias', () => {
    const kda = { kills: 7, deaths: 4, assists: 12 } as Partial<ParticipanteRiot>;
    for (const modo of ['aram', 'caos'] as const) {
      const ps = extraerParticipaciones(conCola(modo === 'aram' ? 450 : 2400, [kda]), linea, objetos, modo);
      expect(ps[0]).toMatchObject({ asesinatos: 7, muertes: 4, asistencias: 12 });
    }
    const arena = extraerParticipacionesArena(conCola(1700, [{ ...kda, placement: 2 }]));
    expect(arena[0]).toMatchObject({ asesinatos: 7, muertes: 4, asistencias: 12, posicion: 2 });
  });
});
