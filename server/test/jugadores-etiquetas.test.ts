import { describe, expect, it } from 'vitest';
import { etiquetasDe, TEXTO_RACHA, textoEspecialista } from '../src/jugadores/etiquetas';
import { RASGOS_POR_ETIQUETA, rasgosDe, TEXTO_DIFICULTAD_ALTA } from '../src/jugadores/rasgos';

const base = { campeon: 'Ahri', maestria: null, rango: null, tags: [] as string[], dificultad: 5 };
const rango = (victorias: number, derrotas: number) => ({ tier: 'GOLD', division: 'II', lp: 50, victorias, derrotas });

describe('etiquetas de la pantalla de carga', () => {
  it('maestría ≥ 100k → «Especialista en <campeón>» (positivo)', () => {
    expect(etiquetasDe({ ...base, maestria: { nivel: 10, puntos: 100_000 } })).toEqual([
      { tipo: 'positivo', texto: 'Especialista en Ahri', clave: 'carga.etiqueta.especialista', params: { campeon: 'Ahri' } },
    ]);
  });

  it('poca maestría (nivel ≤ 2 o 0 puntos) no pone ninguna etiqueta: nunca se señala a otro jugador por ello', () => {
    expect(etiquetasDe({ ...base, maestria: { nivel: 2, puntos: 3000 } })).toEqual([]);
    expect(etiquetasDe({ ...base, maestria: { nivel: 0, puntos: 0 } })).toEqual([]);
    expect(etiquetasDe({ ...base, maestria: { nivel: 5, puntos: 40_000 } })).toEqual([]);
  });

  it('sin datos de maestría (error al consultar) no se supone nada', () => {
    expect(etiquetasDe(base)).toEqual([]);
  });

  it('≥ 55 % de victorias con ≥ 20 partidas → «Racha positiva esta temporada»', () => {
    expect(etiquetasDe({ ...base, rango: rango(11, 9) })).toEqual([{ tipo: 'positivo', texto: TEXTO_RACHA, clave: 'carga.etiqueta.racha' }]);
    expect(etiquetasDe({ ...base, rango: rango(10, 9) })).toEqual([]); // 19 partidas
    expect(etiquetasDe({ ...base, rango: rango(54, 46) })).toEqual([]); // 54 %
  });

  it('añade los rasgos neutros del campeón', () => {
    expect(etiquetasDe({ ...base, tags: ['Assassin', 'Mage'], dificultad: 9 })).toEqual([
      { tipo: 'neutro', texto: 'Fuerte al principio', clave: 'carga.rasgo.Assassin' },
      { tipo: 'neutro', texto: TEXTO_DIFICULTAD_ALTA, clave: 'carga.rasgo.dificil' },
    ]);
  });

  it('rasgosDe usa la primera etiqueta conocida y la dificultad', () => {
    expect(rasgosDe(['Desconocida', 'Marksman'], 3)).toEqual(['Escala a final de partida']);
    expect(rasgosDe([], 8)).toEqual([TEXTO_DIFICULTAD_ALTA]);
    expect(rasgosDe([], 7)).toEqual([]);
  });
});

describe('políticas de Riot: ninguna etiqueta avergüenza a un jugador', () => {
  const PROHIBIDAS = ['malo', 'mala', 'troll', 'inting', 'int', 'noob', 'manco', 'feeder', 'feed', 'peor', 'tóxico', 'toxico', 'mmr', 'elo', 'poca', 'poco', 'experiencia', 'novato', 'nuevo'];
  const todas = [
    textoEspecialista('Ahri'),
    TEXTO_RACHA,
    TEXTO_DIFICULTAD_ALTA,
    ...Object.values(RASGOS_POR_ETIQUETA),
  ];

  it.each(todas)('«%s» no contiene palabras prohibidas', (texto) => {
    const palabras = texto.toLowerCase().split(/[^a-záéíóúüñ]+/);
    for (const p of PROHIBIDAS) expect(palabras).not.toContain(p);
  });

  it('el tipo de cada etiqueta posible es positivo, neutro o informativo', () => {
    const muestras = [
      etiquetasDe({ ...base, maestria: { nivel: 10, puntos: 500_000 }, rango: rango(30, 10), tags: ['Tank'], dificultad: 10 }),
      etiquetasDe({ ...base, maestria: { nivel: 1, puntos: 0 }, rango: rango(0, 30), tags: ['Support'], dificultad: 1 }),
    ].flat();
    for (const e of muestras) expect(['positivo', 'neutro', 'info']).toContain(e.tipo);
    for (const e of muestras) expect(e.clave).not.toBe('carga.etiqueta.pocaExperiencia');
  });
});
