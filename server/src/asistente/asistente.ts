import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import { SISTEMA } from './conocimiento';
import { claveIp } from '../ip';
import type { Db } from '../db';

export const MODELO_POR_DEFECTO = 'claude-opus-5-5';
export const MAX_MENSAJES = 12;
/** Límite de las preguntas del usuario; las respuestas del asistente que se reenvían pueden ser más largas. */
export const MAX_CARACTERES = 1000;
export const MAX_CARACTERES_ASISTENTE = 8000;
const LIMITE_POR_HORA = 20;
const VENTANA_MS = 3600 * 1000;

/** Idiomas de la app (Fase 3); la web no manda ninguno y usa el español. */
export const IDIOMAS_ASISTENTE = ['es', 'en', 'pt-BR', 'fr', 'de'] as const;
export type IdiomaAsistente = (typeof IDIOMAS_ASISTENTE)[number];

/** Idioma pedido en el cuerpo (`idioma`); cualquier otro valor, o ninguno, es español. */
export function leerIdioma(cuerpo: unknown): IdiomaAsistente {
  const idioma = (cuerpo as { idioma?: unknown } | null)?.idioma;
  return typeof idioma === 'string' && (IDIOMAS_ASISTENTE as readonly string[]).includes(idioma) ? (idioma as IdiomaAsistente) : 'es';
}

/**
 * Instrucción de idioma que va detrás de la base de conocimiento (que sigue igual, en español, y en la caché de
 * prompts). Está escrita en el propio idioma para que el modelo no se contagie del español de arriba.
 */
export const INSTRUCCION_IDIOMA: Record<IdiomaAsistente, string> = {
  es: 'Idioma de la respuesta: español neutro.',
  en: 'Reply language: always answer in English, even though the knowledge base above is in Spanish. The user has the app in English, so when you mention buttons, views, settings or messages of the app, use their English names (for example «Import», «Settings», «Move overlay», «Borderless»). Keep proper names such as Coach LoL IA and League of Legends as they are.',
  'pt-BR': 'Idioma da resposta: responda sempre em português do Brasil, mesmo que a base de conhecimento acima esteja em espanhol. O usuário está com o app em português, então, ao citar botões, telas, ajustes ou mensagens do app, use os nomes em português (por exemplo «Importar», «Ajustes», «Mover overlay», «Sem bordas»). Mantenha nomes próprios como Coach LoL IA e League of Legends.',
  fr: 'Langue de la réponse : réponds toujours en français, même si la base de connaissances ci-dessus est en espagnol. L’utilisateur a l’application en français : quand tu cites des boutons, des vues, des réglages ou des messages de l’application, utilise leurs noms en français (par exemple « Importer », « Paramètres », « Déplacer l’overlay », « Sans bordure »). Garde les noms propres comme Coach LoL IA et League of Legends.',
  de: 'Antwortsprache: Antworte immer auf Deutsch, auch wenn die Wissensbasis oben auf Spanisch ist. Der Nutzer hat die App auf Deutsch; wenn du Schaltflächen, Ansichten, Einstellungen oder Meldungen der App nennst, verwende die deutschen Bezeichnungen (zum Beispiel „Importieren“, „Einstellungen“, „Overlay verschieben“, „Randlos“). Eigennamen wie Coach LoL IA und League of Legends bleiben unverändert.',
};

/** Respuesta fija cuando el modelo rechaza la petición (stop_reason «refusal»), en cada idioma. */
export const MENSAJES_RECHAZO: Record<IdiomaAsistente, string> = {
  es: 'No puedo ayudarte con eso. Si tienes un problema con Coach LoL IA, escríbenos a support@coachlolia.com y te ayudamos.',
  en: 'I can’t help with that. If you have a problem with Coach LoL IA, write to us at support@coachlolia.com and we’ll help you.',
  'pt-BR': 'Não posso ajudar com isso. Se você tiver algum problema com o Coach LoL IA, escreva para support@coachlolia.com e a gente te ajuda.',
  fr: 'Je ne peux pas t’aider avec ça. Si tu as un problème avec Coach LoL IA, écris-nous à support@coachlolia.com et nous t’aiderons.',
  de: 'Dabei kann ich dir nicht helfen. Wenn du ein Problem mit Coach LoL IA hast, schreib uns an support@coachlolia.com – wir helfen dir gern.',
};
/** La del español (compatibilidad). */
export const MENSAJE_RECHAZO = MENSAJES_RECHAZO.es;

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Mensaje = Anthropic.Beta.Messages.BetaMessage;
/** Llamada a la API de mensajes (sustituible en las pruebas). */
export type CrearMensaje = (params: Params) => Promise<Mensaje>;

