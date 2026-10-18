import type { ItemDDragonCrudo } from './tipos';

const ID_BOTAS_BASICAS = 1001;
const MAPA_GRIETA = '11';
const ORO_MINIMO_LEGENDARIO = 2000;

export function clasificarObjeto(id: number, item: ItemDDragonCrudo): 'botas' | 'legendario' | 'otro' {
  const tags = item.tags ?? [];
  if (tags.includes('Boots') && id !== ID_BOTAS_BASICAS) return 'botas';
  const esLegendario =
    !item.consumed &&
    (item.into?.length ?? 0) === 0 &&
    item.gold.purchasable &&
    item.gold.total >= ORO_MINIMO_LEGENDARIO &&
    item.maps?.[MAPA_GRIETA] !== false &&
    !tags.includes('Trinket');
  return esLegendario ? 'legendario' : 'otro';
}
