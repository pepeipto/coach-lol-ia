import type { MuestraMinuto, ObjetivoTomadoIa, ResultadoPartidaIa, TipoObjetivoIa } from '@coach/shared';
import type { EstadoPartida, EventoPartida } from '../../shared/tiposApp';

/*
 * Registro de la partida para el análisis con IA (3.2). Con cada estado de la Live Client Data API (uno por segundo)
 * guarda lo justo: una muestra por minuto (CS, nivel, KDA y oro aproximado), las muertes con su minuto, las compras y
 * los objetivos de los eventos oficiales. Vive solo en memoria y se tira al empezar la siguiente partida.
 */

/** Abalorios (se cambian, no se compran): no cuentan como compras. */
const ABALORIOS = new Set([3340, 3363, 3364, 3330, 3513]);

/** Eventos de objetivos y su tipo para el análisis. */
const TIPO_EVENTO: Record<string, TipoObjetivoIa> = {
  DragonKill: 'dragon',
  HeraldKill: 'heraldo',
  BaronKill: 'baron',
  HordeKill: 'larvas',
  AtakhanKill: 'atakhan',
  TurretKilled: 'torre',
  InhibKilled: 'inhibidor',
};

export const MAX_MUESTRAS = 90;
export const MAX_COMPRAS = 80;
export const MAX_OBJETIVOS = 80;

/** Precio de un objeto (Data Dragon); 0 si no se sabe. */
export type PrecioObjeto = (id: number) => number;

/** Equipo dueño de una estructura por su nombre («Turret_T1_L_03_A», «Barracks_T2_R1»): T1 = ORDER, T2 = CHAOS. */
export function duenoEstructura(nombre: string | undefined): 'ORDER' | 'CHAOS' | null {
  if (!nombre) return null;
  if (/_T1(_|$)/.test(nombre)) return 'ORDER';
  if (/_T2(_|$)/.test(nombre)) return 'CHAOS';
  return null;
}

/** Objetivo tomado de un evento, relativo al equipo del jugador; null si no es un objetivo o no se sabe quién. */
export function objetivoDeEvento(e: EventoPartida, miEquipo: 'ORDER' | 'CHAOS' | undefined): ObjetivoTomadoIa | null {
  const tipoBase = TIPO_EVENTO[e.nombre];
  if (!tipoBase || !miEquipo) return null;
  let equipo: 'ORDER' | 'CHAOS' | null = e.equipo ?? null;
  if (tipoBase === 'torre' || tipoBase === 'inhibidor') {
    const dueno = duenoEstructura(e.estructura);
    equipo = dueno ? (dueno === 'ORDER' ? 'CHAOS' : 'ORDER') : null;
  }
  if (!equipo) return null;
  const tipo: TipoObjetivoIa = tipoBase === 'dragon' && e.dragon === 'Elder' ? 'anciano' : tipoBase;
  const o: ObjetivoTomadoIa = { t: Math.round(e.tiempo), tipo, equipo: equipo === miEquipo ? 'aliado' : 'enemigo' };
  if (tipo === 'dragon' && e.dragon && /^[A-Za-z]{1,20}$/.test(e.dragon)) o.subtipo = e.dragon;
  return o;
}

export class RegistroPartida {
  readonly linea: MuestraMinuto[] = [];
  readonly muertes: number[] = [];
  readonly compras: { t: number; id: number }[] = [];
  readonly objetivos: ObjetivoTomadoIa[] = [];
  /** Último estado recibido (las estadísticas finales si la LCU no da las suyas). */
  ultimo: EstadoPartida | null = null;
  private vistos = new Set<string>();
  private objetosPrevios: number[] | null = null;
  private muertoPrevio = false;
  private muertesPrevias = 0;

  constructor(private readonly precio: PrecioObjeto = () => 0) {}

  /** Hay datos suficientes para un análisis (al menos unos minutos de partida). */
  get conDatos(): boolean {
    return !!this.ultimo && this.ultimo.tiempo >= 60;
  }

