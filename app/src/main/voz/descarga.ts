import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extraerTar } from './tar';

/**
 * Descarga de los paquetes de voz: reanudable (cabecera Range sobre el archivo `.parcial`), con la suma SHA-256
 * comprobada antes de instalar, y con reintentos ante fallos de red. La instalación es atómica: se extrae en una
 * carpeta temporal y solo al final se renombra y se marca con `instalado.json`.
 */

export type FetchMinimo = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal; redirect?: 'follow' }) => Promise<{
  status: number;
  headers: { get(nombre: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}>;

export type CodigoErrorDescarga = 'red' | 'checksum' | 'incompleta' | 'cancelada' | 'paquete';

export class ErrorDescarga extends Error {
  constructor(
    readonly codigo: CodigoErrorDescarga,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDescarga';
  }
}

export interface OpcionesDescarga {
  url: string;
  /** Archivo final; mientras baja se llama igual con `.parcial`. */
  destino: string;
  /** Tamaño esperado (0 si no se sabe). */
  bytes: number;
  sha256: string;
  fetch?: FetchMinimo;
  senal?: AbortSignal;
  alProgreso?(recibidos: number, total: number): void;
}

export async function sha256Archivo(ruta: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(ruta), hash);
  return hash.digest('hex');
}

const tamano = (ruta: string) => (existsSync(ruta) ? statSync(ruta).size : 0);

/** Un intento de descarga: continúa el `.parcial` si el servidor admite Range; si no, empieza de cero. */
export async function descargarUnaVez(o: OpcionesDescarga): Promise<void> {
  const parcial = `${o.destino}.parcial`;
  mkdirSync(dirname(o.destino), { recursive: true });
  let ya = tamano(parcial);
  if (o.bytes > 0 && ya > o.bytes) {
    rmSync(parcial, { force: true });
    ya = 0;
  }
  if (!(o.bytes > 0 && ya === o.bytes)) {
    const f = o.fetch ?? (globalThis.fetch as unknown as FetchMinimo);
    let res;
    try {
      res = await f(o.url, { headers: ya > 0 ? { Range: `bytes=${ya}-` } : {}, signal: o.senal, redirect: 'follow' });
    } catch (e) {
      if (o.senal?.aborted) throw new ErrorDescarga('cancelada', 'Descarga cancelada');
      throw new ErrorDescarga('red', `Sin conexión con el servidor de voces (${(e as Error).message})`);
    }
    if (res.status === 416) {
      // El servidor no tiene ese rango: el parcial no vale.
      rmSync(parcial, { force: true });
      throw new ErrorDescarga('red', 'Rango no disponible; se reinicia la descarga');
    }
    let continuar = false;
    if (res.status === 206) {
      const rango = /bytes (\d+)-/.exec(res.headers.get('content-range') ?? '');
      continuar = !!rango && Number(rango[1]) === ya;
      if (!continuar) {
        rmSync(parcial, { force: true });
        throw new ErrorDescarga('red', 'El servidor devolvió otro rango; se reinicia la descarga');
      }
    } else if (res.status !== 200) throw new ErrorDescarga('red', `El servidor de voces respondió ${res.status}`);
    if (!res.body) throw new ErrorDescarga('red', 'Respuesta sin contenido');
    const total = o.bytes || (continuar ? ya : 0) + Number(res.headers.get('content-length') ?? 0);
    let recibidos = continuar ? ya : 0;
    let ultimoAviso = 0;
    o.alProgreso?.(recibidos, total);
    const contador = new Transform({
      transform(trozo: Buffer, _c, listo) {
        recibidos += trozo.length;
        const ahora = Date.now();
        if (ahora - ultimoAviso > 200) {
          ultimoAviso = ahora;
          o.alProgreso?.(recibidos, total);
        }
        listo(null, trozo);
      },
    });
    try {
      await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream<Uint8Array>), contador, createWriteStream(parcial, { flags: continuar ? 'a' : 'w' }), {
        signal: o.senal,
      });
    } catch (e) {
      if (o.senal?.aborted) throw new ErrorDescarga('cancelada', 'Descarga cancelada');
      throw new ErrorDescarga('red', `La descarga se cortó (${(e as Error).message})`);
    }
    o.alProgreso?.(recibidos, total);
  }
  const final = tamano(parcial);
  if (o.bytes > 0 && final !== o.bytes) throw new ErrorDescarga('incompleta', `Descarga incompleta (${final} de ${o.bytes} bytes)`);
  const suma = await sha256Archivo(parcial);
  if (suma !== o.sha256.toLowerCase()) {
    // Un archivo que no cuadra no se reanuda: se borra y la próxima vez baja entero.
    rmSync(parcial, { force: true });
    throw new ErrorDescarga('checksum', 'La suma SHA-256 del paquete de voz no coincide');
  }
  renameSync(parcial, o.destino);
}

