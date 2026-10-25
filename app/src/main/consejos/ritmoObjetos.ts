import { clasificarObjeto, MAPA_DE_MODO, type Build } from '@coach/shared';
import { minutoGanadas, tiemposDe } from '../../shared/objetosBuild';
import type { EstadoPartida } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';

/*
 * 3.10 · Ritmo de objetos (mejora 11 del estudio de la competencia): un aviso suave si tu 1.er o 2.º objeto
 * legendario llega RETRASO_RITMO_MIN minutos o más tarde que la mediana de las partidas ganadas con tu campeón (y rol),
 * que manda el servidor en `Build.tiempos`. Solo usa tus propios objetos de la Live Client Data API y el reloj de la
 * partida.
 *
 * Nunca en Arena (ni en los rotativos: `vozEnPartida`). Prioridad baja, como mucho uno cada RITMO_CADA_MS (el
 * regulador lo aplica con el grupo y el enfriamiento de la categoría) y nunca durante una pelea tuya: el regulador no
 * suelta frases no urgentes mientras dura.
 */

/** Minutos de retraso respecto a la mediana de las partidas ganadas a partir de los que se avisa. */
export const RETRASO_RITMO_MIN = 3;
/** Como mucho un aviso de ritmo de objetos cada 5 minutos. */
export const RITMO_CADA_MS = 300_000;

export interface AvisoRitmo {
  /** 1 = primer objeto, 2 = segundo. */
  objeto: 1 | 2;
  /** Minuto mediano de las partidas ganadas para ese objeto. */
  objetivo: number;
}

export interface EntradaRitmo {
  estado: EstadoPartida;
  build?: Build | null;
  objetos?: DatosEstaticos['objetos'];
}

const HITOS = [
  { objeto: 1, hito: 'objeto1' },
  { objeto: 2, hito: 'objeto2' },
] as const;

/**
 * Lleva la cuenta de los legendarios que has completado en la partida (los distintos que han pasado por tu
 * inventario: venderlo después no lo descuenta) y propone el aviso de cada hito una sola vez. Con `primero` (primer
 * estado de la partida o al reconectar) solo aprende: lo que ya iba tarde al entrar no se dice de golpe.
 */
export class DetectorRitmoObjetos {
  private completados = new Set<number>();
  private avisados = new Set<number>();

  procesar(e: EntradaRitmo, primero: boolean): AvisoRitmo[] {
    const { estado } = e;
    const modo = estado.modo ?? 'clasificatoria';
    if (modo === 'arena' || estado.rotativo) return [];
    const mapa = MAPA_DE_MODO[modo];
    for (const id of estado.objetos) {
      const item = e.objetos?.[id];
      if (item && clasificarObjeto(id, item, mapa) === 'legendario') this.completados.add(id);
    }
    const tiempos = tiemposDe(e.build);
    const salida: AvisoRitmo[] = [];
    for (const { objeto, hito } of HITOS) {
      const objetivo = minutoGanadas(tiempos, hito);
      if (objetivo === null || this.avisados.has(objeto) || this.completados.size >= objeto) continue;
      if (estado.tiempo / 60 < objetivo + RETRASO_RITMO_MIN) continue;
      this.avisados.add(objeto);
      if (primero) continue;
      salida.push({ objeto, objetivo });
      // Uno por estado: si el segundo también va tarde, se propone más adelante (y el regulador lo espacia).
      break;
    }
    return salida;
  }

  reiniciar(): void {
    this.completados.clear();
    this.avisados.clear();
  }
}
