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
}

/**
 * Operaciones del overlay para el resto de la app; no falla si la ventana ya se cerró.
 * El modo mover vive aquí: cualquier cosa que muestre u oculte el overlay lo desactiva,
 * para que la ventana a pantalla completa nunca se quede bloqueando los clics del juego.
 */
export function crearControlOverlay(
  obtener: () => VentanaOverlay | null,
  persistirPosicion: (pos: { x: number; y: number }) => void,
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
      if (!v) return;
      moviendo = true;
      v.setIgnoreMouseEvents(false);
      v.showInactive(); // para poder colocarlo aunque no haya partida
      v.webContents.send('overlay:mover', true);
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
  };
}
