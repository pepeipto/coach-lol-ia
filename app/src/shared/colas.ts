import { esColaGrietaNormal, modoDeCola, type ModoJuego } from '@coach/shared';
import { t, textosDe } from './i18n';

/*
 * 3.8 «Todo LoL»: tipos de cola para la app. Las normales de la Grieta (COLAS_GRIETA_NORMAL del contrato) usan los
 * datos de clasificatoria pero se nombran como lo que son; cualquier otra cola que no es de los cuatro modos con datos
 * es un modo rotativo (URF, Uno para todos…).
 */

/** Filtro del Perfil por tipo de cola. */
export type TipoCola = 'clasificatoria' | 'normales' | 'aram' | 'caos' | 'arena' | 'otros';
export const TIPOS_COLA: readonly TipoCola[] = ['clasificatoria', 'normales', 'aram', 'caos', 'arena', 'otros'];

/** Tipo de una cola (queueId): uno de los cuatro modos, una normal de la Grieta u «otros». */
export function tipoCola(cola: unknown): TipoCola {
  const modo = modoDeCola(cola);
  if (modo) return modo;
  return esColaGrietaNormal(cola) ? 'normales' : 'otros';
}

/**
 * Cola de un modo rotativo: un número que no es de los cuatro modos ni una normal de la Grieta. 0 (personalizadas
 * antiguas) y los negativos no cuentan.
 */
export const esColaRotativa = (cola: unknown): cola is number =>
  typeof cola === 'number' && Number.isInteger(cola) && cola > 0 && !modoDeCola(cola) && !esColaGrietaNormal(cola);

/**
 * Clave de i18n del nombre de una normal de la Grieta: 400/430 «Normal», 440 «Flex», 480/490 «Partida rápida».
 * Null si la cola no es una normal de la Grieta.
 */
export function claveColaNormal(cola: unknown): string | null {
  if (!esColaGrietaNormal(cola)) return null;
  if (cola === 440) return 'cola.flex';
  if (cola === 480 || cola === 490) return 'cola.rapida';
  return 'cola.normal';
}

/** Nombre visible de la cola de una selección: «Normal», «Flex»… o el del modo («Clasificatoria», «ARAM»…). */
export function nombreCola(cola: unknown, modo: ModoJuego = 'clasificatoria'): string {
  const normal = claveColaNormal(cola);
  return t(normal ?? `modo.${modo}`);
}

/**
 * Nombre de un modo rotativo en el idioma de la app: la traducción propia por su `gameMode` si la hay
 * («rotativo.modo.URF»…); si no, el nombre que manda el servidor (inglés, de queues.json) o el `gameMode`.
 */
export function nombreRotativo(r: { gameMode?: string | null; nombre?: string | null; cola?: number }): string {
  const clave = r.gameMode ? `rotativo.modo.${r.gameMode.toUpperCase()}` : null;
  if (clave && (textosDe('es')[clave] !== undefined)) return t(clave);
  return r.nombre?.trim() || r.gameMode || t('rotativo.sinNombre', { cola: r.cola ?? '?' });
}

/** Nombre de la build base de un respaldo («la Grieta», «el Abismo», «Arena»). */
export const nombreBaseRespaldo = (base: ModoJuego): string => t(`rotativo.base.${base}`);
