import { clasificarObjeto, MAPA_DE_MODO, type Build, type Rol } from '@coach/shared';
import { mismoCampeon } from '../../shared/campeones';
import { t } from '../../shared/i18n';
import { esGrieta } from '../../shared/modosOverlay';
import type { EstadoOverlay, EstadoPartida, EventoPartida, JugadorCarga, TipoVoz } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import { CAMPEONES_SIN_REGLAS_NORMALES } from './habilidades';
import { calleDeEstructura, claveDe, rolDe } from './junglaEnemiga';
import { CS_OBJETIVO_POR_MINUTO, ID_GUARDIAN_CONTROL, TIPO_ANCIANO, TIPOS_DRAGON } from './objetivos';

/*
 * 3.1 · Detector de sucesos para la voz: lo que pasa en la partida y no es una cuenta atrás. Todo sale de la Live
 * Client Data API (los eventos oficiales y lo que el marcador del juego enseña a todos: niveles, asesinatos,
 * torres), nunca de la pantalla ni de la memoria del juego. Nada de posiciones, enfriamientos ni definitivas del
 * rival: el nivel del rival se compara solo porque el marcador (TAB) lo enseña.
 *
 * El detector solo propone «candidatas» (situación + clave única); DisparadorVoz (voz.ts) elige la variante, aplica
 * los interruptores y no repite claves, y ReguladorVoz (regulador.ts) decide cuándo suenan.
 */

/** Momento de la frase en la tabla de prioridades y caducidades (voz.ts). */
export type MomentoVoz =
  | 'objetivoYa'
  | 'objetivo30'
  | 'objetivo60'
  | 'jungla'
  | 'junglaEnemiga'
  | 'combate'
  | 'objetivoTomado'
  | 'estructura'
  | 'habilidad'
  | 'nivel'
  | 'compra'
  | 'economia'
  | 'equipo'
  | 'animo'
  | 'reaparecer'
  | 'spike'
  | 'ritmoObjetos'
  | 'cs'
  | 'muerte'
  | 'vision'
  | 'modo'
  | 'fase';

export interface Candidata {
  tipo: TipoVoz;
  /** Única por partida: la misma clave no se dice dos veces. */
  clave: string;
  /** Situación (clave base de las variantes en i18n). */
  base: string;
  params?: Record<string, string | number>;
  momento: MomentoVoz;
  grupo?: string;
  enfriamientoMs?: number;
}

export interface EntradaSucesos {
  estado: EstadoPartida;
  overlay: EstadoOverlay;
  rol: Rol;
  objetos?: DatosEstaticos['objetos'];
  build?: Build | null;
  carga?: JugadorCarga[] | null;
  /** Eventos ya avisados por el jungla enemigo (claveDe): no se repiten aquí. */
  yaAvisados?: ReadonlySet<string>;
}

/** Un evento que llega con más retraso ya no se dice (pasa al reconectar o si la API se atasca). */
export const RETRASO_MAXIMO_EVENTO_S = 15;
/** Oro a partir del cual se considera «mucho oro sin gastar», y durante cuánto (s) seguido, vivo, en la Grieta. */
export const ORO_ALTO = 1500;
export const ORO_ALTO_DURANTE_S = 45;
/** Muertes seguidas (sin asesinato ni asistencia en medio) que disparan las frases de calma. */
export const MUERTES_TILT = [3, 5] as const;
/** Rachas de asesinatos sin morir que se celebran. */
export const RACHAS = [3, 5, 7] as const;
/** Minutos de los puntos de control del farmeo y de la visión, y del marcador. */
export const MINUTOS_CS = [5, 10, 15, 20] as const;
export const MINUTOS_VISION = [10, 20, 30] as const;
export const MINUTOS_MARCADOR = [15, 25, 35] as const;
/** Puntuación de visión por minuto de referencia por rol. */
export const VISION_POR_MINUTO: Record<Rol, number> = { TOP: 0.6, JUNGLE: 0.8, MIDDLE: 0.6, BOTTOM: 0.6, UTILITY: 1.6 };
/** Reaparición de los inhibidores (s) y aviso un minuto antes. */
export const INHIBIDOR_REAPARECE_S = 300;
/** Consejos de modo (ARAM, ARAM: Caos y Arena): el primero a los 1:30 y luego cada 2:30, como mucho 8. */
export const CONSEJO_MODO_DESDE_S = 90;
export const CONSEJO_MODO_CADA_S = 150;
/** Abalorios (por si faltan los datos estáticos): Totem, Lente del oráculo, Alteración clarividente, Efigie. */
const ABALORIOS = new Set([3340, 3363, 3364, 3330]);
const ID_BOTAS_BASICAS = 1001;

