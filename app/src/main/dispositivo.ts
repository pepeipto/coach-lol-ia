import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { hostname as nombreEquipo } from 'node:os';
import { dirname } from 'node:path';
import { escribirAtomico } from './archivoAtomico';

const FORMATO_ID = /^[0-9a-f]{64}$/;

type Ejecutar = (cmd: string, args: string[]) => Promise<string>;

const ejecutar: Ejecutar = (cmd, args) =>
  new Promise((resolver, rechazar) => {
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => (err ? rechazar(err) : resolver(String(stdout))));
  });

/** MachineGuid de Windows (HKLM\SOFTWARE\Microsoft\Cryptography); null fuera de Windows o si no se puede leer. */
export async function leerMachineGuid(ej: Ejecutar = ejecutar, plataforma: string = process.platform): Promise<string | null> {
  if (plataforma !== 'win32') return null;
  try {
    const salida = await ej('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
    return /MachineGuid\s+REG_SZ\s+(\S+)/.exec(salida)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Id anónimo del dispositivo (64 hex), para vincular las licencias de prueba: SHA-256 del MachineGuid
 * de Windows y el nombre del equipo, sin enviar ninguno de los dos. Si no hay MachineGuid, un id
 * aleatorio guardado en userData.
 */
export async function idDispositivo(o: {
  rutaRespaldo: string;
  leerGuid?: () => Promise<string | null>;
  hostname?: () => string;
}): Promise<string> {
  const guid = await (o.leerGuid ?? (() => leerMachineGuid()))();
  if (guid) return createHash('sha256').update(`coach-lol-ia|${guid}|${(o.hostname ?? nombreEquipo)()}`).digest('hex');
  try {
    const { id } = JSON.parse(readFileSync(o.rutaRespaldo, 'utf8')) as { id?: unknown };
    if (typeof id === 'string' && FORMATO_ID.test(id)) return id;
  } catch {
    // no hay respaldo todavía
  }
  const id = randomBytes(32).toString('hex');
  try {
    mkdirSync(dirname(o.rutaRespaldo), { recursive: true });
    escribirAtomico(o.rutaRespaldo, JSON.stringify({ id }));
  } catch {
    // sin poder guardarlo, al menos sirve para esta sesión
  }
  return id;
}
