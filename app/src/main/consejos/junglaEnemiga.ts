import type { Rol, RutaJungla } from '@coach/shared';
import { localeActual, t } from '../../shared/i18n';
import { mismoCampeon } from '../../shared/campeones';
import { esGrieta } from '../../shared/modosOverlay';
import type { EstadoPartida, EventoPartida, JugadorCarga } from '../../shared/tiposApp';
import { SelectorVariantes } from './variantes';

/*
 * Track F1 · Avisos del jungla enemigo por el registro de la partida.
 * Solo usa lo que ya enseña el juego: los eventos oficiales de la Live Client Data API (ChampionKill y, desde la
 * 3.0.2, los objetivos y las estructuras con KillerName / Assisters) y los roles de la pantalla de carga (o
 * `position` de la API). Nunca mira la pantalla, el minimapa ni la memoria del juego (lo prohíben Riot y Vanguard),
 * y nunca dice dónde «está» el jungla: el texto siempre habla de lo que acaba de pasar («acaba de …»).
 */

/** Como mucho un aviso cada 20 s de partida. */
export const INTERVALO_AVISO_S = 20;
/** Una kill que llega con más de 10 s de retraso ya no se avisa (ya no dice nada útil). */
export const RETRASO_MAXIMO_S = 10;
/** Solo hasta el minuto 14: después los jugadores dejan su calle y el rol de la víctima ya no dice la zona. */
export const HASTA_S = 14 * 60;

export type ZonaJungla = 'top' | 'mid' | 'bot' | 'jungla';

export interface AvisoJunglaEnemiga {
  clave: string;
  /** Zona de una kill; null en los objetivos y las estructuras (el texto ya dice cuál). */
  zona: ZonaJungla | null;
  texto: string;
}

function enemigos(estado: EstadoPartida) {
  if (!estado.equipo) return [];
  return (estado.jugadores ?? []).filter((j) => j.equipo !== estado.equipo);
}

/**
 * El campeón del jungla enemigo: el único enemigo con Castigo (si la pantalla de carga dice otra cosa, gana el
 * Castigo); si no hay uno solo, el enemigo con rol JUNGLE en la pantalla de carga; si no, el que la API marca como
 * JUNGLE. Null si no se sabe sin adivinar.
 */
export function junglaEnemigo(estado: EstadoPartida, carga: JugadorCarga[] | null): string | null {
  const rivales = enemigos(estado);
  if (rivales.length === 0) return null;
  const conCastigo = rivales.filter((j) => j.castigo);
  if (conCastigo.length === 1) return conCastigo[0]!.campeon;
  const deCarga = carga?.find((j) => j.equipo === 'enemigo' && j.rol === 'JUNGLE' && j.campeon);
  const enPartida = deCarga && rivales.find((j) => mismoCampeon(j.campeon, deCarga.campeon));
  if (enPartida) return enPartida.campeon;
  const porPosicion = rivales.filter((j) => j.posicion === 'JUNGLE');
  return porPosicion.length === 1 ? porPosicion[0]!.campeon : null;
}

/** Rol de un campeón de la partida: el de la pantalla de carga o, si no, `position` de la API. */
export function rolDe(campeon: string, estado: EstadoPartida, carga: JugadorCarga[] | null): Rol | null {
  const deCarga = carga?.find((j) => mismoCampeon(j.campeon, campeon))?.rol;
  if (deCarga) return deCarga;
  return estado.jugadores?.find((j) => mismoCampeon(j.campeon, campeon))?.posicion ?? null;
}

export function zonaDeRol(rol: Rol): ZonaJungla {
  if (rol === 'TOP') return 'top';
  if (rol === 'MIDDLE') return 'mid';
  if (rol === 'JUNGLE') return 'jungla';
  return 'bot';
}

/**
 * 3.0.2: objetivos de la Live Client Data API (eventos oficiales con KillerName y Assisters) → clave del texto.
 * Cualquier otro tipo de evento (Multikill, FirstBlood, Ace, uno nuevo de Riot…) se ignora sin fallar.
 */
const OBJETIVOS: Record<string, string> = {
  DragonKill: 'dragon',
  HordeKill: 'larvas',
  HeraldKill: 'heraldo',
  BaronKill: 'baron',
  AtakhanKill: 'atakhan',
};
const ESTRUCTURAS = new Set(['TurretKilled', 'InhibKilled']);

