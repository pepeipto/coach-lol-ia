import { describe, expect, it } from 'vitest';
import { WIDGETS } from '../src/main/ajustes';
import {
  ajustarAPantalla,
  altoZonaFlecha,
  anchoFilaHabilidades,
  centroCasilla,
  factorHud,
  filaHabilidades,
  formatoCuenta,
  GLOBAL_SCALE_REFERENCIA,
  ladoFlecha,
  posicionPorDefecto,
  tamanoRelativoHud,
} from '../src/renderer/overlay/posiciones';

const p1080 = { ancho: 1920, alto: 1080 };
const p1440 = { ancho: 2560, alto: 1440 };

describe('posiciones por defecto de los widgets', () => {
  it('la barra de objetivos va centrada arriba', () => {
    expect(posicionPorDefecto('objetivos', p1080, { ancho: 320, alto: 38 })).toEqual({ x: 800, y: 8 });
  });

  it('la flecha se apoya sobre la fila de habilidades del HUD (1080p) y escala con la pantalla (1440p)', () => {
    const a = posicionPorDefecto('habilidad', p1080, { ancho: 220, alto: 92 });
    // Casilla de la Q centrada en x = 782 → la fila empieza media casilla antes.
    expect(a).toEqual({ x: 755, y: 982 - 92 });
    const b = posicionPorDefecto('habilidad', p1440, { ancho: 293, alto: 92 });
    const f = 1440 / 1080;
    expect(b.x).toBe(Math.round(1280 - (960 - 782) * f - 27.5 * f));
    expect(b.y).toBe(Math.round(982 * f - 92));
    expect(anchoFilaHabilidades(p1440)).toBeCloseTo(220 * f);
    expect(centroCasilla('R', p1080)).toBe(27.5 + 3 * 55);
  });

  it('la jungla va abajo a la derecha, entre el HUD central y el minimapa', () => {
    const p = posicionPorDefecto('jungla', p1080, { ancho: 228, alto: 193 });
    expect(p).toEqual({ x: 1920 - 228 - 290, y: 1080 - 193 - 12 });
    // A la derecha del HUD central (que acaba hacia x = 1300) y sin tocar el minimapa (x ≥ 1640).
    expect(p.x).toBeGreaterThan(1300);
    expect(p.x + 228).toBeLessThanOrEqual(1640);
  });

  it('ningún widget queda fuera de la pantalla, ni en pantallas pequeñas', () => {
    for (const pantalla of [p1080, p1440, { ancho: 1280, alto: 720 }]) {
      for (const id of WIDGETS) {
        const w = { ancho: 300, alto: 120 };
        const p = posicionPorDefecto(id, pantalla, w);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + w.ancho).toBeLessThanOrEqual(pantalla.ancho);
        expect(p.y + w.alto).toBeLessThanOrEqual(pantalla.alto);
      }
    }
  });

  it('ajustarAPantalla recorta posiciones arrastradas fuera', () => {
    expect(ajustarAPantalla({ x: -50, y: 5000 }, p1080, { ancho: 100, alto: 40 })).toEqual({ x: 0, y: 1040 });
  });

  it('formatoCuenta da m:ss', () => {
    expect(formatoCuenta(65)).toBe('1:05');
    expect(formatoCuenta(0.2)).toBe('0:01');
    expect(formatoCuenta(-3)).toBe('0:00');
  });
});

describe('3.0.1: geometría del HUD según la escala de LoL (GlobalScale / MinimapScale)', () => {
  const hud = (global: number | null, minimapa: number | null = null, minimapaIzquierda = false) => ({ global, minimapa, minimapaIzquierda });

  it('sin escala conocida, el HUD es el de referencia (la geometría de la 3.0)', () => {
    expect(tamanoRelativoHud(null)).toBe(1);
    expect(factorHud(p1080, null)).toBe(1);
    expect(filaHabilidades(p1080, null)).toEqual({ qCentroX: 782, arriba: 982, paso: 55 });
  });

  it('el HUD crece con GlobalScale (supuesto: lineal, ×1,4 de 0 a 1, referencia en 0,5) y se ancla abajo en el centro', () => {
    expect(tamanoRelativoHud(GLOBAL_SCALE_REFERENCIA)).toBe(1);
    expect(tamanoRelativoHud(0)).toBeCloseTo(1 / 1.2);
    expect(tamanoRelativoHud(1)).toBeCloseTo(1.4 / 1.2);
    // Valores fuera de 0–1 se recortan.
    expect(tamanoRelativoHud(5)).toBeCloseTo(tamanoRelativoHud(1));
    const k = tamanoRelativoHud(1);
    const f = filaHabilidades(p1080, hud(1));
    expect(f.paso).toBeCloseTo(55 * k);
    expect(f.qCentroX).toBeCloseTo(960 - 178 * k);
    expect(f.arriba).toBeCloseTo(1080 - 98 * k);
  });

  it('a 1440p y 4K escala con la altura; la R queda a 3 casillas de la Q', () => {
    const k = tamanoRelativoHud(0.25);
    for (const p of [p1440, { ancho: 3840, alto: 2160 }, { ancho: 2560, alto: 1080 }]) {
      const fh = (p.alto / 1080) * k;
      const f = filaHabilidades(p, hud(0.25));
      expect(f.qCentroX).toBeCloseTo(p.ancho / 2 - 178 * fh);
      expect(f.arriba).toBeCloseTo(p.alto - 98 * fh);
      expect(centroCasilla('R', p, hud(0.25)) - centroCasilla('Q', p, hud(0.25))).toBeCloseTo(3 * 55 * fh);
    }
  });

  it('la zona de la flecha se apoya sobre la fila de casillas de su escala de HUD', () => {
    const h = hud(0.8);
    const f = filaHabilidades(p1440, h);
    const alto = altoZonaFlecha(p1440, h, 1);
    const pos = posicionPorDefecto('habilidad', p1440, { ancho: anchoFilaHabilidades(p1440, h), alto }, h);
    expect(pos.x).toBe(Math.round(f.qCentroX - f.paso / 2));
    expect(pos.y).toBe(Math.round(f.arriba - alto));
  });

  it('la flecha mide unos 26–34 px a 1080p según la escala del HUD', () => {
    for (const g of [0, 0.25, 0.5, 0.75, 1]) {
      const lado = ladoFlecha(p1080, hud(g), 1);
      expect(lado).toBeGreaterThanOrEqual(24);
      expect(lado).toBeLessThanOrEqual(36);
    }
    expect(ladoFlecha(p1080, null, 1)).toBe(30);
    expect(ladoFlecha({ ancho: 3840, alto: 2160 }, null, 1)).toBe(60);
  });
});