type Lado = 'aliado' | 'rival';

const cruza = (antes: number, ahora: number, marca: number) => antes < marca && ahora >= marca;

export class DetectorSucesos {
  private vistos = new Set<string>();
  /** Asesinatos sin morir de cada campeón (por el registro de la partida). */
  private rachas = new Map<string, number>();
  private muertesSeguidas = 0;
  private dragones = { ORDER: 0, CHAOS: 0 };
  private torresCaidas = 0;
  private torresPorEquipo = { ORDER: 0, CHAOS: 0 };
  /** Inhibidores propios caídos: nombre → momento de su caída. */
  private inhibidores = new Map<string, number>();
  private ultimasLarvas = -Infinity;
  private previo: EstadoPartida | null = null;
  private muertoDesde: number | null = null;
  private consejoMuerte = false;
  private oroAltoDesde: number | null = null;

  /** Candidatas de este estado. Con `primero` (primer estado de la partida) solo aprende lo que ya pasó. */
  procesar(e: EntradaSucesos, primero: boolean): Candidata[] {
    const { estado } = e;
    const nuevos = estado.eventos.filter((x) => !this.vistos.has(this.clave(x))).sort((a, b) => a.tiempo - b.tiempo);
    for (const x of nuevos) this.vistos.add(this.clave(x));
    const salida: Candidata[] = [];
    const lote: Candidata[] = [];
    for (const x of nuevos) this.evento(x, e, primero ? null : lote);
    if (!primero && this.previo) {
      salida.push(...depurarLote(lote));
      salida.push(...this.estadoNuevo(e, this.previo));
    }
    this.seguirMuerte(estado);
    this.previo = estado;
    return salida;
  }

  reiniciar(): void {
    this.vistos.clear();
    this.rachas.clear();
    this.muertesSeguidas = 0;
    this.dragones = { ORDER: 0, CHAOS: 0 };
    this.torresCaidas = 0;
    this.torresPorEquipo = { ORDER: 0, CHAOS: 0 };
    this.inhibidores.clear();
    this.ultimasLarvas = -Infinity;
    this.previo = null;
    this.muertoDesde = null;
    this.consejoMuerte = false;
    this.oroAltoDesde = null;
  }

  private clave(x: EventoPartida): string {
    return `${x.nombre}:${claveDe(x)}`;
  }

  // ---------------------------------------------------------------- eventos oficiales

