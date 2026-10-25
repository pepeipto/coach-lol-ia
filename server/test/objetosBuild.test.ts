import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemDDragonCrudo, ModoJuego } from '@coach/shared';
import { calcularBuilds, objetosDeModo } from '../src/agregador';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';
import {
  calcularRendimiento,
  calcularTiempos,
  hitosDe,
  mediana,
  MIN_PARTIDAS_TIEMPOS,
  PARTIDAS_FIABLES_RENDIMIENTO,
  SUAVIZADO_RENDIMIENTO,
} from '../src/objetosBuild';

const OBJETOS: Record<number, ItemDDragonCrudo> = {
  1056: { gold: { total: 400, purchasable: true }, into: [] },
  3020: { gold: { total: 1100, purchasable: true }, tags: ['Boots'], from: ['1001'] },
  6655: { gold: { total: 2900, purchasable: true } },
  3157: { gold: { total: 3000, purchasable: true } },
  3089: { gold: { total: 3500, purchasable: true } },
  3135: { gold: { total: 3000, purchasable: true } },
};

let n = 0;
function p(extra: Partial<Participacion> = {}, modo: ModoJuego = 'clasificatoria'): Participacion {
  return {
    matchId: `M${n++}`,
    campeon: 'Ahri',
    rol: modo === 'clasificatoria' ? 'MIDDLE' : null,
    modo,
    victoria: true,
    parche: '15.20',
    runas: { estiloPrincipal: 8100, estiloSecundario: 8200, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056],
    compras: [6655, 3020, 3157, 3089],
    minutosCompras: [10, 13, 18, 24],
    habilidades: ['Q', 'W', 'E'],
    ...extra,
  };
}
const varias = (k: number, extra: Partial<Participacion> = {}, modo?: ModoJuego) => Array.from({ length: k }, () => p(extra, modo));
const tipo = (id: number) => (id === 3020 ? 'botas' : OBJETOS[id] && id !== 1056 ? 'legendario' : 'otro') as 'botas' | 'legendario' | 'otro';

describe('mediana', () => {
  it('impar, par (media de los dos centrales) y con un decimal', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([10.04, 10.06])).toBe(10.1);
    expect(mediana([])).toBeNull();
  });
});

describe('hitosDe', () => {
  it('1.º, 2.º y 3.er legendario y las primeras botas, por su minuto', () => {
    expect(hitosDe(p(), tipo)).toEqual({ objeto1: 10, botas: 13, objeto2: 18, objeto3: 24 });
  });
  it('solo los hitos alcanzados; sin minutos (partida antigua) o con longitudes distintas, null', () => {
    expect(hitosDe(p({ compras: [3020, 6655], minutosCompras: [8, 12] }), tipo)).toEqual({ botas: 8, objeto1: 12 });
    expect(hitosDe(p({ minutosCompras: undefined }), tipo)).toBeNull();
    expect(hitosDe(p({ minutosCompras: [1, 2] }), tipo)).toBeNull();
  });
});

describe('calcularTiempos (mejora 11)', () => {
  it('medianas de todas y de las ganadas, con 30 partidas o más con cada hito', () => {
    const ps = [
      ...varias(30, { victoria: true, minutosCompras: [10, 13, 18, 24] }),
      ...varias(30, { victoria: false, minutosCompras: [14, 15, 22, 30] }),
    ];
    const t = calcularTiempos(ps, OBJETOS, 11)!;
    expect(t.partidas).toBe(60);
    expect(t.ganadas).toEqual({ objeto1: 10, objeto2: 18, objeto3: 24, botas: 13 });
    expect(t.todas).toEqual({ objeto1: 12, objeto2: 20, objeto3: 27, botas: 14 });
  });

  it(`un hito con menos de ${MIN_PARTIDAS_TIEMPOS} partidas no se publica (null); las ganadas pueden no llegar`, () => {
    const ps = [
      ...varias(20, { victoria: true }),
      ...varias(15, { victoria: false, compras: [6655, 3020], minutosCompras: [11, 12] }),
    ];
    const t = calcularTiempos(ps, OBJETOS, 11)!;
    expect(t.todas.objeto1).toBe(10);
    expect(t.todas.botas).toBe(13);
    expect(t.todas.objeto2).toBeNull(); // solo 20 partidas llegan al 2.º objeto
    expect(t.ganadas).toEqual({ objeto1: null, objeto2: null, objeto3: null, botas: null });
  });

  it('las partidas sin minuto de compras (guardadas antes de la 3.10) no cuentan; sin ningún hito, null', () => {
    expect(calcularTiempos(varias(100, { minutosCompras: undefined }), OBJETOS, 11)).toBeNull();
    const t = calcularTiempos([...varias(29), ...varias(50, { minutosCompras: undefined })], OBJETOS, 11);
    expect(t).toBeNull();
  });
});

