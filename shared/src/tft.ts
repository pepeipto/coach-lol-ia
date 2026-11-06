/*
 * TFT (Teamfight Tactics): tipos de lo que sirve el servidor y ayudas para poner nombre a los ids internos.
 * Todo es para consultar fuera de la partida (política de Riot): ni aumentos ni Leyendas.
 */

export interface ResumenPuestos {
  /** Tableros de la muestra. */
  tableros: number;
  /** Frecuencia sobre todos los tableros (0-1). */
  frecuencia: number;
  puestoMedio: number;
  /** Fracción de tableros en el top 4 (0-1). */
  top4: number;
  /** Fracción de tableros en primer puesto (0-1). */
  victorias: number;
}

export type TierTft = 'S' | 'A' | 'B' | 'C';
export const TIERS_TFT: readonly TierTft[] = ['S', 'A', 'B', 'C'];

export interface CompTft extends ResumenPuestos {
  /** Clave estable de la composición («rasgoA+rasgoB|portador»). */
  id: string;
  /** Los dos rasgos principales (ids internos). */
  rasgos: string[];
  /** Unidad con más objetos (id interno). */
  portador: string;
  /** Unidades presentes en al menos el 50 % de los tableros, de más a menos frecuente. */
  unidades: { id: string; frecuencia: number }[];
  /** Objetos más usados en el portador (hasta 3). */
  objetosPortador: string[];
  nivelMedio: number;
  tier: TierTft;
}

export interface ObjetosCampeonTft {
  campeon: string;
  tableros: number;
  /** Juegos de 3 objetos con muestra suficiente, de mejor a peor top 4. */
  juegos: ({ objetos: string[] } & ResumenPuestos)[];
  /** Objetos sueltos más usados (hasta 6). */
  populares: { objeto: string; frecuencia: number }[];
}

export interface ResultadoTft {
  parche: string;
  partidas: number;
  comps: CompTft[];
}

/** Id de unidad aceptado en `/tft/campeon/:id` (p. ej. «TFT15_Ahri», «18_Ahri», «Krug18»). */
export const REGEX_UNIDAD_TFT = /^[A-Za-z0-9_]{1,60}$/;

export const RUTAS_TFT = {
  comps: '/tft/comps',
  campeon: (id: string) => `/tft/campeon/${encodeURIComponent(id)}`,
  estado: '/tft/estado',
} as const;

const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const esTexto = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 120;
const esResumen = (x: Record<string, unknown>) =>
  esNumero(x.tableros) && esNumero(x.frecuencia) && esNumero(x.puestoMedio) && esNumero(x.top4) && esNumero(x.victorias);

/** Valida la respuesta de `/tft/comps` (viene de la red): null si no tiene la forma esperada. */
export function normalizarResultadoTft(x: unknown): ResultadoTft | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  if (!esTexto(r.parche) || !esNumero(r.partidas) || !Array.isArray(r.comps)) return null;
  const comps: CompTft[] = [];
  for (const c of r.comps as Record<string, unknown>[]) {
    if (!c || typeof c !== 'object' || !esResumen(c) || !esTexto(c.id) || !esTexto(c.portador) || !esNumero(c.nivelMedio)) continue;
    if (!TIERS_TFT.includes(c.tier as TierTft) || !Array.isArray(c.rasgos) || !Array.isArray(c.unidades) || !Array.isArray(c.objetosPortador)) continue;
    comps.push({
      id: c.id,
      rasgos: (c.rasgos as unknown[]).filter(esTexto),
      portador: c.portador,
      unidades: (c.unidades as { id?: unknown; frecuencia?: unknown }[])
        .filter((u) => u && esTexto(u.id) && esNumero(u.frecuencia))
        .map((u) => ({ id: u.id as string, frecuencia: u.frecuencia as number })),
      objetosPortador: (c.objetosPortador as unknown[]).filter(esTexto),
      nivelMedio: c.nivelMedio,
      tier: c.tier as TierTft,
      tableros: c.tableros as number,
      frecuencia: c.frecuencia as number,
      puestoMedio: c.puestoMedio as number,
      top4: c.top4 as number,
      victorias: c.victorias as number,
    });
  }
  return { parche: r.parche, partidas: r.partidas, comps };
}

