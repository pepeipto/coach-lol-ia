import type { PerfilCampeon } from './tiposApp';

/**
 * Pantalla de carga: de qué es el daño de cada equipo y cuántos tanques lleva, a partir de lo que Data Dragon dice de
 * cada campeón (`info.attack` / `info.magic` y sus clases). Es una estimación de la composición (visible para todos
 * en la pantalla de carga del juego), no un dato de la partida.
 */
export interface ResumenEquipo {
  /** % del daño que se espera físico (0–100); el resto, mágico. */
  fisico: number;
  /** Campeones cuya clase principal es Tank. */
  tanques: number;
  /** Campeones con perfil conocido (sin ninguno no hay resumen). */
  conocidos: number;
}

export interface ConsejoCarga {
  /** Clave de i18n («carga.consejo.*»). */
  clave: string;
  params?: Record<string, string | number>;
}

/** A partir de este % se dice que un equipo pega «sobre todo» físico o mágico. */
export const UMBRAL_DANO = 70;
/** Con este número de tanques o más se recuerda el daño porcentual. */
export const UMBRAL_TANQUES = 2;

export function resumenEquipo(perfiles: (PerfilCampeon | null | undefined)[]): ResumenEquipo | null {
  let ataque = 0;
  let magia = 0;
  let tanques = 0;
  let conocidos = 0;
  for (const p of perfiles) {
    if (!p) continue;
    conocidos++;
    ataque += Math.max(0, p.ataque);
    magia += Math.max(0, p.magia);
    if (p.clases[0] === 'Tank') tanques++;
  }
  if (conocidos === 0 || ataque + magia === 0) return null;
  return { fisico: Math.round((ataque / (ataque + magia)) * 100), tanques, conocidos };
}

/** Consejos neutrales sobre la composición rival (sin nombrar objetos concretos: las opciones las elige el jugador). */
export function consejosComposicion(enemigo: ResumenEquipo | null | undefined, aliado: ResumenEquipo | null | undefined): ConsejoCarga[] {
  const consejos: ConsejoCarga[] = [];
  if (enemigo) {
    if (enemigo.fisico >= UMBRAL_DANO) consejos.push({ clave: 'carga.consejo.rivalFisico', params: { n: enemigo.fisico } });
    else if (100 - enemigo.fisico >= UMBRAL_DANO) consejos.push({ clave: 'carga.consejo.rivalMagico', params: { n: 100 - enemigo.fisico } });
    else consejos.push({ clave: 'carga.consejo.rivalMixto' });
    if (enemigo.tanques >= UMBRAL_TANQUES) consejos.push({ clave: 'carga.consejo.tanques', params: { n: enemigo.tanques } });
  }
  if (aliado) {
    if (aliado.fisico >= 80) consejos.push({ clave: 'carga.consejo.aliadoFisico' });
    else if (aliado.fisico <= 20) consejos.push({ clave: 'carga.consejo.aliadoMagico' });
  }
  return consejos;
}
