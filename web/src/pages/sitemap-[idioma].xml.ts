import type { APIRoute, GetStaticPaths } from 'astro';
import { IDIOMAS, type Idioma } from '../i18n/idiomas';
import { sitemapIdioma } from '../lib/sitemap';

export const getStaticPaths = (() => IDIOMAS.map((idioma) => ({ params: { idioma } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(sitemapIdioma(params.idioma as Idioma), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