/** Valida la respuesta de `/tft/campeon/:id`: null si no tiene la forma esperada. */
export function normalizarObjetosCampeonTft(x: unknown): ObjetosCampeonTft | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  if (!esTexto(r.campeon) || !esNumero(r.tableros) || !Array.isArray(r.juegos) || !Array.isArray(r.populares)) return null;
  return {
    campeon: r.campeon,
    tableros: r.tableros,
    juegos: (r.juegos as Record<string, unknown>[])
      .filter((j) => j && esResumen(j) && Array.isArray(j.objetos))
      .map((j) => ({
        objetos: (j.objetos as unknown[]).filter(esTexto),
        tableros: j.tableros as number,
        frecuencia: j.frecuencia as number,
        puestoMedio: j.puestoMedio as number,
        top4: j.top4 as number,
        victorias: j.victorias as number,
      })),
    populares: (r.populares as { objeto?: unknown; frecuencia?: unknown }[])
      .filter((p) => p && esTexto(p.objeto) && esNumero(p.frecuencia))
      .map((p) => ({ objeto: p.objeto as string, frecuencia: p.frecuencia as number })),
  };
}

/**
 * Parte del id interno que nombra la cosa, sin prefijos de set ni de sistema: «TFT15_Ahri», «18_Ahri», «Krug18» y
 * «DA_18_Brawler» dan «Ahri», «Ahri», «Krug» y «Brawler». Las variantes («MasterYi_AD») se quedan con su sufijo.
 */
export function nucleoIdTft(id: string): string {
  return id
    .replace(/^(?:DA_|TFT_|Item_|TFT\d+_|Set\d+_)+/i, '')
    .replace(/^(?:\d+_)+/, '')
    .replace(/^(?:DA_|TFT_|Item_)+/i, '')
    .replace(/_?\d+$/, '');
}

/** Clave para comparar nombres: sin tildes, mayúsculas, espacios ni signos («Master Yi» → «masteryi»). */
export function claveNombreTft(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Nombre legible a falta de Data Dragon: «DA_18_ElderDragon» → «Elder Dragon», «MasterYi_AD» → «Master Yi». */
export function nombreLegibleTft(id: string): string {
  const nucleo = nucleoIdTft(id).split('_')[0] || id;
  return nucleo.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

/** Entrada de un archivo TFT de Data Dragon (tft-champion, tft-trait, tft-item). */
export interface EntradaDDragonTft {
  id?: string;
  name?: string;
  /** Coste en oro de la unidad (1-5); solo en tft-champion. */
  cost?: number;
  image?: { full?: string; group?: string };
}

export interface NombreTft {
  nombre: string;
  /** Archivo del icono en Data Dragon (`img/<grupo>/<archivo>`), si se encontró. */
  icono?: { grupo: string; archivo: string };
  /** Coste en oro de la unidad (1-5), si se conoce. */
  coste?: number;
}

/**
 * Índice para poner nombre (en el idioma de la app) e icono a los ids internos. `local` es el archivo de Data Dragon
 * en el idioma de la app y `ingles` el de en_US (sirve para casar ids nuevos por su nombre en inglés).
 */
export function crearIndiceNombresTft(local: Record<string, EntradaDDragonTft>, ingles: Record<string, EntradaDDragonTft> = {}) {
  const porClave = new Map<string, EntradaDDragonTft>();
  const anadir = (clave: string, e: EntradaDDragonTft) => {
    if (clave && !porClave.has(clave)) porClave.set(clave, e);
  };
  const localPorId = new Map<string, EntradaDDragonTft>();
  for (const [k, e] of Object.entries(local)) localPorId.set(e?.id ?? k, e);
  for (const [k, e] of localPorId) {
    anadir(claveNombreTft(k), e);
    anadir(claveNombreTft(nucleoIdTft(k)), e);
  }
  for (const [k, e] of Object.entries(ingles)) {
    const id = e?.id ?? k;
    const enLocal = localPorId.get(id);
    if (enLocal && e?.name) anadir(claveNombreTft(e.name), enLocal);
  }
  for (const e of localPorId.values()) if (e?.name) anadir(claveNombreTft(e.name), e);
  // Si el archivo del idioma de la app no llegó o no trae algo, el inglés (mejor un nombre oficial que uno sacado del id).
  for (const [k, e] of Object.entries(ingles)) {
    const id = e?.id ?? k;
    anadir(claveNombreTft(id), e);
    anadir(claveNombreTft(nucleoIdTft(id)), e);
  }

  return (id: string): NombreTft => {
    const nucleo = nucleoIdTft(id);
    const e =
      porClave.get(claveNombreTft(id)) ??
      porClave.get(claveNombreTft(nucleo)) ??
      porClave.get(claveNombreTft(nucleo.split('_')[0] ?? ''));
    if (!e?.name) return { nombre: nombreLegibleTft(id) };
    const archivo = e.image?.full;
    const grupo = e.image?.group;
    const coste = typeof e.cost === 'number' && e.cost >= 1 && e.cost <= 7 ? e.cost : undefined;
    return {
      nombre: e.name,
      ...(archivo && grupo && /^[\w.\-]+$/.test(archivo) && /^[\w-]+$/.test(grupo) ? { icono: { grupo, archivo } } : {}),
      ...(coste ? { coste } : {}),
    };
  };
}
