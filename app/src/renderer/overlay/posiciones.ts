import type { Habilidad } from '@coach/shared';
import type { EscalaHud, IdWidget, MarcoMinimapa } from '../../shared/tiposApp';

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
 * Fila de habilidades del HUD de LoL, normalizada a 1080 px de alto, con GlobalScale = GLOBAL_SCALE_REFERENCIA (3.0.2).
 * Medido en una partida real a 3840×2160 con GlobalScale 0,25 (dividido entre 2): centros Q 1621, W 1717, E 1818,
 * R 1916 (pasiva 1533), borde superior de los iconos y ≈ 1964 y casilla ≈ 80 px. Es decir: la Q a −149,5 px del
 * centro de la pantalla, un paso de (1916 − 1621) / 3 / 2 = 49,17 px (la R cae exacta), la fila en y = 982 y una
 * casilla de 40 px. `qCentroX` es el mismo centro de la Q en una pantalla de 1920 de ancho (960 − 149,5).
 */
export const HUD_HABILIDADES = { qDesdeCentro: -149.5, qCentroX: 960 - 149.5, filaY: 982, paso: 295 / 6, casilla: 40 };
export const HABILIDADES: Habilidad[] = ['Q', 'W', 'E', 'R'];
/** Borde superior del widget CS/KDA a 1080p: por debajo del marcador y del contador de FPS/ping de LoL. */
export const CS_ARRIBA = 60;
/** Ancho del minimapa por defecto a 1080p (más un margen), para no taparlo. */
export const MINIMAPA_ANCHO = 290;

/*
 * Escala del HUD. LoL guarda en Config/game.cfg, sección [HUD], `GlobalScale` (deslizador «Escala del HUD», 0–1).
 *  1. El HUD central escala con el alto de la pantalla y se ancla abajo en el centro (confirmado a 4K).
 *  2. Las medidas de HUD_HABILIDADES son de GlobalScale = 0,25 (3.0.2, partida real a 3840×2160): es el único
 *     punto medido. Sin escala conocida se usa esa misma geometría.
 *  3. Supuesto sin medir para otras escalas (la forma de la 3.0.1): el tamaño crece de forma lineal con
 *     GlobalScale, tamaño(g) = 1 + CRECIMIENTO_HUD × g (×1,4 de 0 a 1), relativo al tamaño en 0,25.
 * Si no cuadra, la calibración del modo mover (guardada por tamaño de pantalla) manda.
 */
export const GLOBAL_SCALE_REFERENCIA = 0.25;
export const CRECIMIENTO_HUD = 0.4;
const acotar01 = (v: number) => Math.min(1, Math.max(0, v));
const tamanoHud = (g: number) => 1 + CRECIMIENTO_HUD * acotar01(g);

/** Tamaño del HUD con esa GlobalScale respecto al de referencia (1 si no se sabe). */
export function tamanoRelativoHud(global: number | null | undefined): number {
  if (global === null || global === undefined || !Number.isFinite(global)) return 1;
  return tamanoHud(global) / tamanoHud(GLOBAL_SCALE_REFERENCIA);
}

/** Factor de la pantalla respecto a la referencia (el HUD escala con la altura). */
export const factorPantalla = (pantalla: Tamano) => pantalla.alto / REFERENCIA.alto;

/**
 * Por debajo de este factor de pantalla los widgets ya no se encogen más (en 720p, o en 1080p con el escalado de
 * Windows al 150 %, el texto dejaría de leerse).
 */
export const ESCALA_PANTALLA_MIN = 0.75;

/**
 * Escala con la que se pinta un widget (3.0.2): sigue el alto de la pantalla (× 2 a 4K, × 1,33 a 1440p), como el HUD
 * de LoL, multiplicada por la escala que el usuario elige para ese widget. El alto es el de la ventana del overlay en
 * píxeles CSS: con el escalado de Windows el resultado en píxeles físicos sigue siendo alto físico / 1080.
 */
