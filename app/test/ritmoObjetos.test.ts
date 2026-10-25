import { describe, expect, it } from 'vitest';
import type { Build, TiemposObjetivo } from '@coach/shared';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { resumenOverlay } from '../src/main/consejos/motor';
import { ReguladorVoz } from '../src/main/consejos/regulador';
import { DetectorRitmoObjetos, RETRASO_RITMO_MIN, RITMO_CADA_MS } from '../src/main/consejos/ritmoObjetos';
import { SelectorFijo, textosVariantes } from '../src/main/consejos/variantes';
import { DisparadorVoz, PRIORIDAD_VOZ } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { t } from '../src/shared/i18n';
import { vozEnPartida } from '../src/shared/modosOverlay';
import type { AjustesVoz, EstadoPartida } from '../src/shared/tiposApp';
import { CATEGORIAS_NIVEL, GRUPOS_VOZ, tiposDeNivel } from '../src/shared/vozCategorias';

/* 3.10 · Ritmo de objetos (mejora 11): aviso suave si tu 1.er o 2.º objeto va 3 min o más tarde que en las ganadas. */

const objetos = {
  1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true } },
  6655: { name: 'Tormento de Luden', gold: { total: 2900, purchasable: true } },
  3157: { name: 'Reloj de arena de Zhonya', gold: { total: 3250, purchasable: true } },
} as unknown as DatosEstaticos['objetos'];

const tiempos: TiemposObjetivo = {
  ganadas: { objeto1: 11, objeto2: 18, objeto3: 25, botas: 14 },
  todas: { objeto1: 12, objeto2: 20, objeto3: 27, botas: 15 },
  partidas: 400,
};
const build = { campeon: 'Ahri', rol: 'MIDDLE', nucleo: [6655, 3157], botas: null, situacionales: [], tiempos } as unknown as Build;

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return { tiempo: 60, oro: 0, nivel: 1, campeon: 'Ahri', objetos: [1056], habilidades: { Q: 1, W: 0, E: 0, R: 0 }, eventos: [], modo: 'clasificatoria', ...p };
}
const min = (m: number) => m * 60;

describe('DetectorRitmoObjetos', () => {
  it(`avisa del 1.er objeto a partir de mediana de ganadas + ${RETRASO_RITMO_MIN} min, una sola vez`, () => {
    const d = new DetectorRitmoObjetos();
    d.procesar({ estado: estado(), build, objetos }, true);
    expect(d.procesar({ estado: estado({ tiempo: min(13.9) }), build, objetos }, false)).toEqual([]);
    expect(d.procesar({ estado: estado({ tiempo: min(14) }), build, objetos }, false)).toEqual([{ objeto: 1, objetivo: 11 }]);
    expect(d.procesar({ estado: estado({ tiempo: min(15) }), build, objetos }, false)).toEqual([]);
  });

  it('con el objeto ya completado no avisa; venderlo después no lo descuenta; luego vigila el 2.º', () => {
    const d = new DetectorRitmoObjetos();
    d.procesar({ estado: estado(), build, objetos }, true);
    expect(d.procesar({ estado: estado({ tiempo: min(10), objetos: [6655] }), build, objetos }, false)).toEqual([]);
    expect(d.procesar({ estado: estado({ tiempo: min(16), objetos: [] }), build, objetos }, false)).toEqual([]);
    expect(d.procesar({ estado: estado({ tiempo: min(21), objetos: [] }), build, objetos }, false)).toEqual([{ objeto: 2, objetivo: 18 }]);
  });

  it('dos legendarios a tiempo: ningún aviso', () => {
    const d = new DetectorRitmoObjetos();
    d.procesar({ estado: estado(), build, objetos }, true);
    d.procesar({ estado: estado({ tiempo: min(10), objetos: [6655] }), build, objetos }, false);
    expect(d.procesar({ estado: estado({ tiempo: min(30), objetos: [6655, 3157] }), build, objetos }, false)).toEqual([]);
  });

  it('al entrar tarde (reconexión) lo que ya iba con retraso no se dice; el siguiente hito sí', () => {
    const d = new DetectorRitmoObjetos();
    expect(d.procesar({ estado: estado({ tiempo: min(15) }), build, objetos }, true)).toEqual([]);
    expect(d.procesar({ estado: estado({ tiempo: min(16) }), build, objetos }, false)).toEqual([]);
    expect(d.procesar({ estado: estado({ tiempo: min(21) }), build, objetos }, false)).toEqual([{ objeto: 2, objetivo: 18 }]);
  });

  it('solo se compara con las partidas ganadas; sin ese dato, ni en Arena, ni en un rotativo, nada', () => {
    const soloTodas = { ...build, tiempos: { ...tiempos, ganadas: { objeto1: null, objeto2: null, objeto3: null, botas: null } } } as Build;
    const casos: [EstadoPartida, Build | null][] = [
      [estado({ tiempo: min(30) }), soloTodas],
      [estado({ tiempo: min(30) }), null],
      [estado({ tiempo: min(30) }), { ...build, tiempos: undefined } as Build],
      [estado({ tiempo: min(30), modo: 'arena' }), build],
      [estado({ tiempo: min(30), rotativo: 'URF' }), build],
    ];
    for (const [e, b] of casos) {
      const d = new DetectorRitmoObjetos();
      d.procesar({ estado: { ...e, tiempo: 60 }, build: b, objetos }, true);
      expect(d.procesar({ estado: e, build: b, objetos }, false)).toEqual([]);
    }
  });

  it('en ARAM sí (tiene sus tiempos objetivo)', () => {
    const d = new DetectorRitmoObjetos();
    d.procesar({ estado: estado({ modo: 'aram' }), build, objetos }, true);
    expect(d.procesar({ estado: estado({ modo: 'aram', tiempo: min(14) }), build, objetos }, false)).toHaveLength(1);
  });
});

