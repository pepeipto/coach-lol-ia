// @ts-check
import { defineConfig } from 'astro/config';

// La web se publica en https://pepeipto.github.io/coach-lol-ia/
// WEB_OUT_DIR solo lo usan las pruebas para compilar variantes en carpetas separadas.
export default defineConfig({
  site: 'https://pepeipto.github.io',
  base: '/coach-lol-ia',
  outDir: process.env.WEB_OUT_DIR || './dist',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
