// Compila la web con `astro build` en una carpeta propia y devuelve su ruta.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// El ejecutable de Astro según su package.json (astro.js hasta la 5; bin/astro.mjs desde la 6).
const paqueteAstro = join(raiz, 'node_modules', 'astro');
const bin = JSON.parse(readFileSync(join(paqueteAstro, 'package.json'), 'utf8')).bin;
const astro = join(paqueteAstro, typeof bin === 'string' ? bin : bin.astro);

/** `envExtra`: variables de entorno; `undefined` elimina la variable. */
export function compilar(nombre, envExtra = {}) {
  const outDir = join(raiz, '.dist-pruebas', nombre);
  rmSync(outDir, { recursive: true, force: true });
  const env = { ...process.env, WEB_OUT_DIR: outDir, ...envExtra };
  for (const [k, v] of Object.entries(envExtra)) if (v === undefined) delete env[k];
  execFileSync(process.execPath, [astro, 'build', '--silent'], { cwd: raiz, env, stdio: 'pipe' });
  return outDir;
}
