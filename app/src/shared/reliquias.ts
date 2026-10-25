// 3.9 · Reliquias de vida del Abismo de los Lamentos (ARAM y ARAM: Caos), MANUALES como la jungla: el jugador marca
// con un clic o una tecla opcional cuándo se recoge una reliquia y la app cuenta su reaparición. La Live Client Data
// API no tiene ningún evento de reliquias: nada de esto se lee del juego. Es lo que el jugador ve en el mapa y apunta
// (normas de Riot: sin información oculta).
//
// Tiempos (wiki oficial de LoL, https://wiki.leagueoflegends.com/en-us/Health_Relic, consultada el 25-10-2026):
// - «Four health relic pads exist on the map, two for each team.»
// - Primera aparición: «The first Outer health relics spawn at 1:45 and the first Inner health relics spawn at 2:30»
//   (cambio de V8.11; ningún cambio de tiempos posterior en su historial).
// - Reaparición: «Health Relics have a respawn timer of 90 seconds, starting from the moment their beam strikes», y el
//   rayo cae 2,5 s después de recogerla. Desde que el jugador la marca (al recogerla) faltan 92,5 s.
// La wiki no dice nada de ARAM: Caos: se juega en el mismo Abismo y se asumen los mismos tiempos (s/c).

import { t } from './i18n';
import type { EstadoReliquias, IdReliquia, ReliquiaEstado } from './tiposApp';

/** Reaparición tras caer el rayo (s). */
export const RELIQUIA_REAPARECE_S = 90;
/** El rayo cae tantos segundos después de recoger la reliquia. */
export const RELIQUIA_RAYO_S = 2.5;

export interface DefReliquia {
  id: IdReliquia;
  /** Primera aparición (segundos de partida). */
  aparece: number;
}

/** Las cuatro reliquias: las dos de tu mitad del mapa y las dos de la del rival, exterior (1:45) e interior (2:30). */
export const RELIQUIAS: readonly DefReliquia[] = [
  { id: 'propiaExterior', aparece: 105 },
  { id: 'propiaInterior', aparece: 150 },
  { id: 'rivalExterior', aparece: 105 },
  { id: 'rivalInterior', aparece: 150 },
];

export const esIdReliquia = (v: unknown): v is IdReliquia => RELIQUIAS.some((r) => r.id === v);

/** Momento (segundos de partida) en que el jugador marcó cada reliquia como recogida. */
export type MarcasReliquias = Partial<Record<IdReliquia, number>>;

/** Segundos que faltan para que vuelva una reliquia marcada (≤ 0 si ya está; null sin marca). */
export function restanteReliquia(marcas: MarcasReliquias, id: IdReliquia, tiempo: number): number | null {
  const marca = marcas[id];
  return marca === undefined ? null : marca + RELIQUIA_RAYO_S + RELIQUIA_REAPARECE_S - tiempo;
}

/** Marca una reliquia como recogida ahora; si su cuenta atrás seguía en curso, la quita (un clic por error). */
export function marcarReliquia(marcas: MarcasReliquias, id: IdReliquia, tiempo: number): MarcasReliquias {
  const restante = restanteReliquia(marcas, id, tiempo);
  const siguiente = { ...marcas };
  if (restante !== null && restante > 0) delete siguiente[id];
  else siguiente[id] = tiempo;
  return siguiente;
}

/** Estado de las cuatro reliquias para el widget. */
export function estadoReliquias(marcas: MarcasReliquias, tiempo: number): EstadoReliquias {
  return {
    reliquias: RELIQUIAS.map((r): ReliquiaEstado => {
      const marcado = restanteReliquia(marcas, r.id, tiempo);
      const restante = marcado !== null && marcado > 0 ? marcado : r.aparece - tiempo;
      return {
        id: r.id,
        nombre: t(`reliquias.${r.id}`),
        aparece: restante > 0 ? Math.ceil(restante) : null,
        disponible: restante <= 0,
        marcado: marcado !== null && marcado > 0,
      };
    }),
  };
}
