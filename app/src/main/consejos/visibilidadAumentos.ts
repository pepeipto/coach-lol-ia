import type { EstadoPartida } from '../../shared/tiposApp';

/**
 * Cuándo se ve el panel de aumentos en ARAM: Caos (3.4). Los aumentos se eligen al empezar la partida y al llegar a
 * los niveles 7, 11 y 15 (wiki de LoL, «ARAM: Mayhem»), y la elección se puede dejar para cuando estés muerto. El
 * panel sale solo en esos momentos y la tecla (Alt+Shift+A) lo enseña u oculta a mano en cualquier momento; lo que
 * decide la tecla dura hasta el siguiente cambio automático.
 */
export const NIVELES_AUMENTO = [7, 11, 15] as const;
/** Segundos del principio de la partida con el panel a la vista (primera elección). */
export const INICIO_S = 90;
/** Segundos con el panel a la vista tras llegar a un nivel de aumento. */
export const TRAS_NIVEL_S = 90;

export class VisibilidadAumentos {
  private nivelAnterior = 0;
  private nivelEn: number | null = null;
  private manual: boolean | null = null;
  private autoAnterior = false;
  private ultimo = false;

  /** Si el panel debe verse con este estado de la partida (siempre false fuera de ARAM: Caos). */
  procesar(estado: Pick<EstadoPartida, 'tiempo' | 'nivel' | 'muerto' | 'modo'>): boolean {
    if (estado.modo !== 'caos') return (this.ultimo = false);
    const { tiempo, nivel } = estado;
    // Al entrar tarde (reconexión) el primer nivel no cuenta como subida.
    if (this.nivelAnterior > 0 && NIVELES_AUMENTO.some((n) => this.nivelAnterior < n && nivel >= n)) this.nivelEn = tiempo;
    this.nivelAnterior = nivel;
    const auto = tiempo < INICIO_S || (this.nivelEn !== null && tiempo - this.nivelEn < TRAS_NIVEL_S) || !!estado.muerto;
    if (auto !== this.autoAnterior) {
      this.autoAnterior = auto;
      this.manual = null;
    }
    return (this.ultimo = this.manual ?? auto);
  }

  /** La tecla: invierte lo que se ve ahora. */
  alternar(): boolean {
    this.manual = !this.ultimo;
    return (this.ultimo = this.manual);
  }

  reiniciar(): void {
    this.nivelAnterior = 0;
    this.nivelEn = null;
    this.manual = null;
    this.autoAnterior = false;
    this.ultimo = false;
  }
}
