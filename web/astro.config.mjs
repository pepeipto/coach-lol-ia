// @ts-check
import { defineConfig } from 'astro/config';
import { PREMIUM_HABILITADO } from './src/lib/producto.ts';

/**
 * Páginas de Premium (/premium, /premium/gracias y /premium/gestionar). Coach LoL IA es gratis, así que
 * con PREMIUM_HABILITADO apagado (por defecto) no se construyen; su código se conserva en src/premium/
 * por si Riot aprueba oficialmente la monetización.
 * @returns {import('astro').AstroIntegration}
 */
function paginasPremium() {
  return {
    name: 'coach-paginas-premium',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!PREMIUM_HABILITADO) return;
        injectRoute({ pattern: '/premium', entrypoint: './src/premium/premium.astro' });
        injectRoute({ pattern: '/premium/gracias', entrypoint: './src/premium/gracias.astro' });
        injectRoute({ pattern: '/premium/gestionar', entrypoint: './src/premium/gestionar.astro' });
      },
    },
  };
}

// La web se publica con dominio propio en https://www.coachlolia.com (GitHub Pages + public/CNAME).
// WEB_OUT_DIR solo lo usan las pruebas para compilar variantes en carpetas separadas.
export default defineConfig({
  site: 'https://www.coachlolia.com',
  base: '/',
  outDir: process.env.WEB_OUT_DIR || './dist',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Español en la raíz (/) y el resto de idiomas con prefijo. Las rutas traducidas y los hreflang
  // salen de src/i18n/idiomas.ts; las páginas de otros idiomas las genera src/pages/[idioma]/[...ruta].astro.
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en', { path: 'pt-br', codes: ['pt-BR', 'pt'] }, 'fr', 'de'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [paginasPremium()],
});
