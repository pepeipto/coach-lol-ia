import Anthropic from '@anthropic-ai/sdk';
import { conBetas, credencialIa } from '../claveIa';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AnalisisPartida, IdiomaIa, PeticionAnalisis, PeticionConsejo, PeticionPersonal } from '@coach/shared';
import type { Db } from '../db';
import { claveIp } from '../ip';
import type { TipoCuota } from '@coach/shared';
import { crearRepoLicencias } from '../premium/licencias';
import { consumirCuota, devolverCuota, resolverSujeto, type ResultadoConsumo, type Sujeto } from '../premium/cuotas';
import { LIMITES_COACH_IA } from '../topes';
import { filtrarConsejo } from './filtro';
import { ESQUEMA_ANALISIS, IDIOMA_IA, mensajeAnalisis, mensajeConsejo, SISTEMA_ANALISIS, SISTEMA_CONSEJO } from './prompts';
import { validarAnalisis, validarConsejo } from './validar';
import { MAX_CARACTERES_COACH, MAX_CUERPO_PERSONAL, MAX_TOKENS_PERSONAL, mensajesPersonal, sistemaPersonal, validarPersonal } from './personal';

/*
 * Coach con IA (3.2): POST /api/coach/analisis (A, al terminar la partida) y POST /api/coach/consejo (B, momentos
 * muertos). Lo usa la app (desde su proceso principal), no la web: no hay CORS.
 *
 * Privacidad: los datos de la partida se validan, se mandan al modelo y se descartan. No se guardan ni se registran;
 * de cada petición solo quedan los contadores de los límites (por IP en memoria y globales por hora y día en la base).
 */

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Mensaje = Anthropic.Beta.Messages.BetaMessage;
/** Llamada a la API de mensajes (sustituible en las pruebas); `timeout` en milisegundos. */
export type CrearMensajeIa = (params: Params, opciones?: { timeout?: number }) => Promise<Mensaje>;

export const MODELO_ANALISIS_POR_DEFECTO = 'claude-sonnet-5-5';
export const MODELO_CONSEJO_POR_DEFECTO = 'claude-haiku-5-5';

/** Límites por defecto (configurables por entorno, ver config.ts; la justificación está en topes.ts). */
export { LIMITES_COACH_IA };

/** Tamaño máximo de cada cuerpo (bytes). */
export const MAX_CUERPO_ANALISIS = 64 * 1024;
export const MAX_CUERPO_CONSEJO = 8 * 1024;

/** Tope de salida del análisis (razonamiento incluido). El JSON final ocupa unos 1.000 tokens. */
export const MAX_TOKENS_ANALISIS = 4000;
export const MAX_TOKENS_CONSEJO = 120;
const TIEMPO_ANALISIS_MS = 90_000;
const TIEMPO_CONSEJO_MS = 10_000;
const TIEMPO_PERSONAL_MS = 45_000;

export interface OpcionesCoachIa {
  crear: CrearMensajeIa;
  modeloAnalisis: string;
  modeloConsejo: string;
  ahora?: () => number;
  analisisIpDia?: number;
  consejoIpDia?: number;
  analisisMaxHora?: number;
  analisisMaxDia?: number;
  consejoMaxHora?: number;
  consejoMaxDia?: number;
  /** 3.5: coach personal. */
  personalIpDia?: number;
  personalMaxHora?: number;
  personalMaxDia?: number;
}

/** Cliente real: clave clásica (ANTHROPIC_API_KEY) o clave de usuario / token como Bearer (ver claveIa.ts). */
export function crearClienteCoachIa(): CrearMensajeIa {
  const { opciones, betasExtra } = credencialIa();
  const cliente = new Anthropic({ ...opciones, maxRetries: 1 });
  return (params, o) => cliente.beta.messages.create(conBetas(params, betasExtra), o?.timeout ? { timeout: o.timeout } : undefined);
}

type Ruta = 'analisis' | 'consejo' | 'personal';

/**
 * Tope global por hora y por día de una ruta, en la base (sobrevive a reinicios). Comprueba y suma en una
 * transacción; devuelve false si ya se llegó al tope.
 */
