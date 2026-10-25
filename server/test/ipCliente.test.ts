import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrearMensaje } from '../src/asistente/asistente';
import { leerConfiguracion } from '../src/config';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { crearAlmacenClave, registrarAdminClave } from '../src/riot/claveAdmin';

const ADMIN = 'una-contrasena-de-administrador-larga';
const PROXY = '172.16.0.9';

describe('seguridad (hallazgo 6): IP real del cliente con Fly-Client-IP', () => {
  let db: Db;
  let app: FastifyInstance;
  const crear = vi.fn<CrearMensaje>(async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }) as never);

  const montar = (cabeceraIpCliente: string | null) => {
    app = crearServidor(db, {
      urlWeb: 'https://www.coachlolia.com',
      trustProxy: 1,
      cabeceraIpCliente,
      asistente: { crear, modelo: 'm', maxHora: 1000, maxDia: 1000 },
    });
    app.get('/ip', async (req) => ({ ip: req.ip }));
    registrarAdminClave(app, { almacen: crearAlmacenClave(db, 'RGAPI-entorno', ADMIN), admin: ADMIN, comprobar: async () => 200 });
  };
  const ip = async (headers: Record<string, string>) =>
    (await app.inject({ method: 'GET', url: '/ip', remoteAddress: PROXY, headers })).json().ip as string;
  const asistente = (headers: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/api/asistente',
      remoteAddress: PROXY,
      headers: { 'content-type': 'application/json', ...headers },
      payload: JSON.stringify({ mensajes: [{ rol: 'usuario', texto: 'Hola' }] }),
    });
  const intentoAdmin = (headers: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/admin/clave',
      remoteAddress: PROXY,
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
      payload: new URLSearchParams({ token: 'contrasena-falsa', clave: 'x' }).toString(),
    });

  beforeEach(() => {
    db = abrirDb(':memory:');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
    vi.restoreAllMocks();
  });

  it('con la cabecera configurada, req.ip es Fly-Client-IP aunque X-Forwarded-For diga otra cosa', async () => {
    montar('fly-client-ip');
    expect(await ip({ 'fly-client-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1, 172.16.0.1' })).toBe('203.0.113.7');
    expect(await ip({ 'fly-client-ip': '2001:db8::1' })).toBe('2001:db8::1');
  });

  it('sin la cabecera, o con un valor que no es una IP, se usa la lógica de siempre (X-Forwarded-For con trustProxy)', async () => {
    montar('fly-client-ip');
    expect(await ip({ 'x-forwarded-for': '198.51.100.1' })).toBe('198.51.100.1');
    expect(await ip({ 'fly-client-ip': 'no-soy-una-ip', 'x-forwarded-for': '198.51.100.1' })).toBe('198.51.100.1');
    expect(await ip({})).toBe(PROXY);
  });

  it('sin configurar, Fly-Client-IP se ignora (fuera de Fly cualquiera podría escribirla)', async () => {
    montar(null);
    expect(await ip({ 'fly-client-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' })).toBe('198.51.100.1');
  });

  it('los topes por IP del asistente no se comparten entre clientes que llegan por el mismo proxy', async () => {
    montar('fly-client-ip');
    for (let i = 0; i < 20; i++) expect((await asistente({ 'fly-client-ip': '203.0.113.1' })).statusCode).toBe(200);
    expect((await asistente({ 'fly-client-ip': '203.0.113.1' })).statusCode).toBe(429);
    expect((await asistente({ 'fly-client-ip': '203.0.113.2' })).statusCode).toBe(200);
  });

  it('el bloqueo de /admin/clave es por cliente: 5 fallos de uno no bloquean al dueño', async () => {
    montar('fly-client-ip');
    for (let i = 0; i < 5; i++) expect((await intentoAdmin({ 'fly-client-ip': '203.0.113.66' })).statusCode).toBe(401);
    expect((await intentoAdmin({ 'fly-client-ip': '203.0.113.66' })).statusCode).toBe(429);
    expect((await intentoAdmin({ 'fly-client-ip': '203.0.113.10' })).statusCode).toBe(401);
  });
});

describe('configuración de CABECERA_IP_CLIENTE', () => {
  const base = { RIOT_API_KEY: 'k' };
  it('se lee en minúsculas; «no» la desactiva; un nombre raro es un error', () => {
    expect(leerConfiguracion({ ...base, CABECERA_IP_CLIENTE: 'Fly-Client-IP' }).cabeceraIpCliente).toBe('fly-client-ip');
    expect(leerConfiguracion({ ...base, CABECERA_IP_CLIENTE: 'no', FLY_APP_NAME: 'a', TRUST_PROXY: '1' }).cabeceraIpCliente).toBeNull();
    expect(() => leerConfiguracion({ ...base, CABECERA_IP_CLIENTE: 'x y' })).toThrow('CABECERA_IP_CLIENTE');
  });
  it('sin la variable: fly-client-ip solo en Fly.io (FLY_APP_NAME) y con TRUST_PROXY; si no, ninguna', () => {
    expect(leerConfiguracion({ ...base, FLY_APP_NAME: 'coachlolia-api', TRUST_PROXY: '1' }).cabeceraIpCliente).toBe('fly-client-ip');
    expect(leerConfiguracion({ ...base, TRUST_PROXY: '1' }).cabeceraIpCliente).toBeNull();
    expect(leerConfiguracion({ ...base, FLY_APP_NAME: 'coachlolia-api' }).cabeceraIpCliente).toBeNull();
    expect(leerConfiguracion(base).cabeceraIpCliente).toBeNull();
  });
});
