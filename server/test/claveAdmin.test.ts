import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { cifrar, crearAlmacenClave, descifrar, registrarAdminClave } from '../src/riot/claveAdmin';
import { crearRiotApi } from '../src/riot/riotApi';

const ADMIN = 'una-contrasena-de-administrador-larga';
const NUEVA = 'RGAPI-12345678-1234-1234-1234-123456789abc';
const formulario = (o: Record<string, string>) => ({
  method: 'POST' as const,
  url: '/admin/clave',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  payload: new URLSearchParams(o).toString(),
});

describe('3.9.1: renovar la clave de Riot desde /admin/clave', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    db.cerrar();
    vi.restoreAllMocks();
  });

  function montar(comprobar = async (_c: string) => 200 as number | null) {
    const almacen = crearAlmacenClave(db, 'RGAPI-entorno', ADMIN);
    const alGuardar = vi.fn();
    const app = Fastify();
    registrarAdminClave(app, { almacen, admin: ADMIN, comprobar, alGuardar });
    return { app, almacen, alGuardar };
  }

  it('cifra y descifra; con otra contraseña no se puede leer', () => {
    const c = cifrar(NUEVA, ADMIN);
    expect(c).not.toContain('RGAPI');
    expect(descifrar(c, ADMIN)).toBe(NUEVA);
    expect(descifrar(c, 'otra-contrasena-distinta-y-larga')).toBeNull();
  });

  it('sin ADMIN_TOKEN la página no existe', async () => {
    const app = Fastify();
    registrarAdminClave(app, { almacen: crearAlmacenClave(db, 'x', null), admin: null, comprobar: async () => 200 });
    expect((await app.inject({ method: 'GET', url: '/admin/clave' })).statusCode).toBe(404);
  });

  it('enseña el formulario sin datos y sin caché', async () => {
    const { app } = montar();
    const r = await app.inject({ method: 'GET', url: '/admin/clave' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('<form method="post"');
    expect(r.body).not.toContain('RGAPI-entorno');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toContain('noindex');
  });

  it('con la contraseña correcta y una clave que Riot acepta, la guarda y la usa al momento', async () => {
    const { app, almacen, alGuardar } = montar();
    const r = await app.inject(formulario({ clave: NUEVA, token: ADMIN }));
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Clave guardada');
    expect(r.body).not.toContain(NUEVA);
    expect(almacen.actual()).toBe(NUEVA);
    expect(alGuardar).toHaveBeenCalled();
    // Tras reiniciar el servidor sigue usándola (guardada cifrada en la base).
    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN).actual()).toBe(NUEVA);
    const fila = db.sql.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'riot_api_key_cifrada'").get() as { valor: string };
    expect(fila.valor).not.toContain('RGAPI');
  });

  it('rechaza contraseña incorrecta, claves mal formadas y claves que Riot no acepta', async () => {
    const { app, almacen } = montar(async () => 401);
    expect((await app.inject(formulario({ clave: NUEVA, token: 'mal' }))).statusCode).toBe(401);
    expect((await app.inject(formulario({ clave: 'hola', token: ADMIN }))).statusCode).toBe(400);
    expect((await app.inject(formulario({ clave: NUEVA, token: ADMIN }))).statusCode).toBe(400);
    expect(almacen.actual()).toBe('RGAPI-entorno');
  });

  it('bloquea tras 5 contraseñas incorrectas en 15 minutos', async () => {
    const { app } = montar();
    for (let i = 0; i < 5; i++) await app.inject(formulario({ clave: NUEVA, token: 'mal' }));
    expect((await app.inject(formulario({ clave: NUEVA, token: ADMIN }))).statusCode).toBe(429);
  });

  it('la API de Riot usa la clave nueva sin reiniciar y comprueba la candidata sin tocar el estado', async () => {
    const almacen = crearAlmacenClave(db, 'RGAPI-entorno', ADMIN);
    const usadas: string[] = [];
    const alResponder = vi.fn();
    const api = crearRiotApi({
      clave: () => almacen.actual(),
      alResponder,
      fetch: (async (_u: string, init: RequestInit) => {
        usadas.push((init.headers as Record<string, string>)['X-Riot-Token']!);
        return new Response('[]', { status: 200 });
      }) as unknown as typeof fetch,
    });
    await api.comprobarClave();
    almacen.guardar(NUEVA);
    await api.comprobarClave();
    await api.comprobarClave('RGAPI-candidata');
    expect(usadas).toEqual(['RGAPI-entorno', NUEVA, 'RGAPI-candidata']);
    expect(alResponder).toHaveBeenCalledTimes(2);
  });
});
