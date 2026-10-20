import { MODOS_CONSEJO, type MomentoConsejo } from '@coach/shared';
import type { EstadoOverlay, EstadoPartida } from '../../shared/tiposApp';
import { enPelea } from '../consejos/regulador';

/*
 * Momentos muertos para los consejos con IA (3.2): solo cuando el jugador no puede estar jugando.
 * - Muerto con más de ~8 s por delante: consejo de «muerte» o, si un objetivo épico (evento público) aparece en
 *   60-75 s, de «objetivo».
 * - Justo al reaparecer con oro para gastar: consejo de «tienda» (en lugar del de la muerte).
 * Como mucho uno por muerte, un máximo por partida (ajuste), un minuto entre consejos, nunca en plena pelea y solo
 * en la Grieta y en los ARAM.
 */

/** Segundos de reaparición mínimos para que dé tiempo a oír el consejo. */
export const REAPARECE_MIN_S = 8;
/** Oro a partir del cual merece la pena el consejo de la tienda. */
export const ORO_TIENDA = 1100;
/** Ventana del consejo de objetivo: segundos que faltan para que aparezca. */
export const OBJETIVO_DESDE_S = 55;
export const OBJETIVO_HASTA_S = 80;
/** Separación mínima entre consejos (segundos de partida). */
export const SEPARACION_S = 60;
/** Nada en el primer minuto y medio. */
export const DESDE_S = 90;
/** Segundos tras morir antes de pedir el consejo (la pantalla gris ya se ve y la pelea terminó para él). */
const TRAS_MORIR_S = 2;
/** El consejo de tienda solo vale en los primeros segundos tras reaparecer. */
const TIENDA_HASTA_S = 4;

const OBJETIVOS = new Set(['dragon', 'anciano', 'heraldo', 'baron']);

/** Objetivo épico que aparece dentro de la ventana del consejo de objetivo, si lo hay. */
export function objetivoProximo(resumen: EstadoOverlay | null): boolean {
  return !!resumen?.objetivos.some((o) => OBJETIVOS.has(o.id) && !o.disponible && o.aparece !== null && o.aparece >= OBJETIVO_DESDE_S && o.aparece <= OBJETIVO_HASTA_S);
}

export class DetectorMomentos {
  private usados = 0;
  private ultimo = -Infinity;
  private muertoPrevio = false;
  private muertoDesde = 0;
  private reaparecidoEn: number | null = null;
  /** Ya hubo consejo (o no toca) en la muerte actual. */
  private hechoEnEstaMuerte = true;

  /** Consejos dados en esta partida. */
  get dados(): number {
    return this.usados;
  }

  /**
   * Procesa un estado y devuelve el momento si toca pedir un consejo ahora (y lo cuenta), o null.
   * `max` es el máximo por partida de los ajustes.
   */
  procesar(estado: EstadoPartida, resumen: EstadoOverlay | null, max: number): MomentoConsejo | null {
    const muerto = estado.muerto === true;
    if (muerto && !this.muertoPrevio) {
      this.muertoDesde = estado.tiempo;
      this.hechoEnEstaMuerte = false;
      this.reaparecidoEn = null;
    }
    if (!muerto && this.muertoPrevio) this.reaparecidoEn = estado.tiempo;
    this.muertoPrevio = muerto;

    if (!MODOS_CONSEJO.includes(estado.modo ?? 'clasificatoria')) return null;
    if (this.hechoEnEstaMuerte || this.usados >= max || estado.tiempo < DESDE_S || estado.tiempo - this.ultimo < SEPARACION_S) return null;

    let momento: MomentoConsejo | null = null;
    if (muerto) {
      const reaparece = estado.reaparece ?? 0;
      // Con mucho oro se espera a la tienda (el consejo de compra llega justo al reaparecer)… salvo que se acerque un objetivo.
      const objetivo = objetivoProximo(resumen);
      if (estado.tiempo - this.muertoDesde >= TRAS_MORIR_S && reaparece > REAPARECE_MIN_S && (objetivo || estado.oro < ORO_TIENDA)) {
        momento = objetivo ? 'objetivo' : 'muerte';
      }
    } else if (this.reaparecidoEn !== null && estado.tiempo - this.reaparecidoEn <= TIENDA_HASTA_S) {
      if (estado.oro >= ORO_TIENDA && !enPelea(estado)) momento = 'tienda';
      else this.hechoEnEstaMuerte = true; // reapareció sin oro: esta muerte se queda sin consejo
    } else if (!muerto) {
      this.hechoEnEstaMuerte = true;
    }
    if (!momento) return null;
    this.hechoEnEstaMuerte = true;
    this.usados++;
    this.ultimo = estado.tiempo;
    return momento;
  }

  reiniciar(): void {
    this.usados = 0;
    this.ultimo = -Infinity;
    this.muertoPrevio = false;
    this.reaparecidoEn = null;
    this.hechoEnEstaMuerte = true;
  }
}
