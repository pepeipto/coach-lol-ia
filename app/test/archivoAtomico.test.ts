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

  it('con el archivo bloqueado (EPERM en Windows) reintenta y, si sigue, lo escribe directamente', () => {
    const ruta = join(dir, 'ajustes.json');
    writeFileSync(ruta, '{"viejo":true}');
    let intentos = 0;
    const fsBloqueado = {
      ...fs,
      renameSync: () => {
        intentos++;
        throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
      },
    };
    escribirAtomico(ruta, '{"nuevo":true}', fsBloqueado);
    expect(intentos).toBe(3);
    expect(readFileSync(ruta, 'utf8')).toBe('{"nuevo":true}');
    expect(readdirSync(dir)).toEqual(['ajustes.json']);
  });

  it('un bloqueo pasajero se supera con el reintento', () => {
    const ruta = join(dir, 'perfil.json');
    let intentos = 0;
    const fsPasajero = {
      ...fs,
      renameSync: (a: string, b: string) => {
        if (++intentos === 1) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
        fs.renameSync(a, b);
      },
    };
    escribirAtomico(ruta, '{"ok":true}', fsPasajero);
    expect(intentos).toBe(2);
    expect(readFileSync(ruta, 'utf8')).toBe('{"ok":true}');
    expect(readdirSync(dir)).toEqual(['perfil.json']);
  });

  it('otros errores al renombrar no se tapan', () => {
    const ruta = join(dir, 'licencia.json');
    const fsRoto = {
      ...fs,
      renameSync: () => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      },
    };
    expect(() => escribirAtomico(ruta, '{}', fsRoto)).toThrow('ENOENT');
  });
});