export const escalaWidget = (pantalla: Tamano, escala: number) => Math.max(ESCALA_PANTALLA_MIN, factorPantalla(pantalla)) * escala;

/** Factor del HUD de habilidades: la pantalla por la escala del HUD del jugador. */
export const factorHud = (pantalla: Tamano, hud?: EscalaHud | null) => factorPantalla(pantalla) * tamanoRelativoHud(hud?.global);

/** Fila de habilidades del HUD en la pantalla: centro de la Q, borde superior y paso entre casillas (px). */
export function filaHabilidades(pantalla: Tamano, hud?: EscalaHud | null): { qCentroX: number; arriba: number; paso: number } {
  const f = factorHud(pantalla, hud);
  return {
    qCentroX: pantalla.ancho / 2 + HUD_HABILIDADES.qDesdeCentro * f,
    arriba: pantalla.alto - (REFERENCIA.alto - HUD_HABILIDADES.filaY) * f,
    paso: HUD_HABILIDADES.paso * f,
  };
}

/** Lado de una casilla (icono) de habilidad del HUD, en píxeles de pantalla (≈ 80 px a 4K con GlobalScale 0,25). */
export const ladoCasillaHud = (pantalla: Tamano, hud?: EscalaHud | null) => HUD_HABILIDADES.casilla * factorHud(pantalla, hud);

/** Ancho de la fila de casillas del widget de habilidad, en píxeles de pantalla. */
export function anchoFilaHabilidades(pantalla: Tamano, hud?: EscalaHud | null): number {
  return HUD_HABILIDADES.paso * HABILIDADES.length * factorHud(pantalla, hud);
}

/** Centro horizontal (relativo al borde izquierdo del widget) de la casilla de una habilidad. */
export function centroCasilla(h: Habilidad, pantalla: Tamano, hud?: EscalaHud | null): number {
  const paso = HUD_HABILIDADES.paso * factorHud(pantalla, hud);
  return paso / 2 + HABILIDADES.indexOf(h) * paso;
}

/** Flecha (estilo Blitz): lado a 1080p con el HUD medido (casilla de 40 px), hueco sobre la casilla y recorrido del vaivén. */
export const FLECHA = { lado: 28, hueco: 14, vaiven: 6 };

/** Lado de la flecha en px (unos 25–36 px a 1080p según la escala del HUD), por el tamaño del widget. */
export const ladoFlecha = (pantalla: Tamano, hud: EscalaHud | null | undefined, escala: number) =>
  Math.round(FLECHA.lado * escala * factorHud(pantalla, hud));

/** Alto de la zona de la flecha (el widget), que se apoya sobre la fila de casillas. */
export const altoZonaFlecha = (pantalla: Tamano, hud: EscalaHud | null | undefined, escala: number) =>
  Math.round(ladoFlecha(pantalla, hud, escala) + (FLECHA.hueco + FLECHA.vaiven) * factorHud(pantalla, hud));

/**
 * Esquina superior izquierda por defecto de cada widget, a partir del tamaño de la pantalla y del
 * tamaño que ocupa el widget ya escalado. Todo se ajusta a la pantalla.
 */
