// Constantes y utilidades compartidas por todas las páginas.

export { PRUEBAS_AUTOMATICAS, VERSION_ACTUAL, MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from './cifras';
export { PREMIUM_HABILITADO } from './producto';

export const NOMBRE = 'Coach LoL IA';
export const LEMA = 'Tu coach de League of Legends, en español y en tiempo real.';
/** Precio de Premium: solo lo usan las páginas de Premium, que no se construyen con PREMIUM_HABILITADO apagado. */
export const PRECIO = '4,99 €';
export const AVISO_RIOT =
  'Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.';
export const URL_REPO = 'https://github.com/pepeipto/coach-lol-ia';
export const DOMINIO = 'www.coachlolia.com';
export const URL_SITIO = 'https://www.coachlolia.com';
export const CORREO_SOPORTE = 'support@coachlolia.com';
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

/** Enlace para donar (PUBLIC_DONACION_URL, en la compilación); cadena vacía si no está configurado o no es https. */
const donacion = (import.meta.env.PUBLIC_DONACION_URL || '').trim();
export const DONACION_URL: string = /^https:\/\//i.test(donacion) ? donacion : '';
