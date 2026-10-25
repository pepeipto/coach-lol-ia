import { describe, expect, it } from 'vitest';
import { normalizarDesglose, normalizarFicha, RUTAS_FICHA, type FichaCampeon } from '../src';

const FICHA: FichaCampeon = {
  campeon: 'Ahri',
  idioma: 'es',
  claves: ['Maga de ráfaga con mucha movilidad.', 'Su definitiva tiene tres cargas.', 'Su encanto es su habilidad clave.'],
  fortalezas: ['Mucha movilidad', 'Buen daño a distancia', 'Fácil de rematar'],
  debilidades: ['Frágil', 'Depende de acertar el encanto', 'Sufre contra rivales de mucho alcance'],
  parecidos: ['Lux', 'Syndra', 'Orianna', 'Zoe'],
  danio: { fisico: 0.05, magico: 0.9, verdadero: 0.05 },
  generadoEn: '2026-10-25T10:00:00.000Z',
};

describe('contrato de la ficha del campeón', () => {
  it('la ruta lleva el campeón y el idioma', () => {
    expect(RUTAS_FICHA.ficha('MonkeyKing', 'pt-BR')).toBe('/ficha/MonkeyKing?idioma=pt-BR');
  });

  it('acepta una ficha bien formada tal cual', () => {
    expect(normalizarFicha(FICHA)).toEqual(FICHA);
  });

  it('rechaza bloques con menos frases de las mínimas, idiomas raros y parecidos insuficientes', () => {
    expect(normalizarFicha({ ...FICHA, claves: ['Una', 'Dos'] })).toBeNull();
    expect(normalizarFicha({ ...FICHA, idioma: 'it' })).toBeNull();
    expect(normalizarFicha({ ...FICHA, parecidos: ['Lux', 'Ahri', 'lux', '../x'] })).toBeNull();
    expect(normalizarFicha({ ...FICHA, campeon: '../../etc' })).toBeNull();
  });

  it('recorta los bloques a su máximo, quita duplicados y el propio campeón, y descarta un desglose raro', () => {
    const f = normalizarFicha({
      ...FICHA,
      fortalezas: ['a', 'b', 'c', 'd', 'e'],
      parecidos: ['Lux', 'Ahri', 'Lux', 'Syndra', 'Zoe', 'Orianna', 'Veigar', 'Annie', 'Brand'],
      danio: { fisico: 0.5, magico: 0.9, verdadero: 0 },
    });
    expect(f?.fortalezas).toEqual(['a', 'b', 'c', 'd']);
    expect(f?.parecidos).toEqual(['Lux', 'Syndra', 'Zoe', 'Orianna', 'Veigar', 'Annie']);
    expect(f?.danio).toBeUndefined();
  });

  it('el desglose debe sumar 1', () => {
    expect(normalizarDesglose({ fisico: 0.88, magico: 0.09, verdadero: 0.03 })).toEqual({ fisico: 0.88, magico: 0.09, verdadero: 0.03 });
    expect(normalizarDesglose({ fisico: 0.5, magico: 0.1, verdadero: 0.1 })).toBeNull();
    expect(normalizarDesglose({ fisico: -1, magico: 1, verdadero: 1 })).toBeNull();
  });
});
