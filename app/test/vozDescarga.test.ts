import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { CacheDisco, CacheMemoria, deserializar, serializar } from '../src/main/voz/cacheVoz';
import { descargarConReanudacion, descargarUnaVez, ErrorDescarga, instalarPaquete, paqueteInstalado, type FetchMinimo } from '../src/main/voz/descarga';
import { escribirTar, extraerTar, nombreSeguro } from '../src/main/voz/tar';

const tmp = () => mkdtempSync(join(tmpdir(), 'coach-voz-'));
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Servidor falso: admite Range (o no) y puede cortar la respuesta a mitad. */
function servidor(datos: Buffer, o: { range?: boolean; cortarEn?: number; fallarVeces?: number } = {}) {
  const peticiones: Record<string, string>[] = [];
  let fallos = o.fallarVeces ?? 0;
  const f: FetchMinimo = async (_url, init) => {
    peticiones.push(init.headers);
    if (fallos-- > 0) throw new Error('ECONNRESET');
    const m = /bytes=(\d+)-/.exec(init.headers.Range ?? '');
    const desde = m && o.range !== false ? Number(m[1]) : 0;
    let cuerpo = datos.subarray(desde);
    const cortar = o.cortarEn;
    if (cortar !== undefined) {
      o.cortarEn = undefined;
      cuerpo = cuerpo.subarray(0, cortar);
    }
    const parcial = desde > 0;
    return {
      status: parcial ? 206 : 200,
      headers: { get: (n: string) => (n === 'content-range' && parcial ? `bytes ${desde}-${datos.length - 1}/${datos.length}` : n === 'content-length' ? String(cuerpo.length) : null) },
      body: new Blob([new Uint8Array(cuerpo)]).stream() as ReadableStream<Uint8Array>,
    };
  };
  return { f, peticiones };
}

describe('tar de los paquetes de voz', () => {
  it('ida y vuelta con carpetas', () => {
    const dir = tmp();
    const tar = join(dir, 'p.tar');
    writeFileSync(tar, escribirTar([{ nombre: 'a.txt', datos: Buffer.from('hola') }, { nombre: 'voice_styles/M1.json', datos: Buffer.alloc(1000, 7) }]));
    const extraidos = extraerTar(tar, join(dir, 'x'));
    expect(extraidos.sort()).toEqual(['a.txt', 'voice_styles/M1.json']);
    expect(readFileSync(join(dir, 'x', 'voice_styles', 'M1.json')).length).toBe(1000);
  });

  it('rechaza nombres peligrosos y cabeceras dañadas', () => {
    expect(nombreSeguro('../fuera')).toBe(false);
    expect(nombreSeguro('C:/x')).toBe(false);
    expect(() => escribirTar([{ nombre: '../x', datos: Buffer.alloc(1) }])).toThrow();
    const dir = tmp();
    const t = escribirTar([{ nombre: 'a.txt', datos: Buffer.from('x') }]);
    t[0] = 'b'.charCodeAt(0); // la suma de la cabecera ya no cuadra
    writeFileSync(join(dir, 'm.tar'), t);
    expect(() => extraerTar(join(dir, 'm.tar'), join(dir, 'y'))).toThrow(/dañado/);
  });
});

