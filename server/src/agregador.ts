import {
  clasificarObjeto,
  MODOS_JUEGO,
  type Build,
  type EstadisticaElemento,
  type Habilidad,
  type ItemDDragonCrudo,
  type ModoJuego,
  type PaginaRunas,
} from '@coach/shared';
import type { Db } from './db';
import type { Participacion } from './extraer';

export const MIN_PARTIDAS_PARCHE = 200;
export const MIN_PARTIDAS_PUBLICAR = 10;
/** Con menos partidas que estas, la build se marca como «datos limitados». */
export const MAX_PARTIDAS_DATOS_LIMITADOS = 30;
/** Una opción de build necesita al menos este número de partidas… */
export const MIN_PARTIDAS_OPCION = 10;
/** …y al menos esta fracción del total del campeón y rol. */
export const FRACCION_MIN_OPCION = 0.05;
export const MAX_OPCIONES = 3;

/** Aumentos y objetos de Arena que se publican por build (de más a menos elegidos). */
export const MAX_AUMENTOS = 30;
export const MAX_OBJETOS_ARENA = 20;

const FRACCION_MIN_BOTAS = 0.3;
const RUNAS_VACIAS: PaginaRunas = { estiloPrincipal: 0, estiloSecundario: 0, runas: [] };
const MAX_SITUACIONALES = 5;
const NIVELES_R = [6, 11, 16];
const BASICAS: Habilidad[] = ['Q', 'W', 'E'];

/** Valor más frecuente comparado como JSON; en empate gana el primero que aparece. */
function moda<T>(valores: T[]): T | undefined {
  const cuentas = new Map<string, { valor: T; n: number }>();
  for (const v of valores) {
    const k = JSON.stringify(v);
    const c = cuentas.get(k);
    if (c) c.n++;
    else cuentas.set(k, { valor: v, n: 1 });
  }
  let mejor: { valor: T; n: number } | undefined;
  for (const c of cuentas.values()) if (!mejor || c.n > mejor.n) mejor = c;
  return mejor?.valor;
}

function prioridadDe(secuencia: Habilidad[]): Habilidad[] {
  const puntos: Record<string, number> = { Q: 0, W: 0, E: 0 };
  const llegaA5: Record<string, number> = {};
  secuencia.forEach((h, i) => {
    if (!(h in puntos)) return;
    puntos[h]++;
    if (puntos[h] === 5) llegaA5[h] = i;
  });
  const llegan = BASICAS.filter((h) => h in llegaA5).sort((a, b) => llegaA5[a] - llegaA5[b]);
  const resto = BASICAS.filter((h) => !(h in llegaA5)).sort((a, b) => puntos[b] - puntos[a]);
  return [...llegan, ...resto];
}

export function generarOrdenHabilidades(secuencias: Habilidad[][]): Habilidad[] {
  const inicio = moda(secuencias.filter((s) => s.length >= 3).map((s) => s.slice(0, 3))) ?? [
    ...BASICAS,
  ];
  const prioridad = moda(secuencias.map(prioridadDe)) ?? [...BASICAS];

  const puntos: Record<string, number> = { Q: 0, W: 0, E: 0, R: 0 };
  const orden: Habilidad[] = [];
  for (let nivel = 1; nivel <= 18; nivel++) {
    const tope = Math.ceil(nivel / 2);
    const candidata = inicio[nivel - 1];
    let h: Habilidad;
    if (NIVELES_R.includes(nivel)) h = 'R';
    else if (
      nivel <= 3 &&
      BASICAS.includes(candidata) &&
      puntos[candidata] < Math.min(5, tope)
    )
      h = candidata;
    else {
      h =
        prioridad.find((x) => puntos[x] < 5 && puntos[x] < tope) ??
        BASICAS.filter((x) => puntos[x] < 5).sort((a, b) => puntos[a] - puntos[b])[0] ??
        'Q';
    }
    puntos[h]++;
    orden.push(h);
  }
  return orden;
}

