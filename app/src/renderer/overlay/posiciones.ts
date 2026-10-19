import type { Habilidad } from '@coach/shared';
import type { IdWidget, MarcoMinimapa } from '../../shared/tiposApp';

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
/** Ancho del minimapa por defecto a 1080p (más un margen), para no taparlo. */
export const MINIMAPA_ANCHO = 290;

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
      // Abajo a la derecha, entre el HUD central y el minimapa (que ocupa unos 280 px de ancho).
      p = { x: pantalla.ancho - widget.ancho - MINIMAPA_ANCHO * f, y: pantalla.alto - widget.alto - 12 * f };
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

// ---- Minimapa (temporizadores de la jungla sobre los campamentos) ----

/** Lado del minimapa de LoL con la escala por defecto, en fracción del alto de la pantalla (aproximado). */
export const LADO_MINIMAPA_POR_DEFECTO = 0.2;
/** Límites al calibrar (fracción del alto); los mismos que valida main en los ajustes. */
export const LADO_MINIMAPA_MIN = 0.08;
export const LADO_MINIMAPA_MAX = 0.6;

/** Marco del minimapa en píxeles. */
export interface MarcoPx {
  x: number;
  y: number;
  lado: number;
}
export type EsquinaMarco = 'ni' | 'nd' | 'si' | 'sd';

function dentro(m: MarcoPx, pantalla: Tamano): MarcoPx {
  const lado = Math.round(Math.min(m.lado, pantalla.ancho, pantalla.alto));
  return {
    x: Math.round(Math.max(0, Math.min(pantalla.ancho - lado, m.x))),
    y: Math.round(Math.max(0, Math.min(pantalla.alto - lado, m.y))),
    lado,
  };
}

/** Marco en píxeles: el calibrado (fracciones de la pantalla) o, sin calibrar, abajo a la derecha. */
export function marcoMinimapa(pantalla: Tamano, guardado: MarcoMinimapa | null): MarcoPx {
  if (!guardado) {
    const lado = Math.round(LADO_MINIMAPA_POR_DEFECTO * pantalla.alto);
    return dentro({ x: pantalla.ancho - lado, y: pantalla.alto - lado, lado }, pantalla);
  }
  return dentro({ x: guardado.x * pantalla.ancho, y: guardado.y * pantalla.alto, lado: guardado.lado * pantalla.alto }, pantalla);
}

/** Lo que se guarda en los ajustes: fracciones de la pantalla (x e y del ancho y del alto; lado, del alto). */
export function fraccionesMarco(m: MarcoPx, pantalla: Tamano): MarcoMinimapa {
  return { x: m.x / pantalla.ancho, y: m.y / pantalla.alto, lado: m.lado / pantalla.alto };
}

/** Arrastre de una esquina: el marco sigue cuadrado y la esquina contraria no se mueve. */
export function redimensionarMarco(m: MarcoPx, esquina: EsquinaMarco, dx: number, dy: number, pantalla: Tamano): MarcoPx {
  const haciaFueraX = esquina === 'ni' || esquina === 'si' ? -dx : dx;
  const haciaFueraY = esquina === 'ni' || esquina === 'nd' ? -dy : dy;
  const delta = Math.abs(haciaFueraX) >= Math.abs(haciaFueraY) ? haciaFueraX : haciaFueraY;
  const fijoX = esquina === 'ni' || esquina === 'si' ? m.x + m.lado : m.x;
  const fijoY = esquina === 'ni' || esquina === 'nd' ? m.y + m.lado : m.y;
  // Lo que cabe hacia la esquina que se mueve, sin salir de la pantalla.
  const cabeX = esquina === 'ni' || esquina === 'si' ? fijoX : pantalla.ancho - fijoX;
  const cabeY = esquina === 'ni' || esquina === 'nd' ? fijoY : pantalla.alto - fijoY;
  const min = Math.round(LADO_MINIMAPA_MIN * pantalla.alto);
  const max = Math.min(Math.round(LADO_MINIMAPA_MAX * pantalla.alto), cabeX, cabeY);
  const lado = Math.round(Math.max(min, Math.min(max, m.lado + delta)));
  return {
    x: esquina === 'ni' || esquina === 'si' ? fijoX - lado : fijoX,
    y: esquina === 'ni' || esquina === 'nd' ? fijoY - lado : fijoY,
    lado,
  };
}

/** Texto del temporizador sobre un campamento, como los de Riot: «2:05» desde un minuto, «45» por debajo. */
export function textoTemporizador(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return s >= 60 ? formatoCuenta(s) : String(s);
}
