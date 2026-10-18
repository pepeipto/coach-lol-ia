import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { t } from '../../shared/i18n';
import { registrar } from '../log';
import { protegerNavegacion } from './navegacion';

export function crearVentanaPrincipal(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 960,
    height: 640,
    title: t('app.titulo'),
    autoHideMenuBar: true,
    webPreferences: {
      // electron-vite emite el preload como out/preload/index.cjs (comprobado tras `npm run build`).
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  protegerNavegacion(ventana.webContents);
  ventana.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') registrar('aviso', `Consola de la ventana: ${e.message}`);
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void ventana.loadURL(`${process.env.ELECTRON_RENDERER_URL}/principal/index.html`);
  } else {
    void ventana.loadFile(join(__dirname, '../renderer/principal/index.html'));
  }
  return ventana;
}
