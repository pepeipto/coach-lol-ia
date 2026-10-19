import { ROLES, type Build, type EntradaCampeon, type ListaCampeones, type Tier } from '@coach/shared';
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

/** z-scores (desviación típica poblacional); con desviación 0 todos valen 0. */
function zScores(valores: number[]): number[] {
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length;
  const desviacion = Math.sqrt(varianza);
  return valores.map((v) => (desviacion > 1e-12 ? (v - media) / desviacion : 0));
}

/**
 * Lista de campeones de `GET /campeones` a partir de las builds guardadas (la agregación global de
 * nivel superior). Solo cuenta el parche más reciente. Dentro de cada rol:
 * - uso = partidas del campeón / partidas de todos los campeones del rol;
 * - puntuación = z(tasaVictoria)·0.7 + z(uso)·0.3; S ≥ 1, A ≥ 0.25, B ≥ −0.5, si no C;
 * - con menos de 30 partidas, como mucho B y `datosLimitados`.
 * El orden es por rol (TOP…UTILITY) y, dentro de cada rol, de mayor a menor puntuación.
 */
export function listaCampeones(builds: Build[]): ListaCampeones {
  if (builds.length === 0) return { parche: '', campeones: [] };
  const parche = builds.map((b) => b.parche).reduce((a, b) => (compararParches(b, a) > 0 ? b : a));
  const delParche = builds.filter((b) => b.parche === parche && b.partidas > 0);

  const campeones: EntradaCampeon[] = [];
  for (const rol of ROLES) {
    const delRol = delParche.filter((b) => b.rol === rol);
    if (delRol.length === 0) continue;
    const total = delRol.reduce((s, b) => s + b.partidas, 0);
    const usos = delRol.map((b) => b.partidas / total);
    const zVictorias = zScores(delRol.map((b) => b.tasaVictoria));
    const zUso = zScores(usos);
    const filas = delRol.map((b, i) => {
      const puntuacion = zVictorias[i]! * PESO_VICTORIAS + zUso[i]! * PESO_USO;
      const datosLimitados = b.partidas < MAX_PARTIDAS_DATOS_LIMITADOS;
      let tier = tierDePuntuacion(puntuacion);
      if (datosLimitados && (tier === 'S' || tier === 'A')) tier = 'B';
      const entrada: EntradaCampeon = {
        campeon: b.campeon,
        rol,
        partidas: b.partidas,
        tasaVictoria: b.tasaVictoria,
        uso: usos[i]!,
        tier,
        datosLimitados,
      };
      return { entrada, puntuacion };
    });
    filas.sort((a, b) => b.puntuacion - a.puntuacion);
    campeones.push(...filas.map((f) => f.entrada));
  }
  return { parche, campeones };
}
