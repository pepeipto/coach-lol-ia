import type { Rol } from '@coach/shared';
import { mismoCampeon } from '../../shared/campeones';
import { t } from '../../shared/i18n';
import { esGrieta } from '../../shared/modosOverlay';
import type { EstadoPartida, EventoPartida, JugadorPartida, ObjetivoEstado } from '../../shared/tiposApp';
import { calleDeEstructura, rolDe } from './junglaEnemiga';
import { enPelea } from './regulador';
import type { Candidata, EntradaSucesos } from './sucesos';
import { RETRASO_MAXIMO_EVENTO_S } from './sucesos';

/*
 * 3.12 · Coach de estrategia (macro): las órdenes que da un coach de verdad, encadenando situación → qué hacer
 * («Tu rival está muerto: empuja y vuelve a base»). Solo con lo que el jugador ve en su pantalla o en el marcador
 * (TAB): quién está muerto y cuánto le falta (el marcador lo enseña), los tiempos de los objetivos, las torres caídas,
 * tu oro y tu vida. Nada de posiciones, enfriamientos ni definitivas del rival.
 *
 * Como el resto de detectores, solo propone candidatas; DisparadorVoz no repite claves y ReguladorVoz decide cuándo
 * suenan (con PELEA_S, nada de esto se dice en mitad de una pelea tuya salvo lo urgente).
 */

/** Oro con el que una vuelta a base ya merece la pena (un componente grande o un objeto). */
export const ORO_BACK = 1100;
/** Segundos mínimos de reaparición del rival para que dé tiempo a aprovecharlo. */
export const RIVAL_MUERTO_MIN_S = 12;
/** El consejo del rival de línea muerto solo en la fase de líneas. */
export const RIVAL_MUERTO_DESDE_S = 150;
export const RIVAL_MUERTO_HASTA_S = 1200;
/** Ventaja numérica: rivales muertos a la vez y segundos mínimos que dura la ventana. */
export const VENTAJA_RIVALES = 2;
export const VENTAJA_MIN_S = 15;
export const VENTAJA_DESDE_S = 420;
/** Ventana del consejo de preparar un objetivo (segundos que faltan para que aparezca). */
export const PREPARAR_DESDE_S = 75;
export const PREPARAR_HASTA_S = 100;
/** Antes de este minuto los que no son jungla siguen en línea: no se les manda a preparar objetivos. */
export const PREPARAR_LINEAS_DESDE_S = 420;
/** Las placas de las torres caen a los 14:00: aviso un minuto antes. */
export const PLACAS_AVISO_S = 780;
/** Vida baja (fracción) durante unos segundos seguidos, vivo y fuera de pelea, para aconsejar volver. */
export const VIDA_BAJA = 0.3;
export const VIDA_BAJA_DURANTE_S = 4;
export const ORO_BACK_VIDA = 700;

const OBJETIVOS_PREPARAR: ReadonlySet<ObjetivoEstado['id']> = new Set(['dragon', 'anciano', 'heraldo', 'baron']);
const OBJETIVOS_VENTAJA: ReadonlySet<ObjetivoEstado['id']> = new Set(['dragon', 'anciano', 'heraldo', 'baron', 'larvas']);

/** Calle de las torres de cada rol (el soporte comparte la de abajo). */
const CALLE_DE_ROL: Record<Rol, 'top' | 'mid' | 'bot' | null> = { TOP: 'top', MIDDLE: 'mid', BOTTOM: 'bot', UTILITY: 'bot', JUNGLE: null };

/** Torre exterior de una calle: la 03 de arriba y abajo, la 05 del centro (Turret_T1_L_03_A, Turret_T2_C_05_A…). */
export function esTorreExterior(nombre: string): boolean {
  const m = /^Turret_T[12]_([LCR])_(\d+)/.exec(nombre);
  if (!m) return false;
  return m[1] === 'C' ? m[2] === '05' : m[2] === '03';
}

const cruza = (antes: number, ahora: number, marca: number) => antes < marca && ahora >= marca;

export class DetectorMacro {
  private previo: EstadoPartida | null = null;
  private eventosVistos = new Set<string>();
  private rotarDicho = false;
  private vidaBajaDesde: number | null = null;