describe('descarga reanudable con SHA-256', () => {
  const datos = Buffer.from(Array.from({ length: 50_000 }, (_, i) => i % 251));

  it('descarga entera, comprueba la suma y renombra', async () => {
    const dir = tmp();
    const { f } = servidor(datos);
    const progreso = vi.fn();
    await descargarUnaVez({ url: 'u', destino: join(dir, 'p.tgz'), bytes: datos.length, sha256: sha(datos), fetch: f, alProgreso: progreso });
    expect(readFileSync(join(dir, 'p.tgz')).equals(datos)).toBe(true);
    expect(existsSync(join(dir, 'p.tgz.parcial'))).toBe(false);
    expect(progreso).toHaveBeenLastCalledWith(datos.length, datos.length);
  });

  it('se corta a mitad y la siguiente vez continúa con Range', async () => {
    const dir = tmp();
    const s = servidor(datos, { cortarEn: 20_000 });
    const o = { url: 'u', destino: join(dir, 'p.tgz'), bytes: datos.length, sha256: sha(datos), fetch: s.f };
    await expect(descargarUnaVez(o)).rejects.toMatchObject({ codigo: 'incompleta' });
    expect(statSync(join(dir, 'p.tgz.parcial')).size).toBe(20_000);
    await descargarUnaVez(o);
    expect(s.peticiones[1]).toEqual({ Range: 'bytes=20000-' });
    expect(readFileSync(join(dir, 'p.tgz')).equals(datos)).toBe(true);
  });

  it('si el servidor no admite Range, empieza de cero', async () => {
    const dir = tmp();
    writeFileSync(join(dir, 'p.tgz.parcial'), datos.subarray(0, 1000));
    const s = servidor(datos, { range: false });
    await descargarUnaVez({ url: 'u', destino: join(dir, 'p.tgz'), bytes: datos.length, sha256: sha(datos), fetch: s.f });
    expect(readFileSync(join(dir, 'p.tgz')).equals(datos)).toBe(true);
  });

  it('una suma que no coincide borra lo descargado y no se reintenta', async () => {
    const dir = tmp();
    const s = servidor(datos);
    const espera = vi.fn(async () => {});
    await expect(
      descargarConReanudacion({ url: 'u', destino: join(dir, 'p.tgz'), bytes: datos.length, sha256: 'f'.repeat(64), fetch: s.f }, { espera }),
    ).rejects.toMatchObject({ codigo: 'checksum' });
    expect(existsSync(join(dir, 'p.tgz.parcial'))).toBe(false);
    expect(s.peticiones).toHaveLength(1);
    expect(espera).not.toHaveBeenCalled();
  });

  it('reintenta los fallos de red y los cortes, continuando donde se quedó', async () => {
    const dir = tmp();
    const s = servidor(datos, { fallarVeces: 2 });
    const espera = vi.fn(async () => {});
    await descargarConReanudacion({ url: 'u', destino: join(dir, 'p.tgz'), bytes: datos.length, sha256: sha(datos), fetch: s.f }, { espera });
    expect(espera).toHaveBeenCalledTimes(2);
    expect(readFileSync(join(dir, 'p.tgz')).equals(datos)).toBe(true);
  });

  it('cancelar aborta sin borrar lo bajado', async () => {
    const dir = tmp();
    const control = new AbortController();
    control.abort();
    const f: FetchMinimo = async () => {
      throw new Error('aborted');
    };
    await expect(descargarConReanudacion({ url: 'u', destino: join(dir, 'p.tgz'), bytes: 10, sha256: 'a', fetch: f, senal: control.signal })).rejects.toBeInstanceOf(
      ErrorDescarga,
    );
  });

  it('instala el .tar.gz de forma atómica y lo marca', async () => {
    const dir = tmp();
    const tgz = gzipSync(escribirTar([{ nombre: 'a.onnx', datos: Buffer.from('m') }]));
    writeFileSync(join(dir, 'p.tar.gz'), tgz);
    const final = await instalarPaquete(join(dir, 'p.tar.gz'), dir, 'pq', 'suma', ['a.onnx']);
    expect(readFileSync(join(final, 'a.onnx'), 'utf8')).toBe('m');
    expect(paqueteInstalado(dir, 'pq', 'suma', ['a.onnx'])).toBe(final);
    expect(paqueteInstalado(dir, 'pq', 'otra', ['a.onnx'])).toBeNull();
    // Un paquete al que le falta un archivo requerido no se instala.
    writeFileSync(join(dir, 'q.tar.gz'), tgz);
    await expect(instalarPaquete(join(dir, 'q.tar.gz'), dir, 'q', 's', ['falta.onnx'])).rejects.toMatchObject({ codigo: 'paquete' });
    expect(existsSync(join(dir, 'q'))).toBe(false);
  });
});

describe('caché de frases', () => {
  const audio = (n: number) => ({ sampleRate: 24000, pcm: new Uint8Array(n) });

  it('memoria LRU por bytes', () => {
    const c = new CacheMemoria(100);
    c.guardar('a', audio(40));
    c.guardar('b', audio(40));
    c.obtener('a'); // a pasa a ser la más reciente
    c.guardar('c', audio(40));
    expect(c.obtener('b')).toBeUndefined();
    expect(c.obtener('a')).toBeDefined();
    expect(c.ocupados).toBeLessThanOrEqual(100);
  });

  it('disco: guarda, lee y recorta los menos usados', () => {
    const dir = tmp();
    const c = new CacheDisco(dir, 2500);
    c.guardar('uno', audio(1000));
    expect(c.tiene('uno')).toBe(true);
    expect(c.obtener('uno')?.pcm.length).toBe(1000);
    c.guardar('dos', audio(1000));
    c.guardar('tres', audio(1000));
    const quedan = ['uno', 'dos', 'tres'].filter((k) => c.tiene(k));
    expect(quedan.length).toBe(2);
  });

  it('serializa con cabecera y rechaza basura', () => {
    const b = serializar({ sampleRate: 44100, pcm: Uint8Array.of(1, 2, 3, 4) });
    expect(deserializar(b)).toEqual({ sampleRate: 44100, pcm: Uint8Array.of(1, 2, 3, 4) });
    expect(deserializar(Buffer.from('basura'))).toBeNull();
  });
});
