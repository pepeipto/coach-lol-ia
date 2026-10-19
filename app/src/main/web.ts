import { PREMIUM_HABILITADO } from '@coach/shared';
import type { RutaWeb } from '../shared/tiposApp';

/** Web oficial: dominio propio, sin ruta base. */
export const URL_WEB = 'https://www.coachlolia.com';

/** Páginas de la web que la app puede abrir: con Premium desactivado, /apoyar y ninguna de /premium. */
export function rutasWeb(premiumHabilitado: boolean): readonly RutaWeb[] {
  return premiumHabilitado ? ['/', '/premium', '/premium/gestionar', '/descargar'] : ['/', '/apoyar', '/descargar'];
}

/** Únicas páginas de la web que la app puede abrir. */
export const RUTAS_WEB: readonly RutaWeb[] = rutasWeb(PREMIUM_HABILITADO);

/** URL completa de una página de la lista blanca; lanza con cualquier otra ruta. */
export function urlWeb(ruta: unknown, rutas: readonly RutaWeb[] = RUTAS_WEB): string {
  if (typeof ruta !== 'string' || !(rutas as readonly string[]).includes(ruta)) throw new Error('Ruta web no permitida');
  return `${URL_WEB}${ruta}`;
}

/** Abre una página de la web en el navegador del sistema (la ruta se valida aquí, en main). */
export async function abrirWeb(
  ruta: unknown,
  abrir: (url: string) => Promise<void>,
  rutas: readonly RutaWeb[] = RUTAS_WEB,
): Promise<void> {
  await abrir(urlWeb(ruta, rutas));
}

/** Lo que se usa de ipcMain. */
export interface IpcWeb {
  handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void;
}

/** Canal 'coach:abrir-web': solo atiende a la ventana principal y valida la ruta contra la lista blanca. */
export function registrarIpcWeb(
  ipc: IpcWeb,
  o: { abrir: (url: string) => Promise<void>; esPrincipal: (sender: unknown) => boolean; rutas?: readonly RutaWeb[] },
): void {
  ipc.handle('coach:abrir-web', (e, ruta) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    return abrirWeb(ruta, o.abrir, o.rutas);
  });
}
