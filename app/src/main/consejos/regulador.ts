import { mismoCampeon } from '../../shared/campeones';
import type { EstadoPartida, FraseVoz, RitmoVoz, TipoVoz } from '../../shared/tiposApp';

/*
 * 3.1 · Regulador de la voz: con más de 400 frases, lo importante es que el coach nunca atosigue.
 *  - Urgentes (prioridad ≤ URGENTE_HASTA: objetivos a punto de salir, peleas, jungla enemigo) salen en el acto.
 *  - Las demás, como mucho una cada HUECO_MS (contando también las urgentes) y nunca durante una pelea tuya: esperan
 *    en una lista corta, la más urgente primero, hasta que haya hueco o caduquen.
 *  - Cada categoría tiene su enfriamiento (no dos frases de ánimo seguidas) y cada frase puede traer el suyo para su
 *    grupo (p. ej. una asistencia cada 30 s).
 *  - Una frase nueva de un grupo sustituye a la que esperaba del mismo grupo (la cuenta atrás más reciente gana).
 * La cola del overlay (renderer/overlay/voz.ts) sigue decidiendo el orden final y que no se pisen: aquí solo se decide
 * qué frases llegan y cuándo, con la misma interfaz de siempre (FraseVoz por overlay:voz).
 */

/** Frase con los datos que solo usa el regulador (no viajan al overlay). */
export interface FraseRegulada extends FraseVoz {
  /** Frases del mismo grupo se sustituyen mientras esperan y comparten `enfriamientoMs`. */
  grupo?: string;
  /** Como mucho una frase de este grupo cada tantos milisegundos. */
  enfriamientoMs?: number;
}

/** Hasta esta prioridad (incluida) la frase es urgente: no espera hueco ni enfriamiento de su categoría. */
export const URGENTE_HASTA = 1;
/** Fuera de las urgentes, como mucho una frase cada 5 s (entre 4 y 6 s, como pide el diseño). */
export const HUECO_MS = 5_000;
/** 3.7: hueco entre frases no urgentes según el ritmo elegido. */
export const HUECO_RITMO_MS: Record<RitmoVoz, number> = { tranquilo: 12_000, normal: HUECO_MS, activo: 3_000 };
/** Frases que pueden esperar a la vez; con más se descarta la menos urgente. */
export const MAX_EN_ESPERA = 6;
/** Segundos de partida tras una kill tuya (o tu muerte o asistencia) en los que se considera que estás en una pelea. */
export const PELEA_S = 10;

/** Enfriamiento de cada categoría (ms) para las frases no urgentes. */
export const ENFRIAMIENTO_TIPO_MS: Partial<Record<TipoVoz, number>> = {
  animo: 45_000,
  muerte: 10_000,
  economia: 30_000,
  vision: 45_000,
  fase: 30_000,
  modo: 60_000,
  cs: 30_000,
  nivel: 8_000,
  equipo: 8_000,
  // 3.9: como mucho un power spike del rival cada 20 s.
  spike: 20_000,
};

interface Espera {
  frase: FraseRegulada;
  llegada: number;
  orden: number;
}

/** Hay una pelea tuya en curso: una kill, muerte o asistencia tuya en los últimos PELEA_S segundos de partida. */
export function enPelea(estado: EstadoPartida): boolean {
  return estado.eventos.some(
    (e) =>
      e.nombre === 'ChampionKill' &&
      estado.tiempo - e.tiempo <= PELEA_S &&
      estado.tiempo >= e.tiempo &&
      (mismoCampeon(e.asesino, estado.campeon) ||
        mismoCampeon(e.victima, estado.campeon) ||
        !!e.asistentes?.some((a) => mismoCampeon(a, estado.campeon))),
  );
}

const soloFrase = ({ tipo, clave, texto, prioridad, caducaMs }: FraseRegulada): FraseVoz => ({ tipo, clave, texto, prioridad, caducaMs });

