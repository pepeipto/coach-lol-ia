import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { IDEAS_MAX_DIA, leerIdeas } from '../src/panel/ideas';
import { leerPublicacion, limpiarHashtags } from '../src/panel/publicaciones';
import { registrarPanel } from '../src/panel/rutas';
import { crearTwitch, type PanelTwitch } from '../src/panel/twitch';

const ADMIN = 'una-contrasena-de-administrador-larga';
const AHORA = Date.parse('2026-11-05T12:00:00Z');
const CLIP = 'https://clips.twitch.tv/PentakillDeJinx';
const form = (url: string, o: Record<string, string>, cookie?: string) => ({
  method: 'POST' as const,
  url,
  headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  payload: new URLSearchParams(o).toString(),
});
const bearer = { authorization: `Bearer ${ADMIN}` };

const TWITCH_OK: PanelTwitch = {
  estado: 'ok',
  canal: 'crazylovers',
  nombre: 'CrazyLovers',
  enDirecto: true,
  titulo: 'Probando el coach con IA',
  juego: 'League of Legends',
  espectadores: 42,
  desde: '2026-11-05T10:30:00Z',
  clips: [{ id: 'a', url: CLIP, titulo: 'Pentakill de Jinx', vistas: 120, creado: '2026-11-04T20:00:00Z', segundos: 28, miniatura: '' }],
  videos: [{ url: 'https://www.twitch.tv/videos/1', titulo: 'Directo de ayer', vistas: 300, creado: '2026-11-04T18:00:00Z', duracion: '3h2m' }],
  consultado: '2026-11-05T12:00:00Z',
};

describe('publicaciones: lectura de datos', () => {
  it('limpia hashtags y descarta duplicados', () => {
    expect(limpiarHashtags('#LoL lol, #Coach-LoL  ##ia')).toBe('#lol #coachlol #ia');
    expect(limpiarHashtags(['#a', 'b'])).toBe('#a #b');
  });

  it('desde la API o la IA nunca entra aprobada ni publicada', () => {
    const p = leerPublicacion({ gancho: 'Hola', estado: 'aprobado' }, 'api');
    expect(typeof p !== 'string' && p.estado).toBe('idea');
    const q = leerPublicacion({ gancho: 'Hola', estado: 'aprobado' }, 'panel');
    expect(typeof q !== 'string' && q.estado).toBe('aprobado');
  });

  it('rechaza sin gancho, plataforma desconocida u origen que no es https', () => {
    expect(leerPublicacion({ gancho: ' ' }, 'panel')).toMatch(/gancho/);
    expect(leerPublicacion({ gancho: 'x', plataforma: 'myspace' }, 'panel')).toMatch(/plataforma/);
    expect(leerPublicacion({ gancho: 'x', origen: 'http://clips.twitch.tv/a' }, 'panel')).toMatch(/https/);
  });

  it('de la IA solo acepta como material los clips que se le pasaron', () => {
    const salida = JSON.stringify({
      ideas: [
        { plataforma: 'tiktok', gancho: 'Pentakill sin mirar', texto: 't', guion: 'g', hashtags: ['lol'], origen: CLIP },
        { plataforma: 'tiktok', gancho: 'Inventado', texto: 't', guion: 'g', hashtags: [], origen: 'https://clips.twitch.tv/otro' },
        { plataforma: 'tiktok', gancho: '', texto: 't', guion: 'g', hashtags: [], origen: '' },
      ],
    });
    const ideas = leerIdeas(salida, { clips: TWITCH_OK.estado === 'ok' ? TWITCH_OK.clips : [], tiktok: [], cola: [] });
    expect(ideas).toHaveLength(2);
    expect(ideas[0]!.origen).toBe(CLIP);
    expect(ideas[1]!.origen).toBeNull();
    expect(ideas.every((i) => i.estado === 'idea' && i.autor === 'ia')).toBe(true);
    expect(leerIdeas('no es json', { clips: [], tiktok: [], cola: [] })).toEqual([]);
  });
});

