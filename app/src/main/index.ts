import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { join } from 'node:path';
import { ROLES, type Rol } from '@coach/shared';
import { cargarAjustes, guardarAjustes, normalizarAjustes } from './ajustes';
import { crearAtajo } from './atajo';
import { cargarDatosEstaticos } from './datos/estaticos';
import { VigilanteLcu } from './lcu/vigilante';
import { configurarDirectorioLog, registrar } from './log';
import { crearOrquestadorPartida } from './orquestador/partida';
import { crearOrquestadorSeleccion } from './orquestador/seleccion';
import { crearConectorPartida } from './partida/conector';
import { crearControlOverlay, crearVentanaOverlay } from './ventanas/overlay';
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

  const overlay = crearControlOverlay(() => ventanaOverlay);
  const partida = crearOrquestadorPartida({
    crearConector: crearConectorPartida,
    overlay,
    obtenerAjustes: () => cargarAjustes(rutaAjustes),
    contexto: () => orquestador.contexto(),
    avisar: (aviso) => orquestador.avisar(aviso),
  });
  const atajo = crearAtajo(globalShortcut, () => partida.alternar());
  atajo.registrar(cargarAjustes(rutaAjustes).teclaOverlay);
  app.on('will-quit', () => atajo.liberar());

  ipcMain.handle('coach:estado-actual', () => orquestador.estado());
  ipcMain.handle('coach:importar', () => orquestador.importar());
  ipcMain.handle('coach:cambiar-rol', (_e, rol: unknown) => {
    if (!ROLES.includes(rol as Rol)) throw new Error('Rol no válido');
    return orquestador.cambiarRol(rol as Rol);
  });
  ipcMain.handle('coach:obtener-ajustes', () => cargarAjustes(rutaAjustes));
  ipcMain.handle('coach:guardar-ajustes', (_e, a: unknown) => {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) throw new Error('Ajustes no válidos');
    const nuevos = normalizarAjustes(a);
    guardarAjustes(rutaAjustes, nuevos);
    atajo.registrar(nuevos.teclaOverlay);
  });

  // Modo mover: el overlay deja de ignorar el ratón; al salir se guarda la posición donde quedó el panel.
  let posicionPendiente: { x: number; y: number } | null = null;
  ipcMain.handle('overlay:obtener-posicion', (e) =>
    e.sender === ventanaOverlay?.webContents ? cargarAjustes(rutaAjustes).posicionOverlay : null,
  );
  ipcMain.on('overlay:guardar-posicion', (e, x: unknown, y: unknown) => {
    if (e.sender !== ventanaOverlay?.webContents) return;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      posicionPendiente = { x: Math.round(x), y: Math.round(y) };
    }
  });
  ipcMain.handle('coach:mover-overlay', (_e, activar: unknown) => {
    if (typeof activar !== 'boolean') throw new Error('Valor no válido');
    overlay.mover(activar);
    if (activar) return;
    if (posicionPendiente) {
      guardarAjustes(rutaAjustes, { ...cargarAjustes(rutaAjustes), posicionOverlay: posicionPendiente });
      posicionPendiente = null;
    }
    if (!partida.enPartida()) overlay.ocultar();
  });

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
  // Sin la ventana principal no queda nada que hacer: el overlay oculto no debe mantener viva la app.
  ventana.on('closed', () => ventanaOverlay?.destroy());
}

void app.whenReady().then(iniciar);

app.on('window-all-closed', () => app.quit());
