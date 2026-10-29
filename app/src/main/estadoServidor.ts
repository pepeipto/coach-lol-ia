/** Estado de la clave de Riot de nuestro servidor, tal como lo cuenta `GET /salud`. */
export type EstadoRiotServidor = 'ok' | 'caducada' | 'desconocida';

const TIEMPO_ESPERA_MS = 4000;

/**
 * Pregunta a `/salud` si el servidor puede hablar con Riot. Si no responde o la respuesta es rara, 'desconocida': la
 * app solo avisa cuando el servidor dice claramente que Riot rechaza su clave.
 */
export async function consultarRiotServidor(urlServidor: string, hacerFetch: typeof fetch = fetch): Promise<EstadoRiotServidor> {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(new Error('tiempo de espera agotado')), TIEMPO_ESPERA_MS);
  try {
    const r = await hacerFetch(`${urlServidor.replace(/\/+$/, '')}/salud`, { signal: control.signal });
    if (!r.ok) return 'desconocida';
    const riot = ((await r.json()) as { riot?: unknown } | null)?.riot;
    return riot === 'ok' || riot === 'caducada' ? riot : 'desconocida';
  } catch {
    return 'desconocida';
  } finally {
    clearTimeout(limite);
  }
}