export interface OpcionesAsistente {
  crear: CrearMensaje;
  modelo: string;
  /** Reloj inyectable para los límites. */
  ahora?: () => number;
  /** Tope global de peticiones al modelo por hora y por día (ASISTENTE_MAX_HORA / _DIA). */
  maxHora?: number;
  maxDia?: number;
}

export const MAX_HORA_POR_DEFECTO = 300;
export const MAX_DIA_POR_DEFECTO = 2000;

/**
 * Tope global de gasto, guardado en la base por cubos de hora y de día (sobrevive a reinicios).
 * Comprueba y suma en una transacción; devuelve false si ya se llegó al tope.
 */
function consumirTope(db: Db, ahora: number, maxHora: number, maxDia: number): boolean {
  const iso = new Date(ahora).toISOString();
  const hora = `h:${iso.slice(0, 13)}`;
  const dia = `d:${iso.slice(0, 10)}`;
  const leer = db.sql.prepare('SELECT n FROM asistente_uso WHERE cubo = ?');
  const sumar = db.sql.prepare('INSERT INTO asistente_uso (cubo, n) VALUES (?, 1) ON CONFLICT(cubo) DO UPDATE SET n = n + 1');
  return db.sql.transaction(() => {
    const nHora = (leer.get(hora) as { n: number } | undefined)?.n ?? 0;
    const nDia = (leer.get(dia) as { n: number } | undefined)?.n ?? 0;
    if (nHora >= maxHora || nDia >= maxDia) return false;
    sumar.run(hora);
    sumar.run(dia);
    // Los cubos viejos no sirven: se borran los de hace más de 2 días.
    db.sql.prepare("DELETE FROM asistente_uso WHERE substr(cubo, 3, 10) < ?").run(new Date(ahora - 2 * 86_400_000).toISOString().slice(0, 10));
    return true;
  })();
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

/** Valida el historial: 1-12 mensajes alternos, empezando y terminando por el usuario; preguntas de 1-1000 caracteres y respuestas de hasta 8000. */
export function validarMensajes(cuerpo: unknown): MensajeChat[] | null {
  const mensajes = (cuerpo as { mensajes?: unknown } | null)?.mensajes;
  if (!Array.isArray(mensajes) || mensajes.length === 0 || mensajes.length > MAX_MENSAJES) return null;
  const validos: MensajeChat[] = [];
  for (const [i, m] of mensajes.entries()) {
    const { rol, texto } = (m ?? {}) as { rol?: unknown; texto?: unknown };
    const esperado: MensajeChat['rol'] = i % 2 === 0 ? 'usuario' : 'asistente';
    if (rol !== esperado || typeof texto !== 'string') return null;
    const max = esperado === 'usuario' ? MAX_CARACTERES : MAX_CARACTERES_ASISTENTE;
    if (texto.trim().length === 0 || texto.length > max) return null;
    validos.push({ rol: esperado, texto });
  }
  return validos.at(-1)!.rol === 'usuario' ? validos : null;
}

/** Pide la respuesta al modelo. En un rechazo devuelve el mensaje fijo; si no, une los bloques de texto. */
export async function responder(
  crear: CrearMensaje,
  modelo: string,
  mensajes: MensajeChat[],
  idioma: IdiomaAsistente = 'es',
): Promise<string> {
  const rechazo = MENSAJES_RECHAZO[idioma];
  const respuesta = await crear({
    model: modelo,
    max_tokens: 700,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // La base de conocimiento (fija, en caché) y detrás la instrucción de idioma, que cambia según la app.
    system: [
      { type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: INSTRUCCION_IDIOMA[idioma] },
    ],
    messages: mensajes.map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto })),
  });
  if (respuesta.stop_reason === 'refusal') return rechazo;
  const texto = respuesta.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n');
  return texto || rechazo;
}

/** Registra POST /api/asistente con su CORS (origen de URL_WEB) y su propio límite de 20 peticiones por hora e IP. */
export function registrarAsistente(app: FastifyInstance, opciones: OpcionesAsistente | null, urlWeb: string, db: Db): void {
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
      const ip = claveIp(req.ip);
      const recientes = (peticiones.get(ip) ?? []).filter((x) => t - x < VENTANA_MS);
      recientes.push(t);
      peticiones.set(ip, recientes);
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
      const tope = consumirTope(db, ahora(), opciones!.maxHora ?? MAX_HORA_POR_DEFECTO, opciones!.maxDia ?? MAX_DIA_POR_DEFECTO);
      if (!tope) {
        console.warn('[asistente] Se alcanzó el tope global de peticiones (ASISTENTE_MAX_HORA / ASISTENTE_MAX_DIA).');
        return reply.code(429).send({ error: 'limite_asistente' });
      }
      try {
        return { respuesta: await responder(opciones!.crear, opciones!.modelo, mensajes, leerIdioma(req.body)) };
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
