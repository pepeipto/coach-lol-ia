import { contextBridge, ipcRenderer } from 'electron';
import type { ApiOverlay, AvisoOverlay, Panel } from '../shared/tiposApp';

const api: ApiOverlay = {
  alPanel: (cb) => void ipcRenderer.on('overlay:panel', (_e, p: Panel) => cb(p)),
  alAviso: (cb) => void ipcRenderer.on('overlay:aviso', (_e, a: AvisoOverlay) => cb(a)),
  alMover: (cb) => void ipcRenderer.on('overlay:mover', (_e, activo: boolean) => cb(activo)),
  obtenerPosicion: () => ipcRenderer.invoke('overlay:obtener-posicion'),
  guardarPosicion: (x, y) => ipcRenderer.send('overlay:guardar-posicion', x, y),
  capturarRaton: (capturar) => ipcRenderer.send('overlay:capturar-raton', capturar),
  fijar: () => ipcRenderer.send('overlay:fijar'),
};

contextBridge.exposeInMainWorld('coachOverlay', api);