  procesar(e: EntradaSucesos, primero: boolean): Candidata[] {
    const { estado } = e;
    const salida: Candidata[] = [];
    const previo = this.previo;
    const nuevos = estado.eventos.filter((x) => !this.eventosVistos.has(claveEvento(x)));
    for (const x of nuevos) this.eventosVistos.add(claveEvento(x));
    this.previo = estado;
    if (primero || !previo || !esGrieta(estado.modo) || estado.rotativo) {
      if (primero) this.aprenderTorres(nuevos, e.rol);
      return salida;
    }
    const decir = (c: Candidata) => salida.push(c);
    this.rivalDeLinea(e, previo, decir);
    this.ventajaNumerica(e, previo, decir);
    this.prepararObjetivos(e, decir);
    this.placasYTorres(e, previo, nuevos, decir);
    this.vidaBaja(e, decir);
    return salida;
  }

  reiniciar(): void {
    this.previo = null;
    this.eventosVistos.clear();
    this.rotarDicho = false;
    this.vidaBajaDesde = null;
  }

  // ---------------------------------------------------------------- rival de línea

  /** Tu rival de línea acaba de morir (o llega a nivel 6 antes que tú). */
  private rivalDeLinea(e: EntradaSucesos, previo: EstadoPartida, decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    const rival = this.rivalDe(e);
    if (!rival) return;
    const antes = previo.jugadores?.find((j) => mismoCampeon(j.campeon, rival.campeon));
    const campeon = rival.nombre ?? rival.campeon;

    // Nivel 6 del rival antes que tú: respeta su definitiva (el marcador enseña los niveles).
    if (rol !== 'JUNGLE' && antes?.nivel !== undefined && rival.nivel !== undefined && antes.nivel < 6 && rival.nivel >= 6 && estado.nivel < 6) {
      decir(c('nivel', `rival6:${rival.campeon}`, 'voz.macro.rival6', 'nivel', { params: { campeon } }));
    }

    const acabaDeMorir = rival.muerto === true && antes?.muerto === false;
    if (!acabaDeMorir || estado.muerto === true) return;
    if ((rival.reaparece ?? 0) < RIVAL_MUERTO_MIN_S) return;
    if (estado.tiempo < RIVAL_MUERTO_DESDE_S || estado.tiempo > RIVAL_MUERTO_HASTA_S) return;
    const base =
      rol === 'JUNGLE'
        ? 'voz.macro.rivalMuerto.jungla'
        : estado.oro >= ORO_BACK
          ? 'voz.macro.rivalMuerto.back'
          : 'voz.macro.rivalMuerto.empuja';
    decir(
      c('macro', `rivalMuerto:${rival.campeon}:${Math.floor(estado.tiempo)}`, base, 'macro', {
        params: { campeon },
        grupo: 'macro.rival',
        enfriamientoMs: 60_000,
      }),
    );
  }

  private rivalDe(e: EntradaSucesos): JugadorPartida | null {
    const { estado, rol } = e;
    if (!estado.equipo) return null;
    const rivales = (estado.jugadores ?? []).filter((j) => j.equipo !== estado.equipo && rolDe(j.campeon, estado, e.carga ?? null) === rol);
    return rivales.length === 1 ? rivales[0]! : null;
  }

  // ---------------------------------------------------------------- ventaja numérica

  /** Dos o más rivales muertos a la vez durante un rato: id a por un objetivo o una torre. */
  private ventajaNumerica(e: EntradaSucesos, previo: EstadoPartida, decir: (c: Candidata) => void): void {
    const { estado } = e;
    if (!estado.equipo || estado.muerto === true || estado.tiempo < VENTAJA_DESDE_S) return;
    const caidos = (jugadores: JugadorPartida[] | undefined) =>
      (jugadores ?? []).filter((j) => j.equipo !== estado.equipo && j.muerto === true && (j.reaparece ?? 0) >= VENTAJA_MIN_S);
    const ahora = caidos(estado.jugadores);
    const antes = caidos(previo.jugadores).length;
    // Con los cinco muertos ya habla el as.
    if (ahora.length < VENTAJA_RIVALES || antes >= VENTAJA_RIVALES || ahora.length >= 5) return;
    const ventana = Math.min(...ahora.map((j) => j.reaparece ?? 0));
    const objetivo = e.overlay.objetivos.find(
      (o) => OBJETIVOS_VENTAJA.has(o.id) && (o.disponible || (o.aparece !== null && o.aparece <= ventana - 10)),
    );
    const id = Math.floor(estado.tiempo / 30);
    if (objetivo) {
      decir(
        c('macro', `ventaja:${id}`, 'voz.macro.ventaja.objetivo', 'macro', {
          params: { objetivo: t(`voz.nombre.${objetivo.id}`) },
          grupo: 'macro.ventaja',
          enfriamientoMs: 90_000,
        }),
      );
    } else {
      decir(c('macro', `ventaja:${id}`, 'voz.macro.ventaja.torre', 'macro', { grupo: 'macro.ventaja', enfriamientoMs: 90_000 }));
    }
  }

