// riot.txt (verificación del sitio en Riot): el archivo aún no existe; cuando se añada en public/, sale en la raíz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilar } from './compilar.mjs';
import { problemasRiotTxt } from '../src/lib/riotTxt.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const enPublic = join(raiz, 'public', 'riot.txt');
const bytes = (s) => new TextEncoder().encode(s);

test('problemasRiotTxt: solo la cadena, sin BOM, espacios ni saltos de línea', () => {
  assert.deepEqual(problemasRiotTxt(bytes('abc123-def')), []);
  assert.equal(problemasRiotTxt(bytes('abc123\n')).length, 1);
  assert.equal(problemasRiotTxt(bytes(' abc123')).length, 1);
  assert.equal(problemasRiotTxt(bytes('abc\n123')).length, 1);
  assert.equal(problemasRiotTxt(bytes('')).length, 1);
  assert.ok(problemasRiotTxt(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('abc')])).some((p) => p.includes('BOM')));
});

test('public/riot.txt se publica tal cual en la raíz del sitio (y uno mal guardado para la compilación)', (t) => {
  if (existsSync(enPublic)) {
    // Ya existe el de verdad: solo se comprueba que es válido y que sale en la raíz.
    assert.deepEqual(problemasRiotTxt(readFileSync(enPublic)), []);
    const dist = compilar('riot-txt-real');
    assert.deepEqual(readFileSync(join(dist, 'riot.txt')), readFileSync(enPublic));
    return;
  }
  t.after(() => rmSync(enPublic, { force: true }));
  writeFileSync(enPublic, 'cadena-de-prueba-123');
  const dist = compilar('riot-txt');
  assert.equal(readFileSync(join(dist, 'riot.txt'), 'utf8'), 'cadena-de-prueba-123');
  writeFileSync(enPublic, 'cadena-de-prueba-123\r\n');
  assert.throws(() => compilar('riot-txt-malo'));
});
