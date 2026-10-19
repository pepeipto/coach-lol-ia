import { describe, expect, it } from 'vitest';
import { WIDGETS } from '../src/main/ajustes';
import {
  ajustarAPantalla,
  diametroTemporizador,
  escalaWidget,
  ESCALA_PANTALLA_MIN,
  altoZonaFlecha,
  anchoFilaHabilidades,
  centroCasilla,
  factorHud,
  filaHabilidades,
  formatoCuenta,
  GLOBAL_SCALE_REFERENCIA,
  ladoCasillaHud,
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
    const a = posicionPorDefecto('habilidad', p1080, { ancho: 197, alto: 92 });
    // Casilla de la Q centrada en x = 960 − 149,5 = 810,5 → la fila empieza media casilla (49,17 / 2) antes.
    expect(a).toEqual({ x: Math.round(810.5 - 295 / 12), y: 982 - 92 });
    const b = posicionPorDefecto('habilidad', p1440, { ancho: 262, alto: 92 });
    const f = 1440 / 1080;
    expect(b.x).toBe(Math.round(1280 - 149.5 * f - (295 / 12) * f));
    expect(b.y).toBe(Math.round(982 * f - 92));
    expect(anchoFilaHabilidades(p1440)).toBeCloseTo((4 * 295 / 6) * f);
    expect(centroCasilla('R', p1080)).toBeCloseTo(295 / 12 + 3 * (295 / 6));
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

describe('3.0.2: fila de habilidades medida en una partida real (3840×2160, GlobalScale 0,25)', () => {
  const p4k = { ancho: 3840, alto: 2160 };
  const g025 = { global: 0.25, minimapa: 0.35, minimapaIzquierda: false };
  // Medido sobre la grabación: pasiva 1533; Q 1621, W 1717, E 1818, R 1916; borde superior y ≈ 1964; casilla ≈ 80 px.
  const MEDIDO = { Q: 1621, W: 1717, E: 1818, R: 1916 } as const;

  it('reproduce el centro de la Q, el borde superior y el paso medidos', () => {
    const f = filaHabilidades(p4k, g025);
    expect(f.qCentroX).toBeCloseTo(1621, 6);
    expect(f.arriba).toBeCloseTo(1964, 6);
    expect(f.paso).toBeCloseTo(98.33, 2);
    expect(f.qCentroX + 3 * f.paso).toBeCloseTo(1916, 6);
  });

  it('cada casilla cae a ≤ 3 px de su centro medido y la casilla mide ≈ 80 px', () => {
    const fila = posicionPorDefecto('habilidad', p4k, { ancho: anchoFilaHabilidades(p4k, g025), alto: 100 }, g025);
    for (const h of ['Q', 'W', 'E', 'R'] as const) {
      // El widget empieza en un píxel entero (redondeado): se mide el centro absoluto de su casilla.
      expect(Math.abs(fila.x + centroCasilla(h, p4k, g025) - MEDIDO[h])).toBeLessThanOrEqual(3);
    }
    expect(ladoCasillaHud(p4k, g025)).toBeCloseTo(80, 6);
  });

  it('normalizado a 1080p: Q a −149,5 del centro, paso ≈ 49,2 y fila en y = 982', () => {
    const f = filaHabilidades(p1080, { ...g025 });
    expect(f.qCentroX - 960).toBeCloseTo(-149.5, 6);
    expect(f.paso).toBeCloseTo(49.17, 2);
    expect(f.arriba).toBeCloseTo(982, 6);
  });

  it('sin escala conocida se usa la medida (GlobalScale 0,25 es la única medida)', () => {
    expect(GLOBAL_SCALE_REFERENCIA).toBe(0.25);
    expect(filaHabilidades(p4k, null)).toEqual(filaHabilidades(p4k, g025));
  });
});

describe('3.0.1: geometría del HUD según la escala de LoL (GlobalScale / MinimapScale)', () => {
  const hud = (global: number | null, minimapa: number | null = null, minimapaIzquierda = false) => ({ global, minimapa, minimapaIzquierda });

  it('sin escala conocida, el HUD es el de referencia (la geometría de la 3.0)', () => {
    expect(tamanoRelativoHud(null)).toBe(1);
    expect(factorHud(p1080, null)).toBe(1);
    const f = filaHabilidades(p1080, null);
    expect(f.qCentroX).toBeCloseTo(810.5);
    expect(f.arriba).toBeCloseTo(982);
    expect(f.paso).toBeCloseTo(295 / 6);
  });

  it('el HUD crece con GlobalScale (supuesto: lineal, ×1,4 de 0 a 1, medido en 0,25) y se ancla abajo en el centro', () => {
    expect(tamanoRelativoHud(GLOBAL_SCALE_REFERENCIA)).toBe(1);
    expect(tamanoRelativoHud(0)).toBeCloseTo(1 / 1.1);
    expect(tamanoRelativoHud(1)).toBeCloseTo(1.4 / 1.1);
    // Valores fuera de 0–1 se recortan.
    expect(tamanoRelativoHud(5)).toBeCloseTo(tamanoRelativoHud(1));
    const k = tamanoRelativoHud(1);
    const f = filaHabilidades(p1080, hud(1));
    expect(f.paso).toBeCloseTo((295 / 6) * k);
    expect(f.qCentroX).toBeCloseTo(960 - 149.5 * k);
    expect(f.arriba).toBeCloseTo(1080 - 98 * k);
  });

  it('a 1440p y 4K escala con la altura; la R queda a 3 casillas de la Q', () => {
    const k = tamanoRelativoHud(0.75);
    for (const p of [p1440, { ancho: 3840, alto: 2160 }, { ancho: 2560, alto: 1080 }]) {
      const fh = (p.alto / 1080) * k;
      const f = filaHabilidades(p, hud(0.75));
      expect(f.qCentroX).toBeCloseTo(p.ancho / 2 - 149.5 * fh);
      expect(f.arriba).toBeCloseTo(p.alto - 98 * fh);
      expect(centroCasilla('R', p, hud(0.75)) - centroCasilla('Q', p, hud(0.75))).toBeCloseTo(3 * (295 / 6) * fh);
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

  it('la flecha mide unos 24–36 px a 1080p según la escala del HUD', () => {
    for (const g of [0, 0.25, 0.5, 0.75, 1]) {
      const lado = ladoFlecha(p1080, hud(g), 1);
      expect(lado).toBeGreaterThanOrEqual(24);
      expect(lado).toBeLessThanOrEqual(36);
    }
    expect(ladoFlecha(p1080, null, 1)).toBe(28);
    expect(ladoFlecha({ ancho: 3840, alto: 2160 }, null, 1)).toBe(56);
  });
});

describe('3.0.2: los widgets siguen el alto de la pantalla (2K, 4K) y no tapan el contador de FPS', () => {
  const p4k = { ancho: 3840, alto: 2160 };
  const p720 = { ancho: 1280, alto: 720 };
  const g025 = { global: 0.25, minimapa: 0.35, minimapaIzquierda: false };

  it('escala del widget = alto / 1080 × la escala del usuario (con un mínimo para que se lea)', () => {
    expect(escalaWidget(p1080, 1)).toBe(1);
    expect(escalaWidget(p4k, 1)).toBe(2);
    expect(escalaWidget(p1440, 1.25)).toBeCloseTo(1.25 * (1440 / 1080));
    expect(escalaWidget(p4k, 0.8)).toBeCloseTo(1.6);
    expect(escalaWidget(p720, 1)).toBe(ESCALA_PANTALLA_MIN);
  });

  it('los temporizadores del minimapa crecen con la pantalla (≈ 20 px a 1080p, el doble a 4K)', () => {
    const d1080 = diametroTemporizador(216, p1080, 1);
    expect(d1080).toBeGreaterThanOrEqual(18);
    expect(d1080).toBeLessThanOrEqual(22);
    expect(Math.abs(diametroTemporizador(432, p4k, 1) - 2 * d1080)).toBeLessThanOrEqual(1);
    expect(Math.abs(diametroTemporizador(216, p1080, 1.5) - 1.5 * d1080)).toBeLessThanOrEqual(1);
  });

  it('CS/KDA por defecto, arriba a la derecha pero debajo del marcador y de la línea de FPS/ping', () => {
    // Medido a 4K (HUD 0,25): marcador y 0–65, texto de FPS/ping y ≈ 80–105 → el widget empieza más abajo.
    const w4k = { ancho: 2 * 215, alto: 2 * 120 };
    const a = posicionPorDefecto('cs', p4k, w4k, g025);
    expect(a.y).toBeGreaterThanOrEqual(110);
    expect(a.x + w4k.ancho).toBeLessThanOrEqual(3840);
    // Proporcionalmente igual en cualquier resolución (FPS hasta ≈ 4,9 % del alto).
    for (const p of [p1080, p1440, p720, { ancho: 2560, alto: 1080 }]) {
      const b = posicionPorDefecto('cs', p, { ancho: 215, alto: 120 }, g025);
      expect(b.y / p.alto).toBeGreaterThanOrEqual(0.051);
    }
    // Con un HUD más grande (GlobalScale 1) el marcador y la línea de FPS crecen: el widget baja con ellos.
    expect(posicionPorDefecto('cs', p1080, { ancho: 215, alto: 120 }, { ...g025, global: 1 }).y).toBeGreaterThan(
      posicionPorDefecto('cs', p1080, { ancho: 215, alto: 120 }, g025).y,
    );
  });
});
