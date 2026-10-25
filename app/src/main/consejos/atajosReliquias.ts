import { RELIQUIAS } from '../../shared/reliquias';
import { chocaConLol, normalizarAcelerador } from '../../shared/teclas';
import type { IdReliquia } from '../../shared/tiposApp';
import { crearAtajo } from '../atajo';

interface AtajosGlobales {
  register(tecla: string, cb: () => void): boolean;
  unregister(tecla: string): void;
}

/**
 * 3.9: teclas globales opcionales para marcar las reliquias de vida de ARAM (ninguna por defecto), como las de la
 * jungla. Solo se registran durante una partida en el Abismo con el widget activo; nunca una tecla que ya usa otra
 * acción (`ocupadas`: la del overlay, las de la jungla, la de los aumentos…) ni una combinación que LoL ya usa.
 */
export function crearAtajosReliquias(globalShortcut: AtajosGlobales, alPulsar: (id: IdReliquia) => void) {
  const atajos = new Map(RELIQUIAS.map((r) => [r.id, crearAtajo(globalShortcut, () => alPulsar(r.id))]));
  return {
    sincronizar(o: { activo: boolean; teclas: Partial<Record<IdReliquia, string>>; ocupadas: string[] }): void {
      const usadas = new Set(o.ocupadas.filter(Boolean).map(normalizarAcelerador));
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
