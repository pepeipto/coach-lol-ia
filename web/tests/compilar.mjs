// Compila la web con `astro build` en una carpeta propia y devuelve su ruta.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(raiz, 'node_modules', 'astro', 'astro.js');

/** `envExtra`: variables de entorno; `undefined` elimina la variable. */
export function compilar(nombre, envExtra = {}) {
  const outDir = join(raiz, '.dist-pruebas', nombre);
  rmSync(outDir, { recursive: true, force: true });
  const env = { ...process.env, WEB_OUT_DIR: outDir, ...envExtra };
  for (const [k, v] of Object.entries(envExtra)) if (v === undefined) delete env[k];
  execFileSync(process.execPath, [astro, 'build', '--silent'], { cwd: raiz, env, stdio: 'pipe' });
  return outDir;
}
