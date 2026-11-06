import type { ElementoTftVista } from './tiposApp';

/*
 * 3.15: chuleta de TFT para la partida. Antes de jugar se eligen 1 o 2 composiciones en la pestaña TFT; durante la
 * partida, un panel que se abre y se cierra con la tecla del overlay enseña sus campeones, los objetos del portador y
 * la tabla de recetas. Todo es fijo: nada cambia con el tablero, la tienda, los aumentos ni los rivales (política de
 * Riot: en TFT no hay ayudas en tiempo real), igual que una guía abierta en otra pantalla.
 */

/** Composiciones que caben en la chuleta. */
export const MAX_CHULETA_TFT = 2;

/** Una composición guardada en los ajustes: solo ids internos (los nombres e iconos se ponen al empezar la partida). */
export interface CompChuletaTft {
  /** Id de la composición en la tier list («rasgos|portador»). */
  id: string;
  rasgos: string[];
  portador: string;
  unidades: string[];
  objetosPortador: string[];
  /** Parche de la tier list de la que se eligió. */
  parche?: string;
}

/** Lo que pinta el overlay. */
export interface ChuletaTftVista {
  comps: {
    id: string;
    rasgos: ElementoTftVista[];
    portador: ElementoTftVista;
    unidades: ElementoTftVista[];
    /** Objetos del portador, cada uno con sus dos componentes si es un objeto de receta. */
    objetos: (ElementoTftVista & { receta?: [ElementoTftVista, ElementoTftVista] })[];
  }[];
  /** Componentes básicos (filas y columnas de la tabla). */
  componentes: ElementoTftVista[];
  /** tabla[i][j]: lo que sale de juntar componentes[i] y componentes[j] (null si no se conoce). */
  tabla: (ElementoTftVista | null)[][];
}

/** Mensaje 'overlay:tft': la chuleta y si el panel está abierto (null: no hay partida de TFT). */
export type PanelTft = { abierto: boolean; chuleta: ChuletaTftVista; /** Tecla del overlay (acelerador). */ tecla: string } | null;

/**
 * Componentes básicos con su nombre en inglés (para casarlos con Data Dragon si el id cambia). La espátula y la
 * sartén no entran: sus objetos (emblemas) cambian con cada set.
 */
export const COMPONENTES_TFT: readonly { id: string; en: string }[] = [
  { id: 'TFT_Item_BFSword', en: 'B.F. Sword' },
  { id: 'TFT_Item_RecurveBow', en: 'Recurve Bow' },
  { id: 'TFT_Item_NeedlesslyLargeRod', en: 'Needlessly Large Rod' },
  { id: 'TFT_Item_TearOfTheGoddess', en: 'Tear of the Goddess' },
  { id: 'TFT_Item_ChainVest', en: 'Chain Vest' },
  { id: 'TFT_Item_NegatronCloak', en: 'Negatron Cloak' },
  { id: 'TFT_Item_GiantsBelt', en: "Giant's Belt" },
  { id: 'TFT_Item_SparringGloves', en: 'Sparring Gloves' },
];

/**
 * Recetas de los objetos completos: [componente A, componente B, id del objeto, nombre en inglés]. Los ids internos
 * de Riot no siempre coinciden con el nombre actual del objeto (p. ej. Matagigantes es TFT_Item_MadredsBloodrazor).
 */
