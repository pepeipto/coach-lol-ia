import { t } from '../shared/i18n';
import { registrar } from './log';

/** Lo que se usa del autoUpdater de electron-updater (sustituible en las pruebas). */
export interface Actualizador {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  on(evento: 'update-available', cb: (info: { version: string }) => void): unknown;
  on(evento: 'download-progress', cb: (p: { percent: number }) => void): unknown;
  on(evento: 'update-downloaded', cb: (info: { version: string }) => void): unknown;
  on(evento: 'error', cb: (e: unknown) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface OpcionesActualizar {
  /** Texto para la ventana principal (null lo quita). */
  avisar: (texto: string | null) => void;
  /**
   * No se puede reiniciar ahora: selección de campeón, pantalla de carga, partida, reconexión… (ver `ocupado.ts`).
   * Nunca se reinicia la app en esos momentos.
   */
  ocupado: () => boolean;
  /** Programa una repetición (inyectable en las pruebas); devuelve una función que la cancela. */
  programar?: (cb: () => void, ms: number) => () => void;
}

/** Cada cuánto se vuelve a buscar una versión nueva con la app abierta. */
export const INTERVALO_BUSQUEDA_MS = 4 * 60 * 60_000;
/** Cada cuánto se comprueba si ya terminó la partida para instalar lo descargado. */
export const ESPERA_FIN_PARTIDA_MS = 30_000;

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Actualización automática desde GitHub Releases: al arrancar (y luego cada 4 h) busca la última versión,
 * la descarga enseñando el progreso y, en cuanto está lista, la instala en silencio y vuelve a abrir la app.
 * Nunca reinicia en medio de una partida: espera a que termine (y, si la app se cierra antes, se instala al salir).
 * No usa checkForUpdatesAndNotify, cuya notificación está en inglés: los textos salen de los archivos de idioma.
 * Un fallo nunca debe tumbar la app.
 */
export function crearActualizacionAutomatica(actualizador: Actualizador, o: OpcionesActualizar) {
  const programar =
    o.programar ??
    ((cb: () => void, ms: number) => {
      const id = setTimeout(cb, ms);
      return () => clearTimeout(id);
    });
  let nueva = '';
  let descargada: string | null = null;
  let instalando = false;
  let decena = -1;
  let cancelar: (() => void) | null = null;

  function instalarSiSePuede(): void {
    cancelar = null;
    if (!descargada || instalando) return;
    if (o.ocupado()) {
      o.avisar(t('actualizacion.trasPartida', { version: descargada }));
      cancelar = programar(instalarSiSePuede, ESPERA_FIN_PARTIDA_MS);
      return;
    }
    instalando = true;
    o.avisar(t('actualizacion.instalando', { version: descargada }));
    registrar('info', `Instalando la versión ${descargada} y reiniciando la app`);
    try {
      // Silenciosa (sin el asistente del instalador) y vuelve a abrir la app al terminar.
      actualizador.quitAndInstall(true, true);
    } catch (e) {
      instalando = false;
      registrar('error', `No se pudo instalar la actualización: ${mensaje(e)}`);
      o.avisar(t('actualizacion.descargada', { version: descargada }));
    }
  }

  async function buscar(): Promise<void> {
    cancelar = null;
    try {
      await actualizador.checkForUpdates();
    } catch (e) {
      registrar('error', `No se pudo buscar actualizaciones: ${mensaje(e)}`);
    }
    if (!descargada && !cancelar) cancelar = programar(() => void buscar(), INTERVALO_BUSQUEDA_MS);
  }

  return {
    async iniciar(): Promise<void> {
      try {
        actualizador.logger = {
          info: (m: unknown) => registrar('info', String(m)),
          warn: (m: unknown) => registrar('aviso', String(m)),
          error: (m: unknown) => registrar('error', String(m)),
          debug: () => {},
        };
        actualizador.autoDownload = true;
        // Si la app se cierra antes de poder reiniciar (p. ej. durante una partida), se instala al salir.
        actualizador.autoInstallOnAppQuit = true;
        actualizador.on('update-available', (info) => {
          nueva = info.version;
          decena = 0;
          o.avisar(t('actualizacion.descargando', { version: nueva, porcentaje: 0 }));
        });
        actualizador.on('download-progress', (p) => {
          const porcentaje = Math.max(0, Math.min(100, Math.floor(p?.percent ?? 0)));
          // Solo al cambiar de decena: no saturar la ventana con mensajes.
          if (Math.floor(porcentaje / 10) === decena) return;
          decena = Math.floor(porcentaje / 10);
          o.avisar(t('actualizacion.descargando', { version: nueva, porcentaje }));
        });
        actualizador.on('update-downloaded', (info) => {
          descargada = info.version;
          cancelar?.();
          instalarSiSePuede();
        });
        actualizador.on('error', (e) => {
          registrar('error', `Actualización: ${mensaje(e)}`);
          if (!descargada) o.avisar(null);
        });
      } catch (e) {
        registrar('error', `No se pudo preparar la actualización: ${mensaje(e)}`);
        return;
      }
      await buscar();
    },
    detener(): void {
      cancelar?.();
      cancelar = null;
    },
  };
}
