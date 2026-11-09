import { createHash } from 'node:crypto';
import type { Ajustes, EstadoPartida } from '../../shared/tiposApp';

/*
 * Partidas con voz (8 nov 2026): la app avisa al servidor una vez por partida con la voz encendida, para que las
 * cuente por dispositivo (o licencia) y por IP. Hoy el servidor siempre responde «permitida» (límite apagado); si
 * algún día se enciende (VOZ_PARTIDAS_GRATIS), la app calla la voz en esa partida. Sin conexión, la voz sigue.
 * Solo se manda un id anónimo de la partida, nunca nombres ni Riot ID. Hecho con ayuda de IA.
 */

const TIEMPO_MS = 8_000;

/**
 * Id anónimo y estable de la partida: modo, campeones de cada equipo y día de inicio, en hash. Sale igual aunque la
 * app se reinicie a mitad de partida, así que el servidor no la cuenta dos veces.
 */
export function idPartidaVoz(estado: EstadoPartida, ahora: number): string {
  const campeones = (estado.jugadores ?? []).map((j) => `${j.equipo}:${j.campeon}`).sort();
  const inicio = new Date(ahora - Math.max(0, estado.tiempo) * 1000).toISOString().slice(0, 10);
  return createHash('sha256').update(`voz|${estado.modo ?? ''}|${estado.campeon}|${campeones.join(',')}|${inicio}`).digest('hex').slice(0, 32);
}

export interface DepVozPartidas {
  urlServidor: () => string;
  /** Licencia y dispositivo (las mismas cabeceras que la cuota del coach con IA). */
  cabeceras: () => Promise<Record<string, string>>;
  fetch?: typeof fetch;
  ahora?: () => number;
  registrar?: (texto: string) => void;
}

export function crearContadorVoz(dep: DepVozPartidas) {
  const ahora = dep.ahora ?? Date.now;
  let avisada = false;
  let bloqueada = false;

  async function avisar(id: string): Promise<void> {
    try {
      const r = await (dep.fetch ?? fetch)(`${dep.urlServidor().replace(/\/+$/, '')}/api/premium/voz`, {
        method: 'POST',
        headers: { ...(await dep.cabeceras()), 'content-type': 'application/json' },
        body: JSON.stringify({ partida: id }),
        signal: AbortSignal.timeout(TIEMPO_MS),
      });
      if (!r.ok) return;
      const j = (await r.json()) as { permitida?: unknown; usadas?: unknown; limite?: unknown };
      if (j.permitida === false) {
        bloqueada = true;
        dep.registrar?.(`Voz: sin partidas de prueba (${String(j.usadas)}/${String(j.limite)}); esta partida va sin voz.`);
      }
    } catch {
      // Sin conexión o servidor antiguo: la voz sigue.
    }
  }

  return {
    /** Cada estado de la partida: la primera vez con la voz encendida, avisa al servidor. */
    alEstado(estado: EstadoPartida, vozActiva: boolean): void {
      if (avisada || !vozActiva || !estado.jugadores?.length) return;
      avisada = true;
      void avisar(idPartidaVoz(estado, ahora()));
    },
    /** Al terminar la partida, la siguiente se vuelve a avisar. */
    finPartida(): void {
      avisada = false;
      bloqueada = false;
    },
    /** La voz está cortada en esta partida (solo si el servidor tiene el límite encendido y se agotó). */
    bloqueada: () => bloqueada,
    /** Ajustes con la voz apagada si está cortada en esta partida. */
    ajustar(a: Ajustes): Ajustes {
      return bloqueada ? { ...a, overlay: { ...a.overlay, voz: { ...a.overlay.voz, activa: false } } } : a;
    },
  };
}
