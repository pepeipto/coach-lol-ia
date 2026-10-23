import type { Perfil } from '../../shared/perfil';
import type { AjustesStreamer } from '../../shared/streamer';
import type { EstadoCarga, JugadorCarga } from '../../shared/tiposApp';

/*
 * 3.8: modo streamer. Main aplica la sustitución antes de mandar nada a las ventanas (overlay y principal), así ninguna
 * ventana llega a tener el Riot ID de los demás. Son funciones puras: no tocan lo guardado en disco ni mandan nada.
 */

type Modo = Pick<AjustesStreamer, 'activo' | 'ocultarPropio'>;

/** Se sustituye el nombre de este jugador (los demás siempre; el tuyo, solo con «ocultar también el mío»). */
const sustituir = (m: Modo, propio: boolean) => m.activo && (!propio || m.ocultarPropio);

/** Pantalla de carga: el Riot ID de cada jugador pasa a ser el nombre de su campeón. */
export function anonimizarCarga(estado: EstadoCarga, m: Modo): EstadoCarga {
  if (!m.activo) return estado;
  return {
    ...estado,
    jugadores: estado.jugadores.map((j): JugadorCarga => (sustituir(m, !!j.propio) ? { ...j, riotId: j.nombre || j.campeon, streamer: true } : j)),
  };
}

/**
 * Perfil: en el historial, el nombre de cada jugador pasa a ser el de su campeón; con `ocultarPropio`, también el tuyo y
 * el invocador de la cabecera (que pasa a `etiquetaPropia`, p. ej. «Invocador», sin etiqueta #).
 */
export function anonimizarPerfil(perfil: Perfil, m: Modo, etiquetaPropia: string): Perfil {
  if (!m.activo) return perfil;
  const campeon = (id: number) => perfil.campeonesDD[id]?.nombre ?? '';
  return {
    ...perfil,
    invocador: perfil.invocador && m.ocultarPropio ? { ...perfil.invocador, nombre: etiquetaPropia, tag: '' } : perfil.invocador,
    partidas: perfil.partidas.map((p) => ({
      ...p,
      jugadores: p.jugadores.map((j) => (sustituir(m, j.participante === p.yo) ? { ...j, nombre: campeon(j.campeonId) } : j)),
    })),
  };
}
