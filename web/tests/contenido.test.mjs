// Pruebas de contenido: compilan la web con `astro build` y comprueban el HTML generado.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(raiz, 'node_modules', 'astro', 'astro.js');

export function compilar(nombre, envExtra = {}) {
  const outDir = join(raiz, '.dist-pruebas', nombre);
  rmSync(outDir, { recursive: true, force: true });
  const env = { ...process.env, WEB_OUT_DIR: outDir, ...envExtra };
  for (const [k, v] of Object.entries(envExtra)) if (v === undefined) delete env[k];
  execFileSync(process.execPath, [astro, 'build', '--silent'], { cwd: raiz, env, stdio: 'pipe' });
  return outDir;
}

const AVISO_RIOT =
  'Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.';

let base;
before(() => {
  base = compilar('base', { PUBLIC_ADSENSE_CLIENT: undefined });
});

const leer = (dir, ruta) => readFileSync(join(dir, ruta), 'utf8');

test('la portada contiene el nombre, el precio y el aviso legal de Riot', () => {
  const html = leer(base, 'index.html');
  assert.match(html, /Coach LoL IA/);
  assert.match(html, /4,99\s?€/);
  assert.ok(html.includes(AVISO_RIOT), 'falta el aviso legal de Riot completo');
});

test('la portada tiene todas las secciones', () => {
  const html = leer(base, 'index.html');
  for (const id of ['que-hace', 'como-funciona', 'arquitectura', 'seguridad', 'datos', 'tecnologias', 'calidad', 'planes', 'hoja-de-ruta', 'faq']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta la sección ${id}`);
  }
});

test('la portada explica los datos técnicos clave', () => {
  const html = leer(base, 'index.html');
  for (const texto of ['127.0.0.1:2999', 'LCU', 'Esmeralda', 'EUW', 'LAN', 'LAS', '200', '20 partidas', '6 h', '229', 'Vanguard']) {
    assert.ok(html.includes(texto), `falta «${texto}»`);
  }
  assert.match(html, /<svg[^>]*aria-labelledby="diagrama-titulo[^"]*"/, 'falta el diagrama SVG en línea');
  assert.match(html, /maqueta/i, 'las capturas deben marcarse como maqueta');
});