describe('Twitch con la API Helix', () => {
  it('sin credenciales queda sin configurar', async () => {
    expect(await crearTwitch(null, 'crazylovers').consultar()).toEqual({ estado: 'sin_configurar', canal: 'crazylovers' });
  });

  it('pide un token de aplicación y junta directo, clips y directos guardados, con caché', async () => {
    const llamadas: string[] = [];
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      llamadas.push(u.replace(/\?.*$/, ''));
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (u.startsWith('https://id.twitch.tv/')) return json({ access_token: 'tok', expires_in: 3600 });
      if (u.includes('/users?')) return json({ data: [{ id: '99', display_name: 'CrazyLovers' }] });
      if (u.includes('/streams?')) return json({ data: [{ title: 'En directo', game_name: 'League of Legends', viewer_count: 7, started_at: '2026-11-05T11:00:00Z' }] });
      if (u.includes('/channels?')) return json({ data: [{ title: 'Canal', game_name: 'LoL' }] });
      if (u.includes('/clips?')) return json({ data: [{ id: 'c1', url: 'https://clips.twitch.tv/a', title: 'Poco', view_count: 3, created_at: '2026-11-01T00:00:00Z', duration: 20.4, thumbnail_url: '' }, { id: 'c2', url: 'https://clips.twitch.tv/b', title: 'Mucho', view_count: 30, created_at: '2026-11-02T00:00:00Z', duration: 15, thumbnail_url: '' }] });
      if (u.includes('/videos?')) return json({ data: [] });
      return new Response('', { status: 404 });
    });
    const tw = crearTwitch({ clientId: 'id', secreto: 's', canal: 'crazylovers', fetch: f as unknown as typeof fetch, ahora: () => AHORA }, 'crazylovers');
    const r = await tw.consultar();
    expect(r.estado).toBe('ok');
    if (r.estado !== 'ok') return;
    expect(r.enDirecto).toBe(true);
    expect(r.espectadores).toBe(7);
    expect(r.titulo).toBe('En directo');
    expect(r.clips.map((c) => c.titulo)).toEqual(['Mucho', 'Poco']);
    const n = f.mock.calls.length;
    await tw.consultar();
    expect(f.mock.calls.length).toBe(n);
    expect(llamadas.filter((l) => l.startsWith('https://id.twitch.tv/'))).toHaveLength(1);
  });

  it('con credenciales malas da un error legible y no lanza', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 403 }));
    const r = await crearTwitch({ clientId: 'id', secreto: 's', canal: 'x_y', fetch: f as unknown as typeof fetch }, 'x_y').consultar();
    expect(r).toMatchObject({ estado: 'error', mensaje: expect.stringMatching(/TWITCH_CLIENT_ID/) });
  });
});

