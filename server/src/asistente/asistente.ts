import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import { SISTEMA } from './conocimiento';

export const MODELO_POR_DEFECTO = 'claude-opus-5-5';
export const MAX_MENSAJES = 12;
export const MAX_CARACTERES = 1000;
const LIMITE_POR_HORA = 20;
const VENTANA_MS = 3600 * 1000;

/** Respuesta fija cuando el modelo rechaza la petición (stop_reason «refusal»). */
export const MENSAJE_RECHAZO =
  'No puedo ayudarte con eso. Si tienes un problema con Coach LoL IA, escríbenos a suport@coachlolia.com y te ayudamos.';

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Mensaje = Anthropic.Beta.Messages.BetaMessage;
/** Llamada a la API de mensajes (sustituible en las pruebas). */
export type CrearMensaje = (params: Params) => Promise<Mensaje>;

export interface OpcionesAsistente {
  crear: CrearMensaje;
  modelo: string;
  /** Reloj inyectable para el límite por IP. */
  ahora?: () => number;
}

/** Cliente real: el SDK oficial lee ANTHROPIC_API_KEY del entorno. */
export function crearClienteAsistente(): CrearMensaje {
  const cliente = new Anthropic();
  return (params) => cliente.beta.messages.create(params);
}

interface MensajeChat {
  rol: 'usuario' | 'asistente';
  texto: string;
}

/** Valida el historial: 1-12 mensajes de 1-1000 caracteres, alternos, empezando y terminando por el usuario. */
export function validarMensajes(cuerpo: unknown): MensajeChat[] | null {
  const mensajes = (cuerpo as { mensajes?: unknown } | null)?.mensajes;
  if (!Array.isArray(mensajes) || mensajes.length === 0 || mensajes.length > MAX_MENSAJES) return null;
  const validos: MensajeChat[] = [];
  for (const [i, m] of mensajes.entries()) {
    const { rol, texto } = (m ?? {}) as { rol?: unknown; texto?: unknown };
    const esperado: MensajeChat['rol'] = i % 2 === 0 ? 'usuario' : 'asistente';
    if (rol !== esperado || typeof texto !== 'string') return null;
    if (texto.trim().length === 0 || texto.length > MAX_CARACTERES) return null;
    validos.push({ rol: esperado, texto });
  }
  return validos.at(-1)!.rol === 'usuario' ? validos : null;
}

/** Pide la respuesta al modelo. En un rechazo devuelve el mensaje fijo; si no, une los bloques de texto. */
export async function responder(crear: CrearMensaje, modelo: string, mensajes: MensajeChat[]): Promise<string> {
  const respuesta = await crear({
    model: modelo,
    max_tokens: 1500,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
    messages: mensajes.map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto })),
  });
  if (respuesta.stop_reason === 'refusal') return MENSAJE_RECHAZO;
  const texto = respuesta.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n');
  return texto || MENSAJE_RECHAZO;
}

/** Registra POST /api/asistente con su CORS (origen de URL_WEB) y su propio límite de 20 peticiones por hora e IP. */
export function registrarAsistente(app: FastifyInstance, opciones: OpcionesAsistente | null, urlWeb: string): void {
  let origen = '';
  try {
    origen = new URL(urlWeb).origin;
  } catch {
    origen = '';
  }
  const ahora = opciones?.ahora ?? Date.now;
  const peticiones = new Map<string, number[]>();

  app.register(async (asistente) => {
    asistente.addHook('onRequest', async (req, reply) => {
      if (origen) {
        reply.header('Access-Control-Allow-Origin', origen);
        reply.header('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        return reply
          .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
          .header('Access-Control-Allow-Headers', 'content-type')
          .header('Access-Control-Max-Age', '600')
          .code(204)
          .send();
      }
      if (!opciones) return reply.code(503).send({ error: 'asistente_no_configurado' });
      const t = ahora();
      const recientes = (peticiones.get(req.ip) ?? []).filter((x) => t - x < VENTANA_MS);
      recientes.push(t);
      peticiones.set(req.ip, recientes);
      if (peticiones.size > 10_000) {
        for (const [ip, ts] of peticiones) if (ts.every((x) => t - x >= VENTANA_MS)) peticiones.delete(ip);
      }
      if (recientes.length > LIMITE_POR_HORA) return reply.code(429).send({ error: 'limite_asistente' });
    });

    // Un JSON mal formado o un cuerpo vacío también es un 400 de validación.
    asistente.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, cuerpo, hecho) => {
      try {
        hecho(null, String(cuerpo).trim() ? JSON.parse(String(cuerpo)) : null);
      } catch {
        hecho(null, null);
      }
    });

    asistente.options('/api/asistente', async () => undefined);

    asistente.post('/api/asistente', async (req, reply) => {
      const mensajes = validarMensajes(req.body);
      if (!mensajes) return reply.code(400).send({ error: 'mensajes_no_validos' });
      try {
        return { respuesta: await responder(opciones!.crear, opciones!.modelo, mensajes) };
      } catch (e) {
        // Del más concreto al más general; al cliente nunca le llega el detalle.
        if (e instanceof Anthropic.RateLimitError) console.error('[asistente] Límite de la API de Anthropic');
        else if (e instanceof Anthropic.APIConnectionError) console.error('[asistente] Sin conexión con la API de Anthropic');
        else if (e instanceof Anthropic.APIError) console.error(`[asistente] Error de la API de Anthropic (${e.status ?? '?'})`);
        else console.error('[asistente] Error inesperado:', e instanceof Error ? e.message : String(e));
        return reply.code(502).send({ error: 'asistente_no_disponible' });
      }
    });
  });
}
