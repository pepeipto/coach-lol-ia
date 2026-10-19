/** Primer intento tras arrancar la app (deja que arranque todo lo demás). */
export const ESPERA_INICIAL_MS = 20_000;
/** Reintento mientras el jugador está en la selección, la carga o la partida, o si la descarga falló. */
export const REINTENTO_MS = 60_000;

export interface DepsDescargaAuto {
  /** El motor elegido en ajustes: con la voz de Windows no se descarga nada. */
  motor(): 'pack' | 'natural' | 'sistema';
  /** Falta algo por descargar para el idioma actual (modelo natural o paquete pregrabado). */
  pendiente(): boolean;
  /** Selección de campeón, pantalla de carga o partida: no se gasta red ni disco en ese momento. */
  ocupado(): boolean;
  descargar(): Promise<void>;
  programar?: (cb: () => void, ms: number) => () => void;
}

/**
 * 3.1: la voz natural (y la pregrabada, si hay paquete) se descarga sola en segundo plano, para que nadie se quede
 * con la voz robótica de Windows sin saber que hay otra. Nunca durante la selección, la carga ni la partida; si
 * falla, se reintenta más tarde. Devuelve una función que la detiene.
 */
export function programarDescargaAutomatica(d: DepsDescargaAuto): () => void {
  const programar =
    d.programar ??
    ((cb: () => void, ms: number) => {
      const id = setTimeout(cb, ms);
      return () => clearTimeout(id);
    });
  let cancelar: (() => void) | null = null;
  let detenida = false;

  const intentar = (): void => {
    cancelar = null;
    if (detenida || d.motor() === 'sistema' || !d.pendiente()) return;
    if (d.ocupado()) {
      cancelar = programar(intentar, REINTENTO_MS);
      return;
    }
    d.descargar().then(
      () => {
        if (!detenida && d.pendiente()) cancelar = programar(intentar, REINTENTO_MS);
      },
      () => {
        if (!detenida) cancelar = programar(intentar, REINTENTO_MS);
      },
    );
  };

  cancelar = programar(intentar, ESPERA_INICIAL_MS);
  return () => {
    detenida = true;
    cancelar?.();
    cancelar = null;
  };
}