export type CalleEstructura = 'top' | 'mid' | 'bot' | 'nexo';

/**
 * Calle de una torre o un inhibidor por su nombre oficial: «Turret_T1_L_03_A» (L = top, C = mid, R = bot; las C_01 y
 * C_02 son las del nexo) o «Barracks_T2_R1». Null si el nombre no tiene esa forma.
 */
export function calleDeEstructura(nombre: string): CalleEstructura | null {
  const torre = /^Turret_T[12]_([LCR])_(\d+)/.exec(nombre);
  const inhib = /^Barracks_T[12]_([LCR])\d/.exec(nombre);
  const letra = torre?.[1] ?? inhib?.[1];
  if (!letra) return null;
  if (torre && letra === 'C' && Number(torre[2]) <= 2) return 'nexo';
  return letra === 'L' ? 'top' : letra === 'C' ? 'mid' : 'bot';
}

/** Decide, estado a estado, qué eventos nuevos del jungla enemigo (kills, objetivos y estructuras) merecen aviso. */
export class AvisadorJunglaEnemiga {
  private vistas = new Set<string>();
  private primero = true;
  private ultimoAviso = -Infinity;
  /** 3.1: las tres larvas son tres HordeKill seguidos; se avisa una vez por campamento. */
  private ultimasLarvas = -Infinity;
  /** 3.1: cada aviso tiene variantes (se elige una al azar sin repetir la anterior). */
  private readonly selector: SelectorVariantes;

  /** El selector de variantes (al azar sin repetir la anterior) se puede sustituir en las pruebas. */
  constructor(o: { selector?: SelectorVariantes } = {}) {
    this.selector = o.selector ?? new SelectorVariantes();
  }

  /** El último aviso de este estado (o null). Ver procesarTodos. */
  procesar(estado: EstadoPartida, carga: JugadorCarga[] | null): AvisoJunglaEnemiga | null {
    return this.procesarTodos(estado, carga).at(-1) ?? null;
  }

  /**
   * Avisos nuevos de este estado, en orden. Solo eventos oficiales del registro de la partida en los que el jungla
   * enemigo sale como KillerName, en Assisters o (en ChampionKill) como víctima:
   *  - kills: la zona de la víctima (o la de quien lo mata si muere él); como mucho uno cada INTERVALO_AVISO_S y
   *    solo antes de HASTA_S (después el rol ya no dice la zona);
   *  - objetivos (dragón, larvas, Heraldo, Barón, Atakhan) y estructuras (torres, inhibidores): toda la partida.
   * Cada evento se avisa una vez (por EventID); los que llegan con más de RETRASO_MAXIMO_S de retraso, no.
   */
  procesarTodos(estado: EstadoPartida, carga: JugadorCarga[] | null): AvisoJunglaEnemiga[] {
    const interesantes = estado.eventos
      .filter((e) => e.nombre === 'ChampionKill' || e.nombre in OBJETIVOS || ESTRUCTURAS.has(e.nombre))
      .sort((a, b) => a.tiempo - b.tiempo);
    const nuevos = interesantes.filter((e) => !this.vistas.has(claveDe(e)));
    for (const e of nuevos) this.vistas.add(claveDe(e));
    // Al empezar (o reconectar), lo que ya había pasado no se avisa.
    if (this.primero) {
      this.primero = false;
      return [];
    }
    if (!esGrieta(estado.modo)) return [];
    const jungla = junglaEnemigo(estado, carga);
    if (!jungla) return [];

    const avisos: AvisoJunglaEnemiga[] = [];
    for (const e of nuevos) {
      if (estado.tiempo - e.tiempo > RETRASO_MAXIMO_S) continue;
      const participa = mismoCampeon(e.asesino, jungla) || !!e.asistentes?.some((a) => mismoCampeon(a, jungla));
      const clave = `junglaEnemiga:${claveDe(e)}`;
      if (e.nombre === 'ChampionKill') {
        const aviso = this.kill(e, jungla, participa, estado, carga);
        if (aviso) avisos.push({ clave, ...aviso });
        continue;
      }
      if (!participa) continue;
      const objetivo = OBJETIVOS[e.nombre];
      if (objetivo === 'larvas') {
        if (e.tiempo - this.ultimasLarvas < 60) continue;
        this.ultimasLarvas = e.tiempo;
      }
      if (objetivo) {
        const cual = objetivo === 'dragon' && e.dragon === 'Elder' ? 'dragonAncestral' : objetivo;
        avisos.push({ clave, zona: null, texto: this.selector.texto(`junglaEnemiga.objetivo.${cual}`) });
        continue;
      }
      const calle = e.estructura ? calleDeEstructura(e.estructura) : null;
      if (!calle) continue;
      const texto =
        calle === 'nexo'
          ? this.selector.texto('junglaEnemiga.estructura.torreNexo')
          : this.selector.texto(e.nombre === 'InhibKilled' ? 'junglaEnemiga.estructura.inhibidor' : 'junglaEnemiga.estructura.torre', {
              calle: t(`junglaEnemiga.calleDe.${calle}`),
            });
      avisos.push({ clave, zona: null, texto });
    }
    return avisos;
  }

