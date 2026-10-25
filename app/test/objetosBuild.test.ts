import { describe, expect, it } from 'vitest';
import type { Build, RendimientoObjeto } from '@coach/shared';
import {
  minutoGanadas,
  minutoObjetivo,
  ORDEN_RENDIMIENTO_POR_DEFECTO,
  ordenarRendimiento,
  rendimientoDe,
  siguienteOrdenRendimiento,
  tiemposDe,
} from '../src/shared/objetosBuild';
import { buildElegida } from '../src/shared/opciones';

const r = (id: number, uso: number, tasaVictoria: number, diferencia: number | null): RendimientoObjeto => ({
  id,
  partidas: Math.round(uso * 200),
  uso,
  tasaVictoria,
  diferencia,
  datosLimitados: false,
});
const tiempos = { ganadas: { objeto1: 11, objeto2: null, objeto3: null, botas: 14.4 }, todas: { objeto1: 12, objeto2: 19, objeto3: null, botas: 15 }, partidas: 120 };
const base = { campeon: 'Ahri', rol: 'MIDDLE', nucleo: [], tiempos, rendimientoObjetos: [r(3157, 0.4, 0.55, 2.1)] } as unknown as Build;

describe('tiemposDe / minutoObjetivo', () => {
  it('valida y conserva los hitos; el objetivo es el de las ganadas y, sin él, el de todas', () => {
    const t = tiemposDe(base)!;
    expect(t).toEqual(tiempos);
    expect(minutoObjetivo(t, 'objeto1')).toBe(11);
    expect(minutoObjetivo(t, 'objeto2')).toBe(19);
    expect(minutoObjetivo(t, 'objeto3')).toBeNull();
    expect(minutoGanadas(t, 'objeto2')).toBeNull();
  });
  it('mal formados, de Arena o vacíos: null; cifras raras de un hito se descartan', () => {
    expect(tiemposDe({ ...base, tiempos: 'x' } as unknown as Build)).toBeNull();
    expect(tiemposDe({ ...base, modo: 'arena' } as Build)).toBeNull();
    expect(tiemposDe(null)).toBeNull();
    const raro = { ...base, tiempos: { ...tiempos, ganadas: { objeto1: -3, objeto2: 'x', objeto3: null, botas: 14 } } } as unknown as Build;
    expect(tiemposDe(raro)!.ganadas).toEqual({ objeto1: null, objeto2: null, objeto3: null, botas: 14 });
  });
});

describe('rendimientoDe (nunca en Arena)', () => {
  it('filtra filas mal formadas y quita campos de más', () => {
    const b = { ...base, rendimientoObjetos: [r(1, 0.2, 0.5, null), { id: 2, uso: 3 }, { ...r(3, 0.1, 0.6, 1), extra: 1 }] } as unknown as Build;
    expect(rendimientoDe(b).map((o) => o.id)).toEqual([1, 3]);
    expect(rendimientoDe(b)[1]).not.toHaveProperty('extra');
  });
  it('una build de Arena (por modo o por cifras) siempre vacía', () => {
    expect(rendimientoDe({ ...base, modo: 'arena' } as Build)).toEqual([]);
    expect(rendimientoDe({ ...base, arena: { posicionMedia: 4, top4: 0.5, victorias: 0.1 } } as Build)).toEqual([]);
  });
});

describe('ordenarRendimiento', () => {
  const lista = [r(1, 0.3, 0.52, -1.5), r(2, 0.6, 0.5, null), r(3, 0.1, 0.58, 3.2)];
  it('por uso (por defecto), por % de victorias y por diferencia (sin diferencia, al final)', () => {
    expect(ordenarRendimiento(lista, ORDEN_RENDIMIENTO_POR_DEFECTO).map((o) => o.id)).toEqual([2, 1, 3]);
    expect(ordenarRendimiento(lista, { clave: 'tasaVictoria', direccion: 'desc' }).map((o) => o.id)).toEqual([3, 1, 2]);
    expect(ordenarRendimiento(lista, { clave: 'diferencia', direccion: 'desc' }).map((o) => o.id)).toEqual([3, 1, 2]);
    expect(ordenarRendimiento(lista, { clave: 'diferencia', direccion: 'asc' }).map((o) => o.id)).toEqual([1, 3, 2]);
  });
  it('pulsar la misma columna invierte; otra empieza de mayor a menor', () => {
    expect(siguienteOrdenRendimiento({ clave: 'uso', direccion: 'desc' }, 'uso')).toEqual({ clave: 'uso', direccion: 'asc' });
    expect(siguienteOrdenRendimiento({ clave: 'uso', direccion: 'asc' }, 'diferencia')).toEqual({ clave: 'diferencia', direccion: 'desc' });
  });
});

describe('buildElegida: los datos de objetos del campeón pasan a la opción elegida', () => {
  it('la opción sin tiempos ni rendimiento hereda los de la build de arriba', () => {
    const opcion = { campeon: 'Ahri', rol: 'MIDDLE', nucleo: [1, 2, 3] } as unknown as Build;
    const b = buildElegida({ ...base, opciones: [opcion] }, 0);
    expect(b.nucleo).toEqual([1, 2, 3]);
    expect(b.tiempos).toEqual(tiempos);
    expect(b.rendimientoObjetos).toEqual(base.rendimientoObjetos);
  });
  it('sin nada que heredar, la opción tal cual', () => {
    const opcion = { campeon: 'Ahri', rol: 'MIDDLE', nucleo: [1] } as unknown as Build;
    const arriba = { campeon: 'Ahri', rol: 'MIDDLE', nucleo: [], opciones: [opcion] } as unknown as Build;
    expect(buildElegida(arriba, 0)).toBe(opcion);
  });
});
