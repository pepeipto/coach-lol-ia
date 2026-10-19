import type { Rol } from '@coach/shared';
import { ROLES } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { TipoAviso } from '../../shared/tiposApp';

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
