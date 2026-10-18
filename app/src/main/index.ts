import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { configurarDirectorioLog, registrar } from './log';
import { t } from '../shared/i18n';

function crearVentanaPrincipal(): void {
  const ventana = new BrowserWindow({
    width: 960,
    height: 640,
    title: t('app.titulo'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void ventana.loadURL(`${process.env.ELECTRON_RENDERER_URL}/principal/index.html`);
  } else {
    void ventana.loadFile(join(__dirname, '../renderer/principal/index.html'));
  }
}

app.whenReady().then(() => {
  configurarDirectorioLog(() => join(app.getPath('userData'), 'logs'));
  registrar('info', 'Aplicación iniciada');
  crearVentanaPrincipal();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentanaPrincipal();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
