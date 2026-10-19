import type { Rol } from '@coach/shared';
import { ROLES } from '@coach/shared';
import { idiomaActual, t } from '../../shared/i18n';
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

/** Plantillas del idioma actual (se rehacen al cambiar de idioma). */
let cache: { idioma: string; porPlantilla: [RegExp, TipoAviso][]; fases: Set<string> } | null = null;
function plantillas(): NonNullable<typeof cache> {
  if (cache?.idioma === idiomaActual()) return cache;
  const porPlantilla: [RegExp, TipoAviso][] = [
    [plantilla('aviso.compra'), 'compra'],
    [plantilla('aviso.habilidad'), 'habilidad'],
    [plantilla('aviso.objetivoProntoPlural'), 'objetivo'],
    [plantilla('aviso.objetivoDisponiblePlural'), 'objetivo'],
    [plantilla('aviso.objetivoPronto'), 'objetivo'],
    [plantilla('aviso.objetivoDisponible'), 'objetivo'],
    [plantilla('aviso.vision'), 'vision'],
  ];
  const fases = new Set(ROLES.flatMap((r: Rol) => FASES.map((f) => t(`fase.${r}.${f}`))));
  cache = { idioma: idiomaActual(), porPlantilla, fases };
  return cache;
}

/** Tipo de un aviso a partir de su texto, para cuando el proceso principal no lo indica. */
export function deducirTipo(texto: string): TipoAviso | null {
  const { porPlantilla, fases } = plantillas();
  for (const [re, tipo] of porPlantilla) if (re.test(texto)) return tipo;
  return fases.has(texto) ? 'fase' : null;
}
