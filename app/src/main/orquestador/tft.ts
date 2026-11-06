import type { ModoOverlay } from '../../shared/tiposApp';
import { esColaTft, type ChuletaTftVista, type CompChuletaTft, type PanelTft } from '../../shared/tftChuleta';
import { registrar } from '../log';

/*
 * 3.15: chuleta de TFT en la partida. Con una partida de TFT en curso (fase InProgress y cola de TFT) y alguna
 * composición elegida, la tecla del overlay abre y cierra un panel fijo con esas composiciones y la tabla de recetas.
 * El panel empieza cerrado. No lee nada de la partida (la API de partida no da datos en TFT y Riot no permite ayudas
 * en tiempo real): es lo mismo que tener la guía abierta en otra pantalla. Gratis para todos.
 */

interface OverlayTft {
  mostrar(): void;
  ocultar(): void;
  enviarModo(modo: ModoOverlay): void;
  enviarTft(panel: PanelTft): void;
}

interface Dependencias {
  overlay: OverlayTft;
  /** Composiciones elegidas en la pestaña TFT. */
  elegidas: () => readonly CompChuletaTft[];
  /** Tecla del overlay (la que abre y cierra la chuleta). */
  tecla: () => string;
  /** Pone nombres e iconos a las composiciones elegidas (Data Dragon). */
  preparar: (elegidas: readonly CompChuletaTft[]) => Promise<ChuletaTftVista>;
  /** true al empezar la partida de TFT con chuleta (la tecla del overlay se reserva), false al acabar. */
  alCambiarActiva?: (activa: boolean) => void;
}

export function crearOrquestadorTft(dep: Dependencias) {
  let fase = 'None';
  let cola: number | null = null;
  let gameMode: string | null = null;
  let activa = false;
  let abierto = false;
  let chuleta: ChuletaTftVista | null = null;
  /** Cambia en cada partida: una preparación que llega tarde (partida ya acabada) no se envía. */
  let generacion = 0;

  const esPartidaTft = () => fase === 'InProgress' && esColaTft(cola, gameMode);

  function enviar(): void {
    if (chuleta) dep.overlay.enviarTft({ abierto, chuleta, tecla: dep.tecla() });
  }

  async function empezar(): Promise<void> {
    const elegidas = dep.elegidas();
    if (activa || elegidas.length === 0) return;
    activa = true;
    abierto = false;
    const mia = ++generacion;
    registrar('info', `Partida de TFT: chuleta con ${elegidas.length} composición(es)`);
    dep.alCambiarActiva?.(true);
    try {
      const lista = await dep.preparar(elegidas);
      if (mia !== generacion || !activa) return;
      chuleta = lista;
      dep.overlay.enviarModo('tft');
      enviar();
    } catch (e) {
      registrar('aviso', `No se pudo preparar la chuleta de TFT: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function terminar(): void {
    if (!activa) return;
    activa = false;
    abierto = false;
    chuleta = null;
    generacion++;
    dep.overlay.enviarTft(null);
    dep.overlay.enviarModo('oculto');
    dep.overlay.ocultar();
    dep.alCambiarActiva?.(false);
  }

  function evaluar(): void {
    if (esPartidaTft()) void empezar();
    else terminar();
  }

  return {
    fase(nueva: string): void {
      // Reconnect no corta la partida (como en LoL).
      if (nueva === 'Reconnect' && activa) return;
      fase = nueva;
      evaluar();
    },
    /** Cola de la sesión del cliente (gameflow); null al volver al lobby. */
    cola(nueva: number | null, info: { gameMode?: string } = {}): void {
      cola = nueva;
      gameMode = info.gameMode ?? null;
      evaluar();
    },
    /** La partida en curso es de TFT (aunque no haya chuleta): el coach de LoL no debe arrancar. */
    esTft: (): boolean => esPartidaTft(),
    /** Hay chuleta en esta partida: la tecla del overlay es suya. */
    activa: (): boolean => activa,
    /** Tecla del overlay: abre o cierra el panel. */
    alternar(): void {
      if (!activa || !chuleta) return;
      abierto = !abierto;
      if (abierto) {
        enviar();
        dep.overlay.mostrar();
      } else {
        dep.overlay.ocultar();
        enviar();
      }
    },
  };
}
