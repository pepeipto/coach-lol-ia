// Acceso a los textos de cada idioma.
import { es, type Textos } from './textos/es.ts';
import { en } from './textos/en.ts';
import { ptBr } from './textos/pt-br.ts';
import { fr } from './textos/fr.ts';
import { de } from './textos/de.ts';
import type { Idioma } from './idiomas.ts';

export const TEXTOS: Record<Idioma, Textos> = { es, en, 'pt-br': ptBr, fr, de };

export function t(lang: Idioma): Textos {
  return TEXTOS[lang];
}

/** Fecha AAAA-MM-DD en el formato largo de cada idioma. */
export function fechaLocal(fecha: string, lang: Idioma): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const n = TEXTOS[lang].novedades;
  return n.formatoFecha.replace('{d}', String(d)).replace('{m}', n.meses[m - 1]).replace('{a}', String(a));
}

export * from './idiomas.ts';
export { md } from './md.ts';
export type { Textos };
