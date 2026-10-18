// @ts-check
import { defineConfig } from 'astro/config';

// La web se publica con dominio propio en https://www.coachlolia.com (GitHub Pages + public/CNAME).
// WEB_OUT_DIR solo lo usan las pruebas para compilar variantes en carpetas separadas.
export default defineConfig({
  site: 'https://www.coachlolia.com',
  base: '/',
  outDir: process.env.WEB_OUT_DIR || './dist',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
