import type { Etiqueta, JugadorCarga } from './tipos';
import { rasgosConClaveDe } from './rasgos';

export const PUNTOS_ESPECIALISTA = 100_000;
export const WINRATE_RACHA = 0.55;
export const PARTIDAS_RACHA = 20;

export const textoEspecialista = (campeon: string) => `Especialista en ${campeon}`;
export const TEXTO_RACHA = 'Racha positiva esta temporada';
/** Claves de i18n de la app (3.0): la app las enseña en su idioma; `texto` sigue en español para las anteriores. */
export const CLAVE_ESPECIALISTA = 'carga.etiqueta.especialista';
export const CLAVE_RACHA = 'carga.etiqueta.racha';

/**
 * Etiquetas de una tarjeta. Políticas de Riot: solo positivas o neutras, nunca texto que avergüence
 * a un jugador ni que lo señale por su poca experiencia (una prueba comprueba que no aparezcan palabras prohibidas).
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
    // Solo la positiva: nunca se señala a otro jugador por tener poca maestría con su campeón.
    if (o.maestria.puntos >= PUNTOS_ESPECIALISTA && o.campeon) {
      etiquetas.push({ tipo: 'positivo', texto: textoEspecialista(o.campeon), clave: CLAVE_ESPECIALISTA, params: { campeon: o.campeon } });
    }
  }
  if (o.rango) {
    const partidas = o.rango.victorias + o.rango.derrotas;
    if (partidas >= PARTIDAS_RACHA && o.rango.victorias / partidas >= WINRATE_RACHA) {
      etiquetas.push({ tipo: 'positivo', texto: TEXTO_RACHA, clave: CLAVE_RACHA });
    }
  }
  for (const rasgo of rasgosConClaveDe(o.tags, o.dificultad)) etiquetas.push({ tipo: 'neutro', ...rasgo });
  return etiquetas;
}
