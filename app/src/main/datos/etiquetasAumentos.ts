/**
 * Clasificación de los aumentos de ARAM: Caos por lo que hacen, a partir de su descripción en español (la del juego,
 * stringtable es_mx) y de su clave interna. La usa tools/generar-aumentos-caos.ts para crear aumentosCaos.json, y de
 * ahí sale el encaje de cada aumento con cada campeón (consejos/aumentosCaos.ts).
 *
 * Política de Riot: «Products cannot display win rates for Augments». Aquí no hay ninguna cifra de partidas: solo
 * qué tipo de aumento es.
 */
export const ETIQUETAS = [
  'ap',
  'ad',
  'critico',
  'ataque',
  'alcance',
  'cuerpo',
  'habilidades',
  'definitiva',
  'tanque',
  'curacion',
  'aliados',
  'control',
  'movilidad',
  'mana',
  'bolaNieve',
  'general',
] as const;
export type Etiqueta = (typeof ETIQUETAS)[number];

/** Rareza de un aumento (cherry-augments.json: kSilver, kGold, kPrismatic). */
export type Rareza = 'plata' | 'oro' | 'prismatico';

export interface AumentoCaos {
  /** Id de cherry-augments.json (el mismo que Match-v5 `playerAugmentN`). */
  id: number;
  /** augmentNameId (p. ej. «ARAM_Archmage»). */
  clave: string;
  rareza: Rareza;
  etiquetas: Etiqueta[];
  /** Familia de aumentos que se combinan entre sí (Pan y…, almas de dragón, bola de nieve…); null si no tiene. */
  familia: string | null;
  /** El juego no publica su descripción: no se sabe qué hace y se trata como neutro. */
  sinDescripcion?: boolean;
}

const REGLAS: [Etiqueta, RegExp][] = [
  ['ap', /poder de habilidad|daño mágico|daño mágio|penetración de magia/],
  ['ad', /daño de ataque|daño físico|letalidad|penetración de armadura/],
  ['critico', /golpe crítico|golpes críticos/],
  ['ataque', /velocidad de ataque|tus ataques|ataque básico|ataques básicos|al atacar|item_keyword_onhit|%i:onhit%|al impacto/],
  ['alcance', /alcance de ataque/],
  ['habilidades', /tus habilidades|con una habilidad|con habilidades|aceleración de habilidad|enfriamiento de|\{\{ ?spellname ?\}\}|lanzar un hechizo/],
  ['definitiva', /definitiva/],
  ['tanque', /vida máxima|de vida,|de vida\.|armadura|resistencia mágica|reducción de daño|te vuelves grande|te vuelves enorme|inmune|invulnerable|imparable/],
  ['curacion', /(^|[^a-záéíóúñ])cura|curación|curaciones|escudo|omnivampirismo|robo de vida|regeneración de vida|recuperas vida/],
  ['aliados', /aliad/],
  ['control', /inmoviliz|ralentiz|anclar|anclas|aterroriz|polimorf|provoca|por el aire|encantados/],
  ['movilidad', /velocidad de movimiento|desplazamiento|destello|salto o tele/],
  ['mana', /maná/],
  ['bolaNieve', /bola de nieve/],
  ['general', /de oro|aumento de oro|aumentos? prismáticos?|aumentos aleatorios|aumento prismático aleatorio|yunques?|fuerza adaptable|almas? de dragón|el alma de/],
];

/** Casos que la descripción no deja claros (o que confunde): se fijan por la clave, en minúsculas. */
const POR_CLAVE: Record<string, Etiqueta[]> = {
  aram_adapt: ['ap'],
  aram_escapade: ['ad'],
  aram_drawyoursword: ['cuerpo', 'ad', 'ataque'],
  aram_scopedweapons: ['alcance', 'ataque'],
  aram_scopierweapons: ['alcance', 'ataque'],
  aram_scopiestweapons: ['alcance', 'ataque'],
  aram_masterofduality: ['ap', 'ad', 'ataque', 'habilidades'],
  aram_minionmancer: ['general'],
  aram_perseverance: ['curacion', 'tanque'],
  natureishealing: ['curacion'],
  glasscannon: ['general'],
  aram_littledevil: ['general'],
  aram_magicmissile: ['habilidades'],
  aram_threadtheneedle: ['general'],
  burstingteeth: ['general'],
  aram_marksmage: ['ap', 'ataque'],
  // Mejoras de objetos: sirven a quien compra ese objeto.
  aram_upgrade_zh: ['ap'],
  aram_upgrade_ie: ['critico', 'ad'],
  aram_upgrade_collector: ['ad'],
  aram_upgrade_immolate: ['tanque'],
  aram_upgrade_sheen: ['ataque', 'habilidades'],
  upgrade_swordofblossom: ['ataque'],
  upgrade_ravenous: ['ad', 'curacion'],
  upgrade_sunderedsky: ['ad'],
  upgrade_deathdance: ['ad', 'tanque'],
  upgrade_stormsurge: ['ap'],
  aram_tankitorleaveit: ['tanque', 'critico'],
  aram_celestialbody: ['tanque'],
};

/** Etiquetas de un aumento según su descripción (sin descripción, `general`). */
export function etiquetarAumento(clave: string, descripcion: string): Etiqueta[] {
  const fijas = POR_CLAVE[clave.toLowerCase()];
  if (fijas) return [...fijas];
  const d = descripcion.toLowerCase();
  if (!d.trim()) return ['general'];
  // Reducir la armadura del enemigo es daño, no aguante.
  const sinReduccion = d.replace(/reducción de armadura( y (de )?resistencia mágica)?/g, '');
  const etiquetas = REGLAS.filter(([e, re]) => re.test(e === 'tanque' ? sinReduccion : d)).map(([e]) => e);
  // «Fuerza adaptable» vale para cualquier daño: no lo hace general si ya trae algo más concreto.
  if (etiquetas.length > 1) {
    const i = etiquetas.indexOf('general');
    if (i >= 0 && !/de oro|aumento|yunque|alma/.test(d)) etiquetas.splice(i, 1);
  }
  return etiquetas.length ? etiquetas : ['general'];
}

/** Familias de aumentos que se combinan entre sí, por su clave interna. */
const FAMILIAS: [string, RegExp][] = [
  ['pan', /^aram_breadand/],
  ['alcance', /scop(ed|ier|iest)weapons/],
  ['yunques', /^aram_stats/],
  ['bolaNieve', /snowball|snowday|snowbomb|sharktempest/],
  ['transmutar', /^aram_transmute|pandorasbox|^kingme$/],
  ['almas', /soul$/],
  ['pentakill', /^goh_pentakillaug/],
  ['mejoras', /^aram_upgrade_|^upgrade_/],
  ['misiones', /quest/],
];

export function familiaDe(clave: string): string | null {
  const k = clave.toLowerCase();
  // Alma Hextech, Infernal… son almas de dragón; «SoulSiphon» y «SoulEater» no.
  for (const [familia, re] of FAMILIAS) {
    if (familia === 'almas' && !/^(aram_)?(infernal|mountain|ocean|hextech|omni)soul$/.test(k)) continue;
    if (re.test(k)) return familia;
  }
  return null;
}

export function rarezaDe(rarity: unknown): Rareza | null {
  if (rarity === 'kSilver') return 'plata';
  if (rarity === 'kGold') return 'oro';
  if (rarity === 'kPrismatic') return 'prismatico';
  return null;
}
