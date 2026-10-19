import type { Habilidad } from '@coach/shared';
import type { IdWidget } from '../../shared/tiposApp';

/** Resolución de referencia: las posiciones por defecto se calculan para 1920×1080 y se escalan. */
export const REFERENCIA = { ancho: 1920, alto: 1080 };

export interface Tamano {
  ancho: number;
  alto: number;
}
export interface Punto {
  x: number;
  y: number;
}

/**
 * HUD de LoL con la escala de HUD por defecto a 1920×1080 (medido sobre capturas; aproximado):
 * centro horizontal de la casilla de la Q y borde superior de la fila de habilidades, y la
 * distancia entre casillas. El HUD escala con la altura de la pantalla. Si el jugador usa otra
 * escala de HUD, calibra arrastrando la flecha en el modo mover.
 */
export const HUD_HABILIDADES = { qCentroX: 782, filaY: 982, paso: 55 };
export const HABILIDADES: Habilidad[] = ['Q', 'W', 'E', 'R'];

/** Factor de la pantalla respecto a la referencia (el HUD escala con la altura). */
export const factorPantalla = (pantalla: Tamano) => pantalla.alto / REFERENCIA.alto;

/** Ancho de la fila de casillas del widget de habilidad, en píxeles de pantalla. */
export function anchoFilaHabilidades(pantalla: Tamano): number {
  return HUD_HABILIDADES.paso * HABILIDADES.length * factorPantalla(pantalla);
}

/** Centro horizontal (relativo al borde izquierdo del widget) de la casilla de una habilidad. */
export function centroCasilla(h: Habilidad, pantalla: Tamano): number {
  const paso = HUD_HABILIDADES.paso * factorPantalla(pantalla);
  return paso / 2 + HABILIDADES.indexOf(h) * paso;
}

/**
 * Esquina superior izquierda por defecto de cada widget, a partir del tamaño de la pantalla y del
 * tamaño que ocupa el widget ya escalado. Todo se ajusta a la pantalla.
 */
export function posicionPorDefecto(id: IdWidget, pantalla: Tamano, widget: Tamano): Punto {
  const f = factorPantalla(pantalla);
  const fx = pantalla.ancho / REFERENCIA.ancho;
  let p: Punto;
  switch (id) {
    case 'objetivos':
      // Centrada arriba, sobre nada del HUD (el marcador está arriba a la derecha).
      p = { x: (pantalla.ancho - widget.ancho) / 2, y: 8 * f };
      break;
    case 'habilidad': {
      // La fila de casillas se apoya sobre las habilidades del HUD, que está centrado.
      const qCentroX = pantalla.ancho / 2 - (REFERENCIA.ancho / 2 - HUD_HABILIDADES.qCentroX) * f;
      p = { x: qCentroX - (HUD_HABILIDADES.paso / 2) * f, y: HUD_HABILIDADES.filaY * f - widget.alto };
      break;
    }
    case 'cs':
      // Arriba a la derecha, debajo del marcador de la partida.
      p = { x: pantalla.ancho - widget.ancho - 14 * f, y: 40 * f };
      break;
    case 'compra':
      // Encima de las casillas de objetos del HUD (a la derecha de las habilidades).
      p = { x: pantalla.ancho / 2 + 130 * f, y: 930 * f - widget.alto };
      break;
    case 'jungla':
      p = { x: 14 * fx, y: 560 * f };
      break;
    case 'avisos':
      p = { x: 24 * fx, y: 300 * f };
      break;
  }
  return ajustarAPantalla(p, pantalla, widget);
}

/** Mantiene el widget dentro de la pantalla. */
export function ajustarAPantalla(p: Punto, pantalla: Tamano, widget: Tamano): Punto {
  return {
    x: Math.round(Math.max(0, Math.min(pantalla.ancho - Math.min(widget.ancho, pantalla.ancho), p.x))),
    y: Math.round(Math.max(0, Math.min(pantalla.alto - Math.min(widget.alto, pantalla.alto), p.y))),
  };
}

/** «1:05» a partir de segundos. */
export function formatoCuenta(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
