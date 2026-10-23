import { describe, expect, it } from 'vitest';
import sesion from './fixtures/sesionSeleccion.json';
import { interpretarSeleccion } from '../src/main/lcu/seleccion';

const con = (celda: number) => ({ ...sesion, localPlayerCellId: celda });

describe('interpretarSeleccion', () => {
  it('campeón fijado', () => {
    expect(interpretarSeleccion(sesion)).toEqual({ campeonId: 103, rol: 'MIDDLE' });
  });
  it('intención sin fijar', () => {
    expect(interpretarSeleccion(con(1))).toEqual({ campeonId: 64, rol: 'JUNGLE' });
  });
  it('sin elegir devuelve null', () => {
    expect(interpretarSeleccion(con(3))).toBeNull();
  });
  it('a ciegas sin posición asignada', () => {
    const ciegas = { localPlayerCellId: 0, myTeam: [{ cellId: 0, championId: 22, championPickIntent: 0, assignedPosition: '' }] };
    expect(interpretarSeleccion(ciegas)).toEqual({ campeonId: 22, rol: null });
  });
  it('con queueId de un modo con datos añade el modo (ARAM: Caos 2400, Arena 1700)', () => {
    expect(interpretarSeleccion({ ...sesion, queueId: 2400 })).toEqual({ campeonId: 103, rol: 'MIDDLE', modo: 'caos' });
    expect(interpretarSeleccion({ ...sesion, queueId: 1700 })?.modo).toBe('arena');
    // 3.8: una cola que no es de los cuatro modos (URF 900, normal 400) viaja tal cual, sin modo.
    expect(interpretarSeleccion({ ...sesion, queueId: 900 })).toEqual({ campeonId: 103, rol: 'MIDDLE', cola: 900 });
    expect(interpretarSeleccion({ ...sesion, queueId: 400 })).toEqual({ campeonId: 103, rol: 'MIDDLE', cola: 400 });
    expect(interpretarSeleccion({ ...sesion, queueId: 0 })).toEqual({ campeonId: 103, rol: 'MIDDLE' });
  });
  it('entrada inválida devuelve null', () => {
    expect(interpretarSeleccion(null)).toBeNull();
    expect(interpretarSeleccion({})).toBeNull();
    expect(interpretarSeleccion(con(99))).toBeNull();
  });
});