  /** Actualiza el estado con un evento y, si `lote` no es null (y el evento es reciente), propone frases. */
  private evento(x: EventoPartida, e: EntradaSucesos, lote: Candidata[] | null): void {
    const { estado } = e;
    const fresco = lote !== null && estado.tiempo - x.tiempo <= RETRASO_MAXIMO_EVENTO_S;
    const decir = (c: Candidata) => fresco && lote!.push(c);
    const yo = estado.campeon;
    const mio = estado.equipo;
    const ladoDe = (equipo: 'ORDER' | 'CHAOS' | undefined): Lado | null => (!equipo || !mio ? null : equipo === mio ? 'aliado' : 'rival');
    const id = claveDe(x);

    switch (x.nombre) {
      case 'ChampionKill': {
        const rachaVictima = x.victima ? (this.rachas.get(x.victima) ?? 0) : 0;
        if (x.victima) this.rachas.set(x.victima, 0);
        if (x.asesino) this.rachas.set(x.asesino, (this.rachas.get(x.asesino) ?? 0) + 1);
        const mia = mismoCampeon(x.asesino, yo);
        const asisto = !mia && !!x.asistentes?.some((a) => mismoCampeon(a, yo));
        if (mia || asisto) {
          if (this.muertesSeguidas >= 2) decir(c('animo', `remontada:${id}`, 'voz.animo.remontada', 'animo'));
          this.muertesSeguidas = 0;
        }
        if (mia) {
          if (rachaVictima >= 3) decir(c('combate', `shutdown:${id}`, 'voz.combate.shutdown', 'combate', { grupo: 'combate.yo' }));
          else decir(c('combate', `asesinato:${id}`, 'voz.combate.asesinato', 'combate', { grupo: 'combate.yo' }));
          const racha = this.rachas.get(x.asesino!) ?? 0;
          if ((RACHAS as readonly number[]).includes(racha)) {
            decir(c('combate', `racha:${racha}:${id}`, `voz.combate.racha.${racha}`, 'equipo', { grupo: 'combate.racha' }));
          }
        } else if (asisto) {
          decir(c('combate', `asistencia:${id}`, 'voz.combate.asistencia', 'combate', { grupo: 'combate.asistencia', enfriamientoMs: 30_000 }));
        }
        if (mismoCampeon(x.victima, yo)) {
          this.muertesSeguidas++;
          decir(c('combate', `muerte:${id}`, 'voz.combate.muerte', 'combate', { grupo: 'combate.yo' }));
          if (this.muertesSeguidas === MUERTES_TILT[0]) decir(c('animo', `tilt3:${id}`, 'voz.animo.tilt3', 'animo'));
          if (this.muertesSeguidas === MUERTES_TILT[1]) decir(c('animo', `tilt5:${id}`, 'voz.animo.tilt5', 'animo'));
        }
        if (!mia && x.asesino) {
          const racha = this.rachas.get(x.asesino) ?? 0;
          const lado = ladoDe(this.equipoDe(estado, x.asesino));
          const campeon = this.nombreDe(estado, x.asesino);
          if (lado === 'aliado' && (racha === 3 || racha === 5)) {
            decir(c('equipo', `rachaAliado:${x.asesino}:${racha}:${id}`, 'voz.equipo.rachaAliado', 'equipo', { params: { campeon }, grupo: 'equipo.racha' }));
          } else if (lado === 'rival' && (racha === 4 || racha === 6)) {
            decir(c('equipo', `rachaRival:${x.asesino}:${racha}:${id}`, 'voz.equipo.rachaRival', 'equipo', { params: { campeon }, grupo: 'equipo.racha' }));
          }
        }
        return;
      }
      case 'Multikill': {
        const racha = Math.min(5, x.racha ?? 0);
        if (racha < 2) return;
        if (mismoCampeon(x.asesino, yo)) decir(c('combate', `multi:${racha}:${id}`, `voz.combate.multi.${racha}`, 'combate', { grupo: 'combate.yo' }));
        else if (racha === 5 && x.asesino && ladoDe(this.equipoDe(estado, x.asesino)) === 'aliado') {
          decir(c('equipo', `pentaAliado:${id}`, 'voz.equipo.pentaAliado', 'equipo', { params: { campeon: this.nombreDe(estado, x.asesino) } }));
        }
        return;
      }
      case 'FirstBlood': {
        if (mismoCampeon(x.asesino, yo)) decir(c('combate', 'primeraSangre', 'voz.combate.primeraSangre.yo', 'combate', { grupo: 'combate.yo' }));
        else {
          const lado = x.asesino ? ladoDe(this.equipoDe(estado, x.asesino)) : null;
          if (lado) decir(c('combate', 'primeraSangre', `voz.combate.primeraSangre.${lado}`, 'combate'));
        }
        return;
      }
      case 'Ace': {
        const lado = ladoDe(x.equipo);
        // En el mismo grupo que tus frases de combate: con un as no se dice además «buen asesinato».
        if (lado) decir(c('combate', `ace:${id}`, `voz.combate.ace.${lado}`, 'objetivoYa', { grupo: 'combate.yo' }));
        return;
      }
      case 'DragonKill':
      case 'HordeKill':
      case 'HeraldKill':
      case 'BaronKill':
        this.objetivo(x, e, ladoDe(x.equipo), decir);
        return;
      case 'TurretKilled': {
        const duena = equipoDeEstructura(x.estructura);
        if (!duena) return;
        this.torresCaidas++;
        this.torresPorEquipo[duena]++;
        const lado = ladoDe(duena);
        const calle = x.estructura ? calleDeEstructura(x.estructura) : null;
        if (!lado || !calle) return;
        // Lado de quien la derriba: si la torre es tuya, el rival.
        const quien: Lado = lado === 'aliado' ? 'rival' : 'aliado';
        if (quien === 'rival' && e.yaAvisados?.has(id)) return;
        if (this.torresCaidas === 1) {
          decir(c('equipo', 'primeraTorre', `voz.estructura.primeraTorre.${quien}`, 'estructura'));
          return;
        }
        decir(
          c('equipo', `torre:${id}`, quien === 'aliado' ? 'voz.estructura.torreTomada' : 'voz.estructura.torrePerdida', 'estructura', {
            params: { torre: t(`voz.torre.${calle}`) },
            grupo: 'estructura',
          }),
        );
        return;
      }
      case 'InhibKilled': {
        const duena = equipoDeEstructura(x.estructura);
        const calle = x.estructura ? calleDeEstructura(x.estructura) : null;
        const lado = ladoDe(duena ?? undefined);
        if (!lado || !calle || calle === 'nexo') return;
        if (lado === 'aliado') this.inhibidores.set(x.estructura!, x.tiempo);
        if (lado === 'aliado' && e.yaAvisados?.has(id)) return;
        decir(
          c('equipo', `inhib:${id}`, lado === 'aliado' ? 'voz.estructura.inhibPerdido' : 'voz.estructura.inhibTomado', 'estructura', {
            params: { inhibidor: t(`voz.inhibidor.${calle}`) },
            grupo: 'estructura',
          }),
        );
        return;
      }
      case 'InhibRespawned': {
        const duena = equipoDeEstructura(x.estructura);
        const calle = x.estructura ? calleDeEstructura(x.estructura) : null;
        if (!x.estructura || !calle || calle === 'nexo' || ladoDe(duena ?? undefined) !== 'aliado') return;
        this.inhibidores.delete(x.estructura);
        decir(c('equipo', `inhibVuelto:${id}`, 'voz.estructura.inhibVuelto', 'estructura', { params: { inhibidor: t(`voz.inhibidor.${calle}`) } }));
        return;
      }
      case 'GameEnd':
        if (x.resultado) decir(c('animo', 'final', x.resultado === 'Win' ? 'voz.animo.victoria' : 'voz.animo.derrota', 'objetivoYa'));
        return;
      default:
        return;
    }
  }

