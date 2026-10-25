import type { JugadorHistorial, PartidaHistorial } from './perfil';

/*
 * 3.9 · Puesto del 1.º al 10.º en UNA partida (mejora 6 del estudio de la competencia), sobre nuestras notas de 0 a
 * 100 (`puntuaciones.total`). MVP: el mejor del equipo ganador; ACE: el mejor del perdedor.
 *
 * Norma de Riot: es la nota de una sola partida, nunca una clasificación alternativa. No se acumula en ninguna liga,
 * media de puestos ni número tipo MMR: «Products cannot create alternatives for official skill ranking systems…
 * Prohibited alternatives include MMR or ELO calculators» (developer.riotgames.com/policies/general). Por eso este
 * cálculo se hace al vuelo al abrir la partida y no se guarda en ningún sitio.
 */

export type InsigniaPuesto = 'mvp' | 'ace';

export interface PuestoJugador {
  /** 1 = mejor nota de la partida. */
  puesto: number;
  insignia: InsigniaPuesto | null;
}

export interface PuestosPartida {
  /** Por participante. */
  porJugador: Map<number, PuestoJugador>;
  /** Jugadores ordenados. */
  total: number;
}

/**
 * Orden por nota total (de más a menos). En empate decide la nota de combate y luego el número de participante, para
 * que el orden sea siempre el mismo. MVP y ACE solo con dos equipos y un ganador (no en Arena ni en una partida rara).
 */
export function puestosPartida(p: Pick<PartidaHistorial, 'jugadores'>): PuestosPartida {
  const orden = [...p.jugadores].sort(
    (a, b) => b.puntuaciones.total - a.puntuaciones.total || b.puntuaciones.combate - a.puntuaciones.combate || a.participante - b.participante,
  );
  const porJugador = new Map<number, PuestoJugador>(orden.map((j, i) => [j.participante, { puesto: i + 1, insignia: null }]));
  const equipos = new Set(p.jugadores.map((j) => j.equipo));
  const ganadores = new Set(p.jugadores.filter((j) => j.victoria).map((j) => j.equipo));
  const dosEquipos = equipos.size === 2 && ganadores.size === 1 && p.jugadores.some((j) => !j.victoria);
  if (dosEquipos) {
    const mejor = (filtro: (j: JugadorHistorial) => boolean) => orden.find(filtro);
    const mvp = mejor((j) => j.victoria);
    const ace = mejor((j) => !j.victoria);
    if (mvp) porJugador.get(mvp.participante)!.insignia = 'mvp';
    if (ace) porJugador.get(ace.participante)!.insignia = 'ace';
  }
  return { porJugador, total: orden.length };
}
