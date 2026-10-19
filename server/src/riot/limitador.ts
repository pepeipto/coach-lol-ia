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

export interface Limitador {
  /** Resuelve cuando la petición puede salir. Sin prioridad, es de fondo. */
  esperarTurno(prioridad?: PrioridadRiot): Promise<void>;
}

/**
 * Límites de una clave de desarrollo de Riot (por host). El 10 % de cada regla queda para las
 * consultas interactivas: hasta 20 por partida en la pantalla de carga, casi siempre en caché.
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
export function crearLimitador(reglas: ReglaLimite[] = REGLAS_POR_DEFECTO): Limitador {
  const marcas: number[][] = reglas.map(() => []);
  // Al menos un hueco para el fondo en cada regla.
  const reservas = reglas.map((r) => Math.max(0, Math.min(r.peticiones - 1, r.reservaInteractiva ?? 0)));
  const colas: Record<PrioridadRiot, (() => void)[]> = { interactiva: [], fondo: [] };
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  function msHastaHueco(ahora: number, prioridad: PrioridadRiot): number {
    let espera = 0;
    reglas.forEach((regla, i) => {
      const m = marcas[i];
      while (m.length > 0 && ahora - m[0] >= regla.ventanaMs) m.shift();
      const maximo = regla.peticiones - (prioridad === 'fondo' ? reservas[i] : 0);
      if (m.length >= maximo) {
        espera = Math.max(espera, regla.ventanaMs - (ahora - m[m.length - maximo]));
      }
    });
    return espera;
  }

  /** Da paso a todo lo que quepa ahora, por prioridad; si no cabe, programa el siguiente intento. */
  function despachar(): void {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    for (;;) {
      const prioridad: PrioridadRiot | null =
        colas.interactiva.length > 0 ? 'interactiva' : colas.fondo.length > 0 ? 'fondo' : null;
      if (!prioridad) return;
      const ahora = Date.now();
      const espera = msHastaHueco(ahora, prioridad);
      if (espera > 0) {
        temporizador = setTimeout(despachar, espera);
        return;
      }
      marcas.forEach((m) => m.push(ahora));
      colas[prioridad].shift()!();
    }
  }

  return {
    esperarTurno(prioridad: PrioridadRiot = 'fondo') {
      return new Promise<void>((resolver) => {
        colas[prioridad].push(resolver);
        despachar();
      });
    },
  };
}
