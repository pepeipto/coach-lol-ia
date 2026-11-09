import { describe, expect, it } from 'vitest';
import { ANTES_RUTA_S, DetectorPeligroGank, DURACION_BORDE_MS, ENTRE_BORDES_S } from '../src/main/consejos/peligroGank';
import { PRIMER_GANK_S } from '../src/main/consejos/macro';
import { HASTA_S, type AvisoJunglaEnemiga } from '../src/main/consejos/junglaEnemiga';
import type { EntradaPeligro } from '../src/main/consejos/peligroGank';

const base = (tiempo: number, extra: Partial<EntradaPeligro> = {}): EntradaPeligro => ({
  tiempo,
  modo: 'clasificatoria',
  rol: 'MIDDLE',
  avisos: [],
  ...extra,
});
const visto = (zona: AvisoJunglaEnemiga['zona'], muere = false): AvisoJunglaEnemiga => ({ clave: `k${zona}`, zona, texto: '', muere });

/** Pasa el detector por estados de 1 s desde `desde` hasta `hasta` y devuelve los bordes que salen. */
function recorrer(d: DetectorPeligroGank, desde: number, hasta: number, extra: Partial<EntradaPeligro> = {}) {
  const salida = [];
  for (let s = desde; s <= hasta; s++) {
    const p = d.procesar(base(s, extra));
    if (p) salida.push({ s, ...p });
  }
  return salida;
}

describe('borde rojo de posible gank', () => {
  it('se enciende una vez en la ventana del primer gank', () => {
    const bordes = recorrer(new DetectorPeligroGank(), 60, 300);
    expect(bordes).toHaveLength(1);
    expect(bordes[0]).toMatchObject({ s: PRIMER_GANK_S, motivo: 'primerGank', duracionMs: DURACION_BORDE_MS });
    expect(bordes[0]!.texto).toBeTruthy();
  });

  it('no sale al jungla, fuera de la Grieta ni estando muerto', () => {
    expect(recorrer(new DetectorPeligroGank(), 60, 300, { rol: 'JUNGLE' })).toHaveLength(0);
    expect(recorrer(new DetectorPeligroGank(), 60, 300, { modo: 'aram' })).toHaveLength(0);
    expect(recorrer(new DetectorPeligroGank(), 60, 300, { muerto: true })).toHaveLength(0);
  });

  it('no sale con el primer estado (al empezar o reconectar)', () => {
    const d = new DetectorPeligroGank();
    expect(d.procesar(base(PRIMER_GANK_S + 1, { avisos: [visto('mid')] }))).toBeNull();
  });

  it('se enciende cuando el jungla rival acaba de aparecer en tu calle (registro de muertes)', () => {
    const d = new DetectorPeligroGank();
    d.procesar(base(400));
    expect(d.procesar(base(401, { avisos: [visto('mid')] }))).toMatchObject({ motivo: 'visto' });
  });

  it('no se enciende si aparece en otra calle o si muere él', () => {
    const d = new DetectorPeligroGank();
    d.procesar(base(400));
    expect(d.procesar(base(401, { avisos: [visto('top')] }))).toBeNull();
    expect(d.procesar(base(402, { avisos: [visto('jungla')] }))).toBeNull();
    expect(d.procesar(base(403, { avisos: [visto('mid', true)] }))).toBeNull();
  });

  it('el soporte y el tirador comparten bot', () => {
    const d = new DetectorPeligroGank();
    d.procesar(base(400, { rol: 'UTILITY' }));
    expect(d.procesar(base(401, { rol: 'UTILITY', avisos: [visto('bot')] }))).toMatchObject({ motivo: 'visto' });
  });

  it('con la ruta estimada, sale unos segundos antes del minuto de su primer gank en tu calle', () => {
    const rutaGank = { calle: 'top' as const, minuto: 3.5 };
    const bordes = recorrer(new DetectorPeligroGank(), 60, 300, { rol: 'TOP', rutaGank });
    expect(bordes.map((b) => b.motivo)).toEqual(['primerGank']);
    const tarde = recorrer(new DetectorPeligroGank(), 60, 400, { rol: 'TOP', rutaGank: { calle: 'top', minuto: 4 } });
    expect(tarde.map((b) => [b.s, b.motivo])).toEqual([
      [PRIMER_GANK_S, 'primerGank'],
      [4 * 60 - ANTES_RUTA_S, 'ruta'],
    ]);
    expect(recorrer(new DetectorPeligroGank(), 60, 400, { rol: 'BOTTOM', rutaGank: { calle: 'top', minuto: 4 } })).toHaveLength(1);
  });

  it('como mucho un borde cada ENTRE_BORDES_S', () => {
    const d = new DetectorPeligroGank();
    d.procesar(base(PRIMER_GANK_S - 1));
    expect(d.procesar(base(PRIMER_GANK_S))).not.toBeNull();
    expect(d.procesar(base(PRIMER_GANK_S + 5, { avisos: [visto('mid')] }))).toBeNull();
    expect(d.procesar(base(PRIMER_GANK_S + ENTRE_BORDES_S, { avisos: [visto('mid')] }))).not.toBeNull();
  });

  it('se apaga a partir del minuto 14 y se reinicia entre partidas', () => {
    const d = new DetectorPeligroGank();
    d.procesar(base(HASTA_S));
    expect(d.procesar(base(HASTA_S + 1, { avisos: [visto('mid')] }))).toBeNull();
    d.reiniciar();
    expect(recorrer(d, 60, 300)).toHaveLength(1);
  });
});