  /** Dragón, larvas, Heraldo y Barón conseguidos (con el equipo de KillerName), el robo y el alma de dragón. */
  private objetivo(x: EventoPartida, e: EntradaSucesos, lado: Lado | null, decir: (c: Candidata) => void): void {
    const anciano = x.nombre === 'DragonKill' && x.dragon === TIPO_ANCIANO;
    const id = claveDe(x);
    let alma: 'punto' | 'conseguida' | null = null;
    if (x.nombre === 'DragonKill' && !anciano && x.equipo) {
      const n = ++this.dragones[x.equipo];
      alma = n === 4 ? 'conseguida' : n === 3 ? 'punto' : null;
    }
    if (!lado) return;
    const obj = x.nombre === 'DragonKill' ? (anciano ? 'anciano' : 'dragon') : x.nombre === 'HordeKill' ? 'larvas' : x.nombre === 'HeraldKill' ? 'heraldo' : 'baron';
    if (obj === 'larvas') {
      // Tres larvas = tres eventos: se dice una vez por campamento (también si la primera la dijo el jungla enemigo).
      if (x.tiempo - this.ultimasLarvas < 60) return;
      this.ultimasLarvas = x.tiempo;
    }
    // Lo que acaba de hacer el jungla enemigo ya lo dice su aviso.
    if (lado === 'rival' && e.yaAvisados?.has(id)) {
      if (alma) decir(c('objetivo', `alma:${alma}:${lado}`, `voz.alma.${alma}.${lado}`, 'objetivoTomado'));
      return;
    }
    if (alma === 'conseguida') {
      decir(c('objetivo', `alma:conseguida:${lado}`, `voz.alma.conseguida.${lado}`, 'objetivoTomado'));
      return;
    }
    if (x.robado) {
      decir(c('objetivo', `robo:${id}`, `voz.robo.${lado}`, 'objetivoTomado', { params: { objetivo: t(`voz.nombre.${obj}`) } }));
    } else {
      const dragon = t(`voz.dragonNombre.${(x.dragon && TIPOS_DRAGON[x.dragon]) || 'generico'}`);
      decir(c('objetivo', `tomado:${obj}:${id}`, `voz.tomado.${obj}.${lado}`, 'objetivoTomado', obj === 'dragon' ? { params: { dragon } } : {}));
    }
    if (alma === 'punto') decir(c('objetivo', `alma:punto:${lado}`, `voz.alma.punto.${lado}`, 'objetivo60'));
  }

