import { contextBridge, ipcRenderer } from 'electron';
import type {
  AjustesOverlay,
  ApiOverlay,
  AvisoOverlay,
  EscalaHud,
  EstadoCarga,
  EstadoJungla,
  EstadoReliquias,
  EstadoOverlay,
  FraseVoz,
  ModoOverlay,
  PanelAumentos,
} from '../shared/tiposApp';

const escuchar =
  <T>(canal: string) =>
  (cb: (dato: T) => void) =>
    void ipcRenderer.on(canal, (_e, dato: T) => cb(dato));


/** Idioma de la app, leído de main al cargar (síncrono: los textos salen ya en ese idioma). */
function idiomaInicial(): string {
  try {
    return String(ipcRenderer.sendSync('coach:idioma-actual') ?? 'es');
  } catch {
    return 'es';
  }
}

const api: ApiOverlay = {
  idioma: idiomaInicial(),
  alCambiarIdioma: (cb) => {
    const oyente = (_e: unknown, idioma: string) => cb(idioma);
    ipcRenderer.on('coach:idioma', oyente);
    return () => void ipcRenderer.removeListener('coach:idioma', oyente);
  },
  alEstado: escuchar<EstadoOverlay>('overlay:estado'),
  alAviso: escuchar<AvisoOverlay>('overlay:aviso'),
  alMover: escuchar<boolean>('overlay:mover'),
  alModo: escuchar<ModoOverlay>('overlay:modo'),
  alCarga: escuchar<EstadoCarga>('overlay:carga'),
  alOcultarCarga: (cb) => void ipcRenderer.on('overlay:carga-ocultar', () => cb()),
  alConfig: escuchar<AjustesOverlay>('overlay:config'),
  alJungla: escuchar<EstadoJungla>('overlay:jungla'),
  alAumentos: escuchar<PanelAumentos | null>('overlay:aumentos'),
  alReliquias: escuchar<EstadoReliquias>('overlay:reliquias'),
  alVoz: escuchar<FraseVoz>('overlay:voz'),
  alHud: escuchar<EscalaHud | null>('overlay:hud'),
  obtenerConfig: () => ipcRenderer.invoke('overlay:obtener-config'),
  obtenerHud: () => ipcRenderer.invoke('overlay:obtener-hud'),
  guardarWidget: (id, x, y, pantalla) => ipcRenderer.send('overlay:guardar-widget', id, x, y, pantalla),
  guardarMinimapa: (marco) => ipcRenderer.send('overlay:guardar-minimapa', marco),
  marcarJungla: (id) => ipcRenderer.send('overlay:jungla-marcar', id),
  marcarReliquia: (id) => ipcRenderer.send('overlay:reliquia-marcar', id),
  capturarRaton: (capturar) => ipcRenderer.send('overlay:capturar-raton', capturar),
  capturarRatonJungla: (capturar) => ipcRenderer.send('overlay:capturar-raton', capturar, 'jungla'),
  fijar: () => ipcRenderer.send('overlay:fijar'),
  sintetizarVoz: (texto) => ipcRenderer.invoke('voz:sintetizar', texto),
  prepararVoz: (texto) => ipcRenderer.send('voz:preparar', texto),
  // 3.8: subtítulos de la fuente para OBS (la frase que empieza a sonar).
  vozDicha: (texto) => ipcRenderer.send('overlay:voz-dicha', texto),
};

contextBridge.exposeInMainWorld('coachOverlay', api);
