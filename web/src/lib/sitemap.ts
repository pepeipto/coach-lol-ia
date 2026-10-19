// Sitemaps por idioma con alternativas hreflang (xhtml:link) e índice de sitemaps.
// Sin dependencias de Astro para poder probarlo también desde las pruebas.
import { alternativas, canonica, IDIOMAS, PAGINAS, SITIO, type Idioma, type Pagina } from '../i18n/idiomas.ts';

/** Fecha de la última revisión del contenido de la web (se actualiza al cambiar los textos). */
export const ULTIMA_REVISION = '2026-10-19';

const PRIORIDAD: Partial<Record<Pagina, string>> = {
  inicio: '1.0',
  descargar: '0.9',
  builds: '0.8',
  guias: '0.6',
  guiaOverlay: '0.6',
  guiaTierList: '0.6',
  guiaRunas: '0.6',
  novedades: '0.6',
  apoyar: '0.5',
  privacidad: '0.2',
  terminos: '0.2',
  cookies: '0.2',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function sitemapIdioma(lang: Idioma): string {
  const urls = PAGINAS.map((p) => {
    const alt = alternativas(p)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}"/>`)
      .join('\n');
    return `  <url>
    <loc>${esc(canonica(lang, p))}</loc>
    <lastmod>${ULTIMA_REVISION}</lastmod>
    <priority>${PRIORIDAD[p] ?? '0.5'}</priority>
${alt}
  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

export function sitemapIndice(): string {
  const items = IDIOMAS.map(
    (l) => `  <sitemap>
    <loc>${SITIO}/sitemap-${l}.xml</loc>
    <lastmod>${ULTIMA_REVISION}</lastmod>
  </sitemap>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>
`;
}