export interface OpcionesReintento {
  intentos?: number;
  espera?: (ms: number) => Promise<void>;
}

/** Descarga con reintentos (red o corte: se continúa donde se quedó). La suma incorrecta o la cancelación no se reintentan. */
export async function descargarConReanudacion(o: OpcionesDescarga, r: OpcionesReintento = {}): Promise<void> {
  const intentos = r.intentos ?? 4;
  const espera = r.espera ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  for (let i = 1; ; i++) {
    try {
      return await descargarUnaVez(o);
    } catch (e) {
      const codigo = e instanceof ErrorDescarga ? e.codigo : 'red';
      if (codigo === 'checksum' || codigo === 'cancelada' || i >= intentos) throw e;
      await espera(1000 * 2 ** (i - 1));
    }
  }
}

export interface Instalacion {
  id: string;
  sha256: string;
}

const MARCA = 'instalado.json';

/** Carpeta del paquete si está instalado y completo (su marca coincide con el id y la suma). */
export function paqueteInstalado(dirVoces: string, id: string, sha256: string, requeridos: readonly string[]): string | null {
  const dir = join(dirVoces, id);
  try {
    const marca = JSON.parse(readFileSync(join(dir, MARCA), 'utf8')) as Instalacion;
    if (marca.id !== id || marca.sha256 !== sha256) return null;
    return requeridos.every((r) => existsSync(join(dir, ...r.split('/')))) ? dir : null;
  } catch {
    return null;
  }
}

/** Descomprime el .tar.gz ya verificado en la carpeta del paquete (atómico) y borra lo temporal. */
export async function instalarPaquete(
  rutaTarGz: string,
  dirVoces: string,
  id: string,
  sha256: string,
  requeridos: readonly string[],
): Promise<string> {
  const tar = join(dirVoces, 'descargas', `${id}.tar`);
  const temporal = join(dirVoces, `${id}.instalando`);
  const final = join(dirVoces, id);
  rmSync(temporal, { recursive: true, force: true });
  try {
    mkdirSync(dirname(tar), { recursive: true });
    await pipeline(createReadStream(rutaTarGz), createGunzip(), createWriteStream(tar));
    const extraidos = new Set(extraerTar(tar, temporal));
    const falta = requeridos.find((r) => !extraidos.has(r));
    if (falta) throw new ErrorDescarga('paquete', `Al paquete de voz le falta ${falta}`);
    writeFileSync(join(temporal, MARCA), JSON.stringify({ id, sha256 } satisfies Instalacion));
    rmSync(final, { recursive: true, force: true });
    renameSync(temporal, final);
  } catch (e) {
    rmSync(temporal, { recursive: true, force: true });
    // Un .tar.gz que no se puede abrir no se vuelve a usar.
    rmSync(rutaTarGz, { force: true });
    throw e instanceof ErrorDescarga ? e : new ErrorDescarga('paquete', `No se pudo instalar el paquete de voz (${(e as Error).message})`);
  } finally {
    rmSync(tar, { force: true });
  }
  rmSync(rutaTarGz, { force: true });
  return final;
}