export function agregarBuild(
  ps: Participacion[],
  objetos: Record<number, ItemDDragonCrudo>,
  parche: string,
  mezclaParches: boolean,
  ahora: Date = new Date(),
): Build {
  const tipo = (id: number) => (objetos[id] ? clasificarObjeto(id, objetos[id]) : 'otro');
  const legendariosDe = (p: Participacion) => p.compras.filter((id) => tipo(id) === 'legendario');

  const triples = ps.map((p) => legendariosDe(p).slice(0, 3));
  const conTres = triples.filter((t) => t.length >= 3);
  const nucleo = moda(conTres.length > 0 ? conTres : triples.filter((t) => t.length > 0)) ?? [];

  const primerasBotas = ps
    .map((p) => p.compras.find((id) => tipo(id) === 'botas'))
    .filter((id): id is number => id !== undefined);
  const botas =
    ps.length > 0 && primerasBotas.length / ps.length >= FRACCION_MIN_BOTAS
      ? (moda(primerasBotas) ?? null)
      : null;

  const frecuencias = new Map<number, number>();
  for (const p of ps) {
    for (const id of new Set(legendariosDe(p))) {
      if (!nucleo.includes(id)) frecuencias.set(id, (frecuencias.get(id) ?? 0) + 1);
    }
  }
  // Array.prototype.sort es estable: en empate se conserva el orden de primera aparición.
  const situacionales = [...frecuencias.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SITUACIONALES)
    .map(([id]) => id);

  const victorias = ps.filter((p) => p.victoria).length;
  return {
    campeon: ps[0].campeon,
    rol: ps[0].rol,
    parche,
    partidas: ps.length,
    datosLimitados: ps.length < MAX_PARTIDAS_DATOS_LIMITADOS,
    tasaVictoria: victorias / ps.length,
    mezclaParches,
    runas: moda(ps.map((p) => p.runas))!,
    hechizos: moda(ps.map((p) => p.hechizos))!,
    objetosIniciales: moda(ps.map((p) => [...p.iniciales].sort((a, b) => a - b)))!,
    nucleo,
    botas,
    situacionales,
    ordenHabilidades: generarOrdenHabilidades(ps.map((p) => p.habilidades)),
    calculadoEn: ahora.toISOString(),
  };
}

/**
 * Hasta `max` opciones de build: agrupa las partidas por núcleo (los 3 primeros legendarios, en
 * orden) y agrega cada grupo que llegue a max(10, 5 % del total), de más a menos jugado. Si ninguno
 * llega, devuelve la build global como única opción.
 */
export function agregarOpciones(
  ps: Participacion[],
  objetos: Record<number, ItemDDragonCrudo>,
  parche: string,
  mezclaParches: boolean,
  max = MAX_OPCIONES,
  ahora: Date = new Date(),
): Build[] {
  const tipo = (id: number) => (objetos[id] ? clasificarObjeto(id, objetos[id]) : 'otro');
  const grupos = new Map<string, Participacion[]>();
  for (const p of ps) {
    const nucleo = p.compras.filter((id) => tipo(id) === 'legendario').slice(0, 3);
    if (nucleo.length < 3) continue; // partidas cortas: cuentan en el total, pero no forman opción
    const k = nucleo.join(',');
    const g = grupos.get(k);
    if (g) g.push(p);
    else grupos.set(k, [p]);
  }
  const minimo = Math.max(MIN_PARTIDAS_OPCION, FRACCION_MIN_OPCION * ps.length);
  // sort es estable: en empate gana el núcleo que apareció antes.
  const elegidos = [...grupos.values()]
    .filter((g) => g.length >= minimo)
    .sort((a, b) => b.length - a.length)
    .slice(0, max);
  if (elegidos.length === 0) return [{ ...agregarBuild(ps, objetos, parche, mezclaParches, ahora), popularidad: 1 }];
  return elegidos.map((g) => ({ ...agregarBuild(g, objetos, parche, mezclaParches, ahora), popularidad: g.length / ps.length }));
}

/**
 * Cifras de cada elemento (aumento u objeto) dentro de las partidas `ps`: en cuántas aparece (un id repetido en
 * la misma partida cuenta una vez), qué fracción supone, qué fracción de ellas se ganó y, si las partidas tienen
 * puesto (Arena), la posición media. De más a menos elegidos; en empate, por id.
 */
export function estadisticasElementos(
  ps: Participacion[],
  elegir: (p: Participacion) => number[],
  max = MAX_AUMENTOS,
): EstadisticaElemento[] {
  const cuentas = new Map<number, { partidas: number; victorias: number; sumaPosicion: number; conPosicion: number }>();
  for (const p of ps) {
    for (const id of new Set(elegir(p))) {
      const c = cuentas.get(id) ?? { partidas: 0, victorias: 0, sumaPosicion: 0, conPosicion: 0 };
      c.partidas++;
      if (p.victoria) c.victorias++;
      if (typeof p.posicion === 'number') {
        c.sumaPosicion += p.posicion;
        c.conPosicion++;
      }
      cuentas.set(id, c);
    }
  }
  return [...cuentas.entries()]
    .sort((a, b) => b[1].partidas - a[1].partidas || a[0] - b[0])
    .slice(0, max)
    .map(([id, c]) => ({
      id,
      partidas: c.partidas,
      uso: ps.length > 0 ? c.partidas / ps.length : 0,
      tasaVictoria: c.victorias / c.partidas,
      posicionMedia: c.conPosicion > 0 ? c.sumaPosicion / c.conPosicion : null,
    }));
}

