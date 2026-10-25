import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Build, ItemDDragonCrudo, ModoJuego } from '@coach/shared';
import { calcularBuilds, cambioTasaVictoria, MIN_PARTIDAS_CAMBIO } from '../src/agregador';
import { listaCampeones } from '../src/campeones';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';

const OBJETOS: Record<number, ItemDDragonCrudo> = {};
let n = 0;
function p(parche: string, victoria: boolean, modo: ModoJuego = 'clasificatoria', extra: Partial<Participacion> = {}): Participacion {
  return {
    matchId: `C${n++}`,
    campeon: 'Ahri',
    rol: modo === 'clasificatoria' ? 'MIDDLE' : null,
    modo,
    victoria,
    parche,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8200, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [],
    compras: [],
    habilidades: [],
    ...extra,
  };
}
/** `total` partidas de un parche con `ganadas` victorias. */
const lote = (parche: string, total: number, ganadas: number, modo: ModoJuego = 'clasificatoria', extra: Partial<Participacion> = {}) =>
  Array.from({ length: total }, (_, i) => p(parche, i < ganadas, modo, extra));

describe('cambioTasaVictoria (parche actual − anterior, en puntos porcentuales)', () => {
  it('resta las tasas y redondea a una décima', () => {
    expect(cambioTasaVictoria(lote('15.20', 200, 104), lote('15.19', 200, 100))).toBe(2);
    expect(cambioTasaVictoria(lote('15.20', 250, 126), lote('15.19', 200, 100))).toBe(0.4);
    expect(cambioTasaVictoria(lote('15.20', 100, 45), lote('15.19', 100, 52))).toBe(-7);
  });

  it(`sin ${MIN_PARTIDAS_CAMBIO} partidas en cada parche no hay cambio`, () => {
    expect(cambioTasaVictoria(lote('15.20', MIN_PARTIDAS_CAMBIO - 1, 30), lote('15.19', 200, 100))).toBeUndefined();
    expect(cambioTasaVictoria(lote('15.20', 200, 100), lote('15.19', MIN_PARTIDAS_CAMBIO - 1, 20))).toBeUndefined();
    expect(cambioTasaVictoria(lote('15.20', MIN_PARTIDAS_CAMBIO, 30), lote('15.19', MIN_PARTIDAS_CAMBIO, 25))).toBe(10);
  });
});

describe('calcularBuilds publica el cambio en la build y en /campeones', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('clasificatoria: parche contra parche aunque la build mezcle los dos', () => {
    db.guardarParticipaciones('EUW', [...lote('15.20', 100, 55), ...lote('15.19', 100, 50)]);
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    const b = db.build('Ahri', 'MIDDLE')!;
    expect(b.mezclaParches).toBe(true);
    expect(b.cambioTasaVictoria).toBe(5);
    const e = listaCampeones(db.builds()).campeones.find((c) => c.campeon === 'Ahri');
    expect(e?.cambioTasaVictoria).toBe(5);
  });

  it('ARAM: Caos también; Arena no (allí la «victoria» es el 1.er puesto)', () => {
    db.guardarParticipaciones('EUW', [
      ...lote('15.20', 60, 33, 'caos', { aumentos: [1] }),
      ...lote('15.19', 60, 30, 'caos', { aumentos: [1] }),
      ...lote('15.20', 60, 10, 'arena', { posicion: 3 }),
      ...lote('15.19', 60, 5, 'arena', { posicion: 3 }),
    ]);
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    expect(db.build('Ahri', null, 'caos')!.cambioTasaVictoria).toBe(5);
    expect(db.build('Ahri', null, 'arena')).not.toHaveProperty('cambioTasaVictoria');
  });

  it('sin datos suficientes del parche anterior, ni build ni lista llevan el campo', () => {
    db.guardarParticipaciones('EUW', [...lote('15.20', 200, 100), ...lote('15.19', 10, 5)]);
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    expect(db.build('Ahri', 'MIDDLE')).not.toHaveProperty('cambioTasaVictoria');
    const [e] = listaCampeones([{ campeon: 'Ahri', rol: 'MIDDLE', parche: '15.20', partidas: 50, tasaVictoria: 0.5 } as Build]).campeones;
    expect(e).not.toHaveProperty('cambioTasaVictoria');
  });
});
