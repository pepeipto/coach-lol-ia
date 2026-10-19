export interface ReglaLimite {
  peticiones: number;
  ventanaMs: number;
  /**
   * Huecos de la ventana que solo pueden usar las peticiones interactivas (por defecto, ninguno):
   * así el recolector nunca deja sin sitio a la pantalla de carga, aunque sature la regla.
   */
  reservaInteractiva?: number;
}

/**
 * 'interactiva': alguien espera la respuesta (la pantalla de carga de la app).
 * 'fondo': el recolector de partidas, que puede esperar.
 */
export type PrioridadRiot = 'interactiva' | 'fondo';

export interface OpcionesTurno {
  /** Instante (ms epoch) a partir del cual ya nadie espera la respuesta: la petición sale de la cola sin enviarse. */
  plazo?: number;
  /** Cancelación externa: al abortar, la petición sale de la cola sin enviarse. */
  signal?: AbortSignal;
}

/** La petición salió de la cola sin turno (plazo vencido o cancelada). */
export class TurnoCancelado extends Error {
  constructor(motivo: 'plazo' | 'cancelada') {
    super(`turno cancelado: ${motivo}`);
    this.name = 'TurnoCancelado';
  }
}

export interface Limitador {
  /**
   * Resuelve cuando la petición puede salir. Sin prioridad, es de fondo. Con `plazo` o `signal`, rechaza con
   * TurnoCancelado (y deja su sitio) si vence el plazo o se cancela antes de tener turno.
   */
  esperarTurno(prioridad?: PrioridadRiot, opciones?: OpcionesTurno): Promise<void>;
  /** Para todo el host durante `ms` (un 429 de límite de aplicación o de método con Retry-After). */
  pausar(ms: number): void;
}

/**
 * Tope global de las peticiones interactivas (la ruta pública de la pantalla de carga) en cada regla de cada host:
 * por defecto el 60 % y nunca más del 70 %. Así, aunque alguien abuse de la ruta, siempre queda al menos un 30 %
 * para el recolector y nunca se agota la clave de Riot desde fuera.
 */
export const FRACCION_INTERACTIVA_POR_DEFECTO = 0.6;
export const FRACCION_INTERACTIVA_MAXIMA = 0.7;

export interface OpcionesLimitador {
  /** Fracción de cada regla que pueden usar las interactivas (se acota a 0,05–0,7). */
  fraccionInteractiva?: number;
}

/** Con las dos colas llenas, el fondo tiene al menos 1 de cada 5 turnos (si su regla le deja hueco). */
export const TURNOS_SEGUIDOS_INTERACTIVA = 4;

/**
 * Límites de una clave de desarrollo de Riot (por host). El 10 % de cada regla queda para las
 * consultas interactivas: hasta 20 por partida en la pantalla de carga, casi siempre en caché.
 * Ellas, a su vez, no pasan del 60 % (FRACCION_INTERACTIVA_POR_DEFECTO): el resto es del recolector.
 */
const REGLAS_POR_DEFECTO: ReglaLimite[] = [
  { peticiones: 20, ventanaMs: 1000, reservaInteractiva: 2 },
  { peticiones: 100, ventanaMs: 120000, reservaInteractiva: 10 },
];

/**
 * Ventana deslizante por regla, con dos colas: las peticiones interactivas pasan siempre antes que
 * las de fondo (y, mientras haya una interactiva esperando, ninguna de fondo sale), y dentro de cada
 * cola se respeta el orden de llegada.
 */