describe('calcularRendimiento (mejora 13)', () => {
  it('uso, % de victorias suavizado y diferencia frente a no completarlo', () => {
    // 100 partidas, 50 % de victorias. 3135 en 40 (30 ganadas); las otras 60 ganan 20.
    const ps = [
      ...varias(30, { victoria: true, compras: [6655, 3135] }),
      ...varias(10, { victoria: false, compras: [6655, 3135] }),
      ...varias(20, { victoria: true, compras: [6655, 3157] }),
      ...varias(40, { victoria: false, compras: [6655, 3157] }),
    ];
    const r = calcularRendimiento(ps, OBJETOS, 11);
    const K = SUAVIZADO_RENDIMIENTO;
    const con = (30 + K * 0.5) / (40 + K);
    const sin = (20 + K * 0.5) / (60 + K);
    const x = r.find((o) => o.id === 3135)!;
    expect(x).toEqual({
      id: 3135,
      partidas: 40,
      uso: 0.4,
      tasaVictoria: Math.round(con * 10000) / 10000,
      diferencia: Math.round((con - sin) * 1000) / 10,
      datosLimitados: true,
    });
    expect(x.diferencia).toBeGreaterThan(0);
    expect(r.find((o) => o.id === 3157)!.diferencia).toBeLessThan(0);
    // De más a menos usado; 6655 está en todas: no hay partidas sin él con las que comparar.
    expect(r.map((o) => o.id)).toEqual([6655, 3157, 3135]);
    expect(r[0]).toMatchObject({ uso: 1, diferencia: null, datosLimitados: false, tasaVictoria: 0.5 });
  });

  it(`solo legendarios en el 5 % o más de las partidas (y al menos 10); «datos limitados» por debajo de ${PARTIDAS_FIABLES_RENDIMIENTO}`, () => {
    const ps = [...varias(180, { compras: [6655, 3157] }), ...varias(12, { compras: [3089, 3020] }), ...varias(8, { compras: [3135] })];
    const r = calcularRendimiento(ps, OBJETOS, 11);
    const ids = r.map((o) => o.id);
    expect(ids).not.toContain(3020); // botas: no son legendarios
    expect(ids).not.toContain(3135); // 4 %
    expect(ids).toContain(3089); // 6 %
    expect(r.find((o) => o.id === 3089)!.datosLimitados).toBe(true);
    expect(r.find((o) => o.id === 6655)!.datosLimitados).toBe(false);
    expect(calcularRendimiento([], OBJETOS, 11)).toEqual([]);
  });
});

describe('objetosDeModo y calcularBuilds', () => {
  it('solo clasificatoria y ARAM; nunca Arena (norma de Riot), ni ARAM: Caos', () => {
    const ps = varias(40);
    expect(objetosDeModo('clasificatoria', ps, OBJETOS)).toHaveProperty('rendimientoObjetos');
    expect(objetosDeModo('aram', varias(40, {}, 'aram'), OBJETOS)).toHaveProperty('tiempos');
    expect(objetosDeModo('arena', ps, OBJETOS)).toEqual({});
    expect(objetosDeModo('caos', ps, OBJETOS)).toEqual({});
  });

  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('la build guardada de clasificatoria y la de ARAM los llevan arriba (no en cada opción); la de Arena no', () => {
    db.guardarParticipaciones('EUW', [
      ...varias(40),
      ...varias(40, {}, 'aram'),
      ...varias(12, { posicion: 1, compras: [3089], minutosCompras: undefined, habilidades: [] }, 'arena'),
    ]);
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    const grieta = db.build('Ahri', 'MIDDLE')!;
    expect(grieta.tiempos?.todas).toEqual({ objeto1: 10, objeto2: 18, objeto3: 24, botas: 13 });
    expect(grieta.rendimientoObjetos?.map((o) => o.id)).toEqual([3089, 3157, 6655]);
    for (const o of grieta.opciones ?? []) {
      expect(o).not.toHaveProperty('tiempos');
      expect(o).not.toHaveProperty('rendimientoObjetos');
    }
    expect(db.build('Ahri', null, 'aram')!.tiempos?.partidas).toBe(40);
    const arena = db.build('Ahri', null, 'arena')!;
    expect(arena).not.toHaveProperty('rendimientoObjetos');
    expect(arena).not.toHaveProperty('tiempos');
  });
});
