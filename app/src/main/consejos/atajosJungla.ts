import type { IdCampamento } from '../../shared/tiposApp';
import { chocaConLol, normalizarAcelerador } from '../../shared/teclas';
import { crearAtajo } from '../atajo';
import { CAMPAMENTOS_JUNGLA } from './jungla';

interface AtajosGlobales {
  register(tecla: string, cb: () => void): boolean;
  unregister(tecla: string): void;
}

/**
 * Teclas globales opcionales para marcar campamentos de la jungla (ninguna por defecto). Solo se
 * registran durante una partida con el widget activo; nunca la tecla rápida del overlay ni una
 * combinación que LoL ya usa (Ctrl/Alt/Mayús con Q, W, E, R, D, F, B o 1–6).
 */
export function crearAtajosJungla(globalShortcut: AtajosGlobales, alPulsar: (id: IdCampamento) => void) {
  const atajos = new Map(CAMPAMENTOS_JUNGLA.map((c) => [c.id, crearAtajo(globalShortcut, () => alPulsar(c.id))]));
  return {
    sincronizar(o: { activo: boolean; teclas: Partial<Record<IdCampamento, string>>; teclaOverlay: string }): void {
      // Se comparan en forma canónica: «CommandOrControl+Shift+O» es la misma tecla que «Ctrl+Shift+O».
      const usadas = new Set<string>([normalizarAcelerador(o.teclaOverlay)]);
      for (const [id, atajo] of atajos) {
        const tecla = o.teclas[id];
        const canonica = tecla ? normalizarAcelerador(tecla) : '';
        if (o.activo && tecla && !usadas.has(canonica) && !chocaConLol(tecla)) {
          usadas.add(canonica);
          atajo.registrar(tecla);
        } else atajo.liberar();
      }
    },
    liberar(): void {
      for (const atajo of atajos.values()) atajo.liberar();
    },
  };
}
