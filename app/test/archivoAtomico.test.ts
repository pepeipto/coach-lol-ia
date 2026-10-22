import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { escribirAtomico } from '../src/main/archivoAtomico';

describe('escribirAtomico', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coach-atomico-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('escribe el archivo entero y no deja el temporal', () => {
    const ruta = join(dir, 'ajustes.json');
    writeFileSync(ruta, '{"viejo":true}');
    escribirAtomico(ruta, '{"nuevo":true}');
    expect(readFileSync(ruta, 'utf8')).toBe('{"nuevo":true}');
    expect(readdirSync(dir)).toEqual(['ajustes.json']);
  });

  it('si la escritura falla a medias, el archivo anterior queda intacto', () => {
    const ruta = join(dir, 'licencia.json');
    writeFileSync(ruta, '{"clave":"buena"}');
    const fsRoto = {
      ...fs,
      writeFileSync: (r: string, d: string) => {
        fs.writeFileSync(r, d.slice(0, 3));
        throw new Error('ENOSPC');
      },
    };
    expect(() => escribirAtomico(ruta, '{"clave":"nueva"}', fsRoto)).toThrow('ENOSPC');
    expect(readFileSync(ruta, 'utf8')).toBe('{"clave":"buena"}');
    expect(existsSync(`${ruta}.tmp`)).toBe(true);
  });
});
