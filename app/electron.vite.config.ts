import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

/** Solo en desarrollo: el preámbulo de React Refresh es un script en línea y HMR usa un websocket. */
const cspDesarrollo = {
  name: 'csp-desarrollo',
  apply: 'serve' as const,
  transformIndexHtml: (html: string) =>
    html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace(
      "default-src 'self'",
      "default-src 'self'; connect-src 'self' ws://localhost:* http://localhost:*",
    ),
};

const servidor = JSON.stringify(process.env.COACH_SERVIDOR ?? '');

export default defineConfig({
  main: { define: { __COACH_SERVIDOR__: servidor }, build: { externalizeDeps: { exclude: ['@coach/shared'] } } },
  // Preload en CJS (.cjs): con el sandbox del renderizador activo no se admite un preload ESM.
  preload: { build: { rollupOptions: { output: { format: 'cjs' as const, entryFileNames: '[name].cjs' } } } },
  renderer: {
    plugins: [react(), cspDesarrollo],
    build: {
      rollupOptions: {
        input: {
          principal: resolve(__dirname, 'src/renderer/principal/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
        },
      },
    },
  },
});
