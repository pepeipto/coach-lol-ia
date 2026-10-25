import type { Rol } from '@coach/shared';
import { mismoCampeon } from '../../shared/campeones';
import { esGrieta } from '../../shared/modosOverlay';
import type { EstadoPartida, JugadorCarga, JugadorPartida } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import { rolDe } from './junglaEnemiga';
import { valorObjetos } from './motor';

/*
 * 3.9 · «Power spike» del rival (mejora 3 del estudio de la competencia): cuando un enemigo completa un objeto que
 * cambia una pelea, la voz y el overlay lo dicen («Zed ha terminado Ángel de la guarda: hay que matarlo dos veces»).
 *
 * Normas de Riot: SOLO los objetos que da `allgamedata` de la Live Client Data API, que son los mismos que el
 * jugador ve en el marcador (Tab). Nada de recalls, guardianes, posiciones ni enfriamientos del rival: «Products may
 * not provide any game-session-specific information that would be previously unknown to the player»
 * (developer.riotgames.com/docs/lol). El oro de cada enemigo tampoco se ve: «más oro» es el valor en oro de sus
 * objetos (lo mismo que suma el Tab), como en `oroEnObjetos`.
 *
 * Para no hacer spam: solo el rival de línea (en la Grieta) y los 3 enemigos con más oro en objetos, una vez por
 * objeto y campeón; el disparador de voz pone como mucho uno cada SPIKE_CADA_MS y prioridad media en el regulador.
 */

/** Qué implica el objeto en una pelea (clave de la frase: voz.spike.<efecto>). */
export type EfectoSpike = 'estasis' | 'revivir' | 'antiheal' | 'escudo' | 'dano';

/**
 * Lista corta de objetos clave (ids de Data Dragon 16.21, comprobados el 25-10-2026), elegidos por su efecto en una
 * pelea y no por su precio:
 * - estasis: Reloj de arena de Zhonya (3157), 2,5 s invulnerable: el combo entero puede caer en el vacío;
 * - revivir: Ángel de la guarda (3026), vuelve a la vida: hay que matarlo dos veces;
 * - antiheal: Recordatorio letal (3033), Morellonomicón (3165), Mecanoespada punki (6609) y Malla de espinas (3075):
 *   heridas graves, tu curación y tu robo de vida rinden menos;
 * - escudo: Velo del hada de la muerte (3102) y Filo de la noche (3814), escudo de hechizos que bloquea la primera
 *   habilidad; Fauces de Malmortius (3156), escudo mágico; Cimitarra mercurial (3139), limpia los controles;
 * - daño: Sombrero mortal de Rabadon (3089) y Filo infinito (3031), el mayor salto de daño de magos y tiradores.
 * Los objetos de Arena con id de 6 cifras (22xxxx…) se reducen al id base (Arena no tiene este aviso, por si acaso).
 */
export const OBJETOS_SPIKE: Readonly<Record<number, EfectoSpike>> = {
  3157: 'estasis',
  3026: 'revivir',
  3033: 'antiheal',
  3165: 'antiheal',
  6609: 'antiheal',
  3075: 'antiheal',
  3102: 'escudo',
  3814: 'escudo',
  3156: 'escudo',
  3139: 'escudo',
  3089: 'dano',
  3031: 'dano',
};

/** Además del rival de línea, los enemigos con más oro en objetos que se vigilan. */
export const SPIKE_MAS_ORO = 3;
/** Como mucho un aviso de spike cada tantos milisegundos (voz y overlay). */
export const SPIKE_CADA_MS = 20_000;

export interface Spike {
  /** Id de Data Dragon del campeón enemigo. */
  campeon: string;
  /** Nombre visible del campeón (championName de la API) o, si falta, el id. */
  nombreCampeon: string;
  objeto: number;
  nombreObjeto: string;
  efecto: EfectoSpike;
}

export interface EntradaSpikes {
  estado: EstadoPartida;
  rol: Rol;
  objetos?: DatosEstaticos['objetos'];
  carga?: JugadorCarga[] | null;
}

/** Id base de un objeto (los de Arena llevan delante 22, 32, 44…). */
export const idBase = (id: number): number => (id >= 100_000 ? id % 10_000 : id);

/** Los enemigos que se vigilan: el rival de línea (Grieta) y los SPIKE_MAS_ORO con más oro en objetos. */
export function enemigosVigilados(e: EntradaSpikes): JugadorPartida[] {
  const { estado } = e;
  if (!estado.equipo) return [];
  const enemigos = (estado.jugadores ?? []).filter((j) => j.equipo !== estado.equipo);
  const valor = (j: JugadorPartida) => valorObjetos(j.objetos, e.objetos ?? {});
  const porOro = [...enemigos].sort((a, b) => valor(b) - valor(a)).slice(0, SPIKE_MAS_ORO);
  const rival = esGrieta(estado.modo) ? enemigos.find((j) => rolDe(j.campeon, estado, e.carga ?? null) === e.rol) : undefined;
  return rival && !porOro.includes(rival) ? [rival, ...porOro] : porOro;
}

/**
 * Detecta objetos clave recién completados por los enemigos vigilados. Con `primero` (primer estado de la partida o
 * al reconectar) solo aprende lo que ya tienen. Arena queda fuera (allí no hay rival de línea ni dos equipos de 5).
 */
export class DetectorSpikes {
  /** Objetos clave que ya tenía cada enemigo (por id de campeón). */
  private vistos = new Map<string, Set<number>>();

  procesar(e: EntradaSpikes, primero: boolean): Spike[] {
    const { estado } = e;
    if (estado.modo === 'arena' || !estado.equipo) return [];
    const salida: Spike[] = [];
    const vigilados = new Set(enemigosVigilados(e).map((j) => j.campeon));
    for (const j of estado.jugadores ?? []) {
      if (j.equipo === estado.equipo) continue;
      const clave = (j.objetos ?? []).map(idBase).filter((id) => OBJETOS_SPIKE[id]);
      const antes = this.vistos.get(j.campeon) ?? new Set<number>();
      // Se aprende siempre (también de los no vigilados), para que entrar en el top 3 no anuncie lo que ya tenían.
      for (const id of clave) {
        if (antes.has(id)) continue;
        antes.add(id);
        if (primero || !vigilados.has(j.campeon)) continue;
        const nombreObjeto = e.objetos?.[id]?.name;
        if (!nombreObjeto) continue;
        salida.push({ campeon: j.campeon, nombreCampeon: j.nombre ?? j.campeon, objeto: id, nombreObjeto, efecto: OBJETOS_SPIKE[id]! });
      }
      this.vistos.set(j.campeon, antes);
    }
    // El rival de línea primero: es el que más importa.
    const rival = esGrieta(estado.modo) ? (estado.jugadores ?? []).find((j) => j.equipo !== estado.equipo && rolDe(j.campeon, estado, e.carga ?? null) === e.rol) : undefined;
    return salida.sort((a, b) => Number(mismoCampeon(b.campeon, rival?.campeon)) - Number(mismoCampeon(a.campeon, rival?.campeon)));
  }

  reiniciar(): void {
    this.vistos.clear();
  }
}
