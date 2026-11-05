import type { Rol } from '@coach/shared';
import { mismoCampeon } from '../../shared/campeones';
import { t } from '../../shared/i18n';
import { esGrieta } from '../../shared/modosOverlay';
import type { EstadoPartida, EventoPartida, JugadorPartida, ObjetivoEstado } from '../../shared/tiposApp';
import { calleDeEstructura, rolDe } from './junglaEnemiga';
import { TIPO_ANCIANO } from './objetivos';
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

/*
 * 3.13 · Más estrategia, de la guía «Estrategia de LoL: conceptos y frases para el coach». Lo mismo que arriba: solo
 * lo que se ve en pantalla o en el marcador. Las oleadas no se ven en la API, así que solo se calcula cuándo sale la
 * de cañón (por el evento oficial MinionsSpawning) y el resto se dice en el momento típico y en condicional.
 */
/** Una oleada cada 30 s desde MinionsSpawning; la de cañón, una de cada tres en la fase de líneas. */
export const OLEADA_CADA_S = 30;
export const CANON_CADA_OLEADAS = 3;
/** La oleada de cañón solo se recuerda en la fase de líneas y, como mucho, una vez cada 5 min. */
export const CANON_DESDE_S = 180;
export const CANON_HASTA_S = 840;
export const CANON_ENFRIAMIENTO_MS = 300_000;
/** La carrera al nivel 2: unos segundos después de salir la primera oleada. */
export const NIVEL2_TRAS_OLEADA_S = 20;
/** Primer gankeo posible del jungla rival (termina su primera vuelta entre el 3:00 y el 3:30). */
export const PRIMER_GANK_S = 170;
/** Consejo sobre los hechizos de invocador de tu rival de línea (solo cuáles lleva, nunca su enfriamiento). */
export const HECHIZO_RIVAL_S = 30;
/** Comparación de farmeo con tu rival de línea (minutos 8 y 12) y diferencia que cuenta. */
export const MINUTOS_CRUCE_CS = [480, 720] as const;
export const CS_VENTAJA = 15;
/** Le sacas un nivel a tu rival: en la fase de líneas, como mucho cada 4 min. */
export const VENTAJA_NIVEL_DESDE_S = 180;
export const VENTAJA_NIVEL_HASTA_S = 840;
/** Muertes contra el mismo rival de línea que piden jugar más atrás (en la fase de líneas). */
export const MUERTES_MISMO_RIVAL = 2;
/** Aliados muertos a la vez (sin contarte a ti) para el aviso de inferioridad numérica. */
export const DESVENTAJA_ALIADOS = 3;
/** Desde el 25:00, antes de un objetivo, las líneas laterales (en vez del consejo de la fase de líneas). */
export const LATERAL_DESDE_S = 1500;
/** Maná bajo (fracción) para aconsejar volver, como con la vida. */
export const MANA_BAJO = 0.15;
/** Segundos después del Barón, el ancestral o un as para decir qué hacer con la ventaja. */
export const TRAS_MEJORA_S = 15;
/** Si la ventaja numérica ya mandó a por un objetivo hace menos de esto, el as no lo repite. */
export const AS_TRAS_VENTAJA_S = 60;
/** Cambiar el tótem por la lente: el jungla a los 10:00 y el soporte a los 14:00. */
export const LENTE_S: Partial<Record<Rol, number>> = { JUNGLE: 600, UTILITY: 840 };
const ID_TOTEM = 3340;
export const BASE_REPETIDO = 'voz.macro.repetido';
const ROLES_FARMEO: ReadonlySet<Rol> = new Set(['TOP', 'MIDDLE', 'BOTTOM']);
const OBJETIVOS_CAMBIO: Record<string, ObjetivoEstado['id']> = { DragonKill: 'dragon', HeraldKill: 'heraldo', HordeKill: 'larvas' };

