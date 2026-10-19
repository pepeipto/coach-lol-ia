import { contextBridge, ipcRenderer } from 'electron';
import type { AccionVentana, ApiCoach, EstadoLicencia, EstadoPrincipal } from '../shared/tiposApp';

const ACCIONES_VENTANA: AccionVentana[] = ['minimizar', 'maximizar', 'cerrar'];

const api: ApiCoach = {
  alCambiarEstado: (cb) => {
    ipcRenderer.on('coach:estado', (_e, estado: EstadoPrincipal) => cb(estado));
    // Pide el estado actual por si la ventana se cargó después del último cambio.
    void ipcRenderer.invoke('coach:estado-actual').then((estado: EstadoPrincipal) => cb(estado));
  },
  importar: () => ipcRenderer.invoke('coach:importar'),
  cambiarRol: (rol) => ipcRenderer.invoke('coach:cambiar-rol', rol),
  cambiarOpcion: (i) => ipcRenderer.invoke('coach:cambiar-opcion', i),
  obtenerAjustes: () => ipcRenderer.invoke('coach:obtener-ajustes'),
  guardarAjustes: (a) => ipcRenderer.invoke('coach:guardar-ajustes', a),
  moverOverlay: (activar) => ipcRenderer.invoke('coach:mover-overlay', activar),
  overlayMoviendo: () => ipcRenderer.invoke('coach:overlay-moviendo'),
  alCambiarMover: (cb) => {
    const oyente = (_e: unknown, activo: boolean) => cb(activo);
    ipcRenderer.on('coach:overlay-moviendo', oyente);
    return () => void ipcRenderer.removeListener('coach:overlay-moviendo', oyente);
  },
  ventana: (accion) => {
    if (ACCIONES_VENTANA.includes(accion)) ipcRenderer.send(`ventana:${accion}`);
  },
  licencia: () => ipcRenderer.invoke('coach:licencia-estado'),
  activarLicencia: (clave) => ipcRenderer.invoke('coach:licencia-activar', clave),
  quitarLicencia: () => ipcRenderer.invoke('coach:licencia-quitar'),
  abrirWeb: (ruta) => ipcRenderer.invoke('coach:abrir-web', ruta),
  asistente: (mensajes) => ipcRenderer.invoke('coach:asistente', mensajes),
  campeones: (filtro) => ipcRenderer.invoke('coach:campeones', filtro),
  buildDe: (campeon, rol) => ipcRenderer.invoke('coach:build-de', campeon, rol),
  alCambiarLicencia: (cb) => {
    const oyente = (_e: unknown, estado: EstadoLicencia) => cb(estado);
    ipcRenderer.on('coach:licencia', oyente);
    return () => void ipcRenderer.removeListener('coach:licencia', oyente);
  },
};

contextBridge.exposeInMainWorld('coach', api);
