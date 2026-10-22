import { execFile } from 'node:child_process';

export interface CredencialesLcu {
  puerto: number;
  password: string;
  protocolo: string;
}

export const DIRECTORIO_POR_DEFECTO = 'C:\\Riot Games\\League of Legends';

/** Formato: LeagueClient:<pid>:<puerto>:<password>:<protocolo> */
export function parsearLockfile(texto: string): CredencialesLcu {
  const partes = texto.trim().split(':');
  if (partes.length < 5) throw new Error('Lockfile con formato inválido');
  const puerto = Number(partes[2]);
  if (!Number.isInteger(puerto) || puerto <= 0) throw new Error('Lockfile con puerto inválido');
  return { puerto, password: partes[3], protocolo: partes[4] };
}

function ejecutarPowerShell(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', cmd], { windowsHide: true, timeout: 10000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** 3.6: archivo de Riot con la ruta de instalación de LoL (lo escribe el Riot Client al instalar o actualizar). */
export const METADATOS_LOL = 'C:\\ProgramData\\Riot Games\\Metadata\\league_of_legends.live\\league_of_legends.live.product_settings.yaml';

/** Ruta de instalación de LoL en el YAML de Riot (`product_install_full_path`); null si no está. Sin PowerShell. */
export function dirDeMetadatos(yaml: string): string | null {
  const m = /product_install_full_path:\s*"?([^"\r\n]+?)"?\s*$/m.exec(yaml);
  const dir = m?.[1]?.trim().replace(/\//g, '\\');
  return dir || null;
}

/** Lee la línea de comandos de LeagueClientUx.exe (no toca el juego) y extrae --install-directory. */
export async function encontrarDirectorioLol(
  ejecutar: (cmd: string) => Promise<string> = ejecutarPowerShell,
): Promise<string> {
  try {
    const salida = await ejecutar(
      "(Get-CimInstance Win32_Process -Filter \"Name = 'LeagueClientUx.exe'\" | Select-Object -First 1).CommandLine",
    );
    const m = /--install-directory=(?:"([^"]+)"|([^"\r\n]*?)(?=\s+--|"|\s*$))/m.exec(salida);
    const dir = (m?.[1] ?? m?.[2] ?? '').trim();
    return dir || DIRECTORIO_POR_DEFECTO;
  } catch {
    return DIRECTORIO_POR_DEFECTO;
  }
}
