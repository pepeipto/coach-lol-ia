/**
 * Lógica pura del generador de la voz pregrabada (tools/generar-voz-pack.ts): qué segmentos hay que grabar
 * (sacados de los textos i18n en el momento de generar, no de una lista fija), en qué orden según el presupuesto,
 * cómo se revisa la voz de ElevenLabs y cómo se traducen sus errores. Sin red ni disco: se prueba sola.
 */
import { createHash } from 'node:crypto';
import { normalizarSegmento } from '../src/main/voz/segmentos';

export type Prioridad = 1 | 2 | 3 | 4 | 5;
/** 1 frases fijas frecuentes · 2 resto de fijas · 3 números y calles · 4 campeones · 5 objetos. */
export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = {
  1: 'frases fijas frecuentes (objetivos, nivel/habilidad, combate, muerte, economía)',
  2: 'resto de frases fijas',
  3: 'números y calles',
  4: 'nombres de campeones',
  5: 'nombres de objetos',
};

export interface Segmento {
  clave: string;
  /** Texto que se manda a ElevenLabs (con su puntuación). */
  texto: string;
  prioridad: Prioridad;
}

/** Prefijos de los textos que la voz dice (las plantillas que trae la app; se pueden ampliar con --prefijos). */
export const PREFIJOS_VOZ = ['voz.', 'fase.', 'junglaEnemiga.aviso', 'junglaEnemiga.ruta.', 'junglaEnemiga.objetivo.', 'junglaEnemiga.estructura.'];
/** Grupos de frases que suenan más a menudo: van primero si el presupuesto no da para todo. */
const FRECUENTES = ['voz.obj', 'voz.objetivo', 'voz.dragon', 'voz.tomado', 'voz.robo', 'voz.alma', 'voz.nivel', 'voz.habilidad', 'voz.combate', 'voz.muerte', 'voz.economia', 'voz.compra', 'voz.jungla'];
/** Una plantilla con un solo hueco y como mucho estos valores se graba entera para cada valor (suena más natural). */
export const MAX_EXPANDIR = 12;
export const NUMEROS = Array.from({ length: 61 }, (_, i) => String(i));
const HUECO = /\{(\w+)\}/g;

/** Valores de cada hueco ({objeto}, {campeon}…) y su prioridad. */
export type Valores = Record<string, { valores: string[]; prioridad: Prioridad }>;

const valoresDe = (textos: Record<string, string>, prefijos: string[]) =>
  Object.entries(textos)
    .filter(([k, v]) => prefijos.some((p) => k.startsWith(p)) && !v.includes('{'))
    .map(([, v]) => v);

/**
 * Valores de los huecos sacados de los propios textos (objetivos, dragones, torres, campamentos, zonas…) más los
 * de Data Dragon (campeones y objetos del idioma) y los números 0-60. Un hueco `{x}` sin proveedor propio toma
 * los textos `voz.x.*`, `voz.xNombre.*` y `junglaEnemiga.x.*`.
 */
export function valoresDeHuecos(textos: Record<string, string>, ddragon: { campeones: string[]; objetos: string[] }, huecos: Iterable<string>): Valores {
  const salida: Valores = {
    objetivo: { valores: [...valoresDe(textos, ['voz.dragon.']), ...valoresDe(textos, ['objetivo.'])], prioridad: 2 },
    campamento: { valores: valoresDe(textos, ['jungla.voz.']), prioridad: 2 },
    habilidad: { valores: ['Q', 'W', 'E', 'R'], prioridad: 2 },
    campeon: { valores: ddragon.campeones, prioridad: 4 },
    objeto: { valores: ddragon.objetos, prioridad: 5 },
    zona: { valores: valoresDe(textos, ['junglaEnemiga.zona.']), prioridad: 3 },
    calle: { valores: valoresDe(textos, ['junglaEnemiga.calle.', 'junglaEnemiga.calleDe.']), prioridad: 3 },
    inicio: { valores: valoresDe(textos, ['junglaEnemiga.lado.']), prioridad: 3 },
  };
  for (const h of huecos) {
    if (salida[h]) continue;
    if (/^(n|numero|nivel|minuto|minutos|segundos|oro|cs|cantidad|muertes|racha|asesinatos|tiempo|total|puntos)$/i.test(h)) {
      salida[h] = { valores: NUMEROS, prioridad: 3 };
      continue;
    }
    const propios = valoresDe(textos, [`voz.${h}.`, `voz.${h}Nombre.`, `junglaEnemiga.${h}.`]);
    if (propios.length) salida[h] = { valores: propios, prioridad: /torre|inhibidor/.test(h) ? 3 : 2 };
  }
  return salida;
}

/** Plantillas de voz de los textos (claves con uno de los prefijos). */
export function plantillasDeVoz(textos: Record<string, string>, prefijos = PREFIJOS_VOZ): [string, string][] {
  return Object.entries(textos).filter(([k]) => prefijos.some((p) => k.startsWith(p)));
}

