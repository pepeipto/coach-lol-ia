/**
 * Genera el paquete de la voz natural (Supertonic 3 int8) que la app descarga la primera vez:
 *   voz-supertonic3-int8-v1.tar.gz  (+ su SHA-256 y tamaño, para app/src/main/voz/catalogo.ts)
 *
 * Uso (ver docs/voz-natural.md):
 *   npx tsx app/tools/empaquetar-voz.ts --int8 <carpeta> --oficial <carpeta> [--salida <carpeta>]
 *
 * --int8     carpeta de sherpa-onnx-supertonic-3-tts-int8-2026-05-11 (release tts-models de k2-fsa/sherpa-onnx):
 *            duration_predictor / text_encoder / vector_estimator / vocoder .int8.onnx
 * --oficial  carpeta con lo del repo oficial huggingface.co/Supertone/supertonic-3: onnx/tts.json,
 *            onnx/unicode_indexer.json, voice_styles/*.json y LICENSE (BigScience OpenRAIL-M)
 *
 * El tar es determinista (orden fijo y fecha 0): el mismo contenido da la misma suma.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { escribirTar, type EntradaTar } from '../src/main/voz/tar';
import { PAQUETE_SUPERTONIC, VOCES_NATURALES } from '../src/main/voz/catalogo';
import { ARCHIVOS_MODELO } from '../src/main/voz/supertonic';

const LEEME = `Coach LoL IA - voz natural (paquete ${PAQUETE_SUPERTONIC.id})

Modelo: Supertonic 3 de Supertone Inc. (https://huggingface.co/Supertone/supertonic-3)
Licencia del modelo: BigScience OpenRAIL-M (archivo LICENSE). Incluye restricciones de uso
(Anexo A): no se puede usar para fines ilegales, dañinos, de suplantación o de desinformación.
Esta copia es la versión cuantizada int8 publicada por el proyecto sherpa-onnx (k2-fsa, Apache-2.0),
sin otros cambios; los estilos de voz, tts.json y unicode_indexer.json son los oficiales.
Inferencia en la app: ONNX Runtime (Microsoft, MIT) y el código de referencia de Supertone (MIT).
`;

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const int8 = argumento('int8');
  const oficial = argumento('oficial');
  const salida = resolve(argumento('salida') ?? 'voz-paquetes');
  if (!int8 || !oficial) {
    console.error('Uso: npx tsx app/tools/empaquetar-voz.ts --int8 <carpeta> --oficial <carpeta> [--salida <carpeta>]');
    process.exit(1);
  }
  const buscar = (...opciones: string[]) => {
    const r = opciones.find((o) => existsSync(o));
    if (!r) throw new Error(`Falta ${opciones[0]}`);
    return readFileSync(r);
  };
  const entradas: EntradaTar[] = [
    ...[ARCHIVOS_MODELO.duracion, ARCHIVOS_MODELO.texto, ARCHIVOS_MODELO.estimador, ARCHIVOS_MODELO.vocoder].map((a) => ({
      nombre: a,
      datos: buscar(join(int8, a)),
    })),
    { nombre: ARCHIVOS_MODELO.config, datos: buscar(join(oficial, 'onnx', 'tts.json'), join(oficial, 'tts.json')) },
    { nombre: ARCHIVOS_MODELO.indice, datos: buscar(join(oficial, 'onnx', 'unicode_indexer.json'), join(oficial, 'unicode_indexer.json')) },
    ...VOCES_NATURALES.map((v) => ({ nombre: `voice_styles/${v.estilo}.json`, datos: buscar(join(oficial, 'voice_styles', `${v.estilo}.json`)) })),
    { nombre: 'LICENSE', datos: buscar(join(oficial, 'LICENSE')) },
    { nombre: 'LEEME.txt', datos: Buffer.from(LEEME, 'utf8') },
  ];
  const tgz = gzipSync(escribirTar(entradas), { level: 9 });
  mkdirSync(salida, { recursive: true });
  const nombre = PAQUETE_SUPERTONIC.url.slice(PAQUETE_SUPERTONIC.url.lastIndexOf('/') + 1);
  writeFileSync(join(salida, nombre), tgz);
  const sha256 = createHash('sha256').update(tgz).digest('hex');
  console.log(`Paquete: ${join(salida, nombre)}`);
  console.log(`bytes: ${tgz.length}`);
  console.log(`sha256: ${sha256}`);
  console.log(`\nPon estos valores en PAQUETE_SUPERTONIC (app/src/main/voz/catalogo.ts) y súbelo con:`);
  console.log(`  gh release create voces-v1 --repo pepeipto/coach-lol-ia --title "Voces" --notes "Paquetes de voz de Coach LoL IA" || true`);
  console.log(`  gh release upload voces-v1 "${join(salida, nombre)}" --repo pepeipto/coach-lol-ia --clobber`);
}

main();
