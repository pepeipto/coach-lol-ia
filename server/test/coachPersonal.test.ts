import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeticionPersonal } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { mensajesPersonal, SISTEMA_PERSONAL, textoPerfil, validarPersonal } from '../src/coachIa/personal';
import { IDIOMA_IA } from '../src/coachIa/prompts';
import type { CrearMensajeIa } from '../src/coachIa/rutas';

type Params = Parameters<CrearMensajeIa>[0];

const respuesta = (texto: string, stop_reason = 'end_turn') =>
  ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text: texto, citations: null }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  }) as unknown as Awaited<ReturnType<CrearMensajeIa>>;

const peticion = (o: Partial<PeticionPersonal> = {}): PeticionPersonal => ({
  idioma: 'es',
  perfil: {
    rango: 'Esmeralda I 31 PL',
    partidas: 14,
    campeones: [{ campeon: 'Zed', partidas: 9, victorias: 6, kda: 3.4, csMin: 7.7, nota: 71 }],
    tendencias: [{ id: 'muertes', valor: 3.9, cambio: -0.1 }],
    reto: { id: 'muertes4', hechas: 4, objetivo: 5 },
    ultimas: [{ campeon: 'Zed', modo: 'clasificatoria', rol: 'MIDDLE', victoria: true, k: 8, d: 2, a: 3, csMin: 7.7, nota: 67, minutos: 26 }],
  },
  mensajes: [{ rol: 'usuario', texto: '¿Qué debería mejorar con Zed?' }],
  ...o,
});

describe('coach personal: validación y prompt', () => {
  it('acepta un cuerpo válido y rechaza lo que no lo es', () => {
    expect(validarPersonal(peticion())).toEqual(peticion());
    expect(validarPersonal({ ...peticion(), idioma: 'ru' })).toBeNull();
    expect(validarPersonal({ ...peticion(), mensajes: [] })).toBeNull();
    // La conversación tiene que acabar con una pregunta del usuario.
    expect(validarPersonal({ ...peticion(), mensajes: [{ rol: 'usuario', texto: 'hola' }, { rol: 'coach', texto: 'hola' }] })).toBeNull();
    expect(validarPersonal({ ...peticion(), mensajes: [{ rol: 'usuario', texto: 'x'.repeat(601) }] })).toBeNull();
    expect(validarPersonal({ ...peticion(), perfil: { ...peticion().perfil, partidas: -1 } })).toBeNull();
    expect(validarPersonal({ ...peticion(), perfil: { ...peticion().perfil, ultimas: [{ ...peticion().perfil.ultimas[0], rol: 'X' }] } })).toBeNull();
  });

  it('solo se quedan los 12 últimos mensajes', () => {
    const mensajes = Array.from({ length: 15 }, (_, i) => ({ rol: i % 2 ? 'coach' : 'usuario', texto: `m${i}` })) as PeticionPersonal['mensajes'];
    expect(validarPersonal(peticion({ mensajes }))!.mensajes).toHaveLength(12);
  });

  it('el perfil va delante del primer mensaje del usuario y sin nombres', () => {
    const p = peticion({ mensajes: [{ rol: 'coach', texto: 'Hola' }, { rol: 'usuario', texto: 'Ayuda' }] });
    const m = mensajesPersonal(p);
    expect(m[0]!.role).toBe('user');
    expect(m[0]!.content).toContain('PLAYER PROFILE');
    expect(m[0]!.content).toContain('Zed (9 games, 6 wins');
    expect(m[0]!.content).toContain('Ayuda');
    expect(textoPerfil(p.perfil)).toContain('muertes4 (4/5');
    expect(SISTEMA_PERSONAL).toContain('Riot Games policy');
  });
});

describe('POST /api/coach/personal', () => {
  let db: Db;
  let app: FastifyInstance;
  let crear: ReturnType<typeof vi.fn<CrearMensajeIa>>;
  const pedir = (cuerpo: unknown, ip = '10.0.0.1') =>
    app.inject({ method: 'POST', url: '/api/coach/personal', remoteAddress: ip, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(cuerpo) });

  beforeEach(() => {
    db = abrirDb(':memory:');
    crear = vi.fn<CrearMensajeIa>(async () => respuesta('Tus muertes han bajado: sigue así.'));
    app = crearServidor(db, { coachIa: { crear, modeloAnalisis: 'claude-sonnet-5-5', modeloConsejo: 'claude-haiku-5-5', personalIpDia: 2 } });
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('responde con Sonnet, caché del sistema e idioma', async () => {
    const r = await pedir(peticion({ idioma: 'fr' }));
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ respuesta: 'Tus muertes han bajado: sigue así.' });
    const p = crear.mock.calls[0]![0] as Params;
    expect(p.model).toBe('claude-sonnet-5-5');
    expect(p.system).toEqual([
      { type: 'text', text: SISTEMA_PERSONAL, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: IDIOMA_IA.fr },
    ]);
  });

  it('400 con datos no válidos, 429 al pasar el límite por IP, 502 si el modelo lo rechaza', async () => {
    expect((await pedir({ idioma: 'es' })).statusCode).toBe(400);
    crear.mockResolvedValueOnce(respuesta('', 'refusal'));
    expect((await pedir(peticion())).statusCode).toBe(502);
    // El 502 no gasta el límite de la IP.
    expect((await pedir(peticion())).statusCode).toBe(200);
    expect((await pedir(peticion())).statusCode).toBe(200);
    expect((await pedir(peticion())).statusCode).toBe(429);
  });

  it('sin clave de la IA, 503', async () => {
    await app.close();
    app = crearServidor(db, { coachIa: null });
    expect((await pedir(peticion())).statusCode).toBe(503);
  });
});
