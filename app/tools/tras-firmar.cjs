/**
 * Tras firmar el instalador (SignPath), su contenido cambia: hay que rehacer el blockmap (actualizaciones
 * diferenciales) y latest.yml (sha512 y tamaño que comprueba electron-updater). Lo usa el workflow de release.
 *
 *   node app/tools/tras-firmar.cjs <instalador.exe> <version>
 *
 * Escribe <instalador.exe>.blockmap y latest.yml junto al instalador, y SHA256SUMS.txt con el SHA-256 de cada
 * archivo publicado (para comprobar la descarga a mano).
 */
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { basename, dirname, join } = require('node:path');
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap.js');

async function main() {
  const [exe, version] = process.argv.slice(2);
  if (!exe || !version) throw new Error('Uso: node tras-firmar.cjs <instalador.exe> <version>');
  const dir = dirname(exe);
  const nombre = basename(exe);
  const info = await buildBlockMap(exe, 'gzip', `${exe}.blockmap`);
  const latest = [
    `version: ${version}`,
    'files:',
    `  - url: ${nombre}`,
    `    sha512: ${info.sha512}`,
    `    size: ${info.size}`,
    `path: ${nombre}`,
    `sha512: ${info.sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n');
  writeFileSync(join(dir, 'latest.yml'), latest, 'utf8');
  const sumas = [exe, `${exe}.blockmap`, join(dir, 'latest.yml')]
    .map((f) => `${createHash('sha256').update(readFileSync(f)).digest('hex')}  ${basename(f)}`)
    .join('\n');
  writeFileSync(join(dir, 'SHA256SUMS.txt'), `${sumas}\n`, 'utf8');
  console.log(`latest.yml, ${nombre}.blockmap y SHA256SUMS.txt listos (sha512 ${info.sha512.slice(0, 12)}…, ${info.size} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
