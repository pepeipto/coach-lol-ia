import { contextBridge, ipcRenderer } from 'electron';
import type { AccionVentana, Ajustes, ApiCoach, EntradaAnalisis, EstadoAnalisis, EstadoLicencia, EstadoPrincipal, EstadoVozNatural } from '../shared/tiposApp';
import type { Perfil } from '../shared/perfil';
import type { EstadoObs } from '../shared/streamer';

const ACCIONES_VENTANA: AccionVentana[] = ['minimizar', 'maximizar', 'cerrar'];


/** Idioma de la app, leído de main al cargar (síncrono: los textos salen ya en ese idioma). */
function idiomaInicial(): string {
  try {
    return String(ipcRenderer.sendSync('coach:idioma-actual') ?? 'es');
  } catch {
    return 'es';
  }
}

/** Tema de la ventana principal, leído de main al cargar (síncrono: se pinta ya con él). */
function temaInicial(): string {
  try {
    return String(ipcRenderer.sendSync('coach:tema-actual') ?? 'clasico');
  } catch {
    return 'clasico';
  }
}

const api: ApiCoach = {
  idioma: idiomaInicial(),
  tema: temaInicial(),
  alCambiarIdioma: (cb) => {
    const oyente = (_e: unknown, idioma: string) => cb(idioma);
    ipcRenderer.on('coach:idioma', oyente);
    return () => void ipcRenderer.removeListener('coach:idioma', oyente);
  },
  alCambiarEstado: (cb) => {
    ipcRenderer.on('coach:estado', (_e, estado: EstadoPrincipal) => cb(estado));
    // Pide el estado actual por si la ventana se cargó después del último cambio.
    void ipcRenderer.invoke('coach:estado-actual').then((estado: EstadoPrincipal) => cb(estado));
  },
  importar: (opciones) => ipcRenderer.invoke('coach:importar', opciones),
  cambiarRol: (rol) => ipcRenderer.invoke('coach:cambiar-rol', rol),
  cambiarOpcion: (i) => ipcRenderer.invoke('coach:cambiar-opcion', i),
  cambiarRunas: (i) => ipcRenderer.invoke('coach:cambiar-runas', i),
  obtenerAjustes: () => ipcRenderer.invoke('coach:obtener-ajustes'),
  guardarAjustes: (a) => ipcRenderer.invoke('coach:guardar-ajustes', a),
  moverOverlay: (activar) => ipcRenderer.invoke('coach:mover-overlay', activar),
  overlayMoviendo: () => ipcRenderer.invoke('coach:overlay-moviendo'),
  alCambiarMover: (cb) => {
    const oyente = (_e: unknown, activo: boolean) => cb(activo);
    ipcRenderer.on('coach:overlay-moviendo', oyente);
    return () => void ipcRenderer.removeListener('coach:overlay-moviendo', oyente);
  },
  alCambiarAjustes: (cb) => {
    const oyente = (_e: unknown, a: Ajustes) => cb(a);
    ipcRenderer.on('coach:ajustes-cambiados', oyente);
    return () => void ipcRenderer.removeListener('coach:ajustes-cambiados', oyente);
  },
  restablecerMinimapa: () => ipcRenderer.invoke('coach:restablecer-minimapa'),
  ventana: (accion) => {
    if (ACCIONES_VENTANA.includes(accion)) ipcRenderer.send(`ventana:${accion}`);
  },
  licencia: () => ipcRenderer.invoke('coach:licencia-estado'),
  activarLicencia: (clave) => ipcRenderer.invoke('coach:licencia-activar', clave),
  quitarLicencia: () => ipcRenderer.invoke('coach:licencia-quitar'),
  abrirWeb: (ruta) => ipcRenderer.invoke('coach:abrir-web', ruta),
  asistente: (mensajes) => ipcRenderer.invoke('coach:asistente', mensajes),
  campeones: (filtro) => ipcRenderer.invoke('coach:campeones', filtro),
  buildDe: (campeon, rol, modo) => ipcRenderer.invoke('coach:build-de', campeon, rol, modo),
  counters: (campeon, rol) => ipcRenderer.invoke('coach:counters', campeon, rol),
  sinergias: (campeon, rol) => ipcRenderer.invoke('coach:sinergias', campeon, rol),
  importarEnfrentamiento: () => ipcRenderer.invoke('coach:importar-enfrentamiento'),
  sintetizarVoz: (texto) => ipcRenderer.invoke('voz:sintetizar', texto),
  estadoVozNatural: () => ipcRenderer.invoke('voz:estado'),
  descargarVozNatural: () => ipcRenderer.invoke('voz:descargar'),
  cancelarDescargaVoz: () => ipcRenderer.invoke('voz:cancelar'),
  alCambiarVozNatural: (cb) => {
    const oyente = (_e: unknown, estado: EstadoVozNatural) => cb(estado);
    ipcRenderer.on('voz:estado', oyente);
    return () => void ipcRenderer.removeListener('voz:estado', oyente);
  },
  historialAnalisis: () => ipcRenderer.invoke('coach:analisis-historial'),
  estadoAnalisis: () => ipcRenderer.invoke('coach:analisis-estado'),
  alAnalisis: (cb) => {
    const oyente = (_e: unknown, dato: { estado: EstadoAnalisis; entrada?: EntradaAnalisis; hablar?: boolean }) => cb(dato);
    ipcRenderer.on('coach:analisis', oyente);
    return () => void ipcRenderer.removeListener('coach:analisis', oyente);
  },
  alNavegar: (cb) => {
    const oyente = (_e: unknown, vista: string) => cb(vista);
    ipcRenderer.on('coach:navegar', oyente);
    return () => void ipcRenderer.removeListener('coach:navegar', oyente);
  },
  perfil: (actualizar) => ipcRenderer.invoke('coach:perfil', !!actualizar),
  lineaTiempo: (id) => ipcRenderer.invoke('coach:perfil-linea', id),
  elegirReto: (id) => ipcRenderer.invoke('coach:perfil-reto', id),
  estadisticasPersonales: (consulta) => ipcRenderer.invoke('coach:personal-stats', consulta),
  compartirTarjeta: (png, accion, nombre) => ipcRenderer.invoke('coach:compartir-tarjeta', png, accion, nombre),
  coachPersonal: (mensajes) => ipcRenderer.invoke('coach:personal', mensajes),
  consumo: () => ipcRenderer.invoke('coach:consumo'),
  alPerfil: (cb) => {
    const oyente = (_e: unknown, p: Perfil) => cb(p);
    ipcRenderer.on('coach:perfil', oyente);
    return () => void ipcRenderer.removeListener('coach:perfil', oyente);
  },
  // 3.8: modo streamer (fuente para OBS y portapapeles).
  estadoObs: () => ipcRenderer.invoke('streamer:obs-estado'),
  regenerarTokenObs: () => ipcRenderer.invoke('streamer:obs-regenerar'),
  alCambiarObs: (cb) => {
    const oyente = (_e: unknown, estado: EstadoObs) => cb(estado);
    ipcRenderer.on('streamer:obs', oyente);
    return () => void ipcRenderer.removeListener('streamer:obs', oyente);
  },
  copiarTexto: (texto) => ipcRenderer.invoke('streamer:copiar', texto),
  alCambiarLicencia: (cb) => {
    const oyente = (_e: unknown, estado: EstadoLicencia) => cb(estado);
    ipcRenderer.on('coach:licencia', oyente);
    return () => void ipcRenderer.removeListener('coach:licencia', oyente);
  },
};

contextBridge.exposeInMainWorld('coach', api);
