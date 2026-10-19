import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { idDispositivo, leerMachineGuid } from '../src/main/dispositivo';

const ruta = () => join(mkdtempSync(join(tmpdir(), 'coach-dispositivo-')), 'dispositivo.json');

describe('id anónimo del dispositivo', () => {
  it('SHA-256 del MachineGuid de Windows y el nombre del equipo: 64 hex, estable', async () => {
    const o = { rutaRespaldo: ruta(), leerGuid: async () => '1234-abcd', hostname: () => 'PC-CASA' };
    const id = await idDispositivo(o);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).toBe(createHash('sha256').update('coach-lol-ia|1234-abcd|PC-CASA').digest('hex'));
    expect(await idDispositivo(o)).toBe(id);
    expect(await idDispositivo({ ...o, hostname: () => 'OTRO' })).not.toBe(id);
  });

  it('sin MachineGuid usa un id aleatorio guardado en userData (el mismo en cada arranque)', async () => {
    const r = ruta();
    const a = await idDispositivo({ rutaRespaldo: r, leerGuid: async () => null, hostname: () => 'PC' });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(readFileSync(r, 'utf8'))).toEqual({ id: a });
    expect(await idDispositivo({ rutaRespaldo: r, leerGuid: async () => null, hostname: () => 'PC' })).toBe(a);
  });

  it('lee el MachineGuid de la salida de reg query', async () => {
    const salida = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\r\n    MachineGuid    REG_SZ    5f1c2d3e-aaaa-bbbb-cccc-0123456789ab\r\n\r\n';
    const llamadas: string[][] = [];
    const guid = await leerMachineGuid(async (cmd, args) => {
      llamadas.push([cmd, ...args]);
      return salida;
    }, 'win32');
    expect(guid).toBe('5f1c2d3e-aaaa-bbbb-cccc-0123456789ab');
    expect(llamadas[0]).toEqual(['reg', 'query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
    expect(await leerMachineGuid(async () => 'nada', 'win32')).toBeNull();
    expect(await leerMachineGuid(async () => { throw new Error('sin reg'); }, 'win32')).toBeNull();
    expect(await leerMachineGuid(async () => salida, 'linux')).toBeNull();
  });
});
