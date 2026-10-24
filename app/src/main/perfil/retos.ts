import type { EstadoReto, IdReto, PartidaHistorial } from '../../shared/perfil';
import { cuenta, metricas } from './puntuaciones';

/*
 * 3.5: retos de práctica (como las «Reps» de Game Coach AI). Hay uno activo cada vez; cuenta las partidas que lo
 * cumplen desde que se eligió y la racha de partidas seguidas cumpliéndolo.
 */

type Metricas = NonNullable<ReturnType<typeof metricas>>;

export interface DefinicionReto {
  id: IdReto;
  objetivo: number;
  /** La partida cuenta para este reto (p. ej. el CS no cuenta jugando de apoyo). */
  aplica: (m: Metricas) => boolean;
  cumple: (m: Metricas) => boolean;
}

export const RETOS: DefinicionReto[] = [
  { id: 'cs7', objetivo: 5, aplica: (m) => m.grieta && m.rol !== 'UTILITY' && m.rol !== 'JUNGLE', cumple: (m) => m.csMin >= 7 },
  { id: 'cs8', objetivo: 3, aplica: (m) => m.grieta && m.rol !== 'UTILITY' && m.rol !== 'JUNGLE', cumple: (m) => m.csMin >= 8 },
  { id: 'muertes4', objetivo: 5, aplica: () => true, cumple: (m) => m.muertes <= 4 },
  { id: 'kp50', objetivo: 5, aplica: () => true, cumple: (m) => m.kp >= 0.5 },
  { id: 'vision1', objetivo: 5, aplica: (m) => m.grieta, cumple: (m) => m.vision >= 1 },
  { id: 'dano25', objetivo: 3, aplica: (m) => m.rol !== 'UTILITY', cumple: (m) => m.dano >= 0.25 },
  { id: 'puntuacion60', objetivo: 5, aplica: () => true, cumple: (m) => m.puntuacion >= 60 },
  { id: 'victorias3', objetivo: 3, aplica: () => true, cumple: (m) => m.victoria },
];

export const esIdReto = (v: unknown): v is IdReto => RETOS.some((r) => r.id === v);

/** Estado del reto con las partidas jugadas desde `desde` (ISO), de la más reciente a la más antigua. */
export function estadoReto(id: IdReto, desde: string, partidas: PartidaHistorial[]): EstadoReto {
  const def = RETOS.find((r) => r.id === id)!;
  const resultados = partidas
    .filter((p) => cuenta(p) && p.fecha >= desde)
    .map(metricas)
    .filter((m): m is Metricas => !!m && def.aplica(m))
    .map(def.cumple);
  const hechas = Math.min(def.objetivo, resultados.filter(Boolean).length);
  let racha = 0;
  for (const r of resultados) {
    if (!r) break;
    racha++;
  }
  return { id, hechas, objetivo: def.objetivo, racha, completado: hechas >= def.objetivo, desde, ultimas: resultados.slice(0, 10) };
}

/**
 * Reto que se propone cuando no hay ninguno: el que más le cuesta al jugador en sus últimas partidas (el que menos
 * cumple), para practicar su punto débil. Sin partidas, «muertes4».
 */
export function retoSugerido(partidas: PartidaHistorial[]): IdReto {
  const ms = partidas.filter(cuenta).slice(0, 15).map(metricas).filter((m): m is Metricas => !!m);
  let peor: { id: IdReto; tasa: number } | null = null;
  for (const def of RETOS) {
    if (def.id === 'victorias3' || def.id === 'cs8') continue;
    const aplican = ms.filter(def.aplica);
    if (aplican.length < 3) continue;
    const tasa = aplican.filter(def.cumple).length / aplican.length;
    if (!peor || tasa < peor.tasa) peor = { id: def.id, tasa };
  }
  return peor?.id ?? 'muertes4';
}

export { retoDeAnalisis } from '../../shared/perfil';
