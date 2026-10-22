// Constantes y utilidades compartidas por todas las páginas.

export { PRUEBAS_AUTOMATICAS, VERSION_ACTUAL, MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from './cifras';
export { PREMIUM_HABILITADO } from './producto';

export const NOMBRE = 'Coach LoL IA';
export const LEMA = 'Tu coach de League of Legends, en español y en tiempo real.';
/** Precio de Premium: solo lo usan las páginas de Premium, que no se construyen con PREMIUM_HABILITADO apagado. */
export const PRECIO = '4,99 €';
/**
 * Aviso legal obligatorio de las políticas de la API de Riot («Core Policies»), literal y en inglés:
 * https://developer.riotgames.com/policies/general. Va en todas las páginas (pie); en los demás idiomas, tras su
 * traducción (`pie.avisoRiot`), porque Riot no publica traducciones oficiales.
 */
export const AVISO_RIOT =
  "Coach LoL IA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";
export const URL_REPO = 'https://github.com/pepeipto/coach-lol-ia';
export const DOMINIO = 'www.coachlolia.com';
export const URL_SITIO = 'https://www.coachlolia.com';
export const CORREO_SOPORTE = 'support@coachlolia.com';
export const URL_RELEASES = 'https://github.com/pepeipto/coach-lol-ia/releases/latest';
/**
 * Invitación permanente al servidor oficial de Discord (https://discord.gg/...). Vacía mientras no exista: con ella
 * vacía no se muestra ningún enlace. PUBLIC_DISCORD_URL la sustituye (lo usan los tests). Ver docs/discord/README.md.
 */
const INVITACION_DISCORD = '';
const discord = (import.meta.env.PUBLIC_DISCORD_URL || INVITACION_DISCORD).trim();
export const URL_DISCORD: string = /^https:\/\/discord\.(gg|com)\//i.test(discord) ? discord : '';

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
