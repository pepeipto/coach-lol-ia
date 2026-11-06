// Resumen de TFT para la web: solo el parche y cuántas partidas hay detrás, leídos del servidor al compilar (la web
// es estática y se recompila a diario). Las composiciones y los objetos no se publican en la web: se ven en la
// pestaña TFT de la app. Si el servidor no responde, la página sale sin la línea de datos; nunca se inventan.
import { normalizarResultadoTft, RUTAS_TFT } from '../../../shared/src/tft';
import { API_URL } from './sitio';

const TIEMPO_ESPERA_MS = 15_000;

export interface ResumenTftWeb {
  parche: string;
  partidas: number;
}

let resumen: Promise<ResumenTftWeb | null> | null = null;

/** Parche y número de partidas analizadas de TFT (una vez por compilación), o null si no hay datos. */
export function resumenTft(): Promise<ResumenTftWeb | null> {
  resumen ??= (async () => {
    try {
      const r = await fetch(`${API_URL}${RUTAS_TFT.comps}`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
      if (!r.ok) throw new Error(`Respuesta ${r.status}`);
      const d = normalizarResultadoTft(await r.json());
      return d && d.comps.length > 0 ? { parche: d.parche, partidas: d.partidas } : null;
    } catch (e) {
      console.warn(`[tft] Sin resumen de TFT: ${(e as Error).message}`);
      return null;
    }
  })();
  return resumen;
}
