import type { RutaWeb } from '../shared/tiposApp';

/** Web oficial: dominio propio, sin ruta base. */
export const URL_WEB = 'https://www.coachlolia.com';

/** Únicas páginas de la web que la app puede abrir. */
export const RUTAS_WEB: readonly RutaWeb[] = ['/', '/premium', '/premium/gestionar', '/descargar'];

function esRutaWeb(ruta: unknown): ruta is RutaWeb {
  return typeof ruta === 'string' && (RUTAS_WEB as readonly string[]).includes(ruta);
}

/** URL completa de una página de la lista blanca; lanza con cualquier otra ruta. */
export function urlWeb(ruta: unknown): string {
  if (!esRutaWeb(ruta)) throw new Error('Ruta web no permitida');
  return `${URL_WEB}${ruta}`;
}

/** Abre una página de la web en el navegador del sistema (la ruta se valida aquí, en main). */
export async function abrirWeb(ruta: unknown, abrir: (url: string) => Promise<void>): Promise<void> {
  await abrir(urlWeb(ruta));
}
