import { IDIOMAS, type Idioma } from '../../shared/i18n';
import type { IdiomaSupertonic } from './supertonic';

/**
 * Catálogo de la voz natural (3.1).
 *
 * Motor: Supertonic 3 (Supertone Inc.) en int8, sobre ONNX Runtime. Un solo modelo multilingüe sirve a los cinco
 * idiomas de la app, así que se descarga una vez (124 MB) y vale para todos. No va en el instalador: se baja
 * la primera vez que se activa la voz natural y se guarda en userData.
 *
 * Origen del paquete: un recurso de la release `voces-v1` de pepeipto/coach-lol-ia (ver docs/voz-natural.md, que
 * explica cómo se genera con `npm run voz:empaquetar -w app` y cómo se sube). Para cambiar de modelo o de versión
 * basta con un paquete nuevo aquí (id distinto: se descarga a su propia carpeta).
 */

export interface PaqueteVoz {
  id: string;
  /** URL estable del .tar.gz (recurso de una release de GitHub). */
  url: string;
  bytes: number;
  sha256: string;
}

export type GeneroVoz = 'masculina' | 'femenina';

export interface VozNatural {
  /** Id estable que se guarda en los ajustes (p. ej. «supertonic3:M1»). */
  id: string;
  paquete: string;
  /** Estilo dentro del paquete (voice_styles/<estilo>.json). */
  estilo: string;
  genero: GeneroVoz;
  numero: number;
}

/** Base de las descargas; COACH_VOCES_URL la sustituye (pruebas y espejos). */
export const BASE_VOCES = 'https://github.com/pepeipto/coach-lol-ia/releases/download/voces-v1';

export const PAQUETE_SUPERTONIC: PaqueteVoz = {
  id: 'supertonic3-int8-v1',
  url: `${BASE_VOCES}/voz-supertonic3-int8-v1.tar.gz`,
  bytes: 124_033_960,
  sha256: '786db3c49b93f02f294a8827c2c310eadcd277a0625fc2b5ea3fc7fdfdf74b8c',
};

export const PAQUETES: readonly PaqueteVoz[] = [PAQUETE_SUPERTONIC];

const estilos = (genero: GeneroVoz, letra: 'M' | 'F'): VozNatural[] =>
  [1, 2, 3, 4, 5].map((numero) => ({ id: `supertonic3:${letra}${numero}`, paquete: PAQUETE_SUPERTONIC.id, estilo: `${letra}${numero}`, genero, numero }));

/** Las diez voces del modelo; las mismas en todos los idiomas. */
export const VOCES_NATURALES: readonly VozNatural[] = [...estilos('masculina', 'M'), ...estilos('femenina', 'F')];

/**
 * Voz por defecto de cada idioma: la más clara al oído en las muestras (y en una transcripción automática de
 * control). El dueño puede cambiarla aquí o cada usuario en Overlay > Voz.
 */
export const VOZ_POR_DEFECTO: Record<Idioma, string> = {
  es: 'supertonic3:M2',
  en: 'supertonic3:M1',
  'pt-BR': 'supertonic3:M1',
  fr: 'supertonic3:M1',
  de: 'supertonic3:M1',
};

/** Código de idioma del modelo para cada idioma de la app. */
export const IDIOMA_MODELO: Record<Idioma, IdiomaSupertonic> = { es: 'es', en: 'en', 'pt-BR': 'pt', fr: 'fr', de: 'de' };

export const vozPorId = (id: string): VozNatural | undefined => VOCES_NATURALES.find((v) => v.id === id);
export const paquetePorId = (id: string): PaqueteVoz | undefined => PAQUETES.find((p) => p.id === id);
export const esIdVozNatural = (v: unknown): v is string => typeof v === 'string' && VOCES_NATURALES.some((x) => x.id === v);

/** La voz de los ajustes para el idioma, si existe; si no, la de por defecto del idioma. */
export function elegirVozNatural(idioma: Idioma, elegidas: Partial<Record<Idioma, string>> = {}): VozNatural {
  return vozPorId(elegidas[idioma] ?? '') ?? vozPorId(VOZ_POR_DEFECTO[idioma])!;
}

/** URL del paquete, con la base cambiada si COACH_VOCES_URL está definida. */
export function urlPaquete(p: PaqueteVoz, base: string | undefined = process.env.COACH_VOCES_URL): string {
  if (!base) return p.url;
  return `${base.replace(/\/+$/, '')}/${p.url.slice(p.url.lastIndexOf('/') + 1)}`;
}

/** Comprobación interna: todos los idiomas tienen voz por defecto válida. */
export const catalogoCompleto = (): boolean => IDIOMAS.every((i) => !!vozPorId(VOZ_POR_DEFECTO[i]));
