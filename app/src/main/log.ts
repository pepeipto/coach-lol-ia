import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type NivelLog = 'info' | 'aviso' | 'error';

let directorio: (() => string) | null = null;

/** Define cómo se obtiene el directorio de logs (en la app: userData/logs). Se resuelve de forma perezosa. */
export function configurarDirectorioLog(obtener: () => string): void {
  directorio = obtener;
}

/** Añade una línea a coach.log. Nunca lanza: un fallo de log no debe romper la app. */
export function registrar(nivel: NivelLog, mensaje: string): void {
  if (!directorio) return;
  try {
    const dir = directorio();
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'coach.log'), `${new Date().toISOString()} [${nivel}] ${mensaje}\n`, 'utf8');
  } catch {
    // ignorar
  }
}
