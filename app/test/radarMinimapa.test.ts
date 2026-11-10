import { describe, expect, it } from 'vitest';
import {
  buscarIconosEnemigos,
  cercaDeCalle,
  ENTRE_AVISOS_MS,
  firmaIcono,
  firmaPlantilla,
  identificar,
  LADO_ANALISIS,
  RadarJungla,
  type Plantilla,
} from '../src/shared/radarMinimapa';

type Color = [number, number, number];
const L = LADO_ANALISIS;
const ROJO: Color = [215, 35, 35];

function lienzo(lado = L, fondo: Color = [28, 58, 40]) {
  const d = new Uint8ClampedArray(lado * lado * 4);
  for (let i = 0; i < lado * lado; i++) d.set([...fondo, 255], i * 4);
  return d;
}
const pintar = (d: Uint8ClampedArray, lado: number, x: number, y: number, c: Color) => {
  if (x >= 0 && y >= 0 && x < lado && y < lado) d.set([...c, 255], (y * lado + x) * 4);
};

/** Retrato de un campeón: mitad izquierda de un color y mitad derecha de otro. */
interface Retrato {
  izq: Color;
  der: Color;
}

/** Icono enemigo en el minimapa: aro rojo de 2 px y el retrato dentro. */
function icono(d: Uint8ClampedArray, cx: number, cy: number, r: Retrato, diam = 14) {
  const rad = diam / 2;
  for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
    for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist > rad) continue;
      pintar(d, L, x, y, dist > rad - 2 ? ROJO : x + 0.5 < cx ? r.izq : r.der);
    }
  }
}

function plantilla(campeon: string, r: Retrato): Plantilla {
  const lado = 64;
  const d = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) d.set([...(x < lado / 2 ? r.izq : r.der), 255], (y * lado + x) * 4);
  return { campeon, firma: firmaPlantilla(d, lado) };
}

const LEE: Retrato = { izq: [240, 200, 60], der: [60, 90, 200] };
const ZED: Retrato = { izq: [90, 90, 100], der: [200, 200, 210] };
const LUX: Retrato = { izq: [250, 250, 250], der: [240, 180, 220] };
const PLANTILLAS = [plantilla('LeeSin', LEE), plantilla('Zed', ZED), plantilla('Lux', LUX)];

describe('alerta de gank leyendo el minimapa', () => {
  it('encuentra los aros rojos de los campeones e ignora súbditos y bandas', () => {
    const d = lienzo();
    icono(d, 40, 30, LEE);
    icono(d, 110, 120, ZED);
    // Súbditos (puntos de 2 × 2) y una banda roja larga (borde).
    for (const [x, y] of [[80, 80], [84, 82], [90, 70]]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) pintar(d, L, x + dx!, y + dy!, ROJO);
    for (let x = 0; x < L; x++) for (let y = 0; y < 4; y++) pintar(d, L, x, L - 1 - y, ROJO);
    const iconos = buscarIconosEnemigos(d, L);
    expect(iconos).toHaveLength(2);
    expect(iconos.map((i) => [Math.round(i.x), Math.round(i.y)])).toEqual([[40, 30], [110, 120]]);
  });

  it('distingue al jungla de los demás enemigos por los colores de su retrato', () => {
    const d = lienzo();
    icono(d, 40, 30, LEE);
    icono(d, 110, 120, ZED);
    const [a, b] = buscarIconosEnemigos(d, L);
    expect(identificar(firmaIcono(d, L, a!), PLANTILLAS)).toBe('LeeSin');
    expect(identificar(firmaIcono(d, L, b!), PLANTILLAS)).toBe('Zed');
  });

  it('sin un candidato claro no identifica a nadie', () => {
    const gris: Retrato = { izq: [128, 128, 128], der: [128, 128, 128] };
    const d = lienzo();
    icono(d, 40, 30, gris);
    const [a] = buscarIconosEnemigos(d, L);
    expect(identificar(firmaIcono(d, L, a!), [plantilla('A', { izq: [118, 118, 118], der: [118, 118, 118] }), plantilla('B', { izq: [138, 138, 138], der: [138, 138, 138] })])).toBeNull();
  });

  it('cerca de cada calle (base azul abajo a la izquierda), nunca en las bases', () => {
    expect(cercaDeCalle({ x: 0.1, y: 0.3 }, 'top')).toBe(true);
    expect(cercaDeCalle({ x: 0.4, y: 0.1 }, 'top')).toBe(true);
    expect(cercaDeCalle({ x: 0.5, y: 0.5 }, 'mid')).toBe(true);
    expect(cercaDeCalle({ x: 0.6, y: 0.9 }, 'bot')).toBe(true);
    expect(cercaDeCalle({ x: 0.9, y: 0.5 }, 'bot')).toBe(true);
    expect(cercaDeCalle({ x: 0.6, y: 0.9 }, 'top')).toBe(false);
    expect(cercaDeCalle({ x: 0.3, y: 0.3 }, 'top')).toBe(false);
    expect(cercaDeCalle({ x: 0.95, y: 0.05 }, 'mid')).toBe(false);
    expect(cercaDeCalle({ x: 0.05, y: 0.95 }, 'bot')).toBe(false);
  });

  it('avisa con el jungla cerca de tu calle dos fotogramas seguidos, y como mucho cada 20 s', () => {
    const cerca = lienzo();
    icono(cerca, 0.6 * L, 0.88 * L, LEE); // junto a bot
    icono(cerca, 0.5 * L, 0.5 * L, ZED); // el mid rival, no es el jungla
    const lejos = lienzo();
    icono(lejos, 0.35 * L, 0.3 * L, LEE); // en la jungla de arriba
    const radar = new RadarJungla('LeeSin', 'bot', PLANTILLAS);
    expect(radar.procesar(lejos, L, 0)).toBe(false);
    expect(radar.procesar(cerca, L, 250)).toBe(false);
    expect(radar.procesar(cerca, L, 500)).toBe(true);
    expect(radar.procesar(cerca, L, 750)).toBe(false);
    expect(radar.procesar(cerca, L, 1000)).toBe(false);
    expect(radar.procesar(cerca, L, 500 + ENTRE_AVISOS_MS)).toBe(true);
  });

  it('el rival de calle cerca de ti no salta: solo el jungla', () => {
    const d = lienzo();
    icono(d, 0.5 * L, 0.5 * L, ZED);
    const radar = new RadarJungla('LeeSin', 'mid', PLANTILLAS);
    expect(radar.procesar(d, L, 0)).toBe(false);
    expect(radar.procesar(d, L, 250)).toBe(false);
  });
});
