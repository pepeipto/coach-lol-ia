import { contextBridge, ipcRenderer } from 'electron';
import type { ApiCoach, EstadoPrincipal } from '../shared/tiposApp';

const api: ApiCoach = {
  alCambiarEstado: (cb) => {
    ipcRenderer.on('coach:estado', (_e, estado: EstadoPrincipal) => cb(estado));
    // Pide el estado actual por si la ventana se cargó después del último cambio.
    void ipcRenderer.invoke('coach:estado-actual').then((estado: EstadoPrincipal) => cb(estado));
  },
  importar: () => ipcRenderer.invoke('coach:importar'),
  cambiarRol: (rol) => ipcRenderer.invoke('coach:cambiar-rol', rol),
  obtenerAjustes: () => ipcRenderer.invoke('coach:obtener-ajustes'),
  guardarAjustes: (a) => ipcRenderer.invoke('coach:guardar-ajustes', a),
  moverOverlay: (activar) => ipcRenderer.invoke('coach:mover-overlay', activar),
  overlayMoviendo: () => ipcRenderer.invoke('coach:overlay-moviendo'),
  alCambiarMover: (cb) => {
    const oyente = (_e: unknown, activo: boolean) => cb(activo);
    ipcRenderer.on('coach:overlay-moviendo', oyente);
    return () => void ipcRenderer.removeListener('coach:overlay-moviendo', oyente);
  },
};

contextBridge.exposeInMainWorld('coach', api);
