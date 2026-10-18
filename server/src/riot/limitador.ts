export interface ReglaLimite {
  peticiones: number;
  ventanaMs: number;
}

export interface Limitador {
  esperarTurno(): Promise<void>;
}

const REGLAS_POR_DEFECTO: ReglaLimite[] = [
  { peticiones: 20, ventanaMs: 1000 },
  { peticiones: 100, ventanaMs: 120000 },
];

/** Ventana deslizante por regla: espera hasta que todas las reglas tengan hueco. */
export function crearLimitador(reglas: ReglaLimite[] = REGLAS_POR_DEFECTO): Limitador {
  const marcas: number[][] = reglas.map(() => []);

  function msHastaHueco(ahora: number): number {
    let espera = 0;
    reglas.forEach((regla, i) => {
      const m = marcas[i];
      while (m.length > 0 && ahora - m[0] >= regla.ventanaMs) m.shift();
      if (m.length >= regla.peticiones) {
        espera = Math.max(espera, regla.ventanaMs - (ahora - m[m.length - regla.peticiones]));
      }
    });
    return espera;
  }

  return {
    async esperarTurno() {
      for (;;) {
        const espera = msHastaHueco(Date.now());
        if (espera <= 0) break;
        await new Promise<void>((r) => setTimeout(r, espera));
      }
      const ahora = Date.now();
      marcas.forEach((m) => m.push(ahora));
    },
  };
}
