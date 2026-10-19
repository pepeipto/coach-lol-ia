import { t, textosDe } from '../../shared/i18n';

/*
 * 3.1: variantes de las frases de voz. Una situación («el dragón sale en un minuto») tiene una clave base y de 3 a 6
 * variantes: `<base>.1`, `<base>.2`… (y la propia `<base>` si existe, como en los textos de antes de la 3.1). Cada
 * vez se elige una al azar sin repetir la última de esa situación, para que el coach no suene repetitivo.
 * Todas las traducciones tienen las mismas claves (lo comprueba i18n.test.ts), así que el número de variantes es el
 * mismo en todos los idiomas.
 */

/** Como mucho tantas variantes por situación (de sobra: el catálogo usa de 3 a 6). */
const MAX_VARIANTES = 12;

const cache = new Map<string, readonly string[]>();

/** Claves de las variantes de una situación (vacía si no hay ninguna). */
export function clavesVariantes(base: string): readonly string[] {
  const guardadas = cache.get(base);
  if (guardadas) return guardadas;
  const es = textosDe('es');
  const claves: string[] = [];
  if (es[base] !== undefined) claves.push(base);
  for (let i = 1; i <= MAX_VARIANTES; i++) if (es[`${base}.${i}`] !== undefined) claves.push(`${base}.${i}`);
  cache.set(base, claves);
  return claves;
}

/** Quita los espacios de más que deja un marcador vacío (p. ej. el tipo de dragón cuando aún no se sabe). */
export const limpiarEspacios = (texto: string): string => texto.replace(/\s+/g, ' ').trim();

/** Elige variantes al azar sin repetir la última de cada situación. `aleatorio` se sustituye en las pruebas. */
export class SelectorVariantes {
  private ultima = new Map<string, number>();

  constructor(private readonly aleatorio: () => number = Math.random) {}

  /** Índice de la variante elegida para `base` entre `n` (no repite el anterior si hay más de una). */
  indice(base: string, n: number): number {
    if (n <= 1) return 0;
    const azar = Math.min(n - 1, Math.max(0, Math.floor(this.aleatorio() * n)));
    const anterior = this.ultima.get(base);
    const elegido = azar === anterior ? (azar + 1) % n : azar;
    this.ultima.set(base, elegido);
    return elegido;
  }

  /** Texto de una variante de `base` en el idioma actual (la clave base si no hay ninguna variante). */
  texto(base: string, params?: Record<string, string | number>): string {
    const claves = clavesVariantes(base);
    if (claves.length === 0) return t(base, params);
    return limpiarEspacios(t(claves[this.indice(base, claves.length)]!, params));
  }

  reiniciar(): void {
    this.ultima.clear();
  }
}

/** Siempre la primera variante (para las pruebas y para depurar un texto concreto). */
export class SelectorFijo extends SelectorVariantes {
  override indice(): number {
    return 0;
  }
}

/** Todas las variantes de una situación ya interpoladas, en el idioma actual (pruebas y depuración). */
export function textosVariantes(base: string, params?: Record<string, string | number>): string[] {
  return clavesVariantes(base).map((clave) => limpiarEspacios(t(clave, params)));
}
