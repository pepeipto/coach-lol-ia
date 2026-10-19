import { t } from '../../../shared/i18n';
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

const decimal = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: false });

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
  return `${decimal(Math.round(winrate * 1000) / 10)} %`;
}

/** Ids de Data Dragon cuyo nombre no sale de separar las palabras. */
const NOMBRES_ESPECIALES: Record<string, string> = {
  MonkeyKing: 'Wukong',
  Chogath: "Cho'Gath",
  Khazix: "Kha'Zix",
  KogMaw: "Kog'Maw",
  Leblanc: 'LeBlanc',
  RekSai: "Rek'Sai",
  Velkoz: "Vel'Koz",
  Belveth: "Bel'Veth",
  KSante: "K'Sante",
  Kaisa: "Kai'Sa",
  Nunu: 'Nunu y Willump',
  Renata: 'Renata Glasc',
  FiddleSticks: 'Fiddlesticks',
  DrMundo: 'Dr. Mundo',
};

/** Nombre visible a partir del id de Data Dragon («LeeSin» → «Lee Sin»). */
export function nombreCampeon(id: string): string {
  return NOMBRES_ESPECIALES[id] ?? id.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Riot ID partido en nombre y etiqueta («Ana#EUW» → ['Ana', '#EUW']). */
export function partesRiotId(riotId: string): [string, string] {
  const i = riotId.lastIndexOf('#');
  return i > 0 ? [riotId.slice(0, i), riotId.slice(i)] : [riotId, ''];
}