export function posicionPorDefecto(id: IdWidget, pantalla: Tamano, widget: Tamano, hud?: EscalaHud | null): Punto {
  const f = factorPantalla(pantalla);
  const fx = pantalla.ancho / REFERENCIA.ancho;
  let p: Punto;
  switch (id) {
    case 'objetivos':
      // Centrada arriba, sobre nada del HUD (el marcador está arriba a la derecha).
      p = { x: (pantalla.ancho - widget.ancho) / 2, y: 8 * f };
      break;
    case 'habilidad': {
      // La fila de casillas se apoya sobre las habilidades del HUD, centrado y anclado abajo.
      const fila = filaHabilidades(pantalla, hud);
      p = { x: fila.qCentroX - fila.paso / 2, y: fila.arriba - widget.alto };
      break;
    }
    case 'cs':
      // Arriba a la derecha, debajo del marcador de la partida y de la línea de FPS/ping de LoL (3.0.2: medido a 4K
      // con HUD 0,25, el marcador ocupa y 0–65 y el texto de FPS y ≈ 80–105, es decir, hasta ≈ 4,9 % del alto). Los
      // dos crecen con la escala del HUD: el widget baja con ellos, nunca por encima de 60 px a 1080p.
      p = { x: pantalla.ancho - widget.ancho - 14 * f, y: CS_ARRIBA * Math.max(f, factorHud(pantalla, hud)) };
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

/*
 * Minimapa sin calibrar: `MinimapScale` (0–1) y `FlipMiniMap` de Config/game.cfg, independiente de la escala del HUD.
 * 3.0.2, medido en una partida real a 3840×2160 con MinimapScale 0,35: el mapa (la zona negra, sin el marco dorado)
 * mide 425 px (0,1968 del alto) y queda a 20 px del borde derecho y a 24 px del inferior. Solo ese punto está medido:
 * para las demás escalas se mantiene la forma lineal de la 3.0.1 (crecimiento 0,12 × MinimapScale) y los márgenes
 * en proporción al lado.
 */
export const LADO_MINIMAPA_ESCALA = { base: 425 / 2160 - 0.12 * 0.35, crecimiento: 0.12 };
/** Separación del mapa respecto al borde de la pantalla (lateral y abajo), en fracción de su lado. */
export const MARGEN_MINIMAPA = { lateral: 20 / 425, abajo: 24 / 425 };

/** Lado del minimapa (fracción del alto) para una MinimapScale; sin ella, el de siempre. */
export function ladoMinimapa(minimapa: number | null | undefined): number {
  if (minimapa === null || minimapa === undefined || !Number.isFinite(minimapa)) return LADO_MINIMAPA_POR_DEFECTO;
  return LADO_MINIMAPA_ESCALA.base + LADO_MINIMAPA_ESCALA.crecimiento * acotar01(minimapa);
}

/**
 * Marco en píxeles: el calibrado (fracciones de la pantalla) o, sin calibrar, abajo a la derecha (a la izquierda con
 * FlipMiniMap) con el lado de la escala del minimapa del jugador.
 */
export function marcoMinimapa(pantalla: Tamano, guardado: MarcoMinimapa | null, hud?: EscalaHud | null): MarcoPx {
  if (!guardado) {
    const lado = Math.round(ladoMinimapa(hud?.minimapa) * pantalla.alto);
    // Con la escala leída, separado del borde como el de LoL; sin ella, pegado a la esquina (como siempre).
    const conEscala = hud?.minimapa !== null && hud?.minimapa !== undefined && Number.isFinite(hud.minimapa);
    const lateral = conEscala ? lado * MARGEN_MINIMAPA.lateral : 0;
    const abajo = conEscala ? lado * MARGEN_MINIMAPA.abajo : 0;
    return dentro({ x: hud?.minimapaIzquierda ? lateral : pantalla.ancho - lado - lateral, y: pantalla.alto - lado - abajo, lado }, pantalla);
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

/**
 * Diámetro del círculo de un temporizador del minimapa: unos 20 px a 1080p con el minimapa por defecto (entre 18 y 22,
 * según el lado del marco), escalado como los demás widgets con la pantalla y la escala del usuario.
 */
export function diametroTemporizador(lado: number, pantalla: Tamano, escala = 1): number {
  const f = Math.max(ESCALA_PANTALLA_MIN, factorPantalla(pantalla));
  const base = Math.min(22, Math.max(18, (lado / f) * 0.09));
  return Math.round(base * f * escala);
}

/** Texto del temporizador sobre un campamento, como los de Riot: «2:05» desde un minuto, «45» por debajo. */
export function textoTemporizador(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return s >= 60 ? formatoCuenta(s) : String(s);
}
