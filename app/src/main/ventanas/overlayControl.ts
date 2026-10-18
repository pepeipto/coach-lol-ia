import type { AvisoOverlay, Panel } from '../../shared/tiposApp';
import type { ControlOverlay } from '../orquestador/partida';

/** Lo que se usa de BrowserWindow (sustituible en las pruebas). */
export interface VentanaOverlay {
  isDestroyed(): boolean;
  isVisible(): boolean;
  showInactive(): void;
  hide(): void;
  setIgnoreMouseEvents(ignorar: boolean, opciones?: { forward: boolean }): void;
  webContents: { send(canal: string, ...args: unknown[]): void };
}

export interface ControlOverlayCompleto extends ControlOverlay {
  mover(activo: boolean): void;
  estaMoviendo(): boolean;
  /** Posición del panel tras arrastrarlo; se persiste al salir del modo mover. */
  guardarPosicion(x: number, y: number): void;
  /**
   * El panel pide recibir el ratón mientras el cursor está encima (true) o soltarlo (false).
   * Solo se atiende en modo mover: fuera de él la ventana deja pasar siempre los clics.
   */
  capturarRaton(capturar: boolean): void;
}

/**
 * Operaciones del overlay para el resto de la app; no falla si la ventana ya se cerró.
 * El modo mover vive aquí: cualquier cosa que muestre u oculte el overlay lo desactiva.
 * La ventana ocupa toda la pantalla, así que nunca captura el ratón entero: ni siquiera en
 * modo mover, donde solo lo recibe mientras el cursor está sobre el panel (capturarRaton).
 */
export function crearControlOverlay(
  obtener: () => VentanaOverlay | null,
  persistirPosicion: (pos: { x: number; y: number }) => void,
  alCambiarMover: (activo: boolean) => void = () => {},
): ControlOverlayCompleto {
  let moviendo = false;
  let pendiente: { x: number; y: number } | null = null;
  const vivo = () => {
    const v = obtener();
    return v && !v.isDestroyed() ? v : null;
  };

  function mover(activo: boolean): void {
    const v = vivo();
    if (activo) {
      if (!v || moviendo) return;
      moviendo = true;
      v.showInactive(); // para poder colocarlo aunque no haya partida
      v.webContents.send('overlay:mover', true);
      alCambiarMover(true);
      return;
    }
    if (!moviendo) return;
    moviendo = false;
    if (v) {
      v.setIgnoreMouseEvents(true, { forward: true });
      v.webContents.send('overlay:mover', false);
    }
    if (pendiente) {
      persistirPosicion(pendiente);
      pendiente = null;
    }
    alCambiarMover(false);
  }

  return {
    mostrar: () => {
      mover(false);
      vivo()?.showInactive();
    },
    ocultar: () => {
      mover(false);
      vivo()?.hide();
    },
    alternar: () => {
      const v = vivo();
      if (!v) return;
      if (v.isVisible()) {
        mover(false);
        v.hide();
      } else v.showInactive();
    },
    enviarPanel: (panel: Panel) => vivo()?.webContents.send('overlay:panel', panel),
    enviarAviso: (aviso: AvisoOverlay) => vivo()?.webContents.send('overlay:aviso', aviso),
    mover,
    estaMoviendo: () => moviendo,
    guardarPosicion: (x, y) => {
      pendiente = { x, y };
    },
    capturarRaton: (capturar) => {
      if (!moviendo) return;
      const v = vivo();
      if (!v) return;
      if (capturar) v.setIgnoreMouseEvents(false);
      else v.setIgnoreMouseEvents(true, { forward: true });
    },
  };
}
