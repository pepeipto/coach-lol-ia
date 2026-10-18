import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { Ajustes, AvisoOverlay, Panel } from '../../shared/tiposApp';
import { registrar } from '../log';
import type { ControlOverlay } from '../orquestador/partida';

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

/** Operaciones del overlay para el resto de la app; no falla si la ventana ya se cerró. */
export function crearControlOverlay(obtener: () => BrowserWindow | null): ControlOverlay & {
  mover(activo: boolean): void;
} {
  const vivo = () => {
    const v = obtener();
    return v && !v.isDestroyed() ? v : null;
  };
  return {
    mostrar: () => vivo()?.showInactive(),
    ocultar: () => vivo()?.hide(),
    alternar: () => {
      const v = vivo();
      if (!v) return;
      if (v.isVisible()) v.hide();
      else v.showInactive();
    },
    enviarPanel: (panel: Panel) => vivo()?.webContents.send('overlay:panel', panel),
    enviarAviso: (aviso: AvisoOverlay) => vivo()?.webContents.send('overlay:aviso', aviso),
    /** Modo mover: los clics dejan de pasar al juego para poder arrastrar el panel. */
    mover(activo: boolean) {
      const v = vivo();
      if (!v) return;
      if (activo) {
        v.setIgnoreMouseEvents(false);
        v.showInactive(); // para poder colocarlo aunque no haya partida
      } else {
        v.setIgnoreMouseEvents(true, { forward: true });
      }
      v.webContents.send('overlay:mover', activo);
    },
  };
}