export function consumirTopeIa(db: Db, ruta: Ruta, ahora: number, maxHora: number, maxDia: number): boolean {
  const iso = new Date(ahora).toISOString();
  const hora = `${ruta}:h:${iso.slice(0, 13)}`;
  const dia = `${ruta}:d:${iso.slice(0, 10)}`;
  const leer = db.sql.prepare('SELECT n FROM coach_ia_uso WHERE cubo = ?');
  const sumar = db.sql.prepare('INSERT INTO coach_ia_uso (cubo, n) VALUES (?, 1) ON CONFLICT(cubo) DO UPDATE SET n = n + 1');
  return db.sql.transaction(() => {
    const nHora = (leer.get(hora) as { n: number } | undefined)?.n ?? 0;
    const nDia = (leer.get(dia) as { n: number } | undefined)?.n ?? 0;
    if (nHora >= maxHora || nDia >= maxDia) return false;
    sumar.run(hora);
    sumar.run(dia);
    // Los cubos de hace más de 2 días ya no sirven.
    const limite = new Date(ahora - 2 * 86_400_000).toISOString().slice(0, 10);
    db.sql.prepare("DELETE FROM coach_ia_uso WHERE substr(cubo, instr(cubo, ':') + 3, 10) < ?").run(limite);
    return true;
  })();
}

/** Contador por IP y día, en memoria. */
class LimitePorIp {
  private cuenta = new Map<string, { dia: string; n: number }>();
  constructor(private readonly max: number) {}
  /** Suma una petición; false si la IP ya llegó al máximo de hoy. */
  consumir(ip: string, ahora: number): boolean {
    const dia = new Date(ahora).toISOString().slice(0, 10);
    const previo = this.cuenta.get(ip);
    const n = previo && previo.dia === dia ? previo.n : 0;
    if (n >= this.max) return false;
    this.cuenta.set(ip, { dia, n: n + 1 });
    if (this.cuenta.size > 50_000) for (const [k, v] of this.cuenta) if (v.dia !== dia) this.cuenta.delete(k);
    return true;
  }
}

/** Segundos hasta la próxima hora en punto (cabecera Retry-After del 429 global). */
const segundosHastaHora = (ahora: number) => Math.max(60, Math.ceil((3_600_000 - (ahora % 3_600_000)) / 1000));

const conFallback = (modelo: string) => /^claude-(sonnet|opus|fable)-/.test(modelo);

const textoDe = (m: Mensaje) =>
  m.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

const recortar = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Lee y acota el JSON del análisis; null si no tiene la forma esperada. */
export function leerAnalisis(texto: string, duracion: number): AnalisisPartida | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== 'object' || crudo === null) return null;
  const c = crudo as Record<string, unknown>;
  const puntos = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .map((p) => ({ titulo: recortar((p as Record<string, unknown>)?.titulo, 120), porque: recortar((p as Record<string, unknown>)?.porque, 500) }))
      .filter((p) => p.titulo && p.porque)
      .slice(0, 3);
  const momentos = (Array.isArray(c.momentos) ? c.momentos : [])
    .map((m) => {
      const x = m as Record<string, unknown>;
      const t = typeof x?.t === 'number' && Number.isFinite(x.t) ? Math.round(Math.min(Math.max(0, x.t), duracion)) : null;
      return t === null ? null : { t, texto: recortar(x.texto, 300) };
    })
    .filter((m): m is { t: number; texto: string } => !!m && !!m.texto)
    .slice(0, 2);
  const analisis: AnalisisPartida = {
    veredicto: recortar(c.veredicto, 500),
    bien: puntos(c.bien),
    mejorar: puntos(c.mejorar),
    momentos,
    enfoque: recortar(c.enfoque, 400),
  };
  if (!analisis.veredicto || !analisis.enfoque || analisis.bien.length === 0 || analisis.mejorar.length === 0) return null;
  return analisis;
}

