import type { Habilidad } from '@coach/shared';

/*
 * Cuándo sale la flecha de habilidad y sobre cuál (3.0.1).
 *
 * La Live Client Data API da, del jugador activo, `level` y `abilities.{Q,W,E,R}.abilityLevel` (el rango de cada
 * habilidad). Con las reglas normales de LoL, cada nivel da un punto: hay un punto por gastar si el nivel es mayor
 * que la suma de rangos. Una básica sube a rango n desde el nivel 2n − 1 (máximo 5) y la R en los niveles 6, 11 y 16
 * (máximo 3). La flecha solo sale con un punto libre y sobre una habilidad que de verdad se pueda subir.
 *
 * Hay campeones que no siguen esas reglas (la R desde el nivel 1, rangos automáticos, sin puntos…): con ellos, o con
 * datos que no cuadran con las reglas, no se marca nada. Mejor nada que una flecha equivocada.
 */

/**
 * Campeones (id de Data Dragon, como `rawChampionName`) con rangos que no siguen las reglas normales:
 * Udyr (cuatro básicas, sin R normal), Jayce, Elise y Nidalee (la R desde el nivel 1, con un punto de más),
 * Karma (la R desde el nivel 1 y sube sola), Aphelios (sin puntos de habilidad).
 */
export const CAMPEONES_SIN_REGLAS_NORMALES = new Set(['Udyr', 'Jayce', 'Elise', 'Nidalee', 'Karma', 'Aphelios']);

export const NIVEL_MAXIMO = 18;
const BASICAS: Habilidad[] = ['Q', 'W', 'E'];
const RANGO_MAX_BASICA = 5;
const NIVELES_R = [6, 11, 16];

type Rangos = Record<Habilidad, number>;
const suma = (r: Rangos) => r.Q + r.W + r.E + r.R;

/** Rango máximo que puede tener una habilidad en un nivel, con las reglas normales. */
export function rangoMaximo(h: Habilidad, nivel: number): number {
  if (h === 'R') return NIVELES_R.filter((n) => nivel >= n).length;
  return Math.min(RANGO_MAX_BASICA, Math.max(0, Math.ceil(nivel / 2)));
}

/** El nivel supera la suma de rangos: hay un punto por gastar. */
export const puntoLibre = (nivel: number, rangos: Rangos): boolean => nivel > suma(rangos);

/** Se puede subir un rango de `h` en este nivel. */
export const puedeSubir = (h: Habilidad, nivel: number, rangos: Rangos): boolean => rangos[h] < rangoMaximo(h, nivel);

/** Los rangos cuadran con las reglas normales (si no, el campeón tiene reglas propias o los datos son raros). */
function cuadra(nivel: number, rangos: Rangos): boolean {
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAXIMO) return false;
  if ([...BASICAS, 'R' as const].some((h) => !Number.isInteger(rangos[h]) || rangos[h] < 0 || rangos[h] > rangoMaximo(h, nivel))) return false;
  return suma(rangos) <= nivel;
}

/**
 * Habilidad sobre la que va la flecha: null sin punto libre, con un campeón de reglas propias o si no hay ninguna
 * del orden de la build que se pueda subir ahora. Si el jugador sigue el orden, es la siguiente del orden; si se
 * salió de él, la primera del orden que le falta y que puede subir (nunca la R antes del 6, 11 o 16).
 */
export function habilidadQueSubir(
  estado: { nivel: number; habilidades: Rangos; campeon?: string },
  orden: readonly Habilidad[],
): Habilidad | null {
  const { nivel, habilidades } = estado;
  if (estado.campeon && CAMPEONES_SIN_REGLAS_NORMALES.has(estado.campeon)) return null;
  if (!cuadra(nivel, habilidades) || !puntoLibre(nivel, habilidades)) return null;
  const pedidas: Rangos = { Q: 0, W: 0, E: 0, R: 0 };
  for (const h of orden) {
    if (!(h in pedidas)) continue;
    pedidas[h]++;
    if (pedidas[h] > habilidades[h] && puedeSubir(h, nivel, habilidades)) return h;
  }
  return null;
}
