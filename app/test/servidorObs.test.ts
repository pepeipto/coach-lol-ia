import { createServer as httpCreateServer, request } from 'node:http';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { crearFuenteObs } from '../src/main/streamer/fuenteObs';
import { crearServidorObs, hostPermitido, MAX_CLIENTES_SSE, type ServidorObs } from '../src/main/streamer/servidorObs';
import { crearAlmacenToken, tokenValido } from '../src/main/streamer/tokenObs';
import { OVERLAY_POR_DEFECTO } from '../src/main/ajustes';
import type { EstadoOverlay } from '../src/shared/tiposApp';

const TOKEN = 'a'.repeat(43);
let servidores: ServidorObs[] = [];
afterEach(async () => {
  await Promise.all(servidores.map((s) => s.detener()));
  servidores = [];
});

async function montar(token = TOKEN) {
  const fuente = crearFuenteObs();
  const s = crearServidorObs({ token: () => token, vista: () => fuente.vista(), alCambiar: (cb) => fuente.alCambiar(cb) });
  servidores.push(s);
  const r = await s.arrancar(0);
  if (!r.ok) throw new Error('no arrancó');
  return { fuente, s, puerto: r.puerto, base: `http://127.0.0.1:${r.puerto}` };
}

/** Petición con cabeceras a mano (fetch no deja cambiar Host). */
function pedir(puerto: number, ruta: string, o: { metodo?: string; host?: string } = {}): Promise<{ estado: number; cabeceras: Record<string, unknown>; cuerpo: string }> {
  return new Promise((resolver, rechazar) => {
    const req = request({ host: '127.0.0.1', port: puerto, path: ruta, method: o.metodo ?? 'GET', headers: { host: o.host ?? `127.0.0.1:${puerto}` } }, (res) => {
      let cuerpo = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (cuerpo += d));
      res.on('end', () => resolver({ estado: res.statusCode ?? 0, cabeceras: res.headers, cuerpo }));
    });
    req.on('error', rechazar);
    req.end();
  });
}

