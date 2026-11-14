import type { ItemDDragonCrudo } from './tipos';

const ID_BOTAS_BASICAS = 1001;
/** Botas que regala la runa Calzado mágico (Slightly Magical Footwear): no siempre traen la etiqueta Boots. */
const ID_BOTAS_REGALO = 2422;
const MAPA_GRIETA = 11;
const ORO_MINIMO_LEGENDARIO = 2000;

/**
 * Tipo de objeto para la build. `mapa` es el mapa de Data Dragon (`maps`) donde se juega: 11 (Grieta, por
 * defecto), 12 (Abismo: ARAM y ARAM: Caos) o 30 (Arena); un objeto marcado como no disponible en ese mapa es 'otro'.
 */
export function clasificarObjeto(id: number, item: ItemDDragonCrudo, mapa: number = MAPA_GRIETA): 'botas' | 'legendario' | 'otro' {
  const tags = item.tags ?? [];
  if ((tags.includes('Boots') && id !== ID_BOTAS_BASICAS) || id === ID_BOTAS_REGALO) return 'botas';
  const esLegendario =
    !item.consumed &&
    (item.into?.length ?? 0) === 0 &&
    item.gold.purchasable &&
    item.gold.total >= ORO_MINIMO_LEGENDARIO &&
    item.maps?.[String(mapa)] !== false &&
    !tags.includes('Trinket');
  return esLegendario ? 'legendario' : 'otro';
}