  /** Aviso de zona por una kill (con el intervalo y el límite del minuto 14), sin la clave. */
  private kill(
    k: EventoPartida,
    jungla: string,
    participa: boolean,
    estado: EstadoPartida,
    carga: JugadorCarga[] | null,
  ): Omit<AvisoJunglaEnemiga, 'clave'> | null {
    if (k.tiempo >= HASTA_S) return null;
    // Si muere él, se le ha visto donde estaba quien lo mata.
    const muereEl = mismoCampeon(k.victima, jungla);
    if (!participa && !muereEl) return null;
    const referencia = muereEl ? k.asesino : k.victima;
    if (!referencia) return null;
    const rol = rolDe(referencia, estado, carga);
    if (!rol) return null;
    if (k.tiempo - this.ultimoAviso < INTERVALO_AVISO_S) return null;
    const zona = zonaDeRol(rol);
    this.ultimoAviso = k.tiempo;
    return { zona, texto: this.selector.texto('junglaEnemiga.aviso', { zona: t(`junglaEnemiga.zona.${zona}`) }) };
  }

  reiniciar(): void {
    this.vistas.clear();
    this.primero = true;
    this.ultimoAviso = -Infinity;
    this.ultimasLarvas = -Infinity;
    this.selector.reiniciar();
  }
}

/** Clave de un evento: su EventID o, si falta, su momento. */
export const claveDe = (k: { id?: number; tiempo: number }) => (k.id !== undefined ? String(k.id) : `t${k.tiempo}`);

const CALLES = ['top', 'mid', 'bot'] as const;

/** La respuesta de `GET /jungla/ruta/:campeon` solo si tiene la forma esperada (minuto del primer gank entre 2 y 4). */
export function validarRutaJungla(x: unknown): RutaJungla | null {
  if (typeof x !== 'object' || x === null) return null;
  const r = x as Record<string, unknown>;
  if (r.inicio !== null && r.inicio !== 'rojo' && r.inicio !== 'azul') return null;
  if (typeof r.partidas !== 'number' || !Number.isFinite(r.partidas) || r.partidas < 0) return null;
  let primerGank: RutaJungla['primerGank'] = null;
  if (r.primerGank !== null) {
    const g = r.primerGank as Record<string, unknown> | undefined;
    if (typeof g !== 'object' || !g || !CALLES.includes(g.calle as never)) return null;
    if (typeof g.minuto !== 'number' || !(g.minuto >= 2 && g.minuto <= 4)) return null;
    primerGank = { calle: g.calle as (typeof CALLES)[number], minuto: g.minuto };
  }
  return { inicio: r.inicio, primerGank, partidas: r.partidas };
}

/**
 * Texto de la ruta estimada (Track F2): siempre «Estimación: … suele …», nunca dónde está el jungla.
 * Null si no hay nada claro que decir.
 */
export function textoRutaJungla(nombre: string, ruta: RutaJungla): string | null {
  const inicio = ruta.inicio ? t(`junglaEnemiga.lado.${ruta.inicio}`) : null;
  const g = ruta.primerGank;
  const calle = g ? t(`junglaEnemiga.calle.${g.calle}`) : null;
  const minuto = g ? (Math.round(g.minuto * 10) / 10).toLocaleString(localeActual(), { maximumFractionDigits: 1, useGrouping: false }) : '';
  if (inicio && calle) return t('junglaEnemiga.ruta.completa', { campeon: nombre, inicio, calle, minuto });
  if (inicio) return t('junglaEnemiga.ruta.inicio', { campeon: nombre, inicio });
  if (calle) return t('junglaEnemiga.ruta.gank', { campeon: nombre, calle, minuto });
  return null;
}
