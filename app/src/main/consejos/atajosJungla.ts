import type { IdCampamento } from '../../shared/tiposApp';
import { crearAtajo } from '../atajo';
import { CAMPAMENTOS_JUNGLA } from './jungla';

interface AtajosGlobales {
  register(tecla: string, cb: () => void): boolean;
  unregister(tecla: string): void;
}

/**
 * Teclas globales opcionales para marcar campamentos de la jungla (ninguna por defecto). Solo se
 * registran durante una partida con el widget activo, y nunca la tecla rápida del overlay.
 */
export function crearAtajosJungla(globalShortcut: AtajosGlobales, alPulsar: (id: IdCampamento) => void) {
  const atajos = new Map(CAMPAMENTOS_JUNGLA.map((c) => [c.id, crearAtajo(globalShortcut, () => alPulsar(c.id))]));
  return {
    sincronizar(o: { activo: boolean; teclas: Partial<Record<IdCampamento, string>>; teclaOverlay: string }): void {
      const usadas = new Set<string>([o.teclaOverlay.toLowerCase()]);
      for (const [id, atajo] of atajos) {
        const tecla = o.teclas[id];
        if (o.activo && tecla && !usadas.has(tecla.toLowerCase())) {
          usadas.add(tecla.toLowerCase());
          atajo.registrar(tecla);
        } else atajo.liberar();
      }
    },
    liberar(): void {
      for (const atajo of atajos.values()) atajo.liberar();
    },
  };
}
