// Constantes y utilidades compartidas por todas las páginas.

export const NOMBRE = 'Coach LoL IA';
export const LEMA = 'Tu coach de League of Legends, en español y en tiempo real.';
export const PRECIO = '4,99 €';
export const AVISO_RIOT =
  'Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.';
export const URL_REPO = 'https://github.com/pepeipto/coach-lol-ia';
export const DOMINIO = 'www.coachlolia.com';
export const URL_SITIO = 'https://www.coachlolia.com';
export const CORREO_SOPORTE = 'suport@coachlolia.com';
export const URL_RELEASES = 'https://github.com/pepeipto/coach-lol-ia/releases/latest';

/** Ruta interna respetando el `base` de Astro (hoy `/`, con dominio propio). */
export function url(ruta = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const limpia = ruta.replace(/^\//, '');
  return `${base}/${limpia}`;
}

/** URL del servidor (sin barra final). Por defecto, el servidor local de desarrollo. */
export const API_URL = (import.meta.env.PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

/** ID de editor de AdSense; cadena vacía si no está configurado. */
export const ADSENSE_CLIENT: string = (import.meta.env.PUBLIC_ADSENSE_CLIENT || '').trim();
export const ADSENSE_SLOT: string = (import.meta.env.PUBLIC_ADSENSE_SLOT || '').trim();
