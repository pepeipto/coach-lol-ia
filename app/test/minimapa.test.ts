import { describe, expect, it } from 'vitest';
import { fraccionesMarco, LADO_MINIMAPA_POR_DEFECTO, ladoMinimapa, marcoMinimapa, redimensionarMarco, textoTemporizador } from '../src/renderer/overlay/posiciones';

const P1080 = { ancho: 1920, alto: 1080 };

describe('marco del minimapa', () => {
  it('por defecto: abajo a la derecha, con un lado de 0,20 × el alto de la pantalla', () => {
    expect(LADO_MINIMAPA_POR_DEFECTO).toBe(0.2);
    expect(marcoMinimapa(P1080, null)).toEqual({ x: 1920 - 216, y: 1080 - 216, lado: 216 });
    expect(marcoMinimapa({ ancho: 2560, alto: 1440 }, null)).toEqual({ x: 2560 - 288, y: 1440 - 288, lado: 288 });
  });

  it('el calibrado se guarda en fracciones de la pantalla y vale para otra resolución', () => {
    const f = fraccionesMarco({ x: 1650, y: 790, lado: 270 }, P1080);
    expect(f).toEqual({ x: 1650 / 1920, y: 790 / 1080, lado: 0.25 });
    expect(marcoMinimapa(P1080, f)).toEqual({ x: 1650, y: 790, lado: 270 });
    expect(marcoMinimapa({ ancho: 3840, alto: 2160 }, f)).toEqual({ x: 3300, y: 1580, lado: 540 });
  });

  it('siempre dentro de la pantalla', () => {
    expect(marcoMinimapa(P1080, { x: 0.99, y: 0.99, lado: 0.3 })).toEqual({ x: 1920 - 324, y: 1080 - 324, lado: 324 });
  });

  it('las esquinas cambian el tamaño (cuadrado) dejando fija la esquina contraria, con límites', () => {
    const m = { x: 1700, y: 860, lado: 220 };
    // Esquina de arriba a la izquierda hacia fuera: crece y la de abajo a la derecha no se mueve.
    expect(redimensionarMarco(m, 'ni', -30, -10, P1080)).toEqual({ x: 1670, y: 830, lado: 250 });
    // Abajo a la derecha hacia dentro: encoge.
    expect(redimensionarMarco(m, 'sd', -20, -40, P1080)).toEqual({ x: 1700, y: 860, lado: 180 });
    // Nunca más pequeño del 8 % del alto ni fuera de la pantalla.
    expect(redimensionarMarco(m, 'sd', -500, -500, P1080).lado).toBe(Math.round(0.08 * 1080));
    const r = redimensionarMarco(m, 'sd', 400, 400, P1080);
    expect(r.x + r.lado).toBeLessThanOrEqual(1920);
    expect(r.y + r.lado).toBeLessThanOrEqual(1080);
  });
});

describe('texto del temporizador', () => {
  it('mm:ss desde un minuto, solo segundos por debajo', () => {
    expect(textoTemporizador(125)).toBe('2:05');
    expect(textoTemporizador(60)).toBe('1:00');
    expect(textoTemporizador(59)).toBe('59');
    expect(textoTemporizador(5)).toBe('5');
  });
});

describe('3.0.1: marco por defecto según MinimapScale y FlipMiniMap', () => {
  const hud = (minimapa: number | null, minimapaIzquierda = false) => ({ global: 0.5, minimapa, minimapaIzquierda });

  it('el lado crece con MinimapScale (supuesto: 0,16 + 0,12 × escala del alto) y sin escala queda el de siempre', () => {
    expect(ladoMinimapa(null)).toBe(LADO_MINIMAPA_POR_DEFECTO);
    expect(ladoMinimapa(0)).toBeCloseTo(0.16);
    expect(ladoMinimapa(1)).toBeCloseTo(0.28);
    expect(ladoMinimapa(0.35)).toBeCloseTo(0.202);
    const m = marcoMinimapa(P1080, null, hud(1));
    expect(m).toEqual({ x: 1920 - 302, y: 1080 - 302, lado: 302 });
  });

  it('con FlipMiniMap=1 va abajo a la izquierda', () => {
    expect(marcoMinimapa(P1080, null, hud(0, true))).toEqual({ x: 0, y: 1080 - 173, lado: 173 });
  });

  it('el marco calibrado manda sobre la escala leída', () => {
    const f = { x: 0.5, y: 0.5, lado: 0.25 };
    expect(marcoMinimapa(P1080, f, hud(1, true))).toEqual(marcoMinimapa(P1080, f));
  });
});
