import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTRUCCION_IDIOMA, MENSAJE_RECHAZO, MENSAJES_RECHAZO, MODELO_POR_DEFECTO, type CrearMensaje } from '../src/asistente/asistente';
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
    expect(p.model).toBe('claude-sonnet-5-5');
    expect(p.max_tokens).toBe(700);
    expect(p.output_config).toEqual({ effort: 'low' });
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.fallbacks).toBe('default');
    expect(p.stream).toBeFalsy();
    for (const prohibido of ['thinking', 'temperature', 'top_p', 'top_k']) expect(p).not.toHaveProperty(prohibido);
  });

  it('el bloque de sistema es el conocimiento estable con cache_control, y detrás el idioma (español sin indicarlo)', async () => {
    await pedir({ mensajes: [usuario('Hola')] });
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.system).toEqual([
      { type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: INSTRUCCION_IDIOMA.es },
    ]);
    expect(SISTEMA).toContain('Asistente de Coach LoL IA');
    expect(SISTEMA).toContain('support@coachlolia.com');
  });

  it('la base de conocimiento está al día con la 3.0 (umbrales, modos, jungla, carga e idiomas)', () => {
    expect(SISTEMA).toContain('desde 10 partidas');
    expect(SISTEMA).toContain('de 10 a 29 partidas');
    expect(SISTEMA).not.toMatch(/20 partidas/);
    for (const texto of ['ARAM: Caos', 'Arena', 'minimapa', 'Pantalla de carga', 'portugués (Brasil)', 'alemán', '«Campeones»']) {
      expect(SISTEMA, texto).toContain(texto);
    }
    expect(SISTEMA).not.toContain('En TFT, ARAM, Arena');
  });

  it.each(['en', 'pt-BR', 'fr', 'de'] as const)('con idioma %s, la misma base de conocimiento y la instrucción de responder en él', async (idioma) => {
    await pedir({ mensajes: [usuario('Hello')], idioma });
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.system).toEqual([
      { type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: INSTRUCCION_IDIOMA[idioma] },
    ]);
  });

  it('un idioma desconocido es español', async () => {
    await pedir({ mensajes: [usuario('Ciao')], idioma: 'it' });
    expect((crear.mock.calls[0]![0] as Params).system).toContainEqual({ type: 'text', text: INSTRUCCION_IDIOMA.es });
  });

  it('el rechazo sale en el idioma pedido', async () => {
    crear.mockResolvedValueOnce(respuesta('', 'refusal'));
    const r = await pedir({ mensajes: [usuario('something')], idioma: 'de' });
    expect(r.json()).toEqual({ respuesta: MENSAJES_RECHAZO.de });
    for (const m of Object.values(MENSAJES_RECHAZO)) expect(m).toContain('support@coachlolia.com');
  });

  it('un rechazo (stop_reason refusal) da el mensaje fijo que remite al soporte', async () => {
    crear.mockResolvedValueOnce(respuesta('', 'refusal'));
    const r = await pedir({ mensajes: [usuario('algo')] });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ respuesta: MENSAJE_RECHAZO });
    expect(MENSAJE_RECHAZO).toContain('support@coachlolia.com');
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
    ['pregunta de más de 1000 caracteres', { mensajes: [usuario('x'.repeat(1001))] }],
    ['respuesta del asistente de más de 8000 caracteres', { mensajes: [usuario('a'), asistente('y'.repeat(8001)), usuario('b')] }],
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

  it('al modelo solo llegan los últimos 5 mensajes (empezando por el usuario), aunque el cliente mande 11', async () => {
    const once = [usuario('u0'), ...Array.from({ length: 5 }, (_, i) => [asistente(`a${i}`), usuario(`u${i + 1}`)]).flat()];
    expect((await pedir({ mensajes: once })).statusCode).toBe(200);
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.messages).toEqual([
      { role: 'user', content: 'u3' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'u4' },
      { role: 'assistant', content: 'a4' },
      { role: 'user', content: 'u5' },
    ]);
  });

  it('los turnos del asistente inventados se recortan a 2000 caracteres y el historial a 6000 en total', async () => {
    const mensajes = [usuario('a'), asistente('y'.repeat(8000)), usuario('b'), asistente('z'.repeat(8000)), usuario('¿y ahora?')];
    expect((await pedir({ mensajes })).statusCode).toBe(200);
    const p = crear.mock.calls[0]![0] as Params;
    const textos = p.messages.map((m) => m.content as string);
    for (const t of textos) expect(t.length).toBeLessThanOrEqual(2000);
    expect(textos.reduce((n, t) => n + t.length, 0)).toBeLessThanOrEqual(6000);
    expect(textos.at(-1)).toBe('¿y ahora?');
    expect(p.messages[0]!.role).toBe('user');
  });

  it('si el total pasa de 6000 caracteres se quitan los pares más antiguos', async () => {
    const largo = (c: string) => c.repeat(2000);
    const mensajes = [usuario('x'.repeat(1000)), asistente(largo('a')), usuario('x'.repeat(1000)), asistente(largo('b')), usuario('x'.repeat(1000))];
    await pedir({ mensajes });
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.messages).toHaveLength(3);
    expect((p.messages[1]!.content as string)[0]).toBe('b');
  });

  it('hasta 12 mensajes alternos de hasta 1000 caracteres sí valen', async () => {
    const once = [usuario('a'), ...Array.from({ length: 5 }, () => [asistente('b'), usuario('x'.repeat(1000))]).flat()];
    expect(once).toHaveLength(11);
    expect((await pedir({ mensajes: once })).statusCode).toBe(200);
  });

  it('una respuesta larga del asistente (hasta 8000) seguida de otra pregunta sí vale', async () => {
    const r = await pedir({ mensajes: [usuario('Explícamelo todo'), asistente('y'.repeat(5000)), usuario('¿Y lo de Premium?')] });
    expect(r.statusCode).toBe(200);
    expect((await pedir({ mensajes: [usuario('a'), asistente('y'.repeat(8000)), usuario('b')] })).statusCode).toBe(200);
  });

  it('la base de conocimiento describe el modelo gratuito: sin Premium, sin 4,99 €, con donaciones y soporte', () => {
    expect(SISTEMA).not.toContain('4,99');
    expect(SISTEMA).not.toMatch(/premium/i);
    expect(SISTEMA).not.toMatch(/prueba gratuita|licencia/i);
    expect(SISTEMA).toMatch(/gratis/i);
    expect(SISTEMA).toContain('https://www.coachlolia.com/apoyar');
    expect(SISTEMA).toContain('support@coachlolia.com');
  });

  it('las instrucciones piden respuestas de menos de ~150 palabras', () => {
    expect(SISTEMA).toMatch(/menos de 150 palabras/);
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
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', ANTHROPIC_API_KEY: 'sk-ant-x' }).asistente).toEqual({ modelo: 'claude-sonnet-5-5', maxHora: 60, maxDia: 300 });
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', ANTHROPIC_API_KEY: 'sk-ant-x', ASISTENTE_MODELO: 'otro-modelo' }).asistente).toEqual({ modelo: 'otro-modelo', maxHora: 60, maxDia: 300 });
    expect(
      leerConfiguracion({ RIOT_API_KEY: 'k', ANTHROPIC_API_KEY: 'sk-ant-x', ASISTENTE_MAX_HORA: '50', ASISTENTE_MAX_DIA: '400' }).asistente,
    ).toEqual({ modelo: 'claude-sonnet-5-5', maxHora: 50, maxDia: 400 });
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', ANTHROPIC_API_KEY: 'x', ASISTENTE_MAX_HORA: 'mucho' })).toThrow('ASISTENTE_MAX_HORA');
  });
});

