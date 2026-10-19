// Idiomas de la web y rutas traducidas. Sin dependencias de Astro para poder importarlo desde las pruebas.
// El español es el idioma por defecto y vive en la raíz (/); el resto, con prefijo (/en/, /pt-br/, /fr/, /de/).

export const IDIOMAS = ['es', 'en', 'pt-br', 'fr', 'de'] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';
export const SITIO = 'https://www.coachlolia.com';

/** Datos de cada idioma: atributo lang de <html>, código hreflang, locale de Open Graph y nombre nativo. */
export const INFO: Record<Idioma, { html: string; hreflang: string; og: string; nombre: string; corto: string }> = {
  es: { html: 'es', hreflang: 'es', og: 'es_ES', nombre: 'Español', corto: 'ES' },
  en: { html: 'en', hreflang: 'en', og: 'en_US', nombre: 'English', corto: 'EN' },
  'pt-br': { html: 'pt-BR', hreflang: 'pt-BR', og: 'pt_BR', nombre: 'Português (Brasil)', corto: 'PT' },
  fr: { html: 'fr', hreflang: 'fr', og: 'fr_FR', nombre: 'Français', corto: 'FR' },
  de: { html: 'de', hreflang: 'de', og: 'de_DE', nombre: 'Deutsch', corto: 'DE' },
};

/** Slug de cada página en cada idioma ('' = portada). */
export const SLUGS = {
  inicio: { es: '', en: '', 'pt-br': '', fr: '', de: '' },
  descargar: { es: 'descargar', en: 'download', 'pt-br': 'baixar', fr: 'telecharger', de: 'herunterladen' },
  apoyar: { es: 'apoyar', en: 'support-us', 'pt-br': 'apoiar', fr: 'soutenir', de: 'unterstuetzen' },
  novedades: { es: 'novedades', en: 'changelog', 'pt-br': 'novidades', fr: 'nouveautes', de: 'neuigkeiten' },
  builds: {
    es: 'builds-y-tier-list',
    en: 'builds-and-tier-list',
    'pt-br': 'builds-e-tier-list',
    fr: 'builds-et-tier-list',
    de: 'builds-und-tier-list',
  },
  guias: { es: 'guias', en: 'guides', 'pt-br': 'guias', fr: 'guides', de: 'ratgeber' },
  guiaOverlay: {
    es: 'guias/overlay-lol-seguro',
    en: 'guides/lol-overlay-safely',
    'pt-br': 'guias/overlay-lol-com-seguranca',
    fr: 'guides/overlay-lol-en-securite',
    de: 'ratgeber/lol-overlay-sicher-nutzen',
  },
  guiaTierList: {
    es: 'guias/que-es-una-tier-list',
    en: 'guides/what-is-a-tier-list',
    'pt-br': 'guias/o-que-e-tier-list',
    fr: 'guides/quest-ce-qu-une-tier-list',
    de: 'ratgeber/was-ist-eine-tier-list',
  },
  guiaRunas: {
    es: 'guias/importar-runas-automaticamente',
    en: 'guides/import-runes-automatically',
    'pt-br': 'guias/importar-runas-automaticamente',
    fr: 'guides/importer-runes-automatiquement',
    de: 'ratgeber/runen-automatisch-importieren',
  },
  privacidad: { es: 'privacidad', en: 'privacy', 'pt-br': 'privacidade', fr: 'confidentialite', de: 'datenschutz' },
  terminos: { es: 'terminos', en: 'terms', 'pt-br': 'termos', fr: 'conditions', de: 'nutzungsbedingungen' },
  cookies: { es: 'cookies', en: 'cookies', 'pt-br': 'cookies', fr: 'cookies', de: 'cookies' },
} as const satisfies Record<string, Record<Idioma, string>>;

export type Pagina = keyof typeof SLUGS;
export const PAGINAS = Object.keys(SLUGS) as Pagina[];
/** Guías evergreen, en el orden en que se enlazan. */
export const GUIAS = ['guiaOverlay', 'guiaTierList', 'guiaRunas'] as const satisfies readonly Pagina[];

export function esIdioma(valor: unknown): valor is Idioma {
  return typeof valor === 'string' && (IDIOMAS as readonly string[]).includes(valor);
}

const prefijo = (lang: Idioma) => (lang === IDIOMA_POR_DEFECTO ? '' : `/${lang}`);

/**
 * Enlace interno (relativo a la raíz) a una página en un idioma: '/descargar', '/en/download', '/#faq', '/en/#faq'.
 * Las subpáginas van sin barra final (GitHub Pages redirige a la carpeta), igual que antes de la 3.1.
 */
export function ruta(lang: Idioma, pagina: Pagina, ancla = ''): string {
  const slug = SLUGS[pagina][lang];
  if (!slug) return `${prefijo(lang)}/${ancla}`;
  return `${prefijo(lang)}/${slug}${ancla}`;
}

/** URL canónica absoluta, siempre con barra final (GitHub Pages sirve cada página como carpeta). */
export function canonica(lang: Idioma, pagina: Pagina): string {
  const slug = SLUGS[pagina][lang];
  return `${SITIO}${prefijo(lang)}/${slug ? `${slug}/` : ''}`;
}

/** Alternativas hreflang de una página: una por idioma y x-default (la versión en español). */
export function alternativas(pagina: Pagina): { hreflang: string; href: string }[] {
  return [
    ...IDIOMAS.map((l) => ({ hreflang: INFO[l].hreflang, href: canonica(l, pagina) })),
    { hreflang: 'x-default', href: canonica(IDIOMA_POR_DEFECTO, pagina) },
  ];
}
