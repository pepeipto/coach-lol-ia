import type { Rol } from '@coach/shared';
import { ROLES } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { IdObjetivo, TipoAviso } from '../../shared/tiposApp';

export type Objetivo = IdObjetivo;
const OBJETIVOS: Objetivo[] = ['campamentos', 'escarabajo', 'larvas', 'dragon', 'anciano', 'heraldo', 'baron'];
const FASES = ['temprana', 'media', 'tardia'] as const;

/** Convierte una plantilla de es.json («{objetivo} aparece en {segundos} s») en una expresión regular. */
function plantilla(clave: string): RegExp {
  const partes = t(clave).split(/(\{\w+\})/);
  const fuente = partes
    .map((p) => {
      if (p === '{segundos}' || p === '{nivel}' || p === '{oro}') return '(\\d+)';
      if (/^\{\w+\}$/.test(p)) return '(.+?)';
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${fuente}$`);
}

const PRONTO = plantilla('aviso.objetivoPronto');
const DISPONIBLE = plantilla('aviso.objetivoDisponible');
const PRONTO_PLURAL = plantilla('aviso.objetivoProntoPlural');
const DISPONIBLE_PLURAL = plantilla('aviso.objetivoDisponiblePlural');

export interface DatosObjetivo {
  objetivo: Objetivo | null;
  segundos: number | null;
  disponible: boolean;
}

/** Saca del texto del panel qué objetivo es y cuánto falta (los textos salen de las mismas plantillas). */
export function analizarObjetivo(texto: string): DatosObjetivo {
  const nombre = (n: string) => OBJETIVOS.find((o) => t(`objetivo.${o}`) === n) ?? null;
  const pronto = PRONTO_PLURAL.exec(texto) ?? PRONTO.exec(texto);
  if (pronto) return { objetivo: nombre(pronto[1]), segundos: Number(pronto[2]), disponible: false };
  const disponible = DISPONIBLE_PLURAL.exec(texto) ?? DISPONIBLE.exec(texto);
  if (disponible) return { objetivo: nombre(disponible[1]), segundos: 0, disponible: true };
  return { objetivo: null, segundos: null, disponible: false };
}

const POR_PLANTILLA: [RegExp, TipoAviso][] = [
  [plantilla('aviso.compra'), 'compra'],
  [plantilla('aviso.habilidad'), 'habilidad'],
  [PRONTO_PLURAL, 'objetivo'],
  [DISPONIBLE_PLURAL, 'objetivo'],
  [PRONTO, 'objetivo'],
  [DISPONIBLE, 'objetivo'],
  [plantilla('aviso.vision'), 'vision'],
];
const TEXTOS_FASE = new Set(ROLES.flatMap((r: Rol) => FASES.map((f) => t(`fase.${r}.${f}`))));

/** Tipo de un aviso a partir de su texto, para cuando el proceso principal no lo indica. */
export function deducirTipo(texto: string): TipoAviso | null {
  for (const [re, tipo] of POR_PLANTILLA) if (re.test(texto)) return tipo;
  return TEXTOS_FASE.has(texto) ? 'fase' : null;
}