/** Huecos que usan las plantillas. */
export function huecosDe(plantillas: [string, string][]): Set<string> {
  const s = new Set<string>();
  for (const [, v] of plantillas) for (const m of v.matchAll(HUECO)) s.add(m[1]!);
  return s;
}

const prioridadFija = (clave: string): Prioridad => (FRECUENTES.some((p) => clave.startsWith(p)) ? 1 : 2);

/**
 * Segmentos que hay que grabar para que todas las frases de voz suenen con la voz pregrabada:
 * - plantilla sin huecos: la frase entera;
 * - plantilla con un hueco de pocos valores (≤ MAX_EXPANDIR): la frase entera para cada valor;
 * - si no: sus partes fijas enteras y cada valor del hueco como un clip aparte.
 * Un hueco sin valores conocidos se avisa en `sinValores` (esas frases saldrán con la voz natural).
 */
export function recogerSegmentos(plantillas: [string, string][], valores: Valores): { segmentos: Segmento[]; sinValores: string[] } {
  const mapa = new Map<string, Segmento>();
  const sinValores = new Set<string>();
  const añadir = (texto: string, prioridad: Prioridad) => {
    const t = texto.trim().replace(/\s+/g, ' ');
    const clave = normalizarSegmento(t);
    if (!clave) return;
    const ya = mapa.get(clave);
    if (!ya || prioridad < ya.prioridad) mapa.set(clave, { clave, texto: ya && ya.texto.length >= t.length ? ya.texto : t, prioridad });
  };
  for (const [k, v] of plantillas) {
    const huecos = [...v.matchAll(HUECO)].map((m) => m[1]!);
    const p = prioridadFija(k);
    if (huecos.length === 0) {
      añadir(v, p);
      continue;
    }
    const faltan = huecos.filter((h) => !valores[h]?.valores.length);
    for (const h of faltan) sinValores.add(h);
    if (faltan.length) continue;
    if (huecos.length === 1 && valores[huecos[0]!]!.valores.length <= MAX_EXPANDIR) {
      for (const valor of valores[huecos[0]!]!.valores) añadir(v.replace(HUECO, valor), p);
      continue;
    }
    for (const parte of v.split(HUECO).filter((_, i) => i % 2 === 0)) añadir(parte, p);
    for (const h of huecos) for (const valor of valores[h]!.valores) añadir(valor, valores[h]!.prioridad);
  }
  const segmentos = [...mapa.values()].sort((a, b) => a.prioridad - b.prioridad || a.clave.localeCompare(b.clave));
  return { segmentos, sinValores: [...sinValores].sort() };
}

/** Nombre del clip: estable para el mismo idioma, voz, modelo y texto (así se reanuda sin repetir). */
export const archivoClip = (idioma: string, vozId: string, modelo: string, clave: string) =>
  `${createHash('sha1').update([idioma, vozId, modelo, clave].join('\u0001')).digest('hex').slice(0, 20)}.mp3`;

export interface Plan<T extends Segmento = Segmento> {
  generar: T[];
  pendientes: T[];
  caracteres: number;
  creditos: number;
}

/** En orden de prioridad, lo que cabe en el presupuesto; lo que no, queda pendiente para otra vez. */
export function planificar<T extends Segmento>(segmentos: T[], yaHechos: Set<string>, multiplicador: number, maxCreditos: number): Plan<T> {
  const plan: Plan<T> = { generar: [], pendientes: [], caracteres: 0, creditos: 0 };
  let lleno = false;
  for (const s of segmentos) {
    if (yaHechos.has(s.clave)) continue;
    const coste = s.texto.length * multiplicador;
    if (lleno || plan.creditos + coste > maxCreditos) {
      // Sin saltarse prioridades: en cuanto algo no cabe, lo demás también espera.
      lleno = true;
      plan.pendientes.push(s);
      continue;
    }
    plan.generar.push(s);
    plan.caracteres += s.texto.length;
    plan.creditos += coste;
  }
  return plan;
}

/** Créditos por carácter de cada modelo si la API no lo dice (estimación: Flash y Turbo cuestan la mitad). */
export const MULTIPLICADOR_POR_DEFECTO: Record<string, number> = { eleven_flash_v2_5: 0.5, eleven_turbo_v2_5: 0.5, eleven_multilingual_v2: 1 };

/** Multiplicador de un modelo según GET /v1/models (`model_rates.character_cost_multiplier`), o null. */
export function multiplicadorDeModelos(modelos: unknown, id: string): number | null {
  if (!Array.isArray(modelos)) return null;
  const m = modelos.find((x) => (x as { model_id?: string })?.model_id === id) as
    | { model_rates?: { character_cost_multiplier?: unknown }; character_cost_multiplier?: unknown }
    | undefined;
  const v = m?.model_rates?.character_cost_multiplier ?? m?.character_cost_multiplier;
  return typeof v === 'number' && v > 0 ? v : null;
}