const OBJETIVOS_PREPARAR: ReadonlySet<ObjetivoEstado['id']> = new Set(['dragon', 'anciano', 'heraldo', 'baron']);
const OBJETIVOS_VENTAJA: ReadonlySet<ObjetivoEstado['id']> = new Set(['dragon', 'anciano', 'heraldo', 'baron', 'larvas']);
/** Objetivos que se pueden coger a cambio de uno que se lleva el rival. */
const OBJETIVOS_CAMBIO_A: ReadonlySet<ObjetivoEstado['id']> = new Set(['dragon', 'heraldo', 'larvas', 'baron']);
/** Fin de la fase de líneas para los consejos del cruce. */
const HASTA_LINEAS_S = 840;

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
  private manaBajoDesde: number | null = null;
  /** Última vez que se propuso la ventaja numérica: el as no repite la misma orden justo después. */
  private ultimaVentaja = -Infinity;
  /** Muertes tuyas contra cada campeón rival. */
  private muertesContra = new Map<string, number>();

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
    // 3.13
    this.oleadas(e, previo, decir);
    this.inicioDeLinea(e, previo, decir);
    this.cruce(e, previo, nuevos, decir);
    this.numeros(e, previo, decir);
    this.trasObjetivos(e, previo, nuevos, decir);
    this.manaBajo(e, decir);
    this.lente(e, previo, decir);
    return salida;
  }

  reiniciar(): void {
    this.previo = null;
    this.eventosVistos.clear();
    this.rotarDicho = false;
    this.vidaBajaDesde = null;
    this.manaBajoDesde = null;
    this.ultimaVentaja = -Infinity;
    this.muertesContra.clear();
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
    this.ultimaVentaja = estado.tiempo;
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
      // 3.13: desde el 25:00 lo que cuenta antes de un objetivo son las líneas laterales.
      const lateral = estado.tiempo >= LATERAL_DESDE_S && ROLES_FARMEO.has(rol);
      const base = estado.oro >= ORO_BACK ? 'voz.macro.backObjetivo' : lateral ? 'voz.macro.lateral' : `voz.macro.preparar.${rol}`;
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
  // ---------------------------------------------------------------- 3.13 · oleadas

  /**
   * La oleada de cañón: MinionsSpawning (evento oficial) marca la primera oleada, sale una cada 30 s y la de cañón es
   * una de cada tres. No sabemos dónde está la oleada; solo que la de cañón acaba de salir.
   */
  private oleadas(e: EntradaSucesos, previo: EstadoPartida, decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    if (rol === 'JUNGLE' || estado.muerto === true) return;
    const inicio = primeraOleada(estado);
    if (inicio === null) return;
    const cada = OLEADA_CADA_S * CANON_CADA_OLEADAS;
    // La oleada de cañón k (k = 1, 2…) es la oleada número 3k: sale (3k − 1) × 30 s después de la primera.
    for (let k = 1; ; k++) {
      const sale = inicio + cada * k - OLEADA_CADA_S;
      if (sale > estado.tiempo || sale > CANON_HASTA_S) return;
      if (sale < CANON_DESDE_S || !cruza(previo.tiempo, estado.tiempo, sale)) continue;
      const base = estado.oro >= ORO_BACK ? 'voz.macro.canon.back' : 'voz.macro.canon.empuja';
      decir(c('macro', `canon:${k}`, base, 'macro', { grupo: 'macro.canon', enfriamientoMs: CANON_ENFRIAMIENTO_MS }));
      return;
    }
  }

  /** Inicio de la fase de líneas: hechizos del rival (cuáles lleva), la carrera al nivel 2 y el primer gankeo. */
  private inicioDeLinea(e: EntradaSucesos, previo: EstadoPartida, decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    if (rol === 'JUNGLE') return;
    if (cruza(previo.tiempo, estado.tiempo, HECHIZO_RIVAL_S)) {
      const rival = this.rivalDe(e);
      const hechizos = rival?.hechizos ?? [];
      const cual = hechizos.includes('SummonerDot') ? 'prender' : hechizos.some((h) => h.startsWith('SummonerTeleport')) ? 'teleport' : null;
      if (rival && cual) decir(c('macro', `hechizoRival:${cual}`, `voz.macro.hechizoRival.${cual}`, 'macro', { params: { campeon: rival.nombre ?? rival.campeon } }));
    }
    const inicio = primeraOleada(estado);
    if (inicio !== null && cruza(previo.tiempo, estado.tiempo, inicio + NIVEL2_TRAS_OLEADA_S)) {
      decir(c('macro', 'nivel2', 'voz.macro.nivel2', 'macro'));
    }
    if (cruza(previo.tiempo, estado.tiempo, PRIMER_GANK_S)) decir(c('macro', 'primerGank', 'voz.macro.primerGank', 'macro'));
  }

  // ---------------------------------------------------------------- 3.13 · tu cruce

  /** Farmeo y nivel frente a tu rival de línea (los dos salen en el marcador) y muertes repetidas contra él. */
  private cruce(e: EntradaSucesos, previo: EstadoPartida, nuevos: EventoPartida[], decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    if (rol === 'JUNGLE') return;
    const rival = this.rivalDe(e);
    if (!rival) return;
    const campeon = rival.nombre ?? rival.campeon;

    // Farmeo en los minutos 8 y 12 (el soporte no farmea).
    const marca = MINUTOS_CRUCE_CS.find((m) => cruza(previo.tiempo, estado.tiempo, m));
    if (marca !== undefined && ROLES_FARMEO.has(rol) && estado.cs !== undefined && rival.cs !== undefined) {
      const diferencia = estado.cs - rival.cs;
      if (Math.abs(diferencia) >= CS_VENTAJA) {
        const base = diferencia > 0 ? 'voz.macro.cs.delante' : 'voz.macro.cs.detras';
        decir(c('macro', `cruceCs:${marca}`, base, 'macro', { params: { campeon } }));
      }
    }

    // Le sacas un nivel (el nivel 6 ya lo dice «antes que tu rival»).
    const antes = previo.jugadores?.find((j) => mismoCampeon(j.campeon, rival.campeon));
    if (
      rival.nivel !== undefined &&
      antes?.nivel !== undefined &&
      estado.nivel > rival.nivel &&
      !(previo.nivel > antes.nivel) &&
      estado.nivel !== 6 &&
      estado.tiempo >= VENTAJA_NIVEL_DESDE_S &&
      estado.tiempo <= VENTAJA_NIVEL_HASTA_S &&
      estado.muerto !== true
    ) {
      decir(c('nivel', `ventajaNivel:${estado.nivel}`, 'voz.macro.ventajaNivel', 'nivel', { params: { campeon }, grupo: 'macro.nivel', enfriamientoMs: 240_000 }));
    }

    // Tu rival de línea te mata por segunda vez: juega más atrás.
    for (const x of nuevos) {
      if (x.nombre !== 'ChampionKill' || !mismoCampeon(x.victima, estado.campeon) || !mismoCampeon(x.asesino, rival.campeon)) continue;
      const n = (this.muertesContra.get(rival.campeon) ?? 0) + 1;
      this.muertesContra.set(rival.campeon, n);
      if (n === MUERTES_MISMO_RIVAL && x.tiempo <= HASTA_LINEAS_S && estado.tiempo - x.tiempo <= RETRASO_MAXIMO_EVENTO_S) {
        // Momento «muerte»: espera a que acabe la pelea (estás muerto) y sustituye al consejo general de la muerte.
        decir(c('macro', `repetido:${rival.campeon}`, BASE_REPETIDO, 'muerte', { params: { campeon } }));
      }
    }
  }

  // ---------------------------------------------------------------- 3.13 · inferioridad numérica

  /** Tres o más aliados muertos a la vez (tú vivo): esperad a los que reaparecen. */
  private numeros(e: EntradaSucesos, previo: EstadoPartida, decir: (c: Candidata) => void): void {
    const { estado } = e;
    if (!estado.equipo || estado.muerto === true || estado.tiempo < VENTAJA_DESDE_S) return;
    const caidos = (jugadores: JugadorPartida[] | undefined) =>
      (jugadores ?? []).filter(
        (j) => j.equipo === estado.equipo && !mismoCampeon(j.campeon, estado.campeon) && j.muerto === true && (j.reaparece ?? 0) >= VENTAJA_MIN_S,
      ).length;
    if (caidos(estado.jugadores) < DESVENTAJA_ALIADOS || caidos(previo.jugadores) >= DESVENTAJA_ALIADOS) return;
    decir(c('macro', `desventaja:${Math.floor(estado.tiempo / 30)}`, 'voz.macro.desventaja', 'macro', { grupo: 'macro.desventaja', enfriamientoMs: 90_000 }));
  }

  // ---------------------------------------------------------------- 3.13 · después de un objetivo

  /**
   * Objetivo del rival: cambiarlo por otro en el otro lado (o una torre). Y unos segundos después del Barón, el
   * ancestral o un as de tu equipo, qué hacer con la ventaja (la frase de «objetivo tomado» ya ha sonado).
   */
  private trasObjetivos(e: EntradaSucesos, previo: EstadoPartida, nuevos: EventoPartida[], decir: (c: Candidata) => void): void {
    const { estado } = e;
    if (!estado.equipo) return;
    for (const x of nuevos) {
      const tomado = OBJETIVOS_CAMBIO[x.nombre];
      if (!tomado || x.dragon === TIPO_ANCIANO || !x.equipo || x.equipo === estado.equipo) continue;
      if (estado.tiempo - x.tiempo > RETRASO_MAXIMO_EVENTO_S) continue;
      const otro = e.overlay.objetivos.find(
        (o) => o.id !== tomado && OBJETIVOS_CAMBIO_A.has(o.id) && (o.disponible || (o.aparece !== null && o.aparece <= 45)),
      );
      const id = Math.floor(x.tiempo / 60);
      if (otro) {
        decir(c('macro', `cambio:${id}`, 'voz.macro.cambio.objetivo', 'macro', { params: { objetivo: t(`voz.nombre.${otro.id}`) }, grupo: 'macro.cambio', enfriamientoMs: 90_000 }));
      } else {
        decir(c('macro', `cambio:${id}`, 'voz.macro.cambio.torre', 'macro', { grupo: 'macro.cambio', enfriamientoMs: 90_000 }));
      }
    }
    for (const x of estado.eventos) {
      if (!cruza(previo.tiempo, estado.tiempo, x.tiempo + TRAS_MEJORA_S) || !x.equipo) continue;
      const lado = x.equipo === estado.equipo ? 'aliado' : 'rival';
      const clave = `mejora:${claveEvento(x)}`;
      if (x.nombre === 'BaronKill') decir(c('macro', clave, `voz.macro.mejora.baron.${lado}`, 'macro'));
      else if (x.nombre === 'DragonKill' && x.dragon === TIPO_ANCIANO) decir(c('macro', clave, `voz.macro.mejora.anciano.${lado}`, 'macro'));
      else if (x.nombre === 'Ace' && lado === 'aliado' && estado.tiempo >= VENTAJA_DESDE_S && estado.tiempo - this.ultimaVentaja > AS_TRAS_VENTAJA_S) {
        const objetivo = e.overlay.objetivos.find((o) => OBJETIVOS_VENTAJA.has(o.id) && (o.disponible || (o.aparece !== null && o.aparece <= 20)));
        if (objetivo) decir(c('macro', clave, 'voz.macro.as.objetivo', 'macro', { params: { objetivo: t(`voz.nombre.${objetivo.id}`) } }));
        else decir(c('macro', clave, 'voz.macro.as.torre', 'macro'));
      }
    }
  }

  // ---------------------------------------------------------------- 3.13 · maná y visión

  /** Sin maná unos segundos seguidos, fuera de pelea y con algo de oro: vuelve a base (solo campeones de maná). */
  private manaBajo(e: EntradaSucesos, decir: (c: Candidata) => void): void {
    const { estado } = e;
    const bajo = estado.mana !== undefined && estado.mana < MANA_BAJO && estado.muerto !== true && estado.tiempo >= 120;
    if (!bajo) {
      this.manaBajoDesde = null;
      return;
    }
    this.manaBajoDesde ??= estado.tiempo;
    if (estado.tiempo - this.manaBajoDesde < VIDA_BAJA_DURANTE_S || enPelea(estado) || estado.oro < ORO_BACK_VIDA) return;
    decir(c('macro', `backMana:${this.manaBajoDesde}`, 'voz.macro.backMana', 'macro', { grupo: 'macro.back', enfriamientoMs: 180_000 }));
  }

  /** Jungla y soporte: cambia el tótem por la lente para los objetivos (si aún llevas el tótem). */
  private lente(e: EntradaSucesos, previo: EstadoPartida, decir: (c: Candidata) => void): void {
    const { estado, rol } = e;
    const marca = LENTE_S[rol];
    if (marca === undefined || !cruza(previo.tiempo, estado.tiempo, marca) || !estado.objetos.includes(ID_TOTEM)) return;
    decir(c('vision', 'lente', 'voz.macro.lente', 'vision'));
  }
}

/** Hora de partida de la primera oleada (evento oficial MinionsSpawning); null si aún no ha salido. */
function primeraOleada(estado: EstadoPartida): number | null {
  return estado.eventos.find((x) => x.nombre === 'MinionsSpawning')?.tiempo ?? null;
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
