import { registrar } from './log';

interface AtajosGlobales {
  register(tecla: string, cb: () => void): boolean;
  unregister(tecla: string): void;
}

/** Mantiene un único atajo global; si la tecla no se puede registrar, lo anota y sigue. */
export function crearAtajo(globalShortcut: AtajosGlobales, alPulsar: () => void) {
  let actual: string | null = null;
  return {
    registrar(tecla: string): void {
      if (tecla === actual) return;
      // La nueva se registra primero: si falla, la anterior sigue funcionando.
      try {
        if (globalShortcut.register(tecla, alPulsar)) {
          if (actual) globalShortcut.unregister(actual);
          actual = tecla;
        } else registrar('aviso', `No se pudo registrar la tecla rápida ${tecla}`);
      } catch (e) {
        registrar('aviso', `Tecla rápida no válida (${tecla}): ${String(e)}`);
      }
    },
    liberar(): void {
      if (actual) globalShortcut.unregister(actual);
      actual = null;
    },
  };
}

/**
 * Decide qué teclas globales hay registradas: la tecla rápida solo durante una partida
 * (o en modo mover, donde sirve para salir de él) y Esc solo en modo mover.
 * Fuera de esos momentos no se reserva ninguna tecla del sistema.
 */
export function crearGestorAtajos(
  globalShortcut: AtajosGlobales,
  o: { tecla: () => string; alPulsar: () => void; alEsc: () => void },
) {
  const rapida = crearAtajo(globalShortcut, o.alPulsar);
  const esc = crearAtajo(globalShortcut, o.alEsc);
  let partida = false;
  let mover = false;

  function sincronizar(): void {
    if (partida || mover) rapida.registrar(o.tecla());
    else rapida.liberar();
    if (mover) esc.registrar('Escape');
    else esc.liberar();
  }

  return {
    enPartida(activo: boolean): void {
      partida = activo;
      sincronizar();
    },
    moviendo(activo: boolean): void {
      mover = activo;
      sincronizar();
    },
    /** La tecla de los ajustes cambió: se re-registra solo si ahora está activa. */
    cambiarTecla: sincronizar,
    liberar(): void {
      partida = false;
      mover = false;
      sincronizar();
    },
  };
}