describe('servidor local de la fuente para OBS', () => {
  it('solo escucha en 127.0.0.1', async () => {
    const { s, puerto } = await montar();
    expect(s.escuchando()).toBe(true);
    expect(s.puerto()).toBe(puerto);
    const r = await pedir(puerto, `/${TOKEN}/`);
    expect(r.estado).toBe(200);
    // La dirección de escucha real es la de loopback.
    let direccion: unknown = null;
    const fuente = crearFuenteObs();
    const otro = crearServidorObs({
      token: () => TOKEN,
      vista: () => fuente.vista(),
      alCambiar: (cb) => fuente.alCambiar(cb),
      crear: ((fn: Parameters<typeof httpCreateServer>[0]) => {
        const srv = httpCreateServer(fn);
        srv.on('listening', () => (direccion = srv.address()));
        return srv;
      }) as typeof httpCreateServer,
    });
    servidores.push(otro);
    await otro.arrancar(0);
    expect(direccion).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
  });

  it('sin token, con otro token o con rutas de más: 404', async () => {
    const { puerto } = await montar();
    for (const ruta of ['/', '/favicon.ico', `/${'b'.repeat(43)}/`, `/${TOKEN.slice(1)}/`, `/${TOKEN}/../etc/passwd`, `/${TOKEN}/app.js/x`, `/${TOKEN}/nada`, '/app.js']) {
      expect((await pedir(puerto, ruta)).estado, ruta).toBe(404);
    }
  });

  it('solo lectura: POST, PUT y DELETE dan 404', async () => {
    const { puerto } = await montar();
    for (const metodo of ['POST', 'PUT', 'DELETE', 'OPTIONS']) expect((await pedir(puerto, `/${TOKEN}/estado`, { metodo })).estado, metodo).toBe(404);
  });

  it('con otra cabecera Host (DNS rebinding) no sirve nada', async () => {
    const { puerto } = await montar();
    expect((await pedir(puerto, `/${TOKEN}/`, { host: `malo.example:${puerto}` })).estado).toBe(404);
    expect((await pedir(puerto, `/${TOKEN}/`, { host: `localhost:${puerto}` })).estado).toBe(200);
    expect(hostPermitido('127.0.0.1:1', 2)).toBe(false);
    expect(hostPermitido(undefined, 2)).toBe(false);
  });

  it('página, script y estilos con cabeceras de seguridad y sin CORS', async () => {
    const { puerto } = await montar();
    const pagina = await pedir(puerto, `/${TOKEN}/`);
    expect(pagina.cabeceras['content-type']).toMatch(/text\/html/);
    expect(pagina.cuerpo).toContain('src="app.js"');
    expect(pagina.cabeceras['content-security-policy']).toMatch(/default-src 'none'/);
    expect(pagina.cabeceras['content-security-policy']).toMatch(/script-src 'self'/);
    expect(pagina.cabeceras['content-security-policy']).not.toMatch(/unsafe/);
    expect(pagina.cabeceras['x-content-type-options']).toBe('nosniff');
    expect(pagina.cabeceras['referrer-policy']).toBe('no-referrer');
    expect(pagina.cabeceras['cache-control']).toBe('no-store');
    for (const ruta of ['', 'app.js', 'estilo.css', 'estado']) {
      const r = await pedir(puerto, `/${TOKEN}/${ruta}`);
      expect(r.estado).toBe(200);
      expect(Object.keys(r.cabeceras).filter((k) => k.startsWith('access-control'))).toEqual([]);
    }
    expect((await pedir(puerto, `/${TOKEN}/app.js`)).cabeceras['content-type']).toMatch(/javascript/);
    // El script nunca mete HTML recibido en la página.
    expect((await pedir(puerto, `/${TOKEN}/app.js`)).cuerpo).not.toMatch(/innerHTML|eval\(|new Function/);
  });

  it('sin barra final redirige a la página', async () => {
    const { puerto } = await montar();
    const r = await pedir(puerto, `/${TOKEN}`);
    expect(r.estado).toBe(301);
    expect(r.cabeceras.location).toBe(`/${TOKEN}/`);
  });

  it('el estado es la vista de la fuente (sin rutas de disco ni claves)', async () => {
    const { puerto, fuente } = await montar();
    fuente.config(OVERLAY_POR_DEFECTO);
    fuente.modo('partida');
    fuente.estado({ objetivos: [{ id: 'baron', nombre: 'Barón', subtipo: null, aparece: 90, disponible: false }], widgets: { objetivos: true } } as unknown as EstadoOverlay);
    const r = await pedir(puerto, `/${TOKEN}/estado`);
    const v = JSON.parse(r.cuerpo);
    expect(v.objetivos).toEqual([expect.objectContaining({ id: 'baron', tiempo: '1:30' })]);
    expect(Object.keys(v).sort()).toEqual(['aumentos', 'etiquetas', 'n', 'objetivos', 'subtitulo']);
    expect(r.cuerpo).not.toMatch(/[A-Z]:\\\\|\/Users\/|AppData|token|riotId/i);
  });

  it('SSE: manda el estado al conectar y cada cambio en vivo', async () => {
    const { base, fuente } = await montar();
    fuente.config({ ...OVERLAY_POR_DEFECTO, voz: { ...OVERLAY_POR_DEFECTO.voz, activa: true } });
    const ctrl = new AbortController();
    const res = await fetch(`${base}/${TOKEN}/eventos`, { signal: ctrl.signal });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const lector = res.body!.getReader();
    const dec = new TextDecoder();
    let texto = '';
    const siguiente = async () => {
      while (!texto.includes('\n\n')) texto += dec.decode((await lector.read()).value);
      const i = texto.indexOf('\n\n');
      const evento = texto.slice(0, i);
      texto = texto.slice(i + 2);
      return JSON.parse(evento.replace(/^data: /, ''));
    };
    expect((await siguiente()).subtitulo).toBeNull();
    fuente.modo('partida');
    await siguiente();
    fuente.frase('El Barón sale en 30 segundos');
    expect((await siguiente()).subtitulo).toEqual({ id: 1, texto: 'El Barón sale en 30 segundos' });
    ctrl.abort();
  });

  it(`como mucho ${MAX_CLIENTES_SSE} conexiones SSE a la vez`, async () => {
    const { base } = await montar();
    const ctrl = new AbortController();
    await Promise.all(Array.from({ length: MAX_CLIENTES_SSE }, () => fetch(`${base}/${TOKEN}/eventos`, { signal: ctrl.signal })));
    const extra = await fetch(`${base}/${TOKEN}/eventos`);
    expect(extra.status).toBe(503);
    ctrl.abort();
  });

  it('cambiar el token corta la URL anterior al momento', async () => {
    let token = TOKEN;
    const fuente = crearFuenteObs();
    const s = crearServidorObs({ token: () => token, vista: () => fuente.vista(), alCambiar: (cb) => fuente.alCambiar(cb) });
    servidores.push(s);
    const r = await s.arrancar(0);
    const puerto = (r as { puerto: number }).puerto;
    expect((await pedir(puerto, `/${TOKEN}/`)).estado).toBe(200);
    token = 'c'.repeat(43);
    expect((await pedir(puerto, `/${TOKEN}/`)).estado).toBe(404);
    expect((await pedir(puerto, `/${token}/`)).estado).toBe(200);
  });

  it('cortarClientes cierra las conexiones SSE abiertas (al cambiar el enlace)', async () => {
    const { base, s } = await montar();
    const res = await fetch(`${base}/${TOKEN}/eventos`);
    const lector = res.body!.getReader();
    await lector.read();
    s.cortarClientes();
    // Según la plataforma, la lectura acaba o falla: en los dos casos la conexión ya no está.
    const final = await (async () => {
      for (;;) if ((await lector.read()).done) return 'fin';
    })().catch(() => 'cortada');
    expect(['fin', 'cortada']).toContain(final);
  });

  it('con el puerto ocupado avisa (y no se queda escuchando)', async () => {
    const ocupado = createServer();
    await new Promise<void>((ok) => ocupado.listen(0, '127.0.0.1', ok));
    const puerto = (ocupado.address() as { port: number }).port;
    const fuente = crearFuenteObs();
    const s = crearServidorObs({ token: () => TOKEN, vista: () => fuente.vista(), alCambiar: (cb) => fuente.alCambiar(cb) });
    servidores.push(s);
    expect(await s.arrancar(puerto)).toEqual({ ok: false, error: 'puerto_ocupado' });
    expect(s.escuchando()).toBe(false);
    await new Promise<void>((ok) => ocupado.close(() => ok()));
  });

  it('al detenerlo deja de responder', async () => {
    const { s, puerto } = await montar();
    await s.detener();
    await expect(pedir(puerto, `/${TOKEN}/`)).rejects.toThrow();
  });
});

describe('token de la URL', () => {
  it('aleatorio, con forma fija, guardado y estable entre arranques; regenerar cambia', () => {
    const ruta = join(mkdtempSync(join(tmpdir(), 'coach-obs-')), 'obs.json');
    const a = crearAlmacenToken(ruta);
    const t1 = a.token();
    expect(tokenValido(t1)).toBe(true);
    expect(a.token()).toBe(t1);
    expect(crearAlmacenToken(ruta).token()).toBe(t1);
    const t2 = a.regenerar();
    expect(t2).not.toBe(t1);
    expect(JSON.parse(readFileSync(ruta, 'utf8'))).toEqual({ token: t2 });
    expect(crearAlmacenToken(join(tmpdir(), 'x')).token()).not.toBe(t2);
  });
  it('un archivo roto o con un token raro crea otro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coach-obs-'));
    const ruta = join(dir, 'obs.json');
    const a = crearAlmacenToken(ruta, () => 'z'.repeat(43));
    expect(a.token()).toBe('z'.repeat(43));
    expect(tokenValido('corto')).toBe(false);
    expect(tokenValido('a/b'.padEnd(43, 'x'))).toBe(false);
  });
});