/** Créditos que quedan según GET /v1/user/subscription. */
export function creditosRestantes(sub: unknown): { usados: number; limite: number; restantes: number } | null {
  const s = sub as { character_count?: unknown; character_limit?: unknown } | null;
  if (!s || typeof s.character_count !== 'number' || typeof s.character_limit !== 'number') return null;
  return { usados: s.character_count, limite: s.character_limit, restantes: Math.max(0, s.character_limit - s.character_count) };
}

export interface RevisionVoz {
  nombre: string;
  categoria: string;
  /** Voz de la biblioteca de la comunidad (añadida a la cuenta, no creada por el dueño). */
  biblioteca: boolean;
  /** Motivo para no seguir, o null. */
  bloqueo: string | null;
  avisos: string[];
}

/** Busca, en cualquier nivel, campos booleanos sobre uso comercial o redistribución que estén en false. */
function restricciones(o: unknown, ruta = ''): string[] {
  if (!o || typeof o !== 'object') return [];
  const salida: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    const r = ruta ? `${ruta}.${k}` : k;
    if (typeof v === 'boolean' && /commercial|redistribut/i.test(k) && v === false) salida.push(r);
    else if (typeof v === 'object') salida.push(...restricciones(v, r));
  }
  return salida;
}

/** Revisa la respuesta de GET /v1/voices/{id}: categoría y restricciones de uso. */
export function revisarVoz(v: unknown): RevisionVoz {
  const voz = (v ?? {}) as { name?: string; category?: string; is_owner?: boolean; sharing?: Record<string, unknown> | null };
  const categoria = voz.category ?? 'desconocida';
  const sharing = voz.sharing ?? null;
  const biblioteca =
    categoria === 'library' || (!!sharing && voz.is_owner === false) || (!!sharing && typeof sharing.original_voice_id === 'string' && voz.is_owner !== true);
  const prohibidos = restricciones(voz);
  const avisos: string[] = [];
  if (biblioteca) avisos.push('Es una voz de la biblioteca de la comunidad: revisa sus condiciones en elevenlabs.io antes de distribuir audio.');
  if (sharing && typeof sharing.notice_period === 'number' && sharing.notice_period > 0)
    avisos.push(`La voz tiene un periodo de aviso de ${sharing.notice_period} días si su autor la retira.`);
  const bloqueo = biblioteca && prohibidos.length ? `La voz de la biblioteca no permite uso comercial o redistribución (${prohibidos.join(', ')}).` : null;
  return { nombre: voz.name ?? '', categoria, biblioteca, bloqueo, avisos };
}

/** Texto claro para los errores HTTP de ElevenLabs (como hace Jarvis). */
export function explicarError(status: number, cuerpo: string): string {
  const d = cuerpo.toLowerCase();
  if (d.includes('quota_exceeded') || status === 402) return 'Tu cuenta de ElevenLabs no tiene créditos suficientes para seguir.';
  if (status === 401) return 'ElevenLabs rechaza la clave (ELEVENLABS_API_KEY). Revísala.';
  if (status === 403) return 'La clave no tiene permiso para esta operación (revisa sus permisos en ElevenLabs).';
  if (status === 404) return 'ElevenLabs no encuentra esa voz (ELEVENLABS_VOICE_ID).';
  if (status === 422 || status === 400) return 'ElevenLabs no ha aceptado la petición (texto, modelo o voz no válidos).';
  if (status === 429) return 'Demasiadas peticiones seguidas o demasiadas a la vez: se espera y se reintenta.';
  if (status >= 500) return 'ElevenLabs tiene problemas ahora mismo; prueba más tarde.';
  return `ElevenLabs respondió ${status}.`;
}

/** Lee SOLO la línea ELEVENLABS_API_KEY de un archivo .env (admite comillas y `export`); el resto se ignora. */
export function leerEnv(texto: string): { clave: string | null } {
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.*?)\s*$/.exec(linea);
    if (m) return { clave: m[1]!.replace(/^(['"])(.*)\1$/, '$2') || null };
  }
  return { clave: null };
}

/** Nombres de Data Dragon: campeones y objetos comprables en la Grieta (sin duplicados ni objetos de campeón). */
export function nombresDdragon(campeones: unknown, objetos: unknown): { campeones: string[]; objetos: string[] } {
  const c = Object.values(((campeones as { data?: Record<string, { name?: string }> })?.data ?? {}) as Record<string, { name?: string }>)
    .map((x) => x.name)
    .filter((x): x is string => !!x);
  type Objeto = { name?: string; gold?: { purchasable?: boolean; total?: number }; maps?: Record<string, boolean>; requiredChampion?: string; requiredAlly?: string; inStore?: boolean };
  const o = Object.values(((objetos as { data?: Record<string, Objeto> })?.data ?? {}) as Record<string, Objeto>)
    .filter((x) => x.name && x.gold?.purchasable && (x.gold.total ?? 0) > 0 && (x.maps?.['11'] || x.maps?.['12']) && !x.requiredChampion && !x.requiredAlly && x.inStore !== false)
    .map((x) => x.name!.replace(/<[^>]+>/g, '').trim());
  return { campeones: [...new Set(c)].sort(), objetos: [...new Set(o)].sort() };
}
