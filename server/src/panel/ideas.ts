import type Anthropic from '@anthropic-ai/sdk';
import type { CrearMensajeIa } from '../coachIa/rutas';
import { leerPublicacion, PLATAFORMAS, type NuevaPublicacion, type Publicacion } from './publicaciones';
import type { VideoTiktok } from './tiktok';
import type { ClipTwitch } from './twitch';

/*
 * Botón «Proponer ideas» del panel: pide a la IA del servidor entre 3 y 6 ideas de reels o posts a partir de los clips
 * de Twitch más vistos, los vídeos de TikTok que mejor han funcionado y lo que ya está en la cola. Las ideas entran en
 * la cola como «idea»: nunca se publican ni se aprueban solas.
 *
 * Coste: Sonnet con ~2500 tokens de entrada y hasta 4000 de salida ≈ 0,05 USD en el peor caso; con IDEAS_MAX_DIA = 10,
 * medio dólar al día como mucho (y solo lo puede pulsar el dueño, con la contraseña del panel).
 */

export const IDEAS_MAX_DIA = 10;
export const MAX_TOKENS_IDEAS = 4000;
const TIEMPO_IDEAS_MS = 90_000;

export const SISTEMA_IDEAS = `Eres el responsable de contenido de Coach LoL IA (https://www.coachlolia.com), una app gratuita para Windows 10/11 que ayuda a jugar a League of Legends: builds más usadas por jugadores Esmeralda+ (runas, objetos, habilidades) que se importan en un clic, y un coach en partida con overlay y voz en español que avisa de compras, objetivos, visión y del rival. Tiene planes de pago opcionales que amplían la cuota del coach con IA en la nube. El dueño, Carlos, la está construyendo él mismo y emite en Twitch con un avatar animado.

Propón reels y posts con posibilidades reales de hacerse virales en TikTok, YouTube Shorts e Instagram Reels, y avisos para Twitch, Discord o la web.

Reglas:
- Gancho en el primer segundo: un problema o un resultado, nunca «hola, soy…». Un solo mensaje por vídeo. Cierre con pregunta o reto.
- Vídeos de 15 a 35 segundos, verticales, con subtítulos grandes y grabación real de la app o del directo.
- Si hay un clip de Twitch que sirva de material, ponlo en «origen» con su enlace exacto; si no, deja «origen» vacío.
- No inventes resultados, cifras ni subidas de elo. Nunca digas que es «100 % seguro» ni que «no te pueden banear».
- No uses marcas ni arte de Riot como marca del canal. En la caption añade «Proyecto independiente, no respaldado por Riot Games» si se habla de la app.
- Nada de seguidores comprados, sorteos engañosos ni copiar vídeos de otros creadores.
- 3 a 5 hashtags, en minúsculas.
- Escribe en español de España, cercano, directo y con frases cortas.
- No repitas ideas que ya estén en la cola.`;

export const ESQUEMA_IDEAS = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['plataforma', 'gancho', 'texto', 'guion', 'hashtags', 'origen'],
        properties: {
          plataforma: { type: 'string', enum: [...PLATAFORMAS] },
          gancho: { type: 'string', description: 'Texto en pantalla o primera frase del primer segundo, como mucho 150 caracteres.' },
          texto: { type: 'string', description: 'Caption del post.' },
          guion: { type: 'string', description: 'Guion breve por segundos: imagen, texto en pantalla y voz.' },
          hashtags: { type: 'array', items: { type: 'string' } },
          origen: { type: 'string', description: 'Enlace exacto de un clip de la lista, o cadena vacía.' },
        },
      },
    },
  },
} as const;

export interface ContextoIdeas {
  clips: ClipTwitch[];
  tiktok: VideoTiktok[];
  cola: Publicacion[];
}

export function mensajeIdeas(c: ContextoIdeas): string {
  const clips = c.clips.slice(0, 10).map((x) => `- ${x.url} · «${x.titulo}» · ${x.vistas} vistas · ${x.segundos} s`);
  const tiktok = [...c.tiktok]
    .sort((a, b) => b.vistas - a.vistas)
    .slice(0, 8)
    .map((v) => `- «${v.titulo || v.url}» · ${v.vistas} vistas · ${v.megusta} me gusta · ${v.compartidos} compartidos`);
  const cola = c.cola.filter((p) => p.estado !== 'descartado').slice(0, 20).map((p) => `- [${p.plataforma}] ${p.gancho}`);
  return [
    'Clips de Twitch de los últimos 30 días (los más vistos primero):',
    clips.length ? clips.join('\n') : '- (ninguno)',
    '',
    'Vídeos de TikTok de la cuenta (los más vistos primero):',
    tiktok.length ? tiktok.join('\n') : '- (ninguno apuntado todavía)',
    '',
    'Ya en la cola (no repetir):',
    cola.length ? cola.join('\n') : '- (vacía)',
    '',
    'Propón entre 3 y 6 ideas nuevas, la mayoría reels de TikTok.',
  ].join('\n');
}

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

export function paramsIdeas(modelo: string, c: ContextoIdeas): Params {
  const params: Params = {
    model: modelo,
    max_tokens: MAX_TOKENS_IDEAS,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_IDEAS as unknown as Record<string, unknown> } },
    system: [{ type: 'text', text: SISTEMA_IDEAS, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: mensajeIdeas(c) }],
  };
  if (/^claude-(sonnet|opus|fable)-/.test(modelo)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

/** Lee la salida del modelo: solo ideas válidas, y el origen solo si es uno de los clips que se le pasaron. */
export function leerIdeas(texto: string, c: ContextoIdeas): NuevaPublicacion[] {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return [];
  }
  const lista = (crudo as { ideas?: unknown })?.ideas;
  if (!Array.isArray(lista)) return [];
  const clips = new Set(c.clips.map((x) => x.url));
  const ideas: NuevaPublicacion[] = [];
  for (const e of lista.slice(0, 6)) {
    if (typeof e !== 'object' || e === null) continue;
    const r = e as Record<string, unknown>;
    const origen = typeof r.origen === 'string' && clips.has(r.origen.trim()) ? r.origen.trim() : '';
    const p = leerPublicacion({ ...r, origen, estado: 'idea' }, 'ia');
    if (typeof p !== 'string') ideas.push(p);
  }
  return ideas;
}

export async function generarIdeas(o: { crear: CrearMensajeIa; modelo: string }, c: ContextoIdeas): Promise<NuevaPublicacion[]> {
  const r = await o.crear(paramsIdeas(o.modelo, c), { timeout: TIEMPO_IDEAS_MS });
  if (r.stop_reason === 'refusal') return [];
  const texto = r.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return leerIdeas(texto, c);
}