/** Pide el análisis al modelo. null si el modelo lo rechaza o devuelve algo que no se puede leer. */
export async function analizar(o: OpcionesCoachIa, p: PeticionAnalisis): Promise<AnalisisPartida | null> {
  const params: Params = {
    model: o.modeloAnalisis,
    max_tokens: MAX_TOKENS_ANALISIS,
    // Esfuerzo bajo: el análisis sale casi igual y gasta mucho menos razonamiento (lo más caro de cada llamada).
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_ANALISIS as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SISTEMA_ANALISIS, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: IDIOMA_IA[p.idioma] },
    ],
    messages: [{ role: 'user', content: mensajeAnalisis(p) }],
  };
  if (conFallback(o.modeloAnalisis)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  const r = await o.crear(params, { timeout: TIEMPO_ANALISIS_MS });
  if (r.stop_reason === 'refusal') {
    console.warn('[coach-ia] El modelo rechazó un análisis');
    return null;
  }
  if (r.stop_reason === 'max_tokens') console.warn('[coach-ia] Análisis cortado por max_tokens');
  // Solo los tokens (nunca los datos de la partida), para medir el coste real de cada análisis.
  if (r.usage) console.info(`[coach-ia] Análisis: ${r.usage.input_tokens} entrada, ${r.usage.cache_read_input_tokens ?? 0} caché, ${r.usage.output_tokens} salida`);
  return leerAnalisis(textoDe(r), p.duracion);
}

/** Pide el consejo al modelo y lo pasa por el filtro (si incumple algo, o hay rechazo, el genérico). */
export async function aconsejar(o: OpcionesCoachIa, p: PeticionConsejo): Promise<{ consejo: string; generico: boolean }> {
  const r = await o.crear(
    {
      model: o.modeloConsejo,
      max_tokens: MAX_TOKENS_CONSEJO,
      // Frase corta y rápida: sin razonamiento y con el mínimo esfuerzo.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SISTEMA_CONSEJO, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: IDIOMA_IA[p.idioma] },
      ],
      messages: [{ role: 'user', content: mensajeConsejo(p) }],
    },
    { timeout: TIEMPO_CONSEJO_MS },
  );
  const crudo = r.stop_reason === 'refusal' ? null : textoDe(r);
  const filtrado = filtrarConsejo(crudo, p.idioma, p.momento, Math.floor(p.tiempo / 60));
  if (!filtrado.delModelo) console.info(`[coach-ia] Consejo sustituido por el genérico (${filtrado.motivo ?? 'rechazo'})`);
  return { consejo: filtrado.texto, generico: !filtrado.delModelo };
}

/** 3.5: respuesta del coach personal; null si el modelo la rechaza o llega vacía. */
export async function conversar(o: OpcionesCoachIa, p: PeticionPersonal): Promise<string | null> {
  const r = await o.crear(
    {
      model: o.modeloAnalisis,
      max_tokens: MAX_TOKENS_PERSONAL,
      output_config: { effort: 'low' },
      system: sistemaPersonal(p.idioma),
      messages: mensajesPersonal(p),
    },
    { timeout: TIEMPO_PERSONAL_MS },
  );
  if (r.stop_reason === 'refusal') return null;
  if (r.usage) console.info(`[coach-ia] Pregunta: ${r.usage.input_tokens} entrada, ${r.usage.output_tokens} salida`);
  const t = textoDe(r);
  return t ? t.slice(0, MAX_CARACTERES_COACH) : null;
}

function registrarError(e: unknown): void {
  // Del más concreto al más general; nunca se registran los datos de la partida.
  if (e instanceof Anthropic.RateLimitError) console.error('[coach-ia] Límite de la API de Anthropic');
  else if (e instanceof Anthropic.APIConnectionTimeoutError) console.error('[coach-ia] La API de Anthropic tardó demasiado');
  else if (e instanceof Anthropic.APIConnectionError) console.error('[coach-ia] Sin conexión con la API de Anthropic');
  else if (e instanceof Anthropic.APIError) console.error(`[coach-ia] Error de la API de Anthropic (${e.status ?? '?'})`);
  else console.error('[coach-ia] Error inesperado:', e instanceof Error ? e.message : String(e));
}

/** Cabeceras con las que la app identifica la cuota que gasta (solo con Premium). */
export const CABECERA_LICENCIA = 'x-coach-licencia';
export const CABECERA_DISPOSITIVO = 'x-coach-dispositivo';

/**
 * Registra las rutas; sin opciones (sin ANTHROPIC_API_KEY) responden 503. Con `cuotas` (Premium encendido),
 * el análisis gasta una partida y el coach personal una pregunta de la cuota mensual; el consejo en partida
 * no gasta cuota (lo que ayuda durante la partida nunca va de pago).
 */
