import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const servidor = JSON.stringify(process.env.COACH_SERVIDOR ?? '');

export default defineConfig({
  main: { define: { __COACH_SERVIDOR__: servidor } },
  preload: {},
  renderer: {
    plugins: [react()],
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
