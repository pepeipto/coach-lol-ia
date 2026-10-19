import { existeTexto, localeActual, t } from '../../../shared/i18n';
import { CDN_DDRAGON } from '../../comun/IconoDDragon';
import type { JugadorCarga } from '../../../shared/tiposApp';

/** Ligas sin divisiones: solo se muestran los LP. */
const APICE = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

/** Tier oficial en español; si Riot añade uno nuevo, se muestra tal cual. */
export function nombreTier(tier: string): string {
  const clave = `carga.tier.${tier.toUpperCase()}`;
  const texto = t(clave);
  return texto === clave ? tier : texto;
}

/** «Esmeralda II · 42 LP», «Retador · 1200 LP» o «Sin clasificar». Solo el rango oficial, nunca estimaciones. */
export function textoRango(rango: JugadorCarga['rango']): string {
  if (!rango) return t('carga.sinClasificar');
  const tier = nombreTier(rango.tier);
  const liga = APICE.has(rango.tier.toUpperCase()) || !rango.division ? tier : `${tier} ${rango.division}`;
  return `${liga} · ${t('carga.lp', { lp: rango.lp })}`;
}

const decimal = (n: number) => n.toLocaleString(localeActual(), { maximumFractionDigits: 1, useGrouping: false });

/** «60 % · 30 V 20 D»; null sin partidas. */
export function textoRegistro(rango: JugadorCarga['rango']): string | null {
  if (!rango) return null;
  const partidas = rango.victorias + rango.derrotas;
  if (partidas <= 0) return null;
  return t('carga.registro', {
    winrate: Math.round((rango.victorias / partidas) * 100),
    victorias: rango.victorias,
    derrotas: rango.derrotas,
  });
}

/** 1500 → «1500»; 250 000 → «250 mil»; 1 250 000 → «1,3 M». */
export function puntosCortos(puntos: number): string {
  if (puntos >= 1_000_000) return t('carga.millones', { n: decimal(puntos / 1_000_000) });
  if (puntos >= 10_000) return t('carga.miles', { n: Math.round(puntos / 1000) });
  return String(puntos);
}

export function textoMaestria(maestria: JugadorCarga['maestria']): string | null {
  if (!maestria) return null;
  return t('carga.maestria', { nivel: maestria.nivel, puntos: puntosCortos(maestria.puntos) });
}

/** 0.523 → «52,3 %». */
export function textoWinrate(winrate: number | null): string | null {
  if (winrate === null || !Number.isFinite(winrate)) return null;
  return t('formato.porcentaje', { n: decimal(Math.round(winrate * 1000) / 10) });
}

/** Riot ID partido en nombre y etiqueta («Ana#EUW» → ['Ana', '#EUW']). */
export function partesRiotId(riotId: string): [string, string] {
  const i = riotId.lastIndexOf('#');
  return i > 0 ? [riotId.slice(0, i), riotId.slice(i)] : [riotId, ''];
}

/**
 * Texto de una etiqueta en el idioma de la app: con `clave` (servidor 3.0 o la carga de muestra) se traduce, con el
 * nombre del campeón en el idioma actual; sin ella (servidor anterior), el texto en español tal cual.
 */
export function textoEtiqueta(e: JugadorCarga['etiquetas'][number], nombreCampeon: string): string {
  if (!e.clave || !existeTexto(e.clave)) return e.texto;
  const params = { ...e.params, ...(nombreCampeon && e.params?.campeon !== undefined ? { campeon: nombreCampeon } : {}) };
  return t(e.clave, params);
}

/** 3.1: colas que se nombran en la cabecera de la pantalla completa (id de `gameData.queue.id`). */
const CLAVES_COLA: Record<number, string> = {
  0: 'personalizada',
  400: 'normal',
  420: 'soloDuo',
  430: 'ciegas',
  440: 'flexible',
  480: 'rapida',
  490: 'rapida',
  700: 'clash',
  830: 'ia',
  840: 'ia',
  850: 'ia',
  870: 'ia',
  880: 'ia',
  890: 'ia',
};

/** «Clasificatoria Solo/Dúo», «Clash»…; null si la cola no se sabe o no es una de las conocidas. */
export function textoCola(cola: number | null | undefined): string | null {
  const clave = cola === null || cola === undefined ? undefined : CLAVES_COLA[cola];
  return clave ? t(`carga.cola.${clave}`) : null;
}

/** Arte del campeón en Data Dragon (sin versión): `loading` (vertical, 308×560) o `splash` (panorámica). */
export function urlArteCampeon(tipo: 'loading' | 'splash', campeon: string): string | null {
  return campeon ? `${CDN_DDRAGON}/img/champion/${tipo}/${encodeURIComponent(campeon)}_0.jpg` : null;
}
