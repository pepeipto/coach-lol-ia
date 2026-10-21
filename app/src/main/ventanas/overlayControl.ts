import type {
  AjustesOverlay,
  AvisoOverlay,
  EscalaHud,
  EstadoCarga,
  EstadoJungla,
  EstadoOverlay,
  FraseVoz,
  IdWidget,
  ModoOverlay,
  PanelAumentos,
} from '../../shared/tiposApp';
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

/** Posición de cada widget tras arrastrarlo; la flecha lleva el tamaño de la pantalla (su calibración es por tamaño). */
export type PosicionesWidgets = Partial<Record<IdWidget, { x: number; y: number; pantalla?: { ancho: number; alto: number } }>>;

export interface ControlOverlayCompleto extends ControlOverlay {
  mover(activo: boolean): void;
  estaMoviendo(): boolean;
  /** Posición de un widget tras arrastrarlo; se persisten todas juntas al salir del modo mover. */
  guardarWidget(id: IdWidget, x: number, y: number, pantalla?: { ancho: number; alto: number }): void;
  /**
   * Un widget pide recibir el ratón mientras el cursor está encima (true) o soltarlo (false).
   * Se atiende en modo mover y, fuera de él, solo para los botones de la jungla si ese widget
   * está activo. En cualquier otro caso la ventana deja pasar siempre los clics.
   */
  capturarRaton(capturar: boolean, origen?: 'mover' | 'jungla'): void;
  enviarModo(modo: ModoOverlay): void;
  enviarConfig(config: AjustesOverlay): void;
  enviarCarga(carga: EstadoCarga): void;
  /** 3.1: la pantalla de carga se desvanece (el jugador pulsó Espacio). */
  enviarOcultarCarga(): void;
  /** Escala del HUD de LoL leída de game.cfg (null si no se sabe). */
  enviarHud(hud: EscalaHud | null): void;
  /** Vuelve a dejar pasar todos los clics (recarga o caída del renderizador del overlay). */
  soltarRaton(): void;
}

/**
 * Operaciones del overlay para el resto de la app; no falla si la ventana ya se cerró.
 * El modo mover vive aquí: cualquier cosa que muestre u oculte el overlay lo desactiva.
 * La ventana ocupa toda la pantalla, así que nunca captura el ratón entero: solo mientras el
 * cursor está sobre un widget que lo pide (capturarRaton).
 */
export function crearControlOverlay(
  obtener: () => VentanaOverlay | null,
  persistirPosiciones: (pos: PosicionesWidgets) => void,
  alCambiarMover: (activo: boolean) => void = () => {},
): ControlOverlayCompleto {
  let moviendo = false;
  let junglaActiva = false;
  let capturado = false;
  let pendientes: PosicionesWidgets = {};
  const vivo = () => {
    const v = obtener();
    return v && !v.isDestroyed() ? v : null;
  };
  const soltarRaton = (v: VentanaOverlay) => {
    capturado = false;
    v.setIgnoreMouseEvents(true, { forward: true });
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
      soltarRaton(v);
      v.webContents.send('overlay:mover', false);
    }
    if (Object.keys(pendientes).length > 0) {
      persistirPosiciones(pendientes);
      pendientes = {};
    }
    alCambiarMover(false);
  }

  const enviar = (canal: string, dato: unknown) => vivo()?.webContents.send(canal, dato);

  return {
    mostrar: () => {
      mover(false);
      vivo()?.showInactive();
    },
    ocultar: () => {
      mover(false);
      const v = vivo();
      if (!v) return;
      if (capturado) soltarRaton(v);
      v.hide();
    },
    alternar: () => {
      const v = vivo();
      if (!v) return;
      if (v.isVisible()) {
        mover(false);
        if (capturado) soltarRaton(v);
        v.hide();
      } else v.showInactive();
    },
    enviarEstado: (estado: EstadoOverlay) => enviar('overlay:estado', estado),
    enviarAviso: (aviso: AvisoOverlay) => enviar('overlay:aviso', aviso),
    enviarModo: (modo: ModoOverlay) => {
      // Fuera de la partida los widgets desaparecen: si alguno tenía el ratón, se suelta ya.
      const v = vivo();
      if (v && modo !== 'partida' && !moviendo && capturado) soltarRaton(v);
      enviar('overlay:modo', modo);
    },
    soltarRaton: () => {
      const v = vivo();
      if (v) soltarRaton(v);
    },
    enviarJungla: (jungla: EstadoJungla) => enviar('overlay:jungla', jungla),
    enviarAumentos: (panel: PanelAumentos | null) => enviar('overlay:aumentos', panel),
    enviarVoz: (frase: FraseVoz) => enviar('overlay:voz', frase),
    enviarCarga: (carga: EstadoCarga) => enviar('overlay:carga', carga),
    enviarOcultarCarga: () => vivo()?.webContents.send('overlay:carga-ocultar'),
    enviarHud: (hud: EscalaHud | null) => enviar('overlay:hud', hud),
    enviarConfig: (config: AjustesOverlay) => {
      junglaActiva = config.widgets.jungla.activo;
      const v = vivo();
      if (v && !junglaActiva && !moviendo && capturado) soltarRaton(v);
      enviar('overlay:config', config);
    },
    mover,
    estaMoviendo: () => moviendo,
    guardarWidget: (id, x, y, pantalla) => {
      pendientes = { ...pendientes, [id]: pantalla ? { x, y, pantalla } : { x, y } };
    },
    capturarRaton: (capturar, origen = 'mover') => {
      const v = vivo();
      if (!v) return;
      if (capturar) {
        const permitido = moviendo || (origen === 'jungla' && junglaActiva && v.isVisible());
        if (!permitido) return;
        capturado = true;
        v.setIgnoreMouseEvents(false);
      } else if (moviendo || capturado) soltarRaton(v);
    },
  };
}
