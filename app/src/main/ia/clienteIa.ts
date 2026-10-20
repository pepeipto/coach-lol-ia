import type { AnalisisPartida, PeticionAnalisis, PeticionConsejo } from '@coach/shared';
import type { ErrorAnalisis } from '../../shared/tiposApp';

/*
 * Llamadas al coach con IA del servidor (3.2). Los errores se traducen a códigos para la vista y el registro.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: ErrorAnalisis };

const TIEMPO_ANALISIS_MS = 100_000;
/** Un consejo que tarda más ya no llega a tiempo (el jugador reaparece o sale de la tienda). */
const TIEMPO_CONSEJO_MS = 8_000;

async function enviar<T>(url: string, cuerpo: unknown, tiempoMs: number, f: typeof fetch, leer: (j: unknown) => T | null): Promise<Resultado<T>> {
  let r: Response;
  try {
    r = await f(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(tiempoMs),
    });
  } catch {
    return { ok: false, error: 'sin_conexion' };
  }
  if (r.ok) {
    try {
      const datos = leer(await r.json());
      if (datos) return { ok: true, datos };
    } catch {
      // respuesta ilegible: no disponible
    }
    return { ok: false, error: 'no_disponible' };
  }
  if (r.status === 503) return { ok: false, error: 'no_configurado' };
  if (r.status === 429) return { ok: false, error: 'limite' };
  if (r.status === 400 || r.status === 413) return { ok: false, error: 'no_valido' };
  return { ok: false, error: 'no_disponible' };
}

const base = (url: string) => url.replace(/\/+$/, '');

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Comprueba la forma del análisis que llega del servidor. */
export function esAnalisis(v: unknown): v is AnalisisPartida {
  const a = v as AnalisisPartida | null;
  const puntos = (x: unknown) => Array.isArray(x) && x.length > 0 && x.every((p) => esTexto(p?.titulo) && esTexto(p?.porque));
  return (
    !!a &&
    esTexto(a.veredicto) &&
    esTexto(a.enfoque) &&
    puntos(a.bien) &&
    puntos(a.mejorar) &&
    Array.isArray(a.momentos) &&
    a.momentos.every((m) => typeof m?.t === 'number' && esTexto(m?.texto))
  );
}

export function pedirAnalisis(p: PeticionAnalisis, o: { urlServidor: string; fetch?: typeof fetch }): Promise<Resultado<AnalisisPartida>> {
  return enviar(`${base(o.urlServidor)}/api/coach/analisis`, p, TIEMPO_ANALISIS_MS, o.fetch ?? fetch, (j) => {
    const a = (j as { analisis?: unknown } | null)?.analisis;
    return esAnalisis(a) ? a : null;
  });
}

export function pedirConsejo(p: PeticionConsejo, o: { urlServidor: string; fetch?: typeof fetch }): Promise<Resultado<string>> {
  return enviar(`${base(o.urlServidor)}/api/coach/consejo`, p, TIEMPO_CONSEJO_MS, o.fetch ?? fetch, (j) => {
    const c = (j as { consejo?: unknown } | null)?.consejo;
    return esTexto(c) && c.length <= 200 ? c.replace(/\s+/g, ' ').trim() : null;
  });
}
