// Pone al día latest.yml y el .blockmap del instalador después de firmarlo con SignPath
// (lo ejecuta .github/workflows/release.yml).
//
// electron-builder calcula el SHA-512, el tamaño y el blockmap del instalador SIN firmar. La firma
// Authenticode cambia el archivo, así que, sin esto, electron-updater rechazaría la actualización
// (sha512 checksum mismatch). Uso: node scripts/release/tras-firmar.mjs <carpeta con el .exe firmado y latest.yml>
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Sustituye el sha512 y el tamaño del único instalador de latest.yml (y el sha512 de nivel superior). */
export function actualizarLatest(texto, { sha512, size }) {
  const sha = texto.match(/^\s*(?:- )?\s*sha512:/gm) ?? [];
  const tam = texto.match(/^\s*size:/gm) ?? [];
  if (sha.length === 0 || tam.length !== 1) throw new Error('latest.yml no tiene el formato esperado (un solo instalador)');
  return texto.replace(/^(\s*(?:- )?\s*sha512:).*$/gm, `$1 ${sha512}`).replace(/^(\s*size:).*$/m, `$1 ${size}`);
}

/** Busca el instalador de la carpeta: tiene que haber exactamente uno. */
export async function buscarInstalador(carpeta) {
  const exes = (await readdir(carpeta)).filter((n) => /Setup .*\.exe$/.test(n));
  if (exes.length !== 1) throw new Error(`Se esperaba un instalador en ${carpeta} y hay ${exes.length}`);
  return join(carpeta, exes[0]);
}

export async function procesar(carpeta) {
  // El blockmap tiene que salir del mismo algoritmo que usa electron-builder (Rabin + blake2b, gzip).
  const requerir = createRequire(new URL('../../app/package.json', import.meta.url));
  const { buildBlockMap } = requerir('app-builder-lib/out/targets/blockmap/blockmap.js');
  const exe = await buscarInstalador(carpeta);
  const { sha512, size } = await buildBlockMap(exe, 'gzip', `${exe}.blockmap`);
  const rutaLatest = join(carpeta, 'latest.yml');
  await writeFile(rutaLatest, actualizarLatest(await readFile(rutaLatest, 'utf8'), { sha512, size }));
  return { exe, sha512, size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const carpeta = process.argv[2];
  if (!carpeta) {
    console.error('Uso: node scripts/release/tras-firmar.mjs <carpeta>');
    process.exit(2);
  }
  const { exe, size } = await procesar(carpeta);
  console.log(`latest.yml y blockmap actualizados para ${exe} (${size} bytes)`);
}