  // ---------------------------------------------------------------- cambios de estado

  private estadoNuevo(e: EntradaSucesos, previo: EstadoPartida): Candidata[] {
    const { estado } = e;
    const salida: Candidata[] = [];
    const decir = (x: Candidata) => salida.push(x);
    const grieta = esGrieta(estado.modo);
    const modo = estado.modo ?? 'clasificatoria';
    const antes = previo.tiempo;
    const ahora = estado.tiempo;

    // Saludo (a los 0:15 de una partida que empieza; no al reconectar).
    if (cruza(antes, ahora, 15) && ahora < 60) {
      if (grieta) decir(c('animo', 'inicio', 'voz.animo.inicio', 'animo'));
      else decir(c('modo', 'inicio', `voz.modo.${modo}.inicio`, 'modo'));
    }

    // Niveles 6, 11, 16 y 18 (no en Arena: allí no hay orden de habilidades ni definitiva por nivel).
    if (modo !== 'arena' && estado.nivel > previo.nivel) {
      const sinReglas = CAMPEONES_SIN_REGLAS_NORMALES.has(estado.campeon);
      const marca = [18, 16, 11, 6].find((n) => previo.nivel < n && estado.nivel >= n);
      if (marca === 18) decir(c('nivel', 'nivel:18', 'voz.nivel.maximo', 'nivel'));
      else if (marca && !sinReglas) {
        const antesQueRival = marca === 6 && grieta && this.rivalPorDetras(e, 6);
        decir(c('nivel', `nivel:${marca}`, antesQueRival ? 'voz.nivel.antesQueRival' : `voz.nivel.definitiva${marca}`, 'nivel'));
      }
    }

    this.objetos(e, previo, decir);

    if (grieta) {
      this.economia(e, decir);
      this.farmeoYVision(e, antes, ahora, decir);
      this.marcador(e, antes, ahora, decir);
      this.inhibidoresPropios(antes, ahora, decir);
    } else {
      // Consejos del modo: el primero a los 1:30 y luego cada 2:30.
      // Como con el farmeo, un salto que cruce varias marcas solo dice un consejo.
      const k = [7, 6, 5, 4, 3, 2, 1, 0].find((n) => cruza(antes, ahora, CONSEJO_MODO_DESDE_S + n * CONSEJO_MODO_CADA_S));
      if (k !== undefined) decir(c('modo', `consejoModo:${k}`, `voz.modo.${modo === 'arena' ? 'arena' : modo === 'caos' ? 'caos' : 'aram'}.consejo`, 'modo'));
    }

    // Muerte y reaparición (isDead del marcador).
    if (estado.muerto === true && this.muertoDesde !== null && !this.consejoMuerte && ahora - this.muertoDesde >= 3 && (estado.reaparece ?? 0) >= 10) {
      this.consejoMuerte = true;
      if (grieta) decir(c('muerte', `consejoMuerte:${this.muertoDesde}`, 'voz.muerte.consejo', 'muerte'));
      else decir(c('modo', `consejoMuerte:${this.muertoDesde}`, modo === 'arena' ? 'voz.modo.arena.muerte' : 'voz.modo.aram.muerte', 'reaparecer'));
    }
    if (previo.muerto === true && estado.muerto === false && grieta && this.muertoDesde !== null && ahora - this.muertoDesde >= 15) {
      const cerca = e.overlay.objetivos.find((o) => o.disponible || (o.aparece !== null && o.aparece <= 90));
      if (cerca) decir(c('muerte', `reaparecer:${ahora}`, 'voz.muerte.reaparecerObjetivo', 'reaparecer', { params: { objetivo: t(`voz.nombre.${cerca.id}`) } }));
      else decir(c('muerte', `reaparecer:${ahora}`, 'voz.muerte.reaparecer', 'reaparecer'));
    }

    // Sin morir a los 10 y a los 20 minutos.
    if (grieta && estado.kda?.d === 0) {
      if (cruza(antes, ahora, 600)) decir(c('animo', 'sinMorir10', 'voz.animo.sinMorir10', 'animo'));
      if (cruza(antes, ahora, 1200)) decir(c('animo', 'sinMorir20', 'voz.animo.sinMorir20', 'animo'));
    }
    return salida;
  }