describe('ritmo de objetos en la voz', () => {
  const NORMAL: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, tipos: tiposDeNivel('normal') };
  const procesar = (d: DisparadorVoz, e: EstadoPartida, voz: AjustesVoz = NORMAL) =>
    d.procesar({ estado: e, overlay: resumenOverlay(e, null, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false, objetos, build }, voz);

  it('frase suave de la categoría «ritmoObjetos», prioridad baja, grupo propio y 5 min de enfriamiento', () => {
    const d = new DisparadorVoz({ selector: new SelectorFijo() });
    procesar(d, estado());
    const f = procesar(d, estado({ tiempo: min(14) })).find((x) => x.tipo === 'ritmoObjetos');
    expect(f).toMatchObject({ prioridad: PRIORIDAD_VOZ.ritmoObjetos, grupo: 'ritmoObjetos', enfriamientoMs: RITMO_CADA_MS });
    expect(f!.texto).toBe(textosVariantes('voz.ritmoObjetos.objeto1')[0]);
    expect(RITMO_CADA_MS).toBe(300_000);
    expect(PRIORIDAD_VOZ.ritmoObjetos).toBeGreaterThanOrEqual(PRIORIDAD_VOZ.cs);
  });

  it('con la categoría apagada no se dice', () => {
    const d = new DisparadorVoz({ selector: new SelectorFijo() });
    const sin = { ...NORMAL, tipos: { ...NORMAL.tipos, ritmoObjetos: false } };
    procesar(d, estado(), sin);
    expect(procesar(d, estado({ tiempo: min(14) }), sin).some((x) => x.tipo === 'ritmoObjetos')).toBe(false);
  });

  it('el regulador: como mucho uno cada 5 min y nunca durante una pelea', () => {
    const r = new ReguladorVoz();
    const frase = (clave: string) => ({ tipo: 'ritmoObjetos' as const, clave, texto: clave, prioridad: PRIORIDAD_VOZ.ritmoObjetos, caducaMs: 400_000, grupo: 'ritmoObjetos', enfriamientoMs: RITMO_CADA_MS });
    // En plena pelea espera; al acabar, sale.
    expect(r.procesar([frase('a')], 0, true)).toEqual([]);
    expect(r.procesar([], 1_000, false).map((f) => f.clave)).toEqual(['a']);
    expect(r.procesar([frase('b')], 60_000)).toEqual([]);
    expect(r.procesar([], 300_999)).toEqual([]);
    expect(r.procesar([], 301_000).map((f) => f.clave)).toEqual(['b']);
  });

  it('categoría nueva en el nivel Normal (no en Básico), en «Tu juego»; nunca en Arena ni en los rotativos', () => {
    expect(CATEGORIAS_NIVEL.normal).toContain('ritmoObjetos');
    expect(CATEGORIAS_NIVEL.completo).toContain('ritmoObjetos');
    expect(CATEGORIAS_NIVEL.basico).not.toContain('ritmoObjetos');
    expect(GRUPOS_VOZ.juego).toContain('ritmoObjetos');
    expect(AJUSTES_POR_DEFECTO.overlay.voz.tipos.ritmoObjetos).toBe(true);
    expect(normalizarAjustes({ overlay: { voz: { activa: true, tipos: { combate: false } } } }, 'es').overlay.voz.tipos.ritmoObjetos).toBe(true);
    expect(t('overlay.config.tipo.ritmoObjetos')).not.toBe('overlay.config.tipo.ritmoObjetos');
    expect(vozEnPartida('ritmoObjetos', 'clasificatoria')).toBe(true);
    expect(vozEnPartida('ritmoObjetos', 'aram')).toBe(true);
    expect(vozEnPartida('ritmoObjetos', 'arena')).toBe(false);
    expect(vozEnPartida('ritmoObjetos', 'clasificatoria', 'URF')).toBe(false);
  });
});
