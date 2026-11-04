import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configurarDirectorioLog, registrar } from '../src/main/log';

describe('coach.log', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coach-log-'));
    configurarDirectorioLog(() => dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('añade líneas con fecha y nivel', () => {
    registrar('aviso', 'hola');
    expect(readFileSync(join(dir, 'coach.log'), 'utf8')).toMatch(/^\S+ \[aviso\] hola\n$/);
  });

  it('por encima de 5 MB pasa a coach.old.log y empieza uno nuevo', () => {
    writeFileSync(join(dir, 'coach.log'), 'x'.repeat(5 * 1024 * 1024 + 1));
    writeFileSync(join(dir, 'coach.old.log'), 'muy antiguo');
    registrar('info', 'nueva');
    expect(statSync(join(dir, 'coach.old.log')).size).toBe(5 * 1024 * 1024 + 1);
    expect(readFileSync(join(dir, 'coach.log'), 'utf8')).toMatch(/\[info\] nueva\n$/);
    expect(statSync(join(dir, 'coach.log')).size).toBeLessThan(100);
  });

  it('por debajo de 5 MB no rota', () => {
    writeFileSync(join(dir, 'coach.log'), 'x'.repeat(1000));
    registrar('info', 'nueva');
    expect(existsSync(join(dir, 'coach.old.log'))).toBe(false);
  });
});