  /** Objetos nuevos en el inventario: objeto legendario completado y, tras una compra, el guardián de control. */
  private objetos(e: EntradaSucesos, previo: EstadoPartida, decir: (x: Candidata) => void): void {
    const { estado } = e;
    const quedan = [...previo.objetos];
    const nuevos: number[] = [];
    for (const id of estado.objetos) {
      const i = quedan.indexOf(id);
      if (i === -1) nuevos.push(id);
      else quedan.splice(i, 1);
    }
    if (nuevos.length === 0) return;
    const mapa = MAPA_DE_MODO[estado.modo ?? 'clasificatoria'];
    for (const id of nuevos) {
      const item = e.objetos?.[id];
      if (item && clasificarObjeto(id, item, mapa) === 'legendario') {
        decir(c('economia', `completado:${id}`, 'voz.economia.objetoCompletado', 'economia', { params: { objeto: item.name }, grupo: 'economia.completado' }));
      }
    }
    const compra = nuevos.some((id) => id !== ID_GUARDIAN_CONTROL && !this.esAbalorio(e, id));
    if (
      compra &&
      esGrieta(estado.modo) &&
      estado.tiempo >= 300 &&
      !estado.objetos.includes(ID_GUARDIAN_CONTROL) &&
      estado.oro >= 75 &&
      estado.objetos.length < 7
    ) {
      decir(c('vision', `visionCompra:${Math.floor(estado.tiempo / 300)}`, 'voz.vision.trasCompra', 'vision', { grupo: 'vision.control', enfriamientoMs: 240_000 }));
    }
  }

  private esAbalorio(e: EntradaSucesos, id: number): boolean {
    return ABALORIOS.has(id) || !!e.objetos?.[id]?.tags?.includes('Trinket');
  }

  /** Mucho oro sin gastar, botas y abalorio (solo en la Grieta). */
  private economia(e: EntradaSucesos, decir: (x: Candidata) => void): void {
    const { estado } = e;
    if (estado.oro >= ORO_ALTO && estado.muerto !== true) {
      this.oroAltoDesde ??= estado.tiempo;
      if (estado.tiempo - this.oroAltoDesde >= ORO_ALTO_DURANTE_S) {
        decir(c('economia', `oro:${this.oroAltoDesde}`, 'voz.economia.oroSinGastar', 'economia', { grupo: 'economia.oro', enfriamientoMs: 180_000 }));
      }
    } else this.oroAltoDesde = null;

    const sinBotas = !estado.objetos.some((id) => id === ID_BOTAS_BASICAS || (e.objetos?.[id] && clasificarObjeto(id, e.objetos[id]!) === 'botas'));
    if (estado.tiempo >= 600 && e.build?.botas && sinBotas && estado.objetos.length > 0) {
      decir(c('economia', 'botas', 'voz.economia.botas', 'economia'));
    }
    if (estado.tiempo >= 90 && estado.tiempo < 1200 && estado.objetos.length > 0 && !estado.objetos.some((id) => this.esAbalorio(e, id))) {
      decir(c('vision', 'abalorio', 'voz.vision.abalorio', 'vision'));
    }
  }

