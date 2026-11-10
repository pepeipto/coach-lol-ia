/*
 * 3.19 · Alerta de gank leyendo el minimapa (opción APAGADA por defecto; el jugador la enciende sabiendo que Riot no
 * la ha aprobado). Lee solo los píxeles del minimapa que el jugador ya ve en su pantalla, nunca la memoria del juego,
 * y solo mientras el jungla rival está a la vista: no guarda su última posición ni la enseña después.
 *
 * Funciones puras (sin DOM) para poder probarlas: reciben la imagen del minimapa ya recortada y escalada a un
 * cuadrado de `lado` × `lado` píxeles en RGBA (como `ImageData.data`).
 */

/** Lado del cuadrado al que se escala el minimapa antes de analizarlo. */
export const LADO_ANALISIS = 160;
/** Rejilla de la firma de color de un icono (6 × 6 celdas × RGB). */
export const LADO_FIRMA = 6;
/** Diámetro de un icono de campeón respecto al lado del minimapa (márgenes amplios: depende de la escala del HUD). */
export const DIAMETRO_MIN = 0.05;
export const DIAMETRO_MAX = 0.14;
/** Radio de la muestra del interior del icono respecto a su diámetro (sin tocar el aro rojo). */
export const RADIO_MUESTRA = 0.3;
/**
 * Recorte de cada lado del icono de Data Dragon para que la plantilla cubra lo mismo que la muestra: el retrato del
 * minimapa ocupa ~84 % del aro y la muestra, 60 % del aro → se usa el 71 % central del icono.
 */
export const RECORTE_PLANTILLA = 0.145;
/** Distancia de color media (0–255) máxima para dar por buena la identificación. */
export const DISTANCIA_MAXIMA = 55;
/** El segundo candidato tiene que quedar al menos un 12 % más lejos que el primero. */
export const MARGEN_SEGUNDO = 1.12;
/** Distancia (fracción del minimapa) a tu calle para considerar que el jungla está cerca. */
export const CERCA_CALLE = 0.13;
/** Fotogramas seguidos en los que hay que verlo cerca antes de avisar (evita falsos positivos de un solo fotograma). */
export const FOTOGRAMAS_SEGUIDOS = 2;
/** Como mucho un aviso cada 20 s. */
export const ENTRE_AVISOS_MS = 20_000;

export type Calle = 'top' | 'mid' | 'bot';
export interface Punto {
  x: number;
  y: number;
}
export interface IconoDetectado extends Punto {
  /** Diámetro en píxeles de la imagen analizada. */
  d: number;
}
export interface Plantilla {
  campeon: string;
  firma: Float32Array;
}

/** Píxel del aro rojo de un campeón enemigo en el minimapa. */
export function esRojoEnemigo(r: number, g: number, b: number): boolean {
  return r >= 150 && g <= 95 && b <= 95 && r - g >= 85 && r - b >= 80;
}

/**
 * Busca los aros rojos de los campeones enemigos: manchas rojas conexas del tamaño de un icono, casi cuadradas y
 * huecas (los súbditos y los centinelas son puntos pequeños; las torres y los bordes, manchas de otro tamaño).
 */
export function buscarIconosEnemigos(rgba: ArrayLike<number>, lado: number): IconoDetectado[] {
  const total = lado * lado;
  const rojo = new Uint8Array(total);
  for (let i = 0; i < total; i++) rojo[i] = esRojoEnemigo(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!) ? 1 : 0;
  const visto = new Uint8Array(total);
  const pila: number[] = [];
  const iconos: IconoDetectado[] = [];
  const min = DIAMETRO_MIN * lado;
  const max = DIAMETRO_MAX * lado;
  for (let inicio = 0; inicio < total; inicio++) {
    if (!rojo[inicio] || visto[inicio]) continue;
    let x0 = lado, y0 = lado, x1 = -1, y1 = -1, n = 0;
    visto[inicio] = 1;
    pila.push(inicio);
    while (pila.length) {
      const i = pila.pop()!;
      const x = i % lado;
      const y = (i - x) / lado;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      // 8 vecinos: el aro escalado puede quedar con huecos en diagonal.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < lado && ny < lado) {
            const j = ny * lado + nx;
            if (rojo[j] && !visto[j]) {
              visto[j] = 1;
              pila.push(j);
            }
          }
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w < min || h < min || w > max || h > max) continue;
    if (w / h < 0.7 || w / h > 1.43) continue;
    const relleno = n / (w * h);
    if (relleno < 0.12 || relleno > 0.6) continue;
    iconos.push({ x: x0 + w / 2, y: y0 + h / 2, d: (w + h) / 2 });
  }
  return iconos;
}

