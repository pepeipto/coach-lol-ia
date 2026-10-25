import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { t } from '../../shared/i18n';
import { registrar } from '../log';
import { protegerNavegacion } from './navegacion';
import { rutaRecurso } from '../bandeja';

export function crearVentanaPrincipal(o: { oculta?: boolean } = {}): BrowserWindow {
  const ventana = new BrowserWindow({
    // 3.6: se enseña al estar lista (sin parpadeo blanco); al arrancar con Windows se queda en la bandeja.
    show: false,
    icon: rutaRecurso('icono.png'),
    width: 1240,
    height: 800,
    minWidth: 1000,
    minHeight: 680,
    // Sin marco nativo: la barra de título la dibuja el renderizador (BarraTitulo.tsx).
    frame: false,
    backgroundColor: '#0a0e1a',
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
  if (!o.oculta) ventana.once('ready-to-show', () => ventana.show());
  protegerNavegacion(ventana.webContents);
  ventana.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') registrar('aviso', `Consola de la ventana: ${e.message}`);
  });
  // Seguridad (hallazgo 12): la URL del servidor de desarrollo solo cuenta sin empaquetar; en la app instalada, un
  // programa que fijase ELECTRON_RENDERER_URL podría cargar una página remota con el preload completo.
  const urlDesarrollo = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  if (urlDesarrollo) {
    void ventana.loadURL(`${urlDesarrollo}/principal/index.html`);
  } else {
    void ventana.loadFile(join(__dirname, '../renderer/principal/index.html'));
  }
  return ventana;
}
