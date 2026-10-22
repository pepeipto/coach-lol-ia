import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AudioPcm as AudioVoz } from '../../shared/tiposApp';

/**
 * Caché de frases ya sintetizadas: en memoria (LRU por bytes) y en disco (userData/voz-natural/cache, también LRU,
 * por fecha de último uso). Así lo que ya se dijo en otra partida suena al instante y no gasta CPU.
 */

export const clave = (partes: readonly string[]): string => createHash('sha1').update(partes.join('\u0001')).digest('hex');

const CABECERA = 8; // 'CVZ1' + sampleRate (uint32 LE)
const MAGIA = 'CVZ1';

export function serializar(a: AudioVoz): Buffer {
  const b = Buffer.alloc(CABECERA + a.pcm.byteLength);
  b.write(MAGIA, 0, 'ascii');
  b.writeUInt32LE(a.sampleRate, 4);
  Buffer.from(a.pcm.buffer, a.pcm.byteOffset, a.pcm.byteLength).copy(b, CABECERA);
  return b;
}

export function deserializar(b: Buffer): AudioVoz | null {
  if (b.length < CABECERA || b.toString('ascii', 0, 4) !== MAGIA || (b.length - CABECERA) % 2 !== 0) return null;
  const sampleRate = b.readUInt32LE(4);
  if (sampleRate < 8000 || sampleRate > 96000) return null;
  return { sampleRate, pcm: new Uint8Array(b.subarray(CABECERA)) };
}

export class CacheMemoria {
  private mapa = new Map<string, AudioVoz>();
  private bytes = 0;
  constructor(private readonly maxBytes: number) {}

  obtener(k: string): AudioVoz | undefined {
    const v = this.mapa.get(k);
    if (!v) return undefined;
    // Reinsertar la deja la última (la más reciente).
    this.mapa.delete(k);
    this.mapa.set(k, v);
    return v;
  }

  guardar(k: string, v: AudioVoz): void {
    const previa = this.mapa.get(k);
    if (previa) {
      this.bytes -= previa.pcm.byteLength;
      this.mapa.delete(k);
    }
    if (v.pcm.byteLength > this.maxBytes) return;
    this.mapa.set(k, v);
    this.bytes += v.pcm.byteLength;
    for (const [kk, vv] of this.mapa) {
      if (this.bytes <= this.maxBytes) break;
      this.mapa.delete(kk);
      this.bytes -= vv.pcm.byteLength;
    }
  }

  get tamano(): number {
    return this.mapa.size;
  }
  get ocupados(): number {
    return this.bytes;
  }
  vaciar(): void {
    this.mapa.clear();
    this.bytes = 0;
  }
}

export class CacheDisco {
  /**
   * Bytes de la carpeta según la última vez que se repasó más lo guardado desde entonces (null: aún sin repasar).
   * Así no se lee la carpeta entera en cada frase, solo al pasarse del límite.
   */
  private total: number | null = null;

  constructor(
    private readonly dir: string,
    private readonly maxBytes: number,
  ) {}

  private ruta(k: string): string {
    return join(this.dir, `${k}.pcm`);
  }

  obtener(k: string): AudioVoz | undefined {
    try {
      const a = deserializar(readFileSync(this.ruta(k)));
      if (!a) return undefined;
      const ahora = new Date();
      try {
        utimesSync(this.ruta(k), ahora, ahora);
      } catch {
        // sin permiso para tocar la fecha: no pasa nada
      }
      return a;
    } catch {
      return undefined;
    }
  }

  tiene(k: string): boolean {
    return existsSync(this.ruta(k));
  }

  guardar(k: string, a: AudioVoz): void {
    try {
      mkdirSync(this.dir, { recursive: true });
      const ruta = this.ruta(k);
      let previo = 0;
      try {
        previo = statSync(ruta).size;
      } catch {
        // frase nueva
      }
      const datos = serializar(a);
      writeFileSync(ruta, datos);
      if (this.total === null) return this.recortar();
      this.total += datos.length - previo;
      if (this.total > this.maxBytes) this.recortar();
    } catch {
      // sin espacio o sin permiso: la caché en disco es solo una mejora
    }
  }

  /** Borra los menos usados hasta quedar por debajo del límite. */
  recortar(): void {
    let archivos: { ruta: string; bytes: number; uso: number }[];
    try {
      archivos = readdirSync(this.dir)
        .filter((n) => n.endsWith('.pcm'))
        .map((n) => {
          const ruta = join(this.dir, n);
          const s = statSync(ruta);
          return { ruta, bytes: s.size, uso: s.mtimeMs };
        });
    } catch {
      return;
    }
    let total = archivos.reduce((n, a) => n + a.bytes, 0);
    this.total = total;
    if (total <= this.maxBytes) return;
    archivos.sort((a, b) => a.uso - b.uso);
    for (const a of archivos) {
      if (total <= this.maxBytes) break;
      rmSync(a.ruta, { force: true });
      total -= a.bytes;
    }
    this.total = total;
  }

  vaciar(): void {
    rmSync(this.dir, { recursive: true, force: true });
    this.total = 0;
  }
}
