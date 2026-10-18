import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import type { Rol } from '@coach/shared';
import type { Ajustes } from '../shared/tiposApp';
import { cargarAjustes, guardarAjustes } from './ajustes';
import { cargarDatosEstaticos } from './datos/estaticos';
import { VigilanteLcu } from './lcu/vigilante';
import { configurarDirectorioLog, registrar } from './log';
import { crearOrquestadorSeleccion } from './orquestador/seleccion';
import { crearVentanaPrincipal } from './ventanas/principal';

let ventana: BrowserWindow | null = null;

function iniciar(): void {
  configurarDirectorioLog(() => join(app.getPath('userData'), 'logs'));
  registrar('info', 'Aplicación iniciada');
  const rutaAjustes = join(app.getPath('userData'), 'ajustes.json');
  const dirCache = join(app.getPath('userData'), 'cache');

  const orquestador = crearOrquestadorSeleccion({
    dirCache,
    cargarDatos: () => cargarDatosEstaticos(join(dirCache, 'ddragon')),
    obtenerAjustes: () => cargarAjustes(rutaAjustes),
    enviar: (estado) => {
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:estado', estado);
    },
  });

  ipcMain.handle('coach:estado-actual', () => orquestador.estado());
  ipcMain.handle('coach:importar', () => orquestador.importar());
  ipcMain.handle('coach:cambiar-rol', (_e, rol: Rol) => orquestador.cambiarRol(rol));
  ipcMain.handle('coach:obtener-ajustes', () => cargarAjustes(rutaAjustes));
  ipcMain.handle('coach:guardar-ajustes', (_e, a: Ajustes) => guardarAjustes(rutaAjustes, a));
  // Pendiente: la tarea 15 implementa el modo de mover el overlay.
  ipcMain.handle('coach:mover-overlay', async () => undefined);

  const vigilante = new VigilanteLcu();
  vigilante.on('conectado', (cliente) => orquestador.conectado(cliente));
  vigilante.on('desconectado', () => orquestador.desconectado());
  vigilante.on('seleccion', (sel) => void orquestador.alSeleccionar(sel));
  vigilante.iniciar();
  app.on('before-quit', () => vigilante.detener());

  ventana = crearVentanaPrincipal();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) ventana = crearVentanaPrincipal();
  });
}

void app.whenReady().then(iniciar);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
