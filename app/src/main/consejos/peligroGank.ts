import type { ModoJuego, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import { esGrieta } from '../../shared/modosOverlay';
import type { MotivoPeligroGank, PeligroGank } from '../../shared/tiposApp';
import { HASTA_S, zonaDeRol, type AvisoJunglaEnemiga } from './junglaEnemiga';
import { PRIMER_GANK_S } from './macro';

/*
 * 3.18 · Borde rojo de «posible gank» (idea de un streamer de la comunidad).
 * Solo con lo que el juego ya enseña a todos y la Live Client Data API da de forma oficial: el reloj de la partida
 * (ventana del primer gank), el registro de muertes (el jungla rival acaba de matar o asistir en tu calle) y, si el
 * jugador lo activó, la ruta habitual estimada con datos agregados. NUNCA mira la pantalla, el minimapa ni la memoria
 * del juego (lo prohíben Riot y Vanguard) y nunca dice dónde «está» el jungla: el texto siempre habla de un posible
 * gank. El jugador decide qué hacer; el borde solo avisa.
 */

/** Lo que dura el borde en pantalla. */
export const DURACION_BORDE_MS = 6_000;
/** Como mucho un borde cada 30 s de partida (que no se convierta en ruido). */
export const ENTRE_BORDES_S = 30;
/** Con la ruta estimada, el borde sale unos segundos antes del minuto en que su campeón suele gankear. */
export const ANTES_RUTA_S = 15;

export interface EntradaPeligro {
  tiempo: number;
  modo?: ModoJuego;
  /** Tu rol (el de la selección). El jungla no recibe el borde: es él quien ganka. */
  rol: Rol;
  /** Muerto no hace falta avisar. */
  muerto?: boolean;
  /** Avisos del jungla enemigo de este estado (registro de muertes). */
  avisos: readonly AvisoJunglaEnemiga[];
  /** Primer gank de la ruta estimada (solo si el jugador activó la ruta); null si no hay. */
  rutaGank?: { calle: 'top' | 'mid' | 'bot'; minuto: number } | null;
}

/** Decide, estado a estado, si toca encender el borde rojo de posible gank. */
export class DetectorPeligroGank {
  private previo: number | null = null;
  private ultimo = -Infinity;
  private siguienteId = 1;

  procesar(e: EntradaPeligro): PeligroGank | null {
    const previo = this.previo;
    this.previo = e.tiempo;
    // Al empezar (o reconectar) no hay borde: no se sabe qué ha pasado justo antes.
    if (previo === null || e.tiempo < previo) return null;
    if (!esGrieta(e.modo) || e.rol === 'JUNGLE' || e.muerto) return null;
    if (e.tiempo >= HASTA_S) return null;
    const miZona = zonaDeRol(e.rol);
    const cruza = (momento: number) => previo < momento && e.tiempo >= momento;

    let motivo: MotivoPeligroGank | null = null;
    // 1) El jungla rival acaba de aparecer en tu calle por el registro de muertes (si murió él, no hay peligro).
    if (e.avisos.some((a) => a.zona === miZona && !a.muere)) motivo = 'visto';
    // 2) Ruta estimada: su campeón suele gankear tu calle hacia este minuto.
    else if (e.rutaGank && e.rutaGank.calle === miZona && cruza(e.rutaGank.minuto * 60 - ANTES_RUTA_S)) motivo = 'ruta';
    // 3) Ventana del primer gank (el jungla rival ya puede haber terminado su primera vuelta).
    else if (cruza(PRIMER_GANK_S)) motivo = 'primerGank';
    if (!motivo) return null;
    if (e.tiempo - this.ultimo < ENTRE_BORDES_S) return null;
    this.ultimo = e.tiempo;
    return {
      id: this.siguienteId++,
      motivo,
      etiqueta: t('peligroGank.etiqueta'),
      texto: t(`peligroGank.${motivo}`),
      duracionMs: DURACION_BORDE_MS,
    };
  }

  reiniciar(): void {
    this.previo = null;
    this.ultimo = -Infinity;
  }
}