/** Firma de color de un cuadrado de la imagen: media de cada celda de una rejilla LADO_FIRMA × LADO_FIRMA. */
export function firmaCuadrado(rgba: ArrayLike<number>, ancho: number, cx: number, cy: number, semilado: number): Float32Array {
  const firma = new Float32Array(LADO_FIRMA * LADO_FIRMA * 3);
  const cuentas = new Float32Array(LADO_FIRMA * LADO_FIRMA);
  const alto = rgba.length / 4 / ancho;
  const xa = Math.max(0, Math.floor(cx - semilado)), xb = Math.min(ancho - 1, Math.ceil(cx + semilado) - 1);
  const ya = Math.max(0, Math.floor(cy - semilado)), yb = Math.min(alto - 1, Math.ceil(cy + semilado) - 1);
  for (let y = ya; y <= yb; y++) {
    const fy = Math.min(LADO_FIRMA - 1, Math.floor(((y + 0.5 - (cy - semilado)) / (2 * semilado)) * LADO_FIRMA));
    if (fy < 0) continue;
    for (let x = xa; x <= xb; x++) {
      const fx = Math.min(LADO_FIRMA - 1, Math.floor(((x + 0.5 - (cx - semilado)) / (2 * semilado)) * LADO_FIRMA));
      if (fx < 0) continue;
      const c = fy * LADO_FIRMA + fx;
      const i = (y * ancho + x) * 4;
      firma[c * 3] += rgba[i]!;
      firma[c * 3 + 1] += rgba[i + 1]!;
      firma[c * 3 + 2] += rgba[i + 2]!;
      cuentas[c]++;
    }
  }
  for (let c = 0; c < cuentas.length; c++) {
    const k = cuentas[c] || 1;
    firma[c * 3] /= k;
    firma[c * 3 + 1] /= k;
    firma[c * 3 + 2] /= k;
  }
  return firma;
}

/** Firma de la plantilla: el centro (sin RECORTE_PLANTILLA por cada lado) del icono cuadrado de Data Dragon. */
export function firmaPlantilla(rgba: ArrayLike<number>, lado: number): Float32Array {
  return firmaCuadrado(rgba, lado, lado / 2, lado / 2, (lado / 2) * (1 - 2 * RECORTE_PLANTILLA));
}

/** Firma del interior de un icono detectado en el minimapa. */
export function firmaIcono(rgba: ArrayLike<number>, lado: number, icono: IconoDetectado): Float32Array {
  return firmaCuadrado(rgba, lado, icono.x, icono.y, icono.d * RADIO_MUESTRA);
}

export function distanciaFirmas(a: Float32Array, b: Float32Array): number {
  let suma = 0;
  for (let i = 0; i < a.length; i++) suma += Math.abs(a[i]! - b[i]!);
  return suma / a.length;
}

/** El campeón enemigo de un icono, si se distingue con claridad de los demás enemigos; null si hay dudas. */
export function identificar(firma: Float32Array, plantillas: readonly Plantilla[]): string | null {
  if (!plantillas.length) return null;
  const orden = plantillas.map((p) => ({ campeon: p.campeon, d: distanciaFirmas(firma, p.firma) })).sort((a, b) => a.d - b.d);
  const [primero, segundo] = orden;
  if (!primero || primero.d > DISTANCIA_MAXIMA) return null;
  if (segundo && segundo.d < primero.d * MARGEN_SEGUNDO) return null;
  return primero.campeon;
}

/**
 * Cada calle como una línea en el minimapa (0–1, y hacia abajo; base azul abajo a la izquierda). Los tramos acaban
 * antes de las bases: el jungla en su base no es un gank.
 */
const CALLES: Record<Calle, Punto[]> = {
  top: [{ x: 0.07, y: 0.75 }, { x: 0.07, y: 0.07 }, { x: 0.75, y: 0.07 }],
  mid: [{ x: 0.25, y: 0.75 }, { x: 0.75, y: 0.25 }],
  bot: [{ x: 0.25, y: 0.93 }, { x: 0.93, y: 0.93 }, { x: 0.93, y: 0.25 }],
};

function distanciaSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distancia (fracción del minimapa) de un punto a una calle. */
export function distanciaACalle(p: Punto, calle: Calle): number {
  const l = CALLES[calle];
  let min = Infinity;
  for (let i = 1; i < l.length; i++) min = Math.min(min, distanciaSegmento(p, l[i - 1]!, l[i]!));
  return min;
}

export function cercaDeCalle(p: Punto, calle: Calle): boolean {
  return distanciaACalle(p, calle) <= CERCA_CALLE;
}

/**
 * Decide fotograma a fotograma si toca avisar: el jungla rival identificado en el minimapa y cerca de tu calle en
 * FOTOGRAMAS_SEGUIDOS fotogramas seguidos, y como mucho un aviso cada ENTRE_AVISOS_MS. No guarda posiciones: en
 * cuanto deja de verse, se olvida.
 */
export class RadarJungla {
  private seguidos = 0;
  private ultimoAviso = -Infinity;

  constructor(
    private readonly jungla: string,
    private readonly calle: Calle,
    private readonly plantillas: readonly Plantilla[],
  ) {}

  /** true si en este fotograma hay que encender el borde. */
  procesar(rgba: ArrayLike<number>, lado: number, ahoraMs: number): boolean {
    const visto = this.junglaCerca(rgba, lado);
    this.seguidos = visto ? this.seguidos + 1 : 0;
    if (this.seguidos < FOTOGRAMAS_SEGUIDOS || ahoraMs - this.ultimoAviso < ENTRE_AVISOS_MS) return false;
    this.ultimoAviso = ahoraMs;
    this.seguidos = 0;
    return true;
  }

  private junglaCerca(rgba: ArrayLike<number>, lado: number): boolean {
    for (const icono of buscarIconosEnemigos(rgba, lado)) {
      if (!cercaDeCalle({ x: icono.x / lado, y: icono.y / lado }, this.calle)) continue;
      if (identificar(firmaIcono(rgba, lado, icono), this.plantillas) === this.jungla) return true;
    }
    return false;
  }
}
