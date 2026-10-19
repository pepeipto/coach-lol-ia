/** Primer intento tras arrancar la app (deja que arranque todo lo demás). */
export const ESPERA_INICIAL_MS = 20_000;
/** Reintento mientras el jugador está en la selección, la carga o la partida (y primer reintento tras un fallo). */
export const REINTENTO_MS = 60_000;
/** Mientras descarga, cada cuánto se mira si ha empezado la selección, la carga o la partida. */
export const VIGILANCIA_MS = 5_000;
/** Tras un fallo el reintento se duplica (1, 2, 4… min) hasta este máximo. */
export const REINTENTO_MAX_MS = 60 * 60_000;
/** Tras estos fallos seguidos no se reintenta sola en esta sesión (queda el botón «Reintentar»). */
export const MAX_FALLOS_AUTO = 5;

export interface DepsDescargaAuto {
  /** El motor elegido en ajustes: con la voz de Windows no se descarga nada. */
  motor(): 'pack' | 'natural' | 'sistema';
  /** Falta algo por descargar para el idioma actual (modelo natural o paquete pregrabado). */
  pendiente(): boolean;
  /** Selección de campeón, pantalla de carga o partida: no se gasta red ni disco en ese momento. */
  ocupado(): boolean;
  descargar(): Promise<void>;
  /** Corta la descarga en curso (lo bajado se conserva y se reanuda luego). */
  cancelar?(): void;
  programar?: (cb: () => void, ms: number) => () => void;
}

/**
 * 3.1: la voz natural (y la pregrabada, si hay paquete) se descarga sola en segundo plano, para que nadie se quede
 * con la voz robótica de Windows sin saber que hay otra. Nunca durante la selección, la carga ni la partida: si
 * empiezan mientras descarga, se corta (se reanuda después donde se quedó). Si falla, se reintenta cada vez más
 * tarde y, tras MAX_FALLOS_AUTO fallos seguidos, ya no sola en esta sesión. Devuelve una función que la detiene.
 */
export function programarDescargaAutomatica(d: DepsDescargaAuto): () => void {
  const programar =
    d.programar ??
    ((cb: () => void, ms: number) => {
      const id = setTimeout(cb, ms);
      return () => clearTimeout(id);
    });
  let cancelar: (() => void) | null = null;
  let cancelarVigilancia: (() => void) | null = null;
  let detenida = false;
  let fallos = 0;

  const vigilar = (estado: { cortadaPorPartida: boolean }): void => {
    cancelarVigilancia = programar(() => {
      cancelarVigilancia = null;
      if (detenida) return;
      if (d.ocupado()) {
        estado.cortadaPorPartida = true;
        d.cancelar?.();
      } else vigilar(estado);
    }, VIGILANCIA_MS);
  };

  const intentar = (): void => {
    cancelar = null;
    if (detenida || d.motor() === 'sistema' || !d.pendiente()) return;
    if (d.ocupado()) {
      cancelar = programar(intentar, REINTENTO_MS);
      return;
    }
    const estado = { cortadaPorPartida: false };
    vigilar(estado);
    const alAcabar = (): void => {
      cancelarVigilancia?.();
      cancelarVigilancia = null;
      if (detenida || !d.pendiente()) return;
      if (estado.cortadaPorPartida) {
        cancelar = programar(intentar, REINTENTO_MS);
        return;
      }
      fallos++;
      if (fallos >= MAX_FALLOS_AUTO) return;
      cancelar = programar(intentar, Math.min(REINTENTO_MS * 2 ** (fallos - 1), REINTENTO_MAX_MS));
    };
    d.descargar().then(alAcabar, alAcabar);
  };

  cancelar = programar(intentar, ESPERA_INICIAL_MS);
  return () => {
    detenida = true;
    cancelar?.();
    cancelar = null;
    cancelarVigilancia?.();
    cancelarVigilancia = null;
  };
}
