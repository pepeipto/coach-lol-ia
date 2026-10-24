import { COLAS_MODO, MAPA_DE_MODO, MODOS_JUEGO, type ModoJuego } from '@coach/shared';

/*
 * 3.8 «Todo LoL»: modos internos del servidor. Los modos rotativos (URF, Uno para todos…) no son un `ModoJuego` del
 * contrato (shared): se guardan en las mismas tablas (participaciones y builds, columna `modo`) con un modo propio por
 * cola, «rotativo:<cola>» (p. ej. «rotativo:1900»), sin tocar los modos actuales ni sus filas.
 */
export type ModoRotativoInterno = `rotativo:${number}`;
export type ModoInterno = ModoJuego | ModoRotativoInterno;

const PREFIJO = 'rotativo:';

export const modoRotativo = (cola: number): ModoRotativoInterno => `${PREFIJO}${cola}` as ModoRotativoInterno;

export const esModoRotativo = (modo: unknown): modo is ModoRotativoInterno =>
  typeof modo === 'string' && /^rotativo:[1-9]\d*$/.test(modo);

/** Cola de un modo rotativo interno; null si no lo es. */
export function colaDeModo(modo: unknown): number | null {
  return esModoRotativo(modo) ? Number(modo.slice(PREFIJO.length)) : null;
}

/** Colas de Match-v5 que se piden para un modo. */
export function colasDe(modo: ModoInterno): readonly number[] {
  const cola = colaDeModo(modo);
  return cola !== null ? [cola] : COLAS_MODO[modo as ModoJuego];
}

/** Mapa de un modo conocido (los rotativos lo traen en cada participación); la Grieta si no se sabe. */
export const mapaDeModo = (modo: ModoInterno | undefined): number =>
  modo && (MODOS_JUEGO as string[]).includes(modo) ? MAPA_DE_MODO[modo as ModoJuego] : 11;
