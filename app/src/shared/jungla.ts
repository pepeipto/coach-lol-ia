// Temporizadores MANUALES de la jungla (compartido: lo usan main y el overlay): el jugador marca cuándo limpia cada campamento. Solo se
// ofrecen sus propios campamentos y los dos Escarabajos del río; nunca los del rival (política de
// Riot). La API de partida no informa de los campamentos: nada de esto se deduce ni se lee del juego.
//
// Tiempos del parche 26.20 (Data Dragon 16.20), comprobados el 2026-10-19:
// - Primera aparición (cambiada en 26.1, sin cambios después):
//   https://wiki.leagueoflegends.com/en-us/V26.01 — Azul, Rojo, Lobos y Aviar «Initial spawn time
//   reduced to 0:55 from 1:30»; Gromp y Krugs «reduced to 1:07 from 1:42»; Escarabajo «reduced to
//   2:55 from 3:30». Misma lista en https://www.riftpatchnotes.com/lol/system/jungle (sin cambios
//   de aparición ni de reaparición de campamentos entre 26.2 y 26.20).
// - Reaparición (fichas de la wiki, consultadas el 2026-10-19):
//   https://wiki.leagueoflegends.com/en-us/Blue_Sentinel y /Red_Brambleback — 5:00;
//   /Gromp — 2:15 (desde V11.10); /Murk_Wolf, /Crimson_Raptor y /Ancient_Krug — 2:15;
//   /Rift_Scuttler — 2:30 (desde V8.11).
// Cada reaparición cuenta desde que el jugador marca el campamento (si lo marca tarde, el
// temporizador va igual de tarde).

import { t } from './i18n';
import type { CampamentoEstado, EstadoJungla, IdCampamento } from './tiposApp';

export interface DefCampamento {
  id: IdCampamento;
  /** Primera aparición (segundos de partida). */
  aparece: number;
  /** Reaparición tras limpiarlo (segundos). */
  reaparece: number;
  /** Mitad del mapa para el lado azul (ORDER); en el rojo se invierte. Los Escarabajos no cambian. */
  zonaAzul: 'arriba' | 'abajo';
  rio?: boolean;
}

export const CAMPAMENTOS_JUNGLA: readonly DefCampamento[] = [
  { id: 'azul', aparece: 55, reaparece: 300, zonaAzul: 'arriba' },
  { id: 'gromp', aparece: 67, reaparece: 135, zonaAzul: 'arriba' },
  { id: 'lobos', aparece: 55, reaparece: 135, zonaAzul: 'arriba' },
  { id: 'aviar', aparece: 55, reaparece: 135, zonaAzul: 'abajo' },
  { id: 'rojo', aparece: 55, reaparece: 300, zonaAzul: 'abajo' },
  { id: 'krugs', aparece: 67, reaparece: 135, zonaAzul: 'abajo' },
  { id: 'escarabajoArriba', aparece: 175, reaparece: 150, zonaAzul: 'arriba', rio: true },
  { id: 'escarabajoAbajo', aparece: 175, reaparece: 150, zonaAzul: 'abajo', rio: true },
];

/** Lado de la Grieta (0..14870 en los dos ejes; y hacia arriba, con la base azul abajo a la izquierda). */
export const TAMANO_MAPA = 14870;

/**
 * Centro de cada campamento en coordenadas del mapa, para el lado azul (ORDER). Valores aproximados de los mapas
 * de la comunidad (los mismos que usa el servidor en `rutaJungla.ts`), dentro de unas 250 unidades de los del
 * encargo. Los del lado rojo son la simetría central (14870 − x, 14870 − y); los Escarabajos son del río y no
 * cambian de lado.
 */
export const POSICIONES_CAMPAMENTOS: Record<IdCampamento, { x: number; y: number }> = {
  azul: { x: 3821, y: 8101 },
  gromp: { x: 2288, y: 8448 },
  lobos: { x: 3783, y: 6495 },
  aviar: { x: 7061, y: 5325 },
  rojo: { x: 7762, y: 4011 },
  krugs: { x: 8394, y: 2641 },
  escarabajoArriba: { x: 4400, y: 9600 },
  escarabajoAbajo: { x: 10500, y: 5100 },
};

/**
 * Punto del minimapa (0..1, con (0, 0) arriba a la izquierda) donde está un campamento propio o un Escarabajo
 * según tu lado. Solo los campamentos que el jugador marca a mano: nunca los del rival.
 */
export function posicionMinimapa(id: IdCampamento, lado: 'azul' | 'rojo'): { x: number; y: number } {
  const c = POSICIONES_CAMPAMENTOS[id];
  const rio = id === 'escarabajoArriba' || id === 'escarabajoAbajo';
  const p = lado === 'rojo' && !rio ? { x: TAMANO_MAPA - c.x, y: TAMANO_MAPA - c.y } : c;
  return { x: p.x / TAMANO_MAPA, y: 1 - p.y / TAMANO_MAPA };
}

/** Segundos antes de la reaparición en que se avisa por voz. */
export const AVISO_JUNGLA_ANTES = 30;

/** Momento (segundos de partida) en que el jugador marcó cada campamento como limpiado. */
export type MarcasJungla = Partial<Record<IdCampamento, number>>;

const definicion = (id: IdCampamento) => CAMPAMENTOS_JUNGLA.find((c) => c.id === id)!;

/** Segundos que faltan para la reaparición marcada (≤ 0 si ya reapareció; null sin marca). */
export function restanteMarca(marcas: MarcasJungla, id: IdCampamento, tiempo: number): number | null {
  const marca = marcas[id];
  return marca === undefined ? null : marca + definicion(id).reaparece - tiempo;
}

/**
 * Marca un campamento como limpiado ahora. Si ya tenía una reaparición en curso, la marca se quita:
 * un campamento no se puede limpiar mientras no ha vuelto, así que es un clic por error.
 */
export function marcarCampamento(marcas: MarcasJungla, id: IdCampamento, tiempo: number): MarcasJungla {
  const restante = restanteMarca(marcas, id, tiempo);
  const siguiente = { ...marcas };
  if (restante !== null && restante > 0) delete siguiente[id];
  else siguiente[id] = tiempo;
  return siguiente;
}

/** Estado de los 8 campamentos para el widget; sin equipo conocido se asume el lado azul. */
export function estadoJungla(marcas: MarcasJungla, tiempo: number, equipo?: 'ORDER' | 'CHAOS'): EstadoJungla {
  const lado = equipo === 'CHAOS' ? 'rojo' : 'azul';
  const campamentos = CAMPAMENTOS_JUNGLA.map((c): CampamentoEstado => {
    const marcado = restanteMarca(marcas, c.id, tiempo);
    const restante = marcado !== null && marcado > 0 ? marcado : c.aparece - tiempo;
    const zona = lado === 'azul' || c.rio ? c.zonaAzul : c.zonaAzul === 'arriba' ? 'abajo' : 'arriba';
    return {
      id: c.id,
      nombre: t(`jungla.${c.id}`),
      zona,
      aparece: restante > 0 ? Math.ceil(restante) : null,
      disponible: restante <= 0,
      marcado: marcado !== null && marcado > 0,
    };
  });
  return { lado, campamentos };
}
