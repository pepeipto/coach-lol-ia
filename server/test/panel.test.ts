import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { registrarPanel } from '../src/panel/rutas';
import { clasificarOrigen, limpiarRuta, MAX_VISITAS_IP_DIA, registrarVisitas } from '../src/panel/visitas';
import { leerCifra, limpiarUrlTiktok } from '../src/panel/tiktok';

const ADMIN = 'una-contrasena-de-administrador-larga';
const AHORA = Date.parse('2026-11-05T12:00:00Z');
const form = (url: string, o: Record<string, string>, cookie?: string) => ({
  method: 'POST' as const,
  url,
  headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  payload: new URLSearchParams(o).toString(),
});

describe('contador anónimo de visitas de la web', () => {
  let db: Db;
  let ahora: Date;
  const app = () => {
    const a = Fastify();
    registrarVisitas(a, db, () => ahora);
    return a;
  };
  const visita = (a: ReturnType<typeof app>, cuerpo: object, ip = '1.2.3.4', ua = 'Mozilla/5.0') =>
    a.inject({ method: 'POST', url: '/api/metricas/visita', headers: { 'content-type': 'text/plain', 'user-agent': ua }, remoteAddress: ip, payload: JSON.stringify(cuerpo) });
  const contador = (evento: string) =>
    (db.sql.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM metricas_dia WHERE evento = ?').get(evento) as { n: number }).n;
  beforeEach(() => {
    db = abrirDb(':memory:');
    ahora = new Date(AHORA);
  });
  afterEach(() => db.cerrar());

  it('clasifica la procedencia por utm_source y por dominio', () => {
    expect(clasificarOrigen('', 'TikTok')).toBe('tiktok');
    expect(clasificarOrigen('https://www.tiktok.com/@x/video/1', undefined)).toBe('tiktok');
    expect(clasificarOrigen('https://www.google.es/', undefined)).toBe('google');
    expect(clasificarOrigen('https://t.co/abc', undefined)).toBe('x');
    expect(clasificarOrigen('https://www.coachlolia.com/es/', undefined)).toBe('interna');
    expect(clasificarOrigen('', undefined)).toBe('directo');
    expect(clasificarOrigen('https://ejemplo.org', undefined)).toBe('otros');
    expect(clasificarOrigen('', 'loquesea')).toBe('otros');
  });

  it('limpia la ruta y rechaza lo que no lo es', () => {
    expect(limpiarRuta('/ES/descargar/?x=1#a')).toBe('/es/descargar');
    expect(limpiarRuta('/')).toBe('/');
    expect(limpiarRuta('<script>')).toBeNull();
    expect(limpiarRuta(42)).toBeNull();
  });

  it('cuenta páginas vistas y un visitante por IP y día, con la procedencia de su primera página', async () => {
    const a = app();
    expect((await visita(a, { ruta: '/es/', ref: 'https://www.tiktok.com/' })).statusCode).toBe(204);
    await visita(a, { ruta: '/es/descargar', ref: 'https://www.coachlolia.com/es/' });
    await visita(a, { ruta: '/es/', utm: 'youtube' }, '5.6.7.8');
    expect(contador('visita')).toBe(3);
    expect(contador('visitante')).toBe(2);
    expect(contador('visitante:o:tiktok')).toBe(1);
    expect(contador('visitante:o:youtube')).toBe(1);
    expect(contador('visitante:o:interna')).toBe(0);
    expect(contador('visita:p:/es')).toBe(2);
    // No se guarda nada de la IP.
    const filas = JSON.stringify(db.sql.prepare('SELECT * FROM metricas_dia').all());
    expect(filas).not.toContain('1.2.3.4');
  });

  it('no cuenta robots, cuerpos rotos ni más de MAX_VISITAS_IP_DIA por IP', async () => {
    const a = app();
    await visita(a, { ruta: '/' }, '1.1.1.1', 'Googlebot/2.1');
    await a.inject({ method: 'POST', url: '/api/metricas/visita', headers: { 'content-type': 'text/plain' }, payload: '{roto' });
    expect(contador('visita')).toBe(0);
    for (let i = 0; i < MAX_VISITAS_IP_DIA + 3; i++) await visita(a, { ruta: '/' });
    expect(contador('visita')).toBe(MAX_VISITAS_IP_DIA);
  });

  it('cuenta clics en «Descargar» con tope por IP', async () => {
    const a = app();
    for (let i = 0; i < 5; i++) await a.inject({ method: 'POST', url: '/api/metricas/descarga' });
    expect(contador('descarga')).toBe(3);
  });
});

describe('TikTok: cifras y enlaces', () => {
  it('entiende las cifras como las muestra TikTok', () => {
    expect(leerCifra('12.345')).toBe(12345);
    expect(leerCifra('12,3 mil')).toBe(12300);
    expect(leerCifra('1.2K')).toBe(1200);
    expect(leerCifra('3M')).toBe(3_000_000);
    expect(leerCifra('')).toBe(0);
    expect(leerCifra('abc')).toBeNull();
    expect(leerCifra('-5')).toBeNull();
  });
  it('solo acepta enlaces https de tiktok.com', () => {
    expect(limpiarUrlTiktok('https://www.tiktok.com/@coach/video/123?is_from=x')).toBe('https://www.tiktok.com/@coach/video/123');
    expect(limpiarUrlTiktok('http://www.tiktok.com/@coach/video/123')).toBeNull();
    expect(limpiarUrlTiktok('https://tiktok.com.malo.es/x')).toBeNull();
    expect(limpiarUrlTiktok('javascript:alert(1)')).toBeNull();
  });
});

describe('panel privado /admin/panel', () => {
  let db: Db;
  let ahora: number;
  beforeEach(() => {
    db = abrirDb(':memory:');
    ahora = AHORA;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    db.cerrar();
    vi.restoreAllMocks();
  });
  const montar = (admin: string | null = ADMIN) => {
    const a = Fastify();
    registrarVisitas(a, db, () => new Date(ahora));
    registrarPanel(a, { db, admin, ahora: () => ahora, descargas: async () => 321 });
    return a;
  };
  const entrar = async (a: ReturnType<typeof montar>) => {
    const r = await a.inject(form('/admin/panel/entrar', { token: ADMIN }));
    expect(r.statusCode).toBe(303);
    return String(r.headers['set-cookie']).split(';')[0]!;
  };

  it('sin ADMIN_TOKEN el panel no existe', async () => {
    expect((await montar(null).inject({ method: 'GET', url: '/admin/panel' })).statusCode).toBe(404);
  });

  it('sin sesión pide la contraseña y no enseña ninguna cifra', async () => {
    const r = await montar().inject({ method: 'GET', url: '/admin/panel' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Contraseña de administrador');
    expect(r.body).not.toContain('Suscripciones activas');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toContain('Hecho con ayuda de IA');
  });

  it('con la contraseña correcta da una cookie segura y enseña el panel con los datos', async () => {
    db.sql
      .prepare("INSERT INTO licencias (clave, tipo, estado, actualizada, plan, alta, checkout_session) VALUES (?, 'suscripcion', 'activa', ?, 'mariscal', ?, 'cs_1')")
      .run('CLIA-ABCD-EFGH-JKLM-NPQR', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
    db.sql
      .prepare("INSERT INTO licencias (clave, tipo, estado, actualizada, plan, alta, checkout_session) VALUES (?, 'suscripcion', 'cancelada', ?, 'aliado', ?, 'cs_2')")
      .run('CLIA-ZZZZ-YYYY-XXXX-WWWW', '2026-10-21T00:00:00Z', '2026-10-01T00:00:00Z');
    db.sql.prepare("INSERT INTO cuotas_uso (sujeto, periodo, tipo, n) VALUES ('l:CLIA-ABCD-EFGH-JKLM-NPQR', '2026-11-01T00:00:00.000Z', 'partida', 7)").run();
    db.sql.prepare("INSERT INTO cuotas_uso (sujeto, periodo, tipo, n) VALUES ('d:abc', '2026-11-01T00:00:00.000Z', 'partida', 3)").run();
    const a = montar();
    await a.inject({ method: 'POST', url: '/api/metricas/visita', headers: { 'content-type': 'text/plain' }, payload: JSON.stringify({ ruta: '/es/', utm: 'tiktok' }) });

    const r = await a.inject(form('/admin/panel/entrar', { token: ADMIN }));
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/admin\/panel/);

    const p = await a.inject({ method: 'GET', url: '/admin/panel', headers: { cookie: cookie.split(';')[0]! } });
    expect(p.statusCode).toBe(200);
    expect(p.body).toContain('Suscripciones activas');
    expect(p.body).toContain('14,99 €'); // ingresos estimados: un Mariscal activo
    expect(p.body).toContain('CLIA-ABCD…NPQR');
    expect(p.body).not.toContain('CLIA-ABCD-EFGH-JKLM-NPQR');
    expect(p.body).toContain('20 días'); // duración de la cancelada
    expect(p.body).toContain('321'); // descargas de GitHub
    expect(p.body).toMatch(/<td>Gratis<\/td><td class="n">1<\/td><td class="n">3<\/td>/);
    expect(p.body).toMatch(/tiktok<\/span><i/);
  });

  it('con una contraseña incorrecta no entra y bloquea tras 5 intentos', async () => {
    const a = montar();
    for (let i = 0; i < 5; i++) expect((await a.inject(form('/admin/panel/entrar', { token: 'mala' }))).statusCode).toBe(401);
    expect((await a.inject(form('/admin/panel/entrar', { token: ADMIN }))).statusCode).toBe(429);
  });

  it('una cookie falsificada o caducada no vale', async () => {
    const a = montar();
    const cookie = await entrar(a);
    const falsa = cookie.replace(/\.[\w-]+$/, '.' + 'A'.repeat(43));
    expect((await a.inject({ method: 'GET', url: '/admin/panel', headers: { cookie: falsa } })).body).not.toContain('Suscripciones activas');
    ahora += 13 * 60 * 60_000;
    expect((await a.inject({ method: 'GET', url: '/admin/panel', headers: { cookie } })).body).not.toContain('Suscripciones activas');
  });

  it('guarda, actualiza y quita vídeos de TikTok, y escapa el título', async () => {
    const a = montar();
    const cookie = await entrar(a);
    const url = 'https://www.tiktok.com/@coachlolia/video/111';
    expect((await a.inject(form('/admin/panel/tiktok', { url, titulo: '<b>Hola</b>', publicado: '2026-11-01', vistas: '1,2K' }))).statusCode).toBe(401);
    expect((await a.inject(form('/admin/panel/tiktok', { url, titulo: '<b>Hola</b>', publicado: '2026-11-01', vistas: '1,2K', megusta: '80' }, cookie))).statusCode).toBe(303);
    await a.inject(form('/admin/panel/tiktok', { url: `${url}?x=1`, titulo: '<b>Hola</b>', publicado: '2026-11-01', vistas: '2.500', megusta: '100' }, cookie));
    await a.inject(form('/admin/panel/seguidores', { dia: '2026-11-05', seguidores: '1,5 mil' }, cookie));
    let p = (await a.inject({ method: 'GET', url: '/admin/panel', headers: { cookie } })).body;
    expect(p).toContain('&lt;b&gt;Hola&lt;/b&gt;');
    expect(p).not.toContain('<b>Hola</b>');
    expect(p).toContain('2.500');
    expect(p).toContain('1.500');
    await a.inject(form('/admin/panel/tiktok/borrar', { url }, cookie));
    p = (await a.inject({ method: 'GET', url: '/admin/panel', headers: { cookie } })).body;
    expect(p).toContain('Todavía no hay vídeos apuntados');
  });

  it('rechaza formularios de otra web aunque traigan la cookie', async () => {
    const a = montar();
    const cookie = await entrar(a);
    const r = await a.inject({
      ...form('/admin/panel/tiktok', { url: 'https://www.tiktok.com/@a/video/1', publicado: '2026-11-01', vistas: '1' }, cookie),
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, origin: 'https://malo.example', host: 'api.coachlolia.com' },
    });
    expect(r.statusCode).toBe(401);
  });
});