describe('tope global de gasto del asistente (I3)', () => {
  let db: Db;
  let ahora: number;
  const crear = vi.fn<CrearMensaje>(async () => respuesta('ok'));
  const montar = () =>
    crearServidor(db, {
      urlWeb: 'https://www.coachlolia.com',
      asistente: { crear, modelo: MODELO_POR_DEFECTO, ahora: () => ahora, maxHora: 2, maxDia: 3 },
    });
  const pedir = (app: FastifyInstance, ip: string) =>
    app.inject({
      method: 'POST',
      url: '/api/asistente',
      remoteAddress: ip,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ mensajes: [{ rol: 'usuario', texto: 'Hola' }] }),
    });
  beforeEach(() => {
    ahora = Date.UTC(2026, 9, 19, 10, 5);
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('por hora y por día, contando todas las IP y guardado en la base (sobrevive a un reinicio)', async () => {
    let app = montar();
    expect((await pedir(app, '10.0.0.1')).statusCode).toBe(200);
    expect((await pedir(app, '10.0.0.2')).statusCode).toBe(200);
    const r = await pedir(app, '10.0.0.3');
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'limite_asistente' });
    await app.close();
    // Otra hora: vuelve a haber hueco por hora, pero el día se agota en 3.
    ahora += 3600 * 1000;
    app = montar();
    expect((await pedir(app, '10.0.0.4')).statusCode).toBe(200);
    expect((await pedir(app, '10.0.0.5')).statusCode).toBe(429);
    // Al día siguiente, otra vez.
    ahora += 24 * 3600 * 1000;
    expect((await pedir(app, '10.0.0.6')).statusCode).toBe(200);
    await app.close();
  });

  it('las peticiones no válidas no gastan del tope', async () => {
    const app = montar();
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/asistente', remoteAddress: `10.1.0.${i}`, headers: { 'content-type': 'application/json' }, payload: '{}' });
    }
    expect((await pedir(app, '10.0.0.1')).statusCode).toBe(200);
    await app.close();
  });
});