export function crearLimitador(reglas: ReglaLimite[] = REGLAS_POR_DEFECTO, opciones: OpcionesLimitador = {}): Limitador {
  const marcas: number[][] = reglas.map(() => []);
  /** Solo las interactivas, para su tope global. */
  const marcasI: number[][] = reglas.map(() => []);
  const pedida = opciones.fraccionInteractiva ?? FRACCION_INTERACTIVA_POR_DEFECTO;
  const fraccion = Math.min(FRACCION_INTERACTIVA_MAXIMA, Math.max(0.05, Number.isFinite(pedida) ? pedida : FRACCION_INTERACTIVA_POR_DEFECTO));
  // Al menos 1 (si no, una regla pequeña bloquearía la pantalla de carga para siempre).
  const topesI = reglas.map((r) => Math.max(1, Math.floor(r.peticiones * fraccion)));
  // Al menos un hueco para el fondo en cada regla.
  const reservas = reglas.map((r) => Math.max(0, Math.min(r.peticiones - 1, r.reservaInteractiva ?? 0)));
  interface Espera {
    resolver: () => void;
    rechazar: (e: Error) => void;
    limpiar: () => void;
  }
  const colas: Record<PrioridadRiot, Espera[]> = { interactiva: [], fondo: [] };
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let pausadoHasta = 0;
  /** Turnos interactivos seguidos mientras el fondo esperaba. */
  let racha = 0;

  function msHastaHueco(ahora: number, prioridad: PrioridadRiot): number {
    let espera = Math.max(0, pausadoHasta - ahora);
    reglas.forEach((regla, i) => {
      const m = marcas[i];
      while (m.length > 0 && ahora - m[0] >= regla.ventanaMs) m.shift();
      const maximo = regla.peticiones - (prioridad === 'fondo' ? reservas[i] : 0);
      if (m.length >= maximo) {
        espera = Math.max(espera, regla.ventanaMs - (ahora - m[m.length - maximo]));
      }
      if (prioridad === 'interactiva') {
        const mi = marcasI[i];
        while (mi.length > 0 && ahora - mi[0] >= regla.ventanaMs) mi.shift();
        const tope = topesI[i];
        if (mi.length >= tope) espera = Math.max(espera, regla.ventanaMs - (ahora - mi[mi.length - tope]));
      }
    });
    return espera;
  }

  /** Qué cola sale ahora: la interactiva primero, salvo que le toque al fondo su turno de cada 5 y le quepa. */
  function elegir(ahora: number): { prioridad: PrioridadRiot; espera: number } | null {
    const hayI = colas.interactiva.length > 0;
    const hayF = colas.fondo.length > 0;
    if (!hayI && !hayF) return null;
    if (!hayI) return { prioridad: 'fondo', espera: msHastaHueco(ahora, 'fondo') };
    const esperaI = msHastaHueco(ahora, 'interactiva');
    if (hayF && (racha >= TURNOS_SEGUIDOS_INTERACTIVA || esperaI > 0)) {
      const esperaF = msHastaHueco(ahora, 'fondo');
      // Si la reserva no deja hueco al fondo, el turno no se pierde: lo usa la interactiva. Y si la interactiva
      // espera por su tope global pero al fondo le cabe ya, sale el fondo (ese hueco es suyo).
      if (racha >= TURNOS_SEGUIDOS_INTERACTIVA ? esperaF <= esperaI : esperaF === 0) return { prioridad: 'fondo', espera: esperaF };
    }
    return { prioridad: 'interactiva', espera: esperaI };
  }

  /** Da paso a todo lo que quepa ahora, por prioridad; si no cabe, programa el siguiente intento. */
  function despachar(): void {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    for (;;) {
      const ahora = Date.now();
      const turno = elegir(ahora);
      if (!turno) return;
      if (turno.espera > 0) {
        temporizador = setTimeout(despachar, turno.espera);
        return;
      }
      marcas.forEach((m) => m.push(ahora));
      if (turno.prioridad === 'interactiva') marcasI.forEach((m) => m.push(ahora));
      if (turno.prioridad === 'interactiva') racha = colas.fondo.length > 0 ? racha + 1 : 0;
      else racha = 0;
      const e = colas[turno.prioridad].shift()!;
      e.limpiar();
      e.resolver();
    }
  }

  return {
    esperarTurno(prioridad: PrioridadRiot = 'fondo', opciones: OpcionesTurno = {}) {
      return new Promise<void>((resolver, rechazar) => {
        const { plazo, signal } = opciones;
        if (signal?.aborted) return rechazar(new TurnoCancelado('cancelada'));
        if (plazo !== undefined && plazo <= Date.now()) return rechazar(new TurnoCancelado('plazo'));
        let vence: ReturnType<typeof setTimeout> | null = null;
        const quitar = (motivo: 'plazo' | 'cancelada') => {
          const cola = colas[prioridad];
          const i = cola.indexOf(espera);
          if (i < 0) return;
          cola.splice(i, 1);
          espera.limpiar();
          rechazar(new TurnoCancelado(motivo));
          despachar();
        };
        const alAbortar = () => quitar('cancelada');
        const espera: Espera = {
          resolver,
          rechazar,
          limpiar: () => {
            if (vence) clearTimeout(vence);
            signal?.removeEventListener('abort', alAbortar);
          },
        };
        if (plazo !== undefined) vence = setTimeout(() => quitar('plazo'), plazo - Date.now());
        signal?.addEventListener('abort', alAbortar);
        colas[prioridad].push(espera);
        despachar();
      });
    },
    pausar(ms: number) {
      if (!(ms > 0)) return;
      pausadoHasta = Math.max(pausadoHasta, Date.now() + ms);
      despachar();
    },
  };
}