export function registrarCoachIa(app: FastifyInstance, opciones: OpcionesCoachIa | null, db: Db, extra: { cuotas?: boolean } = {}): void {
  const ahora = opciones?.ahora ?? Date.now;
  const repoLicencias = extra.cuotas ? crearRepoLicencias(db) : null;
  const ipAnalisis = new LimitePorIp(opciones?.analisisIpDia ?? LIMITES_COACH_IA.analisisIpDia);
  const ipConsejo = new LimitePorIp(opciones?.consejoIpDia ?? LIMITES_COACH_IA.consejoIpDia);
  const ipPersonal = new LimitePorIp(opciones?.personalIpDia ?? LIMITES_COACH_IA.personalIpDia);
  /** Consejos al día por licencia de pago (no gastan cuota ni los topes de los gratuitos): el mismo máximo que por IP. */
  const consejoPago = new LimitePorIp(opciones?.consejoIpDia ?? LIMITES_COACH_IA.consejoIpDia);

  app.register(async (coach) => {
    // Un JSON mal formado o vacío es un 400 de validación (no un 500).
    coach.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, cuerpo, hecho) => {
      try {
        hecho(null, String(cuerpo).trim() ? JSON.parse(String(cuerpo)) : null);
      } catch {
        hecho(null, null);
      }
    });

    /**
     * Límites comunes; devuelve true si la petición puede seguir (si no, ya respondió). Una licencia de pago
     * (`pago`) no gasta los topes por IP ni los globales, que son para los usuarios gratuitos: en el análisis y el
     * coach personal ya la limita su cuota mensual; en el consejo, que no tiene cuota, se cuenta por licencia.
     */
    function permitir(ruta: Ruta, ip: string, reply: FastifyReply, pago: Sujeto | null = null): boolean {
      const t = ahora();
      const porIp = ruta === 'analisis' ? ipAnalisis : ruta === 'personal' ? ipPersonal : ipConsejo;
      if (pago) {
        if (ruta !== 'consejo') return true;
        if (consejoPago.consumir(pago.id, t)) return true;
        reply.code(429).send({ error: 'limite_diario' });
        return false;
      }
      if (!porIp.consumir(claveIp(ip), t)) {
        reply.code(429).send({ error: 'limite_diario' });
        return false;
      }
      const o = opciones!;
      const ok =
        ruta === 'analisis'
          ? consumirTopeIa(db, ruta, t, o.analisisMaxHora ?? LIMITES_COACH_IA.analisisMaxHora, o.analisisMaxDia ?? LIMITES_COACH_IA.analisisMaxDia)
          : ruta === 'personal'
            ? consumirTopeIa(db, ruta, t, o.personalMaxHora ?? LIMITES_COACH_IA.personalMaxHora, o.personalMaxDia ?? LIMITES_COACH_IA.personalMaxDia)
            : consumirTopeIa(db, ruta, t, o.consejoMaxHora ?? LIMITES_COACH_IA.consejoMaxHora, o.consejoMaxDia ?? LIMITES_COACH_IA.consejoMaxDia);
      if (!ok) {
        console.warn(`[coach-ia] Se alcanzó el tope global de ${ruta} (COACH_IA_*_MAX_HORA / _MAX_DIA).`);
        reply.code(429).header('Retry-After', String(segundosHastaHora(t))).send({ error: 'limite_global' });
        return false;
      }
      return true;
    }

    const cab = (req: { headers: Record<string, string | string[] | undefined> }, n: string) =>
      typeof req.headers[n] === 'string' ? (req.headers[n] as string).trim() : undefined;

    /**
     * Quién gasta la cuota (solo con Premium). null sin cuotas; false si ya respondió (400 sin licencia ni
     * dispositivo).
     */
    function sujetoDe(req: { headers: Record<string, string | string[] | undefined> }, reply: FastifyReply): Sujeto | null | false {
      if (!repoLicencias) return null;
      const sujeto = resolverSujeto(db, repoLicencias, { clave: cab(req, CABECERA_LICENCIA), dispositivo: cab(req, CABECERA_DISPOSITIVO), ahora: ahora() });
      if (!sujeto) {
        reply.code(400).send({ error: 'falta_dispositivo' });
        return false;
      }
      return sujeto;
    }

    /** Licencia de pago activa de la petición (para el consejo, que no gasta cuota); null si no la hay. */
    function licenciaPago(req: { headers: Record<string, string | string[] | undefined> }): Sujeto | null {
      if (!repoLicencias) return null;
      const clave = cab(req, CABECERA_LICENCIA);
      if (!clave) return null;
      const s = resolverSujeto(db, repoLicencias, { clave, dispositivo: cab(req, CABECERA_DISPOSITIVO), ahora: ahora() });
      return s?.pago ? s : null;
    }

    /**
     * Gasta la cuota mensual del sujeto. Devuelve null sin cuotas, el gasto si puede seguir, o false si ya
     * respondió (402 con la cuota agotada).
     */
    function gastarCuota(
      tipo: TipoCuota,
      sujeto: Sujeto | null,
      ip: string,
      reply: FastifyReply,
    ): { sujeto: Sujeto; gasto: Extract<ResultadoConsumo, { ok: true }> } | null | false {
      if (!sujeto) return null;
      const gasto = consumirCuota(db, sujeto, tipo, ahora(), claveIp(ip));
      if (!gasto.ok) {
        reply.code(402).send({ error: 'cuota_agotada', tipo, plan: sujeto.plan, renueva: gasto.renueva });
        return false;
      }
      return { sujeto, gasto };
    }
    const devolver = (tipo: TipoCuota, c: ReturnType<typeof gastarCuota>) => {
      if (c) devolverCuota(db, c.sujeto, tipo, c.gasto);
    };

    coach.post('/api/coach/analisis', { bodyLimit: MAX_CUERPO_ANALISIS }, async (req, reply) => {
      if (!opciones) return reply.code(503).send({ error: 'ia_no_configurada' });
      const p = validarAnalisis(req.body);
      if (!p) return reply.code(400).send({ error: 'datos_no_validos' });
      const sujeto = sujetoDe(req, reply);
      if (sujeto === false) return reply;
      if (!permitir('analisis', req.ip, reply, sujeto?.pago ? sujeto : null)) return reply;
      const cuota = gastarCuota('partida', sujeto, req.ip, reply);
      if (cuota === false) return reply;
      try {
        const analisis = await analizar(opciones, p);
        if (!analisis) {
          devolver('partida', cuota);
          return reply.code(502).send({ error: 'analisis_no_disponible' });
        }
        return { analisis, idioma: p.idioma satisfies IdiomaIa };
      } catch (e) {
        registrarError(e);
        devolver('partida', cuota);
        return reply.code(502).send({ error: 'analisis_no_disponible' });
      }
    });

    // 3.5: coach personal (conversación con el resumen del perfil del jugador).
    coach.post('/api/coach/personal', { bodyLimit: MAX_CUERPO_PERSONAL }, async (req, reply) => {
      if (!opciones) return reply.code(503).send({ error: 'ia_no_configurada' });
      const p = validarPersonal(req.body);
      if (!p) return reply.code(400).send({ error: 'datos_no_validos' });
      const sujeto = sujetoDe(req, reply);
      if (sujeto === false) return reply;
      if (!permitir('personal', req.ip, reply, sujeto?.pago ? sujeto : null)) return reply;
      const cuota = gastarCuota('pregunta', sujeto, req.ip, reply);
      if (cuota === false) return reply;
      try {
        const respuesta = await conversar(opciones, p);
        if (!respuesta) {
          devolver('pregunta', cuota);
          return reply.code(502).send({ error: 'personal_no_disponible' });
        }
        return { respuesta };
      } catch (e) {
        registrarError(e);
        devolver('pregunta', cuota);
        return reply.code(502).send({ error: 'personal_no_disponible' });
      }
    });

    coach.post('/api/coach/consejo', { bodyLimit: MAX_CUERPO_CONSEJO }, async (req, reply) => {
      if (!opciones) return reply.code(503).send({ error: 'ia_no_configurada' });
      const p = validarConsejo(req.body);
      if (!p) return reply.code(400).send({ error: 'datos_no_validos' });
      if (!permitir('consejo', req.ip, reply, licenciaPago(req))) return reply;
      try {
        return await aconsejar(opciones, p);
      } catch (e) {
        registrarError(e);
        return reply.code(502).send({ error: 'consejo_no_disponible' });
      }
    });
  });
}