  procesar(estado: EstadoPartida): void {
    // Un estado más antiguo que el último (reconexión rara) no rehace nada.
    if (this.ultimo && estado.tiempo + 5 < this.ultimo.tiempo) return;
    this.ultimo = estado;
    this.muestras(estado);
    this.detectarMuerte(estado);
    this.detectarCompras(estado);
    for (const e of estado.eventos) {
      // Sin el EventID: lo que identifica un objetivo es su nombre, su segundo y su estructura o dragón.
      const clave = `${e.nombre}:${Math.round(e.tiempo)}:${e.estructura ?? e.dragon ?? ''}`;
      if (this.vistos.has(clave)) continue;
      this.vistos.add(clave);
      const o = objetivoDeEvento(e, estado.equipo);
      if (o && this.objetivos.length < MAX_OBJETIVOS) this.objetivos.push(o);
    }
  }

  /** Resultado por el evento GameEnd del último estado; null si no llegó. */
  get resultado(): ResultadoPartidaIa | null {
    const fin = this.ultimo?.eventos.find((e) => e.nombre === 'GameEnd' && e.resultado);
    return fin ? (fin.resultado === 'Win' ? 'victoria' : 'derrota') : null;
  }

  /** Oro aproximado: el que lleva más lo que valen sus objetos. */
  oroAproximado(estado: EstadoPartida): number {
    return Math.round(estado.oro + estado.objetos.reduce((s, id) => s + this.precio(id), 0));
  }

  private muestras(estado: EstadoPartida): void {
    const minuto = Math.floor(estado.tiempo / 60);
    const ultimo = this.linea.at(-1)?.m ?? 0;
    if (minuto < 1 || minuto <= ultimo || this.linea.length >= MAX_MUESTRAS) return;
    const kda = estado.kda ?? { k: 0, d: 0, a: 0 };
    this.linea.push({
      m: minuto,
      cs: estado.cs ?? 0,
      nivel: Math.max(1, estado.nivel),
      k: kda.k,
      d: kda.d,
      a: kda.a,
      oro: this.oroAproximado(estado),
    });
  }

  private detectarMuerte(estado: EstadoPartida): void {
    const muertes = estado.kda?.d;
    if (typeof estado.muerto === 'boolean') {
      if (estado.muerto && !this.muertoPrevio) this.muertes.push(Math.round(this.momentoMuerte(estado)));
      this.muertoPrevio = estado.muerto;
    } else if (typeof muertes === 'number' && muertes > this.muertesPrevias) {
      // Sin isDead: por el marcador.
      for (let i = this.muertesPrevias; i < muertes; i++) this.muertes.push(Math.round(estado.tiempo));
    }
    if (typeof muertes === 'number') this.muertesPrevias = muertes;
    if (this.muertes.length > 60) this.muertes.splice(0, this.muertes.length - 60);
  }

  /** Segundo de la muerte: el del ChampionKill del jugador si es de hace poco; si no, el del estado. */
  private momentoMuerte(estado: EstadoPartida): number {
    const campeon = estado.campeon.toLowerCase();
    const kill = estado.eventos
      .filter((e) => e.nombre === 'ChampionKill' && e.victima?.toLowerCase() === campeon && e.tiempo <= estado.tiempo && estado.tiempo - e.tiempo <= 15)
      .at(-1);
    return kill ? kill.tiempo : estado.tiempo;
  }

  private detectarCompras(estado: EstadoPartida): void {
    const actuales = estado.objetos.filter((id) => id > 0 && !ABALORIOS.has(id));
    // Desde el principio de la partida, los objetos iniciales cuentan como compras; al entrar tarde, no.
    if (!this.objetosPrevios && estado.tiempo < 90) this.objetosPrevios = [];
    if (this.objetosPrevios) {
      const restantes = [...this.objetosPrevios];
      for (const id of actuales) {
        const i = restantes.indexOf(id);
        if (i >= 0) restantes.splice(i, 1);
        else if (this.compras.length < MAX_COMPRAS) this.compras.push({ t: Math.round(estado.tiempo), id });
      }
    }
    this.objetosPrevios = actuales;
  }
}
