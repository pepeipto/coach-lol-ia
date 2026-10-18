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
  // Aún no hay un servidor público: no se detiene la compilación, pero se avisa bien claro.
  if (command === 'build' && !process.env.COACH_SERVIDOR) {
    console.warn(
      '[coach] AVISO: COACH_SERVIDOR no está definida. Esta compilación usará http://localhost:8080 ' +
        'como servidor de builds (salvo que COACH_SERVIDOR se defina al ejecutar la app). ' +
        'Las versiones publicadas deben compilarse con COACH_SERVIDOR=https://… (ver README).',
    );
  }
  return config;
});

const config: UserConfig = {
  main: { define: { __COACH_SERVIDOR__: servidor }, build: { externalizeDeps: { exclude: ['@coach/shared'] } } },
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