describe('panel: Twitch y cola de publicaciones', () => {
  let db: Db;
  let ahora: number;
  let crear: ReturnType<typeof vi.fn>;
  const montar = (conIa = true) => {
    const a = Fastify();
    registrarPanel(a, {
      db,
      admin: ADMIN,
      ahora: () => ahora,
      descargas: async () => 0,
      twitch: { consultar: async () => TWITCH_OK },
      ia: conIa ? { crear: crear as never, modelo: 'claude-sonnet-5-5' } : null,
    });
    return a;
  };
  const entrar = async (a: ReturnType<typeof montar>) => {
    const r = await a.inject(form('/admin/panel/entrar', { token: ADMIN }));
    return String(r.headers['set-cookie']).split(';')[0]!;
  };
  const panel = async (a: ReturnType<typeof montar>, cookie: string) => (await a.inject({ method: 'GET', url: '/admin/panel', headers: { cookie } })).body;
  beforeEach(() => {
    db = abrirDb(':memory:');
    ahora = AHORA;
    crear = vi.fn(async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ ideas: [{ plataforma: 'tiktok', gancho: 'El coach me avisó del Barón', texto: 'Caption', guion: '0-2 s: gancho', hashtags: ['lol', 'coachlol'], origen: CLIP }] }) }],
    }));
  });
  afterEach(() => db.cerrar());

  it('enseña el directo, los clips y el botón para hacer un reel', async () => {
    const a = montar();
    const p = await panel(a, await entrar(a));
    expect(p).toContain('EN DIRECTO');
    expect(p).toContain('Probando el coach con IA');
    expect(p).toContain('Pentakill de Jinx');
    expect(p).toContain('Hacer reel');
    expect(p).toContain('Proponer ideas');
  });

  it('flujo completo: reel desde un clip, preparar, aprobar y publicar con enlace', async () => {
    const a = montar();
    const cookie = await entrar(a);
    await a.inject(form('/admin/panel/publicaciones', { plataforma: 'tiktok', estado: 'idea', gancho: 'Pentakill de <Jinx>', origen: CLIP, hashtags: '#lol' }, cookie));
    let p = await panel(a, cookie);
    expect(p).toContain('Pentakill de &lt;Jinx&gt;');
    const id = (db.sql.prepare('SELECT id FROM publicaciones').get() as { id: number }).id;
    await a.inject(form('/admin/panel/publicaciones/estado', { id: String(id), estado: 'aprobado' }, cookie));
    // Sin enlace no se puede marcar como publicada.
    const r = await a.inject(form('/admin/panel/publicaciones/estado', { id: String(id), estado: 'publicado' }, cookie));
    expect(decodeURIComponent(String(r.headers.location))).toMatch(/enlace/);
    await a.inject(form('/admin/panel/publicaciones/estado', { id: String(id), estado: 'publicado', enlace: 'https://www.tiktok.com/@coachlolia/video/1' }, cookie));
    p = await panel(a, cookie);
    expect(p).toContain('Publicadas y descartadas (1)');
    expect(p).toContain('https://www.tiktok.com/@coachlolia/video/1');
  });

  it('las ideas con IA entran como idea y respetan el tope diario', async () => {
    const a = montar();
    const cookie = await entrar(a);
    const r = await a.inject(form('/admin/panel/ideas', {}, cookie));
    expect(decodeURIComponent(String(r.headers.location))).toMatch(/1 ideas nuevas/);
    const fila = db.sql.prepare('SELECT estado, autor, origen FROM publicaciones').get();
    expect(fila).toEqual({ estado: 'idea', autor: 'ia', origen: CLIP });
    // El mensaje a la IA lleva los clips de Twitch.
    expect(JSON.stringify(crear.mock.calls[0]![0])).toContain(CLIP);
    for (let i = 1; i < IDEAS_MAX_DIA; i++) await a.inject(form('/admin/panel/ideas', {}, cookie));
    const tope = await a.inject(form('/admin/panel/ideas', {}, cookie));
    expect(decodeURIComponent(String(tope.headers.location))).toMatch(/Mañana/);
    expect(crear).toHaveBeenCalledTimes(IDEAS_MAX_DIA);
  });

  it('sin IA no hay botón ni se llama a nada', async () => {
    const a = montar(false);
    const cookie = await entrar(a);
    expect(await panel(a, cookie)).not.toContain('Proponer ideas</button>');
    await a.inject(form('/admin/panel/ideas', {}, cookie));
    expect(crear).not.toHaveBeenCalled();
  });

  it('API con Bearer: deja ideas (nunca aprobadas) y lista por estado; sin contraseña, 401', async () => {
    const a = montar();
    expect((await a.inject({ method: 'GET', url: '/admin/panel/api/publicaciones' })).statusCode).toBe(401);
    const r = await a.inject({ method: 'POST', url: '/admin/panel/api/publicaciones', headers: bearer, payload: { gancho: 'Desde Claude', estado: 'aprobado', origen: CLIP } });
    expect(r.statusCode).toBe(201);
    const id = r.json().id as number;
    const ideas = await a.inject({ method: 'GET', url: '/admin/panel/api/publicaciones?estado=idea', headers: bearer });
    expect(ideas.json().publicaciones).toHaveLength(1);
    expect((await a.inject({ method: 'GET', url: '/admin/panel/api/publicaciones?estado=aprobado', headers: bearer })).json().publicaciones).toHaveLength(0);
    expect((await a.inject({ method: 'POST', url: '/admin/panel/api/publicaciones', headers: bearer, payload: { gancho: '' } })).statusCode).toBe(400);
    const listo = await a.inject({ method: 'POST', url: '/admin/panel/api/publicaciones/preparado', headers: bearer, payload: { id, archivo: 'reel-1.mp4' } });
    expect(listo.statusCode).toBe(204);
    expect((db.sql.prepare('SELECT nota FROM publicaciones WHERE id = ?').get(id) as { nota: string }).nota).toBe('Vídeo listo: reel-1.mp4');
  });

  it('el JSON del panel incluye Twitch y la cola', async () => {
    const a = montar();
    const d = (await a.inject({ method: 'GET', url: '/admin/panel/datos', headers: bearer })).json();
    expect(d.twitch.estado).toBe('ok');
    expect(d.publicaciones).toEqual([]);
    expect(d.ideas).toEqual({ disponible: true, quedanHoy: IDEAS_MAX_DIA });
  });

  it('los formularios de la cola exigen sesión', async () => {
    const a = montar();
    expect((await a.inject(form('/admin/panel/publicaciones', { gancho: 'x' }))).statusCode).toBe(401);
    expect((await a.inject(form('/admin/panel/ideas', {}))).statusCode).toBe(401);
  });

  it('se recarga sola cada 2 minutos salvo en pausa', async () => {
    const a = montar();
    const cookie = await entrar(a);
    expect(await panel(a, cookie)).toContain('<meta http-equiv="refresh" content="120;url=/admin/panel">');
    const pausa = (await a.inject({ method: 'GET', url: '/admin/panel?auto=0', headers: { cookie } })).body;
    expect(pausa).not.toContain('http-equiv="refresh"');
    expect(pausa).toContain('reanudar');
  });
});
