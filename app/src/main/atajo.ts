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
      this.liberar();
      try {
        if (globalShortcut.register(tecla, alPulsar)) actual = tecla;
        else registrar('aviso', `No se pudo registrar la tecla rápida ${tecla}`);
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