export class ReguladorVoz {
  private espera: Espera[] = [];
  private contador = 0;
  private ultimaEmision = -Infinity;
  private ultimaPorTipo = new Map<TipoVoz, number>();
  private ultimaPorGrupo = new Map<string, number>();

  private soloObjetivosEnPelea = false;

  constructor(private huecoMs = HUECO_MS) {}

  /** 3.7: ritmo elegido en los ajustes (huecos entre frases y si en una pelea se calla también lo urgente). */
  configurar(ritmo: RitmoVoz = 'normal'): void {
    this.huecoMs = HUECO_RITMO_MS[ritmo];
    this.soloObjetivosEnPelea = ritmo === 'tranquilo';
  }

  /**
   * Recibe las frases nuevas de este estado y devuelve las que deben decirse ya (en orden de prioridad). Se llama con
   * cada estado de la partida (una vez por segundo), aunque no haya frases nuevas, para soltar las que esperan.
   */
  procesar(nuevas: readonly FraseRegulada[], ahoraMs: number, pelea = false): FraseVoz[] {
    const salida: FraseRegulada[] = [];
    for (const f of [...nuevas].sort((a, b) => a.prioridad - b.prioridad)) {
      // En ritmo tranquilo, durante una pelea solo pasa lo más urgente (un objetivo que aparece ya).
      if (f.prioridad <= URGENTE_HASTA && !(pelea && this.soloObjetivosEnPelea && f.prioridad > 0)) {
        if (this.grupoEnfriando(f, ahoraMs)) continue;
        this.anotar(f, ahoraMs);
        salida.push(f);
        continue;
      }
      if (f.grupo) this.espera = this.espera.filter((p) => p.frase.grupo !== f.grupo);
      this.espera.push({ frase: f, llegada: ahoraMs, orden: this.contador++ });
    }
    this.espera = this.espera.filter((p) => ahoraMs - p.llegada <= p.frase.caducaMs);
    this.espera.sort((a, b) => a.frase.prioridad - b.frase.prioridad || a.orden - b.orden);
    if (this.espera.length > MAX_EN_ESPERA) this.espera.length = MAX_EN_ESPERA;

    if (!pelea && ahoraMs - this.ultimaEmision >= this.huecoMs) {
      const i = this.espera.findIndex((p) => !this.grupoEnfriando(p.frase, ahoraMs) && !this.tipoEnfriando(p.frase, ahoraMs));
      if (i !== -1) {
        const [elegida] = this.espera.splice(i, 1);
        this.anotar(elegida!.frase, ahoraMs);
        salida.push(elegida!.frase);
      }
    }
    return salida.map(soloFrase);
  }

  /** Frases esperando (para las pruebas y la depuración). */
  get enEspera(): readonly FraseVoz[] {
    return this.espera.map((p) => soloFrase(p.frase));
  }

  reiniciar(): void {
    this.espera = [];
    this.ultimaEmision = -Infinity;
    this.ultimaPorTipo.clear();
    this.ultimaPorGrupo.clear();
  }

  private grupoEnfriando(f: FraseRegulada, ahora: number): boolean {
    if (!f.grupo || !f.enfriamientoMs) return false;
    const ultima = this.ultimaPorGrupo.get(f.grupo);
    return ultima !== undefined && ahora - ultima < f.enfriamientoMs;
  }

  private tipoEnfriando(f: FraseRegulada, ahora: number): boolean {
    const enfriamiento = ENFRIAMIENTO_TIPO_MS[f.tipo];
    const ultima = this.ultimaPorTipo.get(f.tipo);
    return !!enfriamiento && ultima !== undefined && ahora - ultima < enfriamiento;
  }

  private anotar(f: FraseRegulada, ahora: number): void {
    this.ultimaEmision = ahora;
    this.ultimaPorTipo.set(f.tipo, ahora);
    if (f.grupo) this.ultimaPorGrupo.set(f.grupo, ahora);
  }
}
