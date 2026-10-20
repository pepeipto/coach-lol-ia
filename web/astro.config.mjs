// @ts-check
import { defineConfig } from 'astro/config';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PREMIUM_HABILITADO } from './src/lib/producto.ts';
import { problemasRiotTxt } from './src/lib/riotTxt.mjs';

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

/**
 * riot.txt (verificación del sitio en el Riot Developer Portal): si existe public/riot.txt, Astro lo copia a la raíz
 * (/riot.txt). Esta integración comprueba al compilar que el archivo publicado es solo la cadena del portal (sin BOM,
 * espacios ni saltos de línea) y para la compilación si no. Sin el archivo no hace nada: aún no existe.
 * @returns {import('astro').AstroIntegration}
 */
function verificarRiotTxt() {
  return {
    name: 'coach-riot-txt',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const ruta = fileURLToPath(new URL('riot.txt', dir));
        if (!existsSync(ruta)) return;
        const problemas = problemasRiotTxt(readFileSync(ruta));
        if (problemas.length) throw new Error(`riot.txt no es válido: ${problemas.join('; ')}`);
        logger.info('riot.txt listo en la raíz del sitio');
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
  integrations: [paginasPremium(), verificarRiotTxt()],
});
