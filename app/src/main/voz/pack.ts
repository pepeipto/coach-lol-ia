import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Idioma } from '../../shared/i18n';
import type { AudioVoz } from '../../shared/tiposApp';
import { BASE_VOCES, type PaqueteVoz } from './catalogo';
import { esManifest, pausaTras, segmentar, type ManifestPack } from './segmentos';
import registro from './packs.json';

/**
 * Voz pregrabada de Coach LoL IA (3.1): un paquete por idioma con clips generados una sola vez con ElevenLabs
 * (`npm run voz:pack -w app`, ver docs/voz-natural.md). `packs.json` lo escribe el generador: url, tamaño y
 * suma de cada idioma publicado. Un idioma sin entrada no tiene voz pregrabada (se usa la natural).
 */

export interface EntradaPack {
  archivo: string;
  bytes: number;
  sha256: string;
  modelo: string;
  fecha: string;
  segmentos: number;
}

const PACKS = registro as Partial<Record<Idioma, EntradaPack>>;

/** Paquete publicado del idioma, o null. Su id lleva la suma: un paquete nuevo se instala en su propia carpeta. */
export function paquetePack(idioma: Idioma, packs: Partial<Record<Idioma, EntradaPack>> = PACKS): PaqueteVoz | null {
  const e = packs[idioma];
  if (!e || !e.sha256 || !e.bytes || !/^[A-Za-z0-9._-]+\.tar\.gz$/.test(e.archivo)) return null;
  return { id: `pack-${idioma}-${e.sha256.slice(0, 12)}`, url: `${BASE_VOCES}/${e.archivo}`, bytes: e.bytes, sha256: e.sha256 };
}

/** Manifest de un paquete instalado, con los clips en memoria según se piden (los mismos se repiten mucho). */
export function crearPack(dir: string, leer: (ruta: string) => Buffer = (r) => readFileSync(r)) {
  let manifest: ManifestPack | null | undefined;
  const clips = new Map<string, Uint8Array>();
  const cargar = (): ManifestPack | null => {
    if (manifest !== undefined) return manifest;
    try {
      const m: unknown = JSON.parse(leer(join(dir, 'manifest.json')).toString('utf8'));
      manifest = esManifest(m) ? m : null;
    } catch {
      manifest = null;
    }
    return manifest;
  };
  return {
    /** Clips de la frase si TODA ella está en el paquete; si falta algo, null (la frase sale entera con otra voz). */
    buscar(texto: string): AudioVoz | null {
      const m = cargar();
      if (!m) return null;
      const claves = segmentar(texto, (k) => Object.prototype.hasOwnProperty.call(m.segmentos, k));
      if (!claves) return null;
      try {
        const segmentos = claves.map((k) => m.segmentos[k]!);
        const datos = segmentos.map((s) => {
          let c = clips.get(s.archivo);
          if (!c) {
            c = new Uint8Array(leer(join(dir, s.archivo)));
            if (clips.size > 400) clips.delete(clips.keys().next().value!);
            clips.set(s.archivo, c);
          }
          return c;
        });
        return { clips: datos, ids: segmentos.map((s) => s.archivo), pausasMs: segmentos.map((s, i) => (i < segmentos.length - 1 ? pausaTras(s.texto) : 0)) };
      } catch {
        return null;
      }
    },
    /** La frase está entera en el paquete (para no prepararla con la voz natural). */
    cubre(texto: string): boolean {
      const m = cargar();
      return !!m && !!segmentar(texto, (k) => Object.prototype.hasOwnProperty.call(m.segmentos, k));
    },
  };
}
export type Pack = ReturnType<typeof crearPack>;