  /** Puntos de control del farmeo (5, 10, 15 y 20 min) y de la puntuación de visión (10, 20 y 30 min). */
  private farmeoYVision(e: EntradaSucesos, antes: number, ahora: number, decir: (x: Candidata) => void): void {
    const { estado, rol } = e;
    if (estado.cs !== undefined && rol !== 'UTILITY') {
      // Si un salto de estado cruza dos marcas (pasa al reconectar), solo cuenta la última.
      const m = [...MINUTOS_CS].reverse().find((x) => cruza(antes, ahora, x * 60));
      if (m) {
        const ritmo = estado.cs / m / CS_OBJETIVO_POR_MINUTO[rol];
        const como = ritmo >= 1 ? 'bien' : ritmo >= 0.85 ? 'cerca' : 'bajo';
        decir(c('cs', `cs:${m}`, `voz.cs.${como}`, 'cs'));
      }
    }
    if (estado.vision !== undefined) {
      const m = [...MINUTOS_VISION].reverse().find((x) => cruza(antes, ahora, x * 60));
      if (m) {
        const ritmo = estado.vision / (m * VISION_POR_MINUTO[rol]);
        if (ritmo < 0.5) decir(c('vision', `visionPuntos:${m}`, 'voz.vision.baja', 'vision'));
        else if (ritmo >= 1.2) decir(c('vision', `visionPuntos:${m}`, 'voz.vision.buena', 'vision'));
      }
    }
  }

  /**
   * Cómo va la partida a los 15, 25 y 35 minutos, solo con lo que enseña el marcador a todos: asesinatos (suma de
   * los del marcador) y torres derribadas. Si un equipo va por delante en una cosa y por detrás en otra, no se dice
   * nada (no sería honesto resumirlo). El oro del rival no se ve, así que no se usa.
   */
  private marcador(e: EntradaSucesos, antes: number, ahora: number, decir: (x: Candidata) => void): void {
    const { estado } = e;
    const marca = MINUTOS_MARCADOR.find((m) => cruza(antes, ahora, m * 60));
    if (!marca || !estado.equipo) return;
    const jugadores = estado.jugadores ?? [];
    if (jugadores.length < 2 || jugadores.some((j) => j.asesinatos === undefined)) return;
    const kills = (equipo: 'ORDER' | 'CHAOS') => jugadores.filter((j) => j.equipo === equipo).reduce((s, j) => s + (j.asesinatos ?? 0), 0);
    const rival = estado.equipo === 'ORDER' ? 'CHAOS' : 'ORDER';
    const difK = kills(estado.equipo) - kills(rival);
    // Torres del rival caídas menos torres tuyas caídas.
    const difT = this.torresPorEquipo[rival] - this.torresPorEquipo[estado.equipo];
    let como: 'delante' | 'detras' | 'igualada' | null = null;
    if ((difK >= 5 && difT >= 0) || (difT >= 2 && difK >= 0)) como = 'delante';
    else if ((difK <= -5 && difT <= 0) || (difT <= -2 && difK <= 0)) como = 'detras';
    else if (Math.abs(difK) <= 3 && Math.abs(difT) <= 1) como = 'igualada';
    if (como) decir(c('fase', `marcador:${marca}`, `voz.marcador.${como}`, 'fase'));
  }

