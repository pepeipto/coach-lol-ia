import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { cifrar, crearAlmacenClave, descifrar, registrarAdminClave } from '../src/riot/claveAdmin';
import { crearRiotApi } from '../src/riot/riotApi';

const ADMIN = 'una-contrasena-de-administrador-larga';
const NUEVA = 'RGAPI-12345678-1234-1234-1234-123456789abc';
/** Misma huella que claveAdmin.ts (no exportada): para simular una clave guardada con RIOT_API_KEY dada. */
const huellaDe = (clave: string) => createHash('sha256').update(`coachlolia:huella-riot:${clave}`).digest('hex').slice(0, 16);
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

  it('cifra y descifra; con otra contraseña o con otra sal no se puede leer', () => {
    const sal = randomBytes(16);
    const c = cifrar(NUEVA, ADMIN, sal);
    expect(c).not.toContain('RGAPI');
    expect(c.startsWith('v2.')).toBe(true);
    expect(descifrar(c, ADMIN, sal)).toBe(NUEVA);
    expect(descifrar(c, 'otra-contrasena-distinta-y-larga', sal)).toBeNull();
    expect(descifrar(c, ADMIN, randomBytes(16))).toBeNull();
    expect(descifrar(c, ADMIN, null)).toBeNull();
  });

  it('seguridad: una clave guardada con el método antiguo (SHA-256 sin sal) se lee y se vuelve a guardar con scrypt', () => {
    // Formato antiguo, tal como lo escribía la 3.9.1.
    const llave = createHash('sha256').update(`coachlolia:clave-riot:${ADMIN}`).digest();
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', llave, iv);
    const datos = Buffer.concat([c.update(NUEVA, 'utf8'), c.final()]);
    const antiguo = [iv, c.getAuthTag(), datos].map((b) => b.toString('base64')).join('.');
    db.sql.prepare("INSERT INTO ajustes_servidor (clave, valor) VALUES ('riot_api_key_cifrada', ?)").run(antiguo);
    db.sql.prepare("INSERT INTO ajustes_servidor (clave, valor) VALUES ('clave_riot_entorno_huella', ?)").run(huellaDe('RGAPI-entorno'));

    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN).actual()).toBe(NUEVA);
    const fila = db.sql.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'riot_api_key_cifrada'").get() as { valor: string };
    expect(fila.valor.startsWith('v2.')).toBe(true);
    expect(fila.valor).not.toBe(antiguo);
    const sal = db.sql.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'sal_clave_riot'").get() as { valor: string };
    expect(Buffer.from(sal.valor, 'base64')).toHaveLength(16);
    // Tras otro reinicio se sigue leyendo (ya con el formato nuevo) y con otro ADMIN_TOKEN no.
    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN).actual()).toBe(NUEVA);
    expect(crearAlmacenClave(db, 'RGAPI-entorno', 'otra-contrasena-distinta-y-larga').actual()).toBe('RGAPI-entorno');
  });

  it('la clave de la página se descarta si cambia RIOT_API_KEY (el secreto de Fly.io manda)', () => {
    crearAlmacenClave(db, 'RGAPI-entorno', ADMIN).guardar(NUEVA);
    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN).actual()).toBe(NUEVA);
    // Se cambia el secreto de Fly.io: el servidor arranca con otra clave de entorno.
    const almacen = crearAlmacenClave(db, 'RGAPI-otra-de-entorno', ADMIN);
    expect(almacen.actual()).toBe('RGAPI-otra-de-entorno');
    expect(almacen.origen()).toBe('entorno');
    expect(db.sql.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'riot_api_key_cifrada'").get()).toBeUndefined();
  });

  it('una clave guardada antes de esta regla (sin huella de entorno) se descarta al arrancar', () => {
    db.sql.prepare("INSERT INTO ajustes_servidor (clave, valor) VALUES ('riot_api_key_cifrada', ?)").run(cifrar(NUEVA, ADMIN, randomBytes(16)));
    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN).actual()).toBe('RGAPI-entorno');
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

  it('desde(): se conserva al reiniciar con la misma clave y cambia al guardar otra o al arrancar con otra de entorno', () => {
    let t = 1_000;
    const reloj = () => t;
    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN, reloj).desde()).toBe(1_000);
    t = 5_000;
    // Reinicio con la misma clave: la fecha no cambia (la clave no es más nueva por reiniciar).
    const almacen = crearAlmacenClave(db, 'RGAPI-entorno', ADMIN, reloj);
    expect(almacen.desde()).toBe(1_000);
    t = 9_000;
    almacen.guardar(NUEVA);
    expect(almacen.desde()).toBe(9_000);
    t = 12_000;
    expect(crearAlmacenClave(db, 'RGAPI-entorno', ADMIN, reloj).desde()).toBe(9_000);
    // Sin la página (otra máquina, sin ADMIN_TOKEN) y otra clave de entorno: empieza a contar al arrancar.
    expect(crearAlmacenClave(db, 'RGAPI-otra-de-entorno', null, reloj).desde()).toBe(12_000);
    // Nunca se guarda la clave en claro.
    const filas = db.sql.prepare('SELECT valor FROM ajustes_servidor').all() as { valor: string }[];
    expect(JSON.stringify(filas)).not.toContain('RGAPI-');
  });
});
