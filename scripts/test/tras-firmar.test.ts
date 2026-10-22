import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error: módulo .mjs sin tipos (lo ejecuta GitHub Actions con node)
import { actualizarLatest, buscarInstalador, procesar } from '../release/tras-firmar.mjs';

const LATEST = `version: 3.6.0
files:
  - url: Coach-LoL-IA-Setup-3.6.0.exe
    sha512: viejo==
    size: 100
path: Coach-LoL-IA-Setup-3.6.0.exe
sha512: viejo==
releaseDate: '2026-10-22T01:26:14.000Z'
`;

describe('actualizarLatest', () => {
  it('cambia los dos sha512 y el tamaño y deja el resto igual', () => {
    const nuevo = actualizarLatest(LATEST, { sha512: 'nuevo+/=', size: 123 });
    expect(nuevo).toBe(LATEST.replaceAll('viejo==', 'nuevo+/=').replace('size: 100', 'size: 123'));
  });

  it('falla si no reconoce el formato', () => {
    expect(() => actualizarLatest('version: 1.0.0\n', { sha512: 'x', size: 1 })).toThrow(/formato/);
  });
});

describe('procesar', () => {
  let carpeta = '';
  afterEach(async () => {
    if (carpeta) await rm(carpeta, { recursive: true, force: true });
  });

  it('recalcula el sha512 y el tamaño del instalador firmado y escribe su blockmap', async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'tras-firmar-'));
    const contenido = Buffer.alloc(200_000, 7);
    await writeFile(join(carpeta, 'Coach LoL IA Setup 3.6.0.exe'), contenido);
    await writeFile(join(carpeta, 'latest.yml'), LATEST);
    await procesar(carpeta);
    const sha512 = createHash('sha512').update(contenido).digest('base64');
    const latest = await readFile(join(carpeta, 'latest.yml'), 'utf8');
    expect(latest).toContain(`    sha512: ${sha512}\n`);
    expect(latest).toContain(`\nsha512: ${sha512}\n`);
    expect(latest).toContain('size: 200000');
    expect((await readFile(join(carpeta, 'Coach LoL IA Setup 3.6.0.exe.blockmap'))).length).toBeGreaterThan(0);
  });

  it('exige exactamente un instalador', async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'tras-firmar-'));
    await expect(buscarInstalador(carpeta)).rejects.toThrow(/hay 0/);
  });
});