  /** Un minuto antes de que vuelva un inhibidor tuyo (sus tiempos se ven en el juego). */
  private inhibidoresPropios(antes: number, ahora: number, decir: (x: Candidata) => void): void {
    for (const [nombre, caida] of this.inhibidores) {
      const vuelve = caida + INHIBIDOR_REAPARECE_S;
      if (ahora > vuelve + 10) {
        this.inhibidores.delete(nombre);
        continue;
      }
      const calle = calleDeEstructura(nombre);
      if (calle && calle !== 'nexo' && cruza(antes, ahora, vuelve - 60)) {
        decir(c('equipo', `inhibVuelve:${nombre}:${caida}`, 'voz.estructura.inhibVuelve60', 'estructura', { params: { inhibidor: t(`voz.inhibidor.${calle}`) } }));
      }
    }
  }

  /** Tu rival de línea (mismo rol en el equipo contrario) aún no ha llegado a `nivel` (el marcador enseña los niveles). */
  private rivalPorDetras(e: EntradaSucesos, nivel: number): boolean {
    const { estado, rol } = e;
    if (!estado.equipo) return false;
    const rivales = (estado.jugadores ?? []).filter((j) => j.equipo !== estado.equipo && rolDe(j.campeon, estado, e.carga ?? null) === rol);
    return rivales.length === 1 && rivales[0]!.nivel !== undefined && rivales[0]!.nivel < nivel;
  }

  private seguirMuerte(estado: EstadoPartida): void {
    if (estado.muerto === true && this.muertoDesde === null) {
      this.muertoDesde = estado.tiempo;
      this.consejoMuerte = false;
    } else if (estado.muerto === false) {
      // Se borra después de usarlo en estadoNuevo (la reaparición necesita saber cuándo murió).
      this.muertoDesde = null;
    }
  }

  private equipoDe(estado: EstadoPartida, campeon: string): 'ORDER' | 'CHAOS' | undefined {
    return estado.jugadores?.find((j) => mismoCampeon(j.campeon, campeon))?.equipo;
  }

  private nombreDe(estado: EstadoPartida, campeon: string): string {
    return estado.jugadores?.find((j) => mismoCampeon(j.campeon, campeon))?.nombre ?? campeon;
  }
}

/** Equipo dueño de una torre o un inhibidor por su nombre oficial: T1 = ORDER (lado azul), T2 = CHAOS. */
export function equipoDeEstructura(nombre: string | undefined): 'ORDER' | 'CHAOS' | null {
  const m = /^(?:Turret|Barracks)_T([12])_/.exec(nombre ?? '');
  return m ? (m[1] === '1' ? 'ORDER' : 'CHAOS') : null;
}

function c(
  tipo: TipoVoz,
  clave: string,
  base: string,
  momento: MomentoVoz,
  o: { params?: Record<string, string | number>; grupo?: string; enfriamientoMs?: number } = {},
): Candidata {
  return { tipo, clave, base, momento, ...o };
}

/** Orden de preferencia de tus frases de combate en un mismo estado: la más especial gana y las demás se callan. */
const RANGO_COMBATE = ['voz.combate.ace.', 'voz.combate.multi.', 'voz.combate.primeraSangre.yo', 'voz.combate.shutdown', 'voz.combate.asesinato', 'voz.combate.muerte'];
const rango = (base: string) => RANGO_COMBATE.findIndex((r) => base.startsWith(r));

/** En un mismo estado, una sola frase por grupo (p. ej. un doble asesinato no dice además «buen asesinato»). */
function depurarLote(lote: Candidata[]): Candidata[] {
  const porGrupo = new Map<string, Candidata>();
  const salida: Candidata[] = [];
  for (const x of lote) {
    if (!x.grupo) {
      salida.push(x);
      continue;
    }
    const otra = porGrupo.get(x.grupo);
    if (!otra) {
      porGrupo.set(x.grupo, x);
      continue;
    }
    const mejor = x.grupo === 'combate.yo' ? (rango(x.base) <= rango(otra.base) ? x : otra) : x;
    porGrupo.set(x.grupo, mejor);
  }
  return [...salida, ...porGrupo.values()];
}
