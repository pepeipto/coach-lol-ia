import type { Indicacion, TipoAviso } from '../../shared/tiposApp';

const PRIORIDAD: TipoAviso[] = ['objetivo', 'compra', 'habilidad', 'vision', 'fase'];

/** Deja pasar como mucho una indicación cada `intervaloMs`, sin repetir las que siguen presentes. */
export class FiltroAvisos {
  private emitidas = new Set<string>();
  private ultimaEmision = -Infinity;

  constructor(private readonly intervaloMs = 10_000) {}

  procesar(indicaciones: Indicacion[], ahoraMs: number, activos: Record<TipoAviso, boolean>): Indicacion | null {
    // Una clave que ya no está en la lista se olvida: si reaparece, puede emitirse otra vez.
    const presentes = new Set(indicaciones.map((i) => i.clave));
    for (const clave of this.emitidas) if (!presentes.has(clave)) this.emitidas.delete(clave);

    if (ahoraMs - this.ultimaEmision < this.intervaloMs) return null;

    const candidatas = indicaciones
      .filter((i) => activos[i.tipo] && !this.emitidas.has(i.clave))
      .sort((a, b) => PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo)); // sort estable: respeta el orden dado
    const elegida = candidatas[0];
    if (!elegida) return null;
    this.emitidas.add(elegida.clave);
    this.ultimaEmision = ahoraMs;
    return elegida;
  }

  reiniciar(): void {
    this.emitidas.clear();
    this.ultimaEmision = -Infinity;
  }
}