/**
 * Build de Arena de un campeón: sin runas ni orden de habilidades (Arena no los usa), con las cifras del modo
 * (posición media, top 4 y victorias = 1.er puesto), los aumentos y los objetos del inventario final por uso.
 */
export function agregarArena(ps: Participacion[], parche: string, mezclaParches: boolean, ahora: Date = new Date()): Build {
  const posiciones = ps.map((p) => p.posicion ?? 8);
  const victorias = posiciones.filter((x) => x === 1).length / ps.length;
  const runasValidas = ps.map((p) => p.runas).filter((r) => r.runas.length > 0);
  return {
    campeon: ps[0].campeon,
    rol: null,
    modo: 'arena',
    parche,
    partidas: ps.length,
    datosLimitados: ps.length < MAX_PARTIDAS_DATOS_LIMITADOS,
    tasaVictoria: victorias,
    mezclaParches,
    runas: moda(runasValidas) ?? RUNAS_VACIAS,
    hechizos: moda(ps.map((p) => p.hechizos))!,
    objetosIniciales: [],
    nucleo: [],
    botas: null,
    situacionales: [],
    ordenHabilidades: [],
    calculadoEn: ahora.toISOString(),
    popularidad: 1,
    arena: {
      posicionMedia: posiciones.reduce((s, x) => s + x, 0) / ps.length,
      top4: posiciones.filter((x) => x <= 4).length / ps.length,
      victorias,
    },
    aumentos: estadisticasElementos(ps, (p) => p.aumentos ?? [], MAX_AUMENTOS),
    objetosArena: estadisticasElementos(ps, (p) => p.compras, MAX_OBJETOS_ARENA),
  };
}

/** Build que se guarda para un campeón (y rol en clasificatoria) en un modo. */
function buildDeModo(
  modo: ModoJuego,
  ps: Participacion[],
  objetos: Record<number, ItemDDragonCrudo>,
  parche: string,
  mezcla: boolean,
  ahora: Date,
): Build {
  if (modo === 'arena') return agregarArena(ps, parche, mezcla, ahora);
  // Arriba, la build global de v1 (todas las partidas), que leen tal cual los clientes antiguos;
  // en `opciones`, las 1-3 opciones por núcleo (la primera ya no coincide con la de arriba).
  const opciones = agregarOpciones(ps, objetos, parche, mezcla, MAX_OPCIONES, ahora);
  const build: Build = { ...agregarBuild(ps, objetos, parche, mezcla, ahora), popularidad: 1, opciones };
  if (modo === 'clasificatoria') return build; // sin `modo`, igual que en v1
  for (const o of opciones) o.modo = modo;
  return {
    ...build,
    modo,
    ...(modo === 'caos' ? { aumentos: estadisticasElementos(ps, (p) => p.aumentos ?? [], MAX_AUMENTOS) } : {}),
  };
}

/**
 * Recalcula y guarda las builds de todos los modos: clasificatoria por campeón y rol; ARAM, ARAM: Caos y Arena
 * por campeón (rol null). Devuelve cuántas guardó.
 */
export function calcularBuilds(
  db: Db,
  objetos: Record<number, ItemDDragonCrudo>,
  parcheActual: string,
  parcheAnterior: string,
): number {
  let guardadas = 0;
  for (const modo of MODOS_JUEGO) {
    for (const { campeon, rol } of db.combinaciones([parcheActual, parcheAnterior], modo)) {
      const actuales = db.participacionesDe(campeon, rol, [parcheActual], modo);
      let ps = actuales;
      let mezcla = false;
      if (actuales.length < MIN_PARTIDAS_PARCHE) {
        ps = db.participacionesDe(campeon, rol, [parcheActual, parcheAnterior], modo);
        mezcla = true;
      }
      if (ps.length < MIN_PARTIDAS_PUBLICAR) continue;
      db.guardarBuild(buildDeModo(modo, ps, objetos, parcheActual, mezcla, new Date()));
      guardadas++;
    }
  }
  return guardadas;
}
