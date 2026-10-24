import { ROLES, tieneRoles, type Build, type EntradaCampeon, type ListaCampeones, type ModoJuego, type Rol, type Tier } from '@coach/shared';
import { MAX_PARTIDAS_DATOS_LIMITADOS } from './agregador';

/** Peso de la tasa de victorias y del uso en la puntuación del tier. */
const PESO_VICTORIAS = 0.7;
const PESO_USO = 0.3;

/** Cortes de la puntuación (en desviaciones típicas dentro del rol). */
export function tierDePuntuacion(puntuacion: number): Tier {
  if (puntuacion >= 1) return 'S';
  if (puntuacion >= 0.25) return 'A';
  if (puntuacion >= -0.5) return 'B';
  return 'C';
}

function compararParches(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * z-scores de todos los `valores` con la media y la desviación típica (poblacional) de los que tienen
 * `cuenta[i]` a true. Con menos de 2 que cuenten o con desviación 0, todos valen 0.
 */
function zScores(valores: number[], cuenta: boolean[]): number[] {
  const muestra = valores.filter((_, i) => cuenta[i]);
  if (muestra.length < 2) return valores.map(() => 0);
  const media = muestra.reduce((s, v) => s + v, 0) / muestra.length;
  const varianza = muestra.reduce((s, v) => s + (v - media) ** 2, 0) / muestra.length;
  const desviacion = Math.sqrt(varianza);
  return valores.map((v) => (desviacion > 1e-12 ? (v - media) / desviacion : 0));
}

/**
 * Lista de campeones de `GET /campeones` a partir de las builds guardadas de un modo (la agregación global de
 * nivel superior). Solo cuenta el parche más reciente. Los grupos son los roles en clasificatoria y un único
 * grupo (rol null) en ARAM, ARAM: Caos y Arena. Dentro de cada grupo:
 * - uso = partidas del campeón / partidas de todos los campeones del grupo;
 * - puntuación = z(rendimiento)·0.7 + z(uso)·0.3; S ≥ 1, A ≥ 0.25, B ≥ −0.5, si no C. El rendimiento es la
 *   tasa de victorias, salvo en Arena, donde es la posición media cambiada de signo (menor es mejor);
 * - la media y la desviación de los z-scores salen solo de las entradas con 30 o más partidas (las de
 *   menos tienen tasas de victorias con mucho ruido); con menos de 2 de esas o desviación 0, z = 0 (B).
 *   Después se estandarizan todas las entradas con esa media y esa desviación;
 * - con menos de 30 partidas, como mucho B y `datosLimitados`.
 * El orden es por grupo (TOP…UTILITY) y, dentro de cada uno, de mayor a menor puntuación.
 */
export function listaCampeones(builds: Build[], modo: ModoJuego = 'clasificatoria'): ListaCampeones {
  if (builds.length === 0) return { parche: '', campeones: [] };
  const parche = builds.map((b) => b.parche).reduce((a, b) => (compararParches(b, a) > 0 ? b : a));
  const delParche = builds.filter((b) => b.parche === parche && b.partidas > 0);
  const esArena = modo === 'arena';
  const rendimiento = (b: Build) => (esArena ? -(b.arena?.posicionMedia ?? 8) : b.tasaVictoria);
  const grupos: (Rol | null)[] = tieneRoles(modo) ? ROLES : [null];

  const campeones: EntradaCampeon[] = [];
  for (const rol of grupos) {
    const delRol = delParche.filter((b) => (rol === null ? true : b.rol === rol));
    if (delRol.length === 0) continue;
    const total = delRol.reduce((s, b) => s + b.partidas, 0);
    const usos = delRol.map((b) => b.partidas / total);
    const fiables = delRol.map((b) => b.partidas >= MAX_PARTIDAS_DATOS_LIMITADOS);
    const zRendimiento = zScores(delRol.map(rendimiento), fiables);
    const zUso = zScores(usos, fiables);
    const filas = delRol.map((b, i) => {
      const puntuacion = zRendimiento[i]! * PESO_VICTORIAS + zUso[i]! * PESO_USO;
      const datosLimitados = b.partidas < MAX_PARTIDAS_DATOS_LIMITADOS;
      let tier = tierDePuntuacion(puntuacion);
      if (datosLimitados && (tier === 'S' || tier === 'A')) tier = 'B';
      const entrada: EntradaCampeon = {
        campeon: b.campeon,
        rol,
        partidas: b.partidas,
        tasaVictoria: b.tasaVictoria,
        ...(esArena && b.arena ? { posicionMedia: b.arena.posicionMedia, top4: b.arena.top4 } : {}),
        uso: usos[i]!,
        tier,
        datosLimitados,
        ...(b.tasaBloqueo !== undefined ? { tasaBloqueo: b.tasaBloqueo } : {}),
        ...(b.tasaSeleccion !== undefined ? { tasaSeleccion: b.tasaSeleccion } : {}),
      };
      return { entrada, puntuacion };
    });
    filas.sort((a, b) => b.puntuacion - a.puntuacion);
    campeones.push(...filas.map((f) => f.entrada));
  }
  return { parche, campeones };
}
