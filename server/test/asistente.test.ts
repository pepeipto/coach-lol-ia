import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENSAJE_RECHAZO, MODELO_POR_DEFECTO, type CrearMensaje } from '../src/asistente/asistente';
import { SISTEMA } from '../src/asistente/conocimiento';
import { leerConfiguracion } from '../src/config';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';

type Params = Parameters<CrearMensaje>[0];

const respuesta = (texto: string, stop_reason = 'end_turn') =>
  ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: texto, citations: null }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  }) as unknown as Awaited<ReturnType<CrearMensaje>>;

describe('POST /api/asistente', () => {
  let db: Db;
  let app: FastifyInstance;
  let crear: ReturnType<typeof vi.fn<CrearMensaje>>;
  let ahora: number;
  const montar = (conCliente = true) =>
    crearServidor(db, {
      urlWeb: 'https://www.coachlolia.com',
      asistente: conCliente ? { crear, modelo: MODELO_POR_DEFECTO, ahora: () => ahora } : null,
    });
  const pedir = (cuerpo: unknown, ip = '10.0.0.1') =>
    app.inject({
      method: 'POST',
      url: '/api/asistente',
      remoteAddress: ip,
      headers: { 'content-type': 'application/json', origin: 'https://www.coachlolia.com' },
      payload: JSON.stringify(cuerpo),
    });
  const usuario = (texto: string) => ({ rol: 'usuario', texto });
  const asistente = (texto: string) => ({ rol: 'asistente', texto });

  beforeEach(() => {
    ahora = Date.UTC(2026, 9, 19);
    db = abrirDb(':memory:');
    crear = vi.fn<CrearMensaje>(async () => respuesta('Pulsa «Importar» en la vista Campeón.'));
    app = montar();
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('responde y traduce los mensajes a la API (usuario/asistente → user/assistant)', async () => {
    const r = await pedir({ mensajes: [usuario('Hola'), asistente('¡Hola! ¿En qué te ayudo?'), usuario('¿Cómo importo la build?')] });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ respuesta: 'Pulsa «Importar» en la vista Campeón.' });
    expect(r.headers['access-control-allow-origin']).toBe('https://www.coachlolia.com');
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.messages).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: '¡Hola! ¿En qué te ayudo?' },
      { role: 'user', content: '¿Cómo importo la build?' },
    ]);
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.max_tokens).toBe(1500);
    expect(p.output_config).toEqual({ effort: 'low' });
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.fallbacks).toBe('default');
    expect(p.stream).toBeFalsy();
    for (const prohibido of ['thinking', 'temperature', 'top_p', 'top_k']) expect(p).not.toHaveProperty(prohibido);
  });

  it('el bloque de sistema es el conocimiento estable con cache_control', async () => {
    await pedir({ mensajes: [usuario('Hola')] });
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.system).toEqual([{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }]);
    expect(SISTEMA).toContain('Asistente de Coach LoL IA');
    expect(SISTEMA).toContain('4,99 €/mes');
    expect(SISTEMA).toContain('suport@coachlolia.com');
  });

  it('un rechazo (stop_reason refusal) da el mensaje fijo que remite al soporte', async () => {
    crear.mockResolvedValueOnce(respuesta('', 'refusal'));
    const r = await pedir({ mensajes: [usuario('algo')] });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ respuesta: MENSAJE_RECHAZO });
    expect(MENSAJE_RECHAZO).toContain('suport@coachlolia.com');
  });

  it('une varios bloques de texto y descarta los que no son texto', async () => {
    crear.mockResolvedValueOnce({
      ...respuesta(''),
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'text', text: 'Primero.', citations: null },
        { type: 'text', text: 'Segundo.', citations: null },
      ],
    } as unknown as Awaited<ReturnType<CrearMensaje>>);
    expect((await pedir({ mensajes: [usuario('Hola')] })).json()).toEqual({ respuesta: 'Primero.\n\nSegundo.' });
  });

  it.each([
    ['sin cuerpo', undefined],
    ['sin mensajes', {}],
    ['lista vacía', { mensajes: [] }],
    ['más de 12 mensajes', { mensajes: Array.from({ length: 13 }, (_, i) => (i % 2 === 0 ? usuario('a') : asistente('b'))) }],
    ['texto vacío', { mensajes: [usuario('')] }],
    ['texto de más de 1000 caracteres', { mensajes: [usuario('x'.repeat(1001))] }],
    ['el último no es del usuario', { mensajes: [usuario('a'), asistente('b')] }],
    ['roles que no alternan', { mensajes: [usuario('a'), usuario('b')] }],
    ['empieza el asistente', { mensajes: [asistente('a'), usuario('b')] }],
    ['rol desconocido', { mensajes: [{ rol: 'sistema', texto: 'a' }] }],
    ['texto que no es texto', { mensajes: [{ rol: 'usuario', texto: 42 }] }],
  ])('400 si el cuerpo no es válido: %s', async (_n, cuerpo) => {
    const r = await pedir(cuerpo);
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ error: 'mensajes_no_validos' });
    expect(crear).not.toHaveBeenCalled();
  });

  it('hasta 12 mensajes alternos de hasta 1000 caracteres sí valen', async () => {
    const once = [usuario('a'), ...Array.from({ length: 5 }, () => [asistente('b'), usuario('x'.repeat(1000))]).flat()];
    expect(once).toHaveLength(11);
    expect((await pedir({ mensajes: once })).statusCode).toBe(200);
  });

  it('503 asistente_no_configurado sin ANTHROPIC_API_KEY', async () => {
    await app.close();
    app = montar(false);
    const r = await pedir({ mensajes: [usuario('Hola')] });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: 'asistente_no_configurado' });
  });

  it('20 peticiones por hora y por IP; la 21 da 429 limite_asistente; otra IP sigue; pasada la hora, también', async () => {
    for (let i = 0; i < 20; i++) expect((await pedir({ mensajes: [usuario('Hola')] })).statusCode).toBe(200);
    const r = await pedir({ mensajes: [usuario('Hola')] });
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'limite_asistente' });
    expect((await pedir({ mensajes: [usuario('Hola')] }, '10.0.0.2')).statusCode).toBe(200);
    ahora += 3600 * 1000;
    expect((await pedir({ mensajes: [usuario('Hola')] })).statusCode).toBe(200);
  });

  it('el límite del asistente es independiente del de premium', async () => {
    for (let i = 0; i < 31; i++) await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X', remoteAddress: '10.0.0.1' });
    expect((await pedir({ mensajes: [usuario('Hola')] })).statusCode).toBe(200);
  });

  it.each([
    ['RateLimitError', new Anthropic.RateLimitError(429, { error: { message: 'secreto' } }, 'detalle interno', new Headers())],
    ['APIError 500', new Anthropic.InternalServerError(500, { error: { message: 'secreto' } }, 'detalle interno', new Headers())],
    ['APIError 400', new Anthropic.BadRequestError(400, { error: { message: 'secreto' } }, 'detalle interno', new Headers())],
    ['APIConnectionError', new Anthropic.APIConnectionError({ message: 'detalle interno' })],
    ['error cualquiera', new Error('detalle interno')],
  ])('los errores del SDK (%s) dan 502 asistente_no_disponible sin detalles', async (_n, error) => {
    crear.mockRejectedValueOnce(error);
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await pedir({ mensajes: [usuario('Hola')] });
    consola.mockRestore();
    expect(r.statusCode).toBe(502);
    expect(r.json()).toEqual({ error: 'asistente_no_disponible' });
    expect(r.body).not.toContain('detalle');
    expect(r.body).not.toContain('secreto');
  });

  it('CORS: el preflight del POST JSON admite content-type', async () => {
    const p = await app.inject({
      method: 'OPTIONS',
      url: '/api/asistente',
      headers: { origin: 'https://www.coachlolia.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    });
    expect(p.statusCode).toBe(204);
    expect(p.headers['access-control-allow-origin']).toBe('https://www.coachlolia.com');
    expect(String(p.headers['access-control-allow-headers']).toLowerCase()).toContain('content-type');
    expect(String(p.headers['access-control-allow-methods'])).toContain('POST');
  });
});

describe('configuración del asistente', () => {
  it('sin ANTHROPIC_API_KEY no hay asistente; ASISTENTE_MODELO cambia el modelo', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k' }).asistente).toBeNull();
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', ANTHROPIC_API_KEY: 'sk-ant-x' }).asistente).toEqual({ modelo: 'claude-opus-5-5' });
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', ANTHROPIC_API_KEY: 'sk-ant-x', ASISTENTE_MODELO: 'otro-modelo' }).asistente).toEqual({ modelo: 'otro-modelo' });
  });
});
