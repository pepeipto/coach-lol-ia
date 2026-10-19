import { describe, expect, it } from 'vitest';
import type { EntradaCampeon, Rol, Tier } from '@coach/shared';
import {
  construirFilas,
  filtrarFilas,
  normalizarBusqueda,
  ordenarFilas,
  siguienteOrden,
  type Fila,
} from '../src/renderer/principal/vistas/listaCampeones';
import type { CampeonDDragon } from '../src/shared/tiposApp';

const DD: CampeonDDragon[] = [
  { id: 'Ahri', nombre: 'Ahri', key: 103 },
  { id: 'Fiddlesticks', nombre: 'Fiddlesticks', key: 9 },
  { id: 'Kaisa', nombre: "Kai'Sa", key: 145 },
  { id: 'MonkeyKing', nombre: 'Wukong', key: 62 },
  { id: 'Nunu', nombre: 'Nunu y Willump', key: 20 },
];

function e(campeon: string, rol: Rol, tier: Tier, tasaVictoria: number, uso: number, partidas: number): EntradaCampeon {
  return { campeon, rol, tier, tasaVictoria, uso, partidas, datosLimitados: partidas < 30 };
}

const LISTA = [
  e('Ahri', 'MIDDLE', 'A', 0.52, 0.1, 900),
  e('FiddleSticks', 'JUNGLE', 'S', 0.54, 0.05, 400),
  e('Kaisa', 'BOTTOM', 'B', 0.49, 0.2, 2000),
  e('MonkeyKing', 'TOP', 'C', 0.47, 0.03, 120),
  e('MonkeyKing', 'JUNGLE', 'B', 0.51, 0.04, 300),
  e('Desconocido', 'TOP', 'S', 0.6, 0.1, 100),
];

const nombres = (filas: Fila[]) => filas.map((f) => `${f.campeon.id}${f.entrada ? '-' + f.entrada.rol : ''}`);

describe('construirFilas', () => {
  it('una fila por campeón y rol con datos, y una fila sin datos para el resto', () => {
    const filas = construirFilas(DD, LISTA);
    expect(nombres(filas).sort()).toEqual(
      ['Ahri-MIDDLE', 'Fiddlesticks-JUNGLE', 'Kaisa-BOTTOM', 'MonkeyKing-TOP', 'MonkeyKing-JUNGLE', 'Nunu'].sort(),
    );
  });

  it('empareja el campeón sin distinguir mayúsculas (FiddleSticks de Match-v5)', () => {
    const fila = construirFilas(DD, LISTA).find((f) => f.campeon.id === 'Fiddlesticks')!;
    expect(fila.entrada?.tier).toBe('S');
  });

  it('ignora entradas de campeones que no están en Data Dragon', () => {
    expect(nombres(construirFilas(DD, LISTA)).some((n) => n.startsWith('Desconocido'))).toBe(false);
  });

  it('sin lista del servidor, todos los campeones aparecen sin datos', () => {
    const filas = construirFilas(DD, null);
    expect(filas).toHaveLength(DD.length);
    expect(filas.every((f) => f.entrada === null)).toBe(true);
  });
});

describe('normalizarBusqueda', () => {
  it('quita tildes, mayúsculas, espacios y signos', () => {
    expect(normalizarBusqueda("Kai'Sa")).toBe('kaisa');
    expect(normalizarBusqueda('  Nunú y Willump ')).toBe('nunuywillump');
  });
});

describe('filtrarFilas', () => {
  const filas = construirFilas(DD, LISTA);

  it('busca por nombre en español o por id, sin tildes ni signos', () => {
    expect(nombres(filtrarFilas(filas, { busqueda: 'kaisa', rol: 'TODOS' }))).toEqual(['Kaisa-BOTTOM']);
    expect(nombres(filtrarFilas(filas, { busqueda: 'wuk', rol: 'TODOS' })).sort()).toEqual(['MonkeyKing-JUNGLE', 'MonkeyKing-TOP']);
    expect(nombres(filtrarFilas(filas, { busqueda: 'monkey', rol: 'TODOS' }))).toHaveLength(2);
    expect(filtrarFilas(filas, { busqueda: 'zzz', rol: 'TODOS' })).toEqual([]);
  });

  it('con un rol muestra los campeones con datos en ese rol y los que no tienen ningún dato', () => {
    expect(nombres(filtrarFilas(filas, { busqueda: '', rol: 'JUNGLE' })).sort()).toEqual(['Fiddlesticks-JUNGLE', 'MonkeyKing-JUNGLE', 'Nunu']);
  });
});

describe('ordenarFilas', () => {
  const filas = construirFilas(DD, LISTA);

  it('por tier (S primero) y, en empate, por victorias; los sin datos siempre al final', () => {
    expect(nombres(ordenarFilas(filas, { clave: 'tier', direccion: 'desc' }))).toEqual([
      'Fiddlesticks-JUNGLE',
      'Ahri-MIDDLE',
      'MonkeyKing-JUNGLE',
      'Kaisa-BOTTOM',
      'MonkeyKing-TOP',
      'Nunu',
    ]);
    const asc = nombres(ordenarFilas(filas, { clave: 'tier', direccion: 'asc' }));
    expect(asc[0]).toBe('MonkeyKing-TOP');
    expect(asc.at(-1)).toBe('Nunu');
  });

  it('por victorias, uso y partidas', () => {
    expect(nombres(ordenarFilas(filas, { clave: 'tasaVictoria', direccion: 'desc' }))[0]).toBe('Fiddlesticks-JUNGLE');
    expect(nombres(ordenarFilas(filas, { clave: 'uso', direccion: 'desc' }))[0]).toBe('Kaisa-BOTTOM');
    expect(nombres(ordenarFilas(filas, { clave: 'partidas', direccion: 'asc' }))[0]).toBe('MonkeyKing-TOP');
  });

  it('por nombre en español', () => {
    expect(nombres(ordenarFilas(filas, { clave: 'nombre', direccion: 'asc' })).slice(0, 3)).toEqual(['Ahri-MIDDLE', 'Fiddlesticks-JUNGLE', 'Kaisa-BOTTOM']);
  });

  it('no modifica la lista original', () => {
    const copia = [...filas];
    ordenarFilas(filas, { clave: 'uso', direccion: 'asc' });
    expect(filas).toEqual(copia);
  });
});

describe('siguienteOrden', () => {
  it('la misma columna invierte la dirección; otra empieza de mayor a menor (el nombre, de la A a la Z)', () => {
    expect(siguienteOrden({ clave: 'tier', direccion: 'desc' }, 'tier')).toEqual({ clave: 'tier', direccion: 'asc' });
    expect(siguienteOrden({ clave: 'tier', direccion: 'asc' }, 'uso')).toEqual({ clave: 'uso', direccion: 'desc' });
    expect(siguienteOrden({ clave: 'tier', direccion: 'desc' }, 'nombre')).toEqual({ clave: 'nombre', direccion: 'asc' });
  });
});
