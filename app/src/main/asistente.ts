import { idiomaActual } from '../shared/i18n';
import type { MensajeAsistente, RespuestaAsistente } from '../shared/tiposApp';
import { registrar } from './log';

const MAX_MENSAJES = 12;
const MAX_CARACTERES = 1000;
const MAX_CARACTERES_ASISTENTE = 8000;
/** El modelo puede tardar unos segundos; más allá de esto se da por caído. */
const TIEMPO_MAXIMO_MS = 60_000;

/** Mismas reglas que el servidor: 1-12 mensajes alternos, empezando y terminando por el usuario; preguntas de hasta 1000 caracteres y respuestas de hasta 8000. */
export function validarMensajes(entrada: unknown): MensajeAsistente[] | null {
  if (!Array.isArray(entrada) || entrada.length === 0 || entrada.length > MAX_MENSAJES) return null;
  const salida: MensajeAsistente[] = [];
  for (const [i, m] of entrada.entries()) {
    const { rol, texto } = (m ?? {}) as { rol?: unknown; texto?: unknown };
    const esperado: MensajeAsistente['rol'] = i % 2 === 0 ? 'usuario' : 'asistente';
    const max = esperado === 'usuario' ? MAX_CARACTERES : MAX_CARACTERES_ASISTENTE;
    if (rol !== esperado || typeof texto !== 'string' || !texto.trim() || texto.length > max) return null;
    salida.push({ rol: esperado, texto });
  }
  return salida.at(-1)!.rol === 'usuario' ? salida : null;
}

/**
 * Pregunta al asistente del servidor (POST /api/asistente) y traduce los errores a códigos para el renderer.
 * Manda el idioma de la app (Fase 3): el servidor pide al modelo que responda en él.
 */
export async function preguntarAsistente(
  entrada: unknown,
  o: { urlServidor: string; fetch?: typeof fetch; idioma?: string },
): Promise<RespuestaAsistente> {
  const mensajes = validarMensajes(entrada);
  if (!mensajes) return { ok: false, error: 'no_valido' };
  let r: Response;
  try {
    r = await (o.fetch ?? fetch)(`${o.urlServidor.replace(/\/+$/, '')}/api/asistente`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mensajes, idioma: o.idioma ?? idiomaActual() }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch (e) {
    registrar('aviso', `Asistente sin conexión: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'sin_conexion' };
  }
  if (r.ok) {
    try {
      const cuerpo = (await r.json()) as { respuesta?: unknown };
      if (typeof cuerpo.respuesta === 'string' && cuerpo.respuesta.trim()) return { ok: true, respuesta: cuerpo.respuesta };
    } catch {
      // respuesta ilegible: se trata como no disponible
    }
    return { ok: false, error: 'no_disponible' };
  }
  if (r.status === 503) return { ok: false, error: 'no_configurado' };
  if (r.status === 429) return { ok: false, error: 'limite' };
  if (r.status === 400) return { ok: false, error: 'no_valido' };
  return { ok: false, error: 'no_disponible' };
}

/** IPC 'coach:asistente': solo para la ventana principal; valida en main y usa la URL del servidor. */
export function registrarIpcAsistente(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: { urlServidor: () => string; fetch?: typeof fetch; esPrincipal: (sender: unknown) => boolean },
): void {
  ipc.handle('coach:asistente', (e, mensajes) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    return preguntarAsistente(mensajes, { urlServidor: o.urlServidor(), fetch: o.fetch });
  });
}
