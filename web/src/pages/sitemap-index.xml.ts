import type { APIRoute } from 'astro';
import { sitemapIndice } from '../lib/sitemap';

export const GET: APIRoute = () =>
  new Response(sitemapIndice(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
