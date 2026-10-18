import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { Ajustes } from '../../shared/tiposApp';
import { registrar } from '../log';

/** Ventana transparente del tamaño de la pantalla principal, sin foco y que deja pasar los clics. */
export function crearVentanaOverlay(_ajustes: Ajustes): BrowserWindow {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
  const ventana = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/overlay.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ventana.setAlwaysOnTop(true, 'screen-saver');
  ventana.setIgnoreMouseEvents(true, { forward: true });
  ventana.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') registrar('aviso', `Consola del overlay: ${e.message}`);
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void ventana.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay/index.html`);
  } else {
    void ventana.loadFile(join(__dirname, '../renderer/overlay/index.html'));
  }
  return ventana;
}