export const RECETAS_TFT: readonly (readonly [string, string, string, string])[] = [
  ['TFT_Item_BFSword', 'TFT_Item_BFSword', 'TFT_Item_Deathblade', 'Deathblade'],
  ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_MadredsBloodrazor', 'Giant Slayer'],
  ['TFT_Item_BFSword', 'TFT_Item_NeedlesslyLargeRod', 'TFT_Item_HextechGunblade', 'Hextech Gunblade'],
  ['TFT_Item_BFSword', 'TFT_Item_TearOfTheGoddess', 'TFT_Item_SpearOfShojin', 'Spear of Shojin'],
  ['TFT_Item_BFSword', 'TFT_Item_ChainVest', 'TFT_Item_GuardianAngel', 'Edge of Night'],
  ['TFT_Item_BFSword', 'TFT_Item_NegatronCloak', 'TFT_Item_Bloodthirster', 'Bloodthirster'],
  ['TFT_Item_BFSword', 'TFT_Item_GiantsBelt', 'TFT_Item_SteraksGage', "Sterak's Gage"],
  ['TFT_Item_BFSword', 'TFT_Item_SparringGloves', 'TFT_Item_InfinityEdge', 'Infinity Edge'],
  ['TFT_Item_RecurveBow', 'TFT_Item_RecurveBow', 'TFT_Item_RapidFireCannon', 'Red Buff'],
  ['TFT_Item_RecurveBow', 'TFT_Item_NeedlesslyLargeRod', 'TFT_Item_GuinsoosRageblade', "Guinsoo's Rageblade"],
  ['TFT_Item_RecurveBow', 'TFT_Item_TearOfTheGoddess', 'TFT_Item_StatikkShiv', 'Void Staff'],
  ['TFT_Item_RecurveBow', 'TFT_Item_ChainVest', 'TFT_Item_TitansResolve', "Titan's Resolve"],
  ['TFT_Item_RecurveBow', 'TFT_Item_NegatronCloak', 'TFT_Item_RunaansHurricane', "Kraken's Fury"],
  ['TFT_Item_RecurveBow', 'TFT_Item_GiantsBelt', 'TFT_Item_Leviathan', "Nashor's Tooth"],
  ['TFT_Item_RecurveBow', 'TFT_Item_SparringGloves', 'TFT_Item_LastWhisper', 'Last Whisper'],
  ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_NeedlesslyLargeRod', 'TFT_Item_RabadonsDeathcap', "Rabadon's Deathcap"],
  ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_TearOfTheGoddess', 'TFT_Item_ArchangelsStaff', "Archangel's Staff"],
  ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_ChainVest', 'TFT_Item_Crownguard', 'Crownguard'],
  ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_NegatronCloak', 'TFT_Item_IonicSpark', 'Ionic Spark'],
  ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_GiantsBelt', 'TFT_Item_Morellonomicon', 'Morellonomicon'],
  ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_SparringGloves', 'TFT_Item_JeweledGauntlet', 'Jeweled Gauntlet'],
  ['TFT_Item_TearOfTheGoddess', 'TFT_Item_TearOfTheGoddess', 'TFT_Item_BlueBuff', 'Blue Buff'],
  ['TFT_Item_TearOfTheGoddess', 'TFT_Item_ChainVest', 'TFT_Item_FrozenHeart', "Protector's Vow"],
  ['TFT_Item_TearOfTheGoddess', 'TFT_Item_NegatronCloak', 'TFT_Item_AdaptiveHelm', 'Adaptive Helm'],
  ['TFT_Item_TearOfTheGoddess', 'TFT_Item_GiantsBelt', 'TFT_Item_Redemption', 'Spirit Visage'],
  ['TFT_Item_TearOfTheGoddess', 'TFT_Item_SparringGloves', 'TFT_Item_UnstableConcoction', 'Hand of Justice'],
  ['TFT_Item_ChainVest', 'TFT_Item_ChainVest', 'TFT_Item_BrambleVest', 'Bramble Vest'],
  ['TFT_Item_ChainVest', 'TFT_Item_NegatronCloak', 'TFT_Item_GargoyleStoneplate', 'Gargoyle Stoneplate'],
  ['TFT_Item_ChainVest', 'TFT_Item_GiantsBelt', 'TFT_Item_RedBuff', 'Sunfire Cape'],
  ['TFT_Item_ChainVest', 'TFT_Item_SparringGloves', 'TFT_Item_NightHarvester', 'Steadfast Heart'],
  ['TFT_Item_NegatronCloak', 'TFT_Item_NegatronCloak', 'TFT_Item_DragonsClaw', "Dragon's Claw"],
  ['TFT_Item_NegatronCloak', 'TFT_Item_GiantsBelt', 'TFT_Item_SpectralGauntlet', 'Evenshroud'],
  ['TFT_Item_NegatronCloak', 'TFT_Item_SparringGloves', 'TFT_Item_Quicksilver', 'Quicksilver'],
  ['TFT_Item_GiantsBelt', 'TFT_Item_GiantsBelt', 'TFT_Item_WarmogsArmor', "Warmog's Armor"],
  ['TFT_Item_GiantsBelt', 'TFT_Item_SparringGloves', 'TFT_Item_PowerGauntlet', "Striker's Flail"],
  ['TFT_Item_SparringGloves', 'TFT_Item_SparringGloves', 'TFT_Item_ThiefsGloves', "Thief's Gloves"],
];

/** Componentes de un objeto completo (por su id interno); null si no es de receta (artefactos, emblemas…). */
export function recetaDe(objeto: string): [string, string] | null {
  const r = RECETAS_TFT.find((x) => x[2] === objeto);
  return r ? [r[0], r[1]] : null;
}

/** Cola de TFT: por el `gameMode` de la sesión del cliente o, si no lo trae, por las colas conocidas. */
const COLAS_TFT = new Set([1090, 1091, 1092, 1100, 1110, 1111, 1130, 1150, 1160, 1170, 1180, 1210, 1220, 6000]);
export function esColaTft(cola: number | null | undefined, gameMode?: string | null): boolean {
  if (typeof gameMode === 'string' && gameMode) return gameMode.toUpperCase() === 'TFT';
  return typeof cola === 'number' && COLAS_TFT.has(cola);
}

const ID_TFT = /^[\w.+|-]{1,120}$/;
const listaIds = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ID_TFT.test(x)).slice(0, max) : [];

/** Chuleta guardada en los ajustes: como mucho dos composiciones con ids válidos y sin repetir. */
export function normalizarChuletaTft(crudo: unknown): CompChuletaTft[] {
  if (!Array.isArray(crudo)) return [];
  const salida: CompChuletaTft[] = [];
  for (const c of crudo) {
    if (salida.length >= MAX_CHULETA_TFT) break;
    if (typeof c !== 'object' || c === null) continue;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== 'string' || !ID_TFT.test(o.id) || typeof o.portador !== 'string' || !ID_TFT.test(o.portador)) continue;
    if (salida.some((x) => x.id === o.id)) continue;
    const unidades = listaIds(o.unidades, 10);
    if (unidades.length === 0) continue;
    salida.push({
      id: o.id,
      rasgos: listaIds(o.rasgos, 4),
      portador: o.portador,
      unidades,
      objetosPortador: listaIds(o.objetosPortador, 3),
      ...(typeof o.parche === 'string' && /^[\w.]{1,20}$/.test(o.parche) ? { parche: o.parche } : {}),
    });
  }
  return salida;
}

/** Elige o quita una composición de la chuleta; con la chuleta llena, la nueva sustituye a la más antigua. */
export function alternarEnChuleta(actual: readonly CompChuletaTft[], comp: CompChuletaTft): CompChuletaTft[] {
  if (actual.some((c) => c.id === comp.id)) return actual.filter((c) => c.id !== comp.id);
  return [...actual, comp].slice(-MAX_CHULETA_TFT);
}
