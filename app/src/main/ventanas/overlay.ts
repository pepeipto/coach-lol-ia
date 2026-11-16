import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { Ajustes } from '../../shared/tiposApp';
import { registrar } from '../log';
import { protegerNavegacion } from './navegacion';

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
  // Windows abre la ventana recortada al área de trabajo (sin la barra de tareas): con la barra a 150 % se quedaba
  // 48 px corta por abajo y la niebla roja no llegaba al borde. Comprobado en un PC real: un setBounds posterior sí
  // la deja del tamaño de la pantalla. Se repite al mostrarla y si cambia la pantalla (resolución, barra de tareas).
  const ajustarAPantalla = () => {
    if (ventana.isDestroyed()) return;
    ventana.setBounds(screen.getPrimaryDisplay().bounds);
  };
  ajustarAPantalla();
  ventana.on('show', () => {
    ajustarAPantalla();
    setTimeout(ajustarAPantalla, 300);
  });
  screen.on('display-metrics-changed', ajustarAPantalla);
  ventana.once('closed', () => screen.off('display-metrics-changed', ajustarAPantalla));
  ventana.setAlwaysOnTop(true, 'screen-saver');
  ventana.setIgnoreMouseEvents(true, { forward: true });
  protegerNavegacion(ventana.webContents);
  ventana.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') registrar('aviso', `Consola del overlay: ${e.message}`);
  });
  // Seguridad (hallazgo 12): la URL del servidor de desarrollo solo cuenta sin empaquetar; en la app instalada, un
  // programa que fijase ELECTRON_RENDERER_URL podría cargar una página remota con el preload completo.
  const urlDesarrollo = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  if (urlDesarrollo) {
    void ventana.loadURL(`${urlDesarrollo}/overlay/index.html`);
  } else {
    void ventana.loadFile(join(__dirname, '../renderer/overlay/index.html'));
  }
  return ventana;
}