  // ---------------------------------------------------------------- objetivos

  /**
   * Minuto y medio antes de un objetivo épico: si tienes oro, vuelve ahora a base para llegar con la compra; si no,
   * qué hacer según tu rol (empujar y rotar, visión, teletransporte…).
   */
  private prepararObjetivos(e: EntradaSucesos, decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    if (estado.muerto === true) return;
    if (rol !== 'JUNGLE' && estado.tiempo < PREPARAR_LINEAS_DESDE_S) return;
    for (const o of e.overlay.objetivos) {
      if (!OBJETIVOS_PREPARAR.has(o.id) || o.disponible || o.aparece === null) continue;
      if (o.aparece < PREPARAR_DESDE_S || o.aparece > PREPARAR_HASTA_S) continue;
      // Una vez por aparición: la hora de partida a la que sale, redondeada.
      const sale = Math.round((estado.tiempo + o.aparece) / 20);
      const objetivo = t(`voz.nombre.${o.id}`);
      const base = estado.oro >= ORO_BACK ? 'voz.macro.backObjetivo' : `voz.macro.preparar.${rol}`;
      decir(c('macro', `preparar:${o.id}:${sale}`, base, 'macro', { params: { objetivo }, grupo: 'macro.objetivo' }));
      return;
    }
  }

  // ---------------------------------------------------------------- torres

  private aprenderTorres(eventos: EventoPartida[], rol: Rol): void {
    if (eventos.some((x) => this.esTorreDeTuCalle(x, rol))) this.rotarDicho = true;
  }

  private esTorreDeTuCalle(x: EventoPartida, rol: Rol): boolean {
    const calle = CALLE_DE_ROL[rol];
    return x.nombre === 'TurretKilled' && !!calle && !!x.estructura && esTorreExterior(x.estructura) && calleDeEstructura(x.estructura) === calle;
  }

  /** Placas a punto de caer (13:00) y primera torre de tu calle caída (sea de quien sea): toca moverse por el mapa. */
  private placasYTorres(e: EntradaSucesos, previo: EstadoPartida, nuevos: EventoPartida[], decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    if (rol !== 'JUNGLE' && cruza(previo.tiempo, estado.tiempo, PLACAS_AVISO_S)) {
      decir(c('macro', 'placas', 'voz.macro.placas', 'macro'));
    }
    if (this.rotarDicho) return;
    const torre = nuevos.find((x) => this.esTorreDeTuCalle(x, rol));
    if (!torre) return;
    this.rotarDicho = true;
    if (estado.tiempo - torre.tiempo > RETRASO_MAXIMO_EVENTO_S) return;
    decir(c('macro', 'rotar', 'voz.macro.rotar', 'macro'));
  }

  // ---------------------------------------------------------------- vida

  /** Poca vida unos segundos seguidos, fuera de pelea y con algo de oro: vuelve a base. */
  private vidaBaja(e: EntradaSucesos, decir: (c: Candidata) => void): void {
    const { estado } = e;
    const baja = estado.vida !== undefined && estado.vida < VIDA_BAJA && estado.muerto !== true && estado.tiempo >= 120;
    if (!baja) {
      this.vidaBajaDesde = null;
      return;
    }
    this.vidaBajaDesde ??= estado.tiempo;
    if (estado.tiempo - this.vidaBajaDesde < VIDA_BAJA_DURANTE_S || enPelea(estado) || estado.oro < ORO_BACK_VIDA) return;
    decir(
      c('macro', `backVida:${this.vidaBajaDesde}`, 'voz.macro.backVida', 'macro', { grupo: 'macro.back', enfriamientoMs: 180_000 }),
    );
  }
}

function claveEvento(x: EventoPartida): string {
  return `${x.nombre}:${x.id ?? ''}:${x.tiempo}:${x.estructura ?? ''}`;
}

function c(
  tipo: Candidata['tipo'],
  clave: string,
  base: string,
  momento: Candidata['momento'],
  o: { params?: Record<string, string | number>; grupo?: string; enfriamientoMs?: number } = {},
): Candidata {
  return { tipo, clave, base, momento, ...o };
}
