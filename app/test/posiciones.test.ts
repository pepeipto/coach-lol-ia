import { describe, expect, it } from 'vitest';
import { WIDGETS } from '../src/main/ajustes';
import { ajustarAPantalla, anchoFilaHabilidades, centroCasilla, formatoCuenta, posicionPorDefecto } from '../src/renderer/overlay/posiciones';

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
