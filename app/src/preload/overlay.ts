import { contextBridge, ipcRenderer } from 'electron';
import type {
  AjustesOverlay,
  ApiOverlay,
  AvisoOverlay,
  EstadoCarga,
  EstadoJungla,
  EstadoOverlay,
  FraseVoz,
  ModoOverlay,
} from '../shared/tiposApp';

const escuchar =
  <T>(canal: string) =>
  (cb: (dato: T) => void) =>
    void ipcRenderer.on(canal, (_e, dato: T) => cb(dato));

const api: ApiOverlay = {
  alEstado: escuchar<EstadoOverlay>('overlay:estado'),
  alAviso: escuchar<AvisoOverlay>('overlay:aviso'),
  alMover: escuchar<boolean>('overlay:mover'),
  alModo: escuchar<ModoOverlay>('overlay:modo'),
  alCarga: escuchar<EstadoCarga>('overlay:carga'),
  alConfig: escuchar<AjustesOverlay>('overlay:config'),
  alJungla: escuchar<EstadoJungla>('overlay:jungla'),
  alVoz: escuchar<FraseVoz>('overlay:voz'),
  obtenerConfig: () => ipcRenderer.invoke('overlay:obtener-config'),
  guardarWidget: (id, x, y) => ipcRenderer.send('overlay:guardar-widget', id, x, y),
  guardarMinimapa: (marco) => ipcRenderer.send('overlay:guardar-minimapa', marco),
  marcarJungla: (id) => ipcRenderer.send('overlay:jungla-marcar', id),
  capturarRaton: (capturar) => ipcRenderer.send('overlay:capturar-raton', capturar),
  capturarRatonJungla: (capturar) => ipcRenderer.send('overlay:capturar-raton', capturar, 'jungla'),
  fijar: () => ipcRenderer.send('overlay:fijar'),
};

contextBridge.exposeInMainWorld('coachOverlay', api);
