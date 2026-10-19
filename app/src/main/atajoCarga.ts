import { crearAtajo } from './atajo';

/** Tecla que oculta la pantalla de carga (acelerador de Electron). */
export const TECLA_OCULTAR_CARGA = 'Space';

interface AtajosGlobales {
  register(tecla: string, cb: () => void): boolean;
  unregister(tecla: string): void;
}

/** Lo que decide si Espacio se reserva. */
export interface EstadoAtajoCarga {
  /** La pantalla de carga se ve (activa, no oculta ni desactivada). */
  cargaVisible: boolean;
  /** Ajuste «Ocultar con Espacio». */
  activado: boolean;
  /** Ya se juega la partida (el overlay de la partida está a la vista). */
  enPartida: boolean;
}

/**
 * 3.1: Espacio oculta la pantalla de carga. En la partida Espacio centra la cámara, así que solo se reserva mientras
 * la pantalla de carga se ve, con el ajuste encendido y sin partida en juego; en cualquier otro caso se suelta al
 * momento. Al pulsarla se suelta antes de avisar (nunca queda reservada por lo que pase después).
 */
export function crearAtajoCarga(globalShortcut: AtajosGlobales, alPulsar: () => void) {
  const atajo = crearAtajo(globalShortcut, () => {
    liberar();
    alPulsar();
  });
  const liberar = (): void => atajo.liberar();
  return {
    sincronizar(e: EstadoAtajoCarga): void {
      // registrar no hace nada si ya está reservada; si otra app la tiene, se anota en el registro y sigue.
      if (e.cargaVisible && e.activado && !e.enPartida) atajo.registrar(TECLA_OCULTAR_CARGA);
      else liberar();
    },
    liberar,
  };
}
