import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Notification } from 'electron';
import { join } from 'node:path';
import { ROLES, type Rol } from '@coach/shared';
import { t } from '../shared/i18n';
import { buscarActualizaciones, type Actualizador } from './actualizaciones';
import { cargarAjustes, conservarPosicion, guardarAjustes, normalizarAjustes } from './ajustes';
import { crearGestorAtajos } from './atajo';
import { cargarDatosEstaticos } from './datos/estaticos';
import { asegurarInstanciaUnica } from './instancia';
import { VigilanteLcu } from './lcu/vigilante';
import { configurarDirectorioLog, registrar } from './log';
import { crearOrquestadorPartida } from './orquestador/partida';
import { crearOrquestadorSeleccion } from './orquestador/seleccion';
import { crearConectorPartida } from './partida/conector';
import { crearVentanaOverlay } from './ventanas/overlay';
import { registrarControlVentana } from './ventanas/controlVentana';
import { crearControlOverlay } from './ventanas/overlayControl';
import { crearVentanaPrincipal } from './ventanas/principal';

let ventana: BrowserWindow | null = null;
let ventanaOverlay: BrowserWindow | null = null;

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

  // Tecla rápida solo en partida o en modo mover; Esc solo en modo mover (ambas salen de él).
  const atajos = crearGestorAtajos(globalShortcut, {
    tecla: () => cargarAjustes(rutaAjustes).teclaOverlay,
    alPulsar: () => (overlay.estaMoviendo() ? salirDeMover() : partida.alternar()),
    alEsc: () => salirDeMover(),
  });
  const overlay = crearControlOverlay(
    () => ventanaOverlay,
    (posicionOverlay) => guardarAjustes(rutaAjustes, { ...cargarAjustes(rutaAjustes), posicionOverlay }),
    (activo) => {
      atajos.moviendo(activo);
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:overlay-moviendo', activo);
    },
  );
  const partida = crearOrquestadorPartida({
    crearConector: crearConectorPartida,
    overlay,
    obtenerAjustes: () => cargarAjustes(rutaAjustes),
    contexto: () => orquestador.contexto(),
    avisar: (aviso) => orquestador.avisar(aviso),
    alCambiarPartida: (activa) => atajos.enPartida(activa),
  });
  /** Sale del modo mover; fuera de partida el overlay vuelve a ocultarse. */
  function salirDeMover(): void {
    overlay.mover(false);
    if (!partida.enPartida()) overlay.ocultar();
  }
  app.on('will-quit', () => {
    atajos.liberar();
    overlay.mover(false);
  });

  ipcMain.handle('coach:estado-actual', () => orquestador.estado());
  ipcMain.handle('coach:importar', () => orquestador.importar());
  ipcMain.handle('coach:cambiar-rol', (_e, rol: unknown) => {
    if (!ROLES.includes(rol as Rol)) throw new Error('Rol no válido');
    return orquestador.cambiarRol(rol as Rol);
  });
  ipcMain.handle('coach:obtener-ajustes', () => cargarAjustes(rutaAjustes));
  ipcMain.handle('coach:guardar-ajustes', (_e, a: unknown) => {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) throw new Error('Ajustes no válidos');
    const nuevos = conservarPosicion(normalizarAjustes(a), cargarAjustes(rutaAjustes));
    guardarAjustes(rutaAjustes, nuevos);
    atajos.cambiarTecla();
  });

  // Modo mover: el estado vive en el control del overlay; al salir se guarda la posición donde quedó el panel.
  ipcMain.handle('overlay:obtener-posicion', (e) =>
    e.sender === ventanaOverlay?.webContents ? cargarAjustes(rutaAjustes).posicionOverlay : null,
  );
  ipcMain.on('overlay:guardar-posicion', (e, x: unknown, y: unknown) => {
    if (e.sender !== ventanaOverlay?.webContents) return;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      overlay.guardarPosicion(Math.round(x), Math.round(y));
    }
  });
  // El panel pide el ratón solo mientras el cursor está encima; el control lo ignora fuera del modo mover.
  ipcMain.on('overlay:capturar-raton', (e, capturar: unknown) => {
    if (e.sender !== ventanaOverlay?.webContents || typeof capturar !== 'boolean') return;
    overlay.capturarRaton(capturar);
  });
  ipcMain.on('overlay:fijar', (e) => {
    if (e.sender === ventanaOverlay?.webContents) salirDeMover();
  });
  ipcMain.handle('coach:overlay-moviendo', () => overlay.estaMoviendo());
  ipcMain.handle('coach:mover-overlay', (_e, activar: unknown) => {
    if (typeof activar !== 'boolean') throw new Error('Valor no válido');
    if (activar) overlay.mover(true);
    else salirDeMover();
    return overlay.estaMoviendo();
  });

  // Barra de título propia: solo la ventana principal puede minimizarse, maximizarse o cerrarse así.
  registrarControlVentana(ipcMain, () => ventana);

  const vigilante = new VigilanteLcu();
  vigilante.on('conectado', (cliente, dirLol: string) => {
    orquestador.conectado(cliente);
    partida.conectado(dirLol);
  });
  vigilante.on('desconectado', () => {
    orquestador.desconectado();
    partida.desconectado();
  });
  vigilante.on('fase', (fase: string) => {
    orquestador.fase(fase);
    void partida.fase(fase);
  });
  vigilante.on('seleccion', (sel) => void orquestador.alSeleccionar(sel));
  vigilante.iniciar();
  app.on('before-quit', () => vigilante.detener());

  ventanaOverlay = crearVentanaOverlay(cargarAjustes(rutaAjustes));
  ventana = crearVentanaPrincipal();
  partida.arrancar();
  // Sin la ventana principal no queda nada que hacer: el overlay oculto no debe mantener viva la app.
  ventana.on('closed', () => ventanaOverlay?.destroy());
}

/** Carga electron-updater (solo en la app empaquetada) y avisa en español cuando hay una versión descargada. */
async function actualizar(): Promise<void> {
  try {
    // electron-updater es CommonJS: según el empaquetado, el export viene con o sin `default`.
    const modulo = (await import('electron-updater')) as typeof import('electron-updater') & { default?: typeof import('electron-updater') };
    const autoUpdater = modulo.autoUpdater ?? modulo.default?.autoUpdater;
    if (!autoUpdater) throw new Error('electron-updater no expone autoUpdater');
    await buscarActualizaciones(autoUpdater as unknown as Actualizador, (texto) => {
      if (Notification.isSupported()) new Notification({ title: t('app.titulo'), body: texto }).show();
      registrar('info', texto);
    });
  } catch (e) {
    registrar('error', `No se pudo buscar actualizaciones: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (asegurarInstanciaUnica(app, () => ventana)) {
  // Sin menú de la aplicación: el menú por defecto de Electron está en inglés.
  Menu.setApplicationMenu(null);
  // Mismo identificador que el instalador (appId): lo necesitan las notificaciones de Windows.
  app.setAppUserModelId('com.coachlolia.app');
  void app.whenReady().then(() => {
    iniciar();
    if (app.isPackaged) void actualizar();
  });
  app.on('window-all-closed', () => app.quit());
}
