import es from './i18n/es.json';
import en from './i18n/en.json';
import ptBR from './i18n/pt-BR.json';
import fr from './i18n/fr.json';
import de from './i18n/de.json';

/** Idiomas de la app (Fase 3). El español es el original y el de reserva. */
export const IDIOMAS = ['es', 'en', 'pt-BR', 'fr', 'de'] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';

/** Nombre de cada idioma en su propio idioma (para el selector de Ajustes). */
export const NOMBRES_IDIOMA: Record<Idioma, string> = {
  es: 'Español',
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  de: 'Deutsch',
};

/** Locale de Data Dragon de cada idioma. */
export const LOCALE_DDRAGON: Record<Idioma, string> = {
  es: 'es_MX',
  en: 'en_US',
  'pt-BR': 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
};

/** Etiqueta BCP 47 para Intl (números, fechas, orden alfabético) y para elegir la voz. */
export const LOCALE_INTL: Record<Idioma, string> = {
  es: 'es',
  en: 'en',
  'pt-BR': 'pt-BR',
  fr: 'fr',
  de: 'de',
};

const TEXTOS: Record<Idioma, Record<string, string>> = { es, en, 'pt-BR': ptBR, fr, de };

export const esIdioma = (v: unknown): v is Idioma => typeof v === 'string' && (IDIOMAS as readonly string[]).includes(v);

/**
 * Idioma de la app a partir del idioma del sistema (`app.getLocale()`, p. ej. «en-US», «pt-BR», «de»).
 * El portugués de Portugal también usa pt-BR (es el único portugués); cualquier otro idioma, español.
 */
export function idiomaDeSistema(locale: string | null | undefined): Idioma {
  const l = (locale ?? '').trim().toLowerCase().replace('_', '-');
  const es = (codigo: string) => l === codigo || l.startsWith(`${codigo}-`);
  if (es('en')) return 'en';
  if (es('pt')) return 'pt-BR';
  if (es('fr')) return 'fr';
  if (es('de')) return 'de';
  return 'es';
}

let actual: Idioma = IDIOMA_POR_DEFECTO;
const oyentes = new Set<(idioma: Idioma) => void>();

export function idiomaActual(): Idioma {
  return actual;
}

/** Cambia el idioma de los textos (en el proceso o la ventana que lo llama) y avisa a los oyentes. */
export function establecerIdioma(idioma: unknown): void {
  const nuevo = esIdioma(idioma) ? idioma : IDIOMA_POR_DEFECTO;
  if (nuevo === actual) return;
  actual = nuevo;
  for (const cb of oyentes) cb(nuevo);
}

/** Avisa al cambiar el idioma; devuelve la función para dejar de escuchar. */
export function alCambiarIdioma(cb: (idioma: Idioma) => void): () => void {
  oyentes.add(cb);
  return () => void oyentes.delete(cb);
}

/** Etiqueta BCP 47 del idioma actual, para `toLocaleString` y `localeCompare`. */
export function localeActual(): string {
  return LOCALE_INTL[actual];
}

/** ¿Existe la clave? (en el idioma actual o en español). */
export function existeTexto(clave: string): boolean {
  return TEXTOS[actual][clave] !== undefined || TEXTOS.es[clave] !== undefined;
}

/**
 * Devuelve el texto de `clave` en el idioma actual (o en español si faltara), interpolando `{param}`.
 * Si no existe, devuelve la clave.
 */
export function t(clave: string, params?: Record<string, string | number>): string {
  const texto = TEXTOS[actual][clave] ?? TEXTOS.es[clave];
  if (texto === undefined) return clave;
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (coincidencia, nombre: string) =>
    nombre in params ? String(params[nombre]) : coincidencia,
  );
}

/** Textos de un idioma (para las pruebas de paridad de claves). */
export function textosDe(idioma: Idioma): Readonly<Record<string, string>> {
  return TEXTOS[idioma];
}
