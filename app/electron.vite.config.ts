import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'electron-vite';
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

export default defineConfig(({ command }) => {
  // 3.6: sin COACH_SERVIDOR la app instalada usaría http://localhost:8080 y no funcionarían las builds, la carga ni la
  // IA (pasó en la 3.4.0 y la 3.5.0). La compilación se detiene salvo que se pida a propósito (COACH_PERMITIR_LOCAL=1).
  if (command === 'build' && !process.env.COACH_SERVIDOR) {
    if (process.env.COACH_PERMITIR_LOCAL !== '1') {
      throw new Error(
        '[coach] COACH_SERVIDOR no está definida: compila con COACH_SERVIDOR=https://api.coachlolia.com ' +
          '(o COACH_PERMITIR_LOCAL=1 para una compilación de pruebas contra localhost).',
      );
    }
    console.warn('[coach] COACH_PERMITIR_LOCAL=1: esta compilación usa http://localhost:8080 (solo para pruebas).');
  }
  return config;
});

const config: UserConfig = {
  main: {
    define: { __COACH_SERVIDOR__: servidor },
    build: {
      externalizeDeps: { exclude: ['@coach/shared'] },
      // 3.1: procesoVoz.js es el utilityProcess de la voz natural (ONNX Runtime fuera del proceso principal).
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts'), procesoVoz: resolve(__dirname, 'src/main/voz/procesoVoz.ts') } },
    },
  },
  // Preload en CJS (.cjs): con el sandbox del renderizador activo no se admite un preload ESM.
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts'), overlay: resolve(__dirname, 'src/preload/overlay.ts') },
        output: { format: 'cjs' as const, entryFileNames: '[name].cjs' },
      },
    },
  },
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
};
