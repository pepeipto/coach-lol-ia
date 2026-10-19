import type { Etiqueta, JugadorCarga } from './tipos';
import { rasgosDe } from './rasgos';

export const PUNTOS_ESPECIALISTA = 100_000;
export const NIVEL_POCA_EXPERIENCIA = 2;
export const WINRATE_RACHA = 0.55;
export const PARTIDAS_RACHA = 20;

export const textoEspecialista = (campeon: string) => `Especialista en ${campeon}`;
export const TEXTO_POCA_EXPERIENCIA = 'Poca experiencia con este campeón';
export const TEXTO_RACHA = 'Racha positiva esta temporada';

/**
 * Etiquetas de una tarjeta. Políticas de Riot: solo positivas o neutras, nunca texto que avergüence
 * a un jugador (una prueba comprueba que no aparezcan palabras prohibidas).
 */
export function etiquetasDe(o: {
  campeon: string;
  maestria: JugadorCarga['maestria'];
  rango: JugadorCarga['rango'];
  tags: string[];
  dificultad: number;
}): Etiqueta[] {
  const etiquetas: Etiqueta[] = [];
  if (o.maestria) {
    if (o.maestria.puntos >= PUNTOS_ESPECIALISTA && o.campeon) {
      etiquetas.push({ tipo: 'positivo', texto: textoEspecialista(o.campeon) });
    } else if (o.maestria.nivel <= NIVEL_POCA_EXPERIENCIA || o.maestria.puntos === 0) {
      etiquetas.push({ tipo: 'info', texto: TEXTO_POCA_EXPERIENCIA });
    }
  }
  if (o.rango) {
    const partidas = o.rango.victorias + o.rango.derrotas;
    if (partidas >= PARTIDAS_RACHA && o.rango.victorias / partidas >= WINRATE_RACHA) {
      etiquetas.push({ tipo: 'positivo', texto: TEXTO_RACHA });
    }
  }
  for (const rasgo of rasgosDe(o.tags, o.dificultad)) etiquetas.push({ tipo: 'neutro', texto: rasgo });
  return etiquetas;
}
