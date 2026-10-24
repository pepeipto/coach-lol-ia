import {
  clasificarObjeto,
  MODOS_JUEGO,
  type BuildRotativa,
  type Build,
  type KdaMedio,
  type ElementoPopular,
  type Habilidad,
  type ItemDDragonCrudo,
  type ModoJuego,
  type OpcionRunas,
  type PaginaRunas,
} from '@coach/shared';
import type { Db } from './db';
import type { Participacion } from './extraer';
import { agregarRuta, type RutaPartida } from './rutaJungla';
import { tasasCampeones } from './tasas';
import { colaDeModo, mapaDeModo, type ModoRotativoInterno } from './rotativos/modos';

export const MIN_PARTIDAS_PARCHE = 200;
export const MIN_PARTIDAS_PUBLICAR = 10;
/** Con menos partidas que estas, la build se marca como «datos limitados». */
export const MAX_PARTIDAS_DATOS_LIMITADOS = 30;
/** Una opción de build necesita al menos este número de partidas… */
export const MIN_PARTIDAS_OPCION = 10;
/** …y al menos esta fracción del total del campeón y rol. */
export const FRACCION_MIN_OPCION = 0.05;
export const MAX_OPCIONES = 3;
/** Páginas de runas elegibles por campeón y rol: como mucho estas, con al menos MIN_PARTIDAS_OPCION partidas cada una. */
export const MAX_OPCIONES_RUNAS = 3;
/** Partidas con KDA necesarias para dar el KDA medio. */
export const MIN_PARTIDAS_KDA = 10;

/**
 * Aumentos y objetos de Arena que se publican por build: los más elegidos, solo con su uso. La política de juego de
 * Riot prohíbe enseñar % de victorias de aumentos y de objetos de Arena (ver `politica.ts` en shared), así que no se
 * calculan victorias, posición media ni listas de «mejores».
 */
export const MAX_AUMENTOS = 30;
export const MAX_OBJETOS_ARENA = 20;

/** Mapa de Data Dragon de las partidas (para clasificar objetos): el suyo (modos rotativos) o el de su modo; sin modo, la Grieta. */
const mapaDe = (ps: Participacion[]) => ps[0]?.mapa ?? mapaDeModo(ps[0]?.modo);

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

const redondear = (n: number, decimales: number) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/** KDA medio de las participaciones que lo tienen; null si son menos de 10. */
export function kdaMedio(ps: Participacion[]): KdaMedio | null {
  const con = ps.filter((p) => p.asesinatos !== undefined && p.muertes !== undefined && p.asistencias !== undefined);
  if (con.length < MIN_PARTIDAS_KDA) return null;
  const media = (f: (p: Participacion) => number) => con.reduce((t, p) => t + f(p), 0) / con.length;
  const k = media((p) => p.asesinatos!);
  const d = media((p) => p.muertes!);
  const a = media((p) => p.asistencias!);
  return { asesinatos: redondear(k, 1), muertes: redondear(d, 1), asistencias: redondear(a, 1), ratio: redondear((k + a) / Math.max(1, d), 2) };
}

export function agregarBuild(
  ps: Participacion[],
  objetos: Record<number, ItemDDragonCrudo>,
  parche: string,
  mezclaParches: boolean,
  ahora: Date = new Date(),
): Build {
  const mapa = mapaDe(ps);
  const tipo = (id: number) => (objetos[id] ? clasificarObjeto(id, objetos[id], mapa) : 'otro');
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
    kda: kdaMedio(ps),
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
  const mapa = mapaDe(ps);
  const tipo = (id: number) => (objetos[id] ? clasificarObjeto(id, objetos[id], mapa) : 'otro');
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
 * Hasta `max` páginas de runas elegibles: agrupa las partidas por runa clave y rama secundaria y, en cada grupo con
 * al menos 10 partidas, toma la página completa más habitual (runas principales, secundarias y fragmentos, comparada
 * entera para que siempre sea una página válida). Las cifras (partidas, % de victorias, popularidad) son las del
 * grupo. De más a menos jugadas; en empate, el grupo que apareció antes. Sin ningún grupo válido, lista vacía.
 */
export function agregarOpcionesRunas(ps: Participacion[], max = MAX_OPCIONES_RUNAS): OpcionRunas[] {
  const grupos = new Map<string, Participacion[]>();
  for (const p of ps) {
    if (p.runas.runas.length === 0) continue; // sin página (p. ej. datos de Arena): no forma grupo
    const k = `${p.runas.runas[0]}-${p.runas.estiloSecundario}`;
    const g = grupos.get(k);
    if (g) g.push(p);
    else grupos.set(k, [p]);
  }
  return [...grupos.values()]
    .filter((g) => g.length >= MIN_PARTIDAS_OPCION)
    .sort((a, b) => b.length - a.length)
    .slice(0, max)
    .map((g) => ({
      runas: moda(g.map((p) => p.runas))!,
      partidas: g.length,
      tasaVictoria: g.filter((p) => p.victoria).length / g.length,
      popularidad: g.length / ps.length,
      datosLimitados: g.length < MAX_PARTIDAS_DATOS_LIMITADOS,
    }));
}

/**
 * Los elementos (aumentos u objetos de Arena) más elegidos en las partidas `ps`: en cuántas aparece cada uno (un id
 * repetido en la misma partida cuenta una vez) y qué fracción supone. De más a menos elegidos; en empate, por id.
 * A propósito no mira `victoria` ni `posicion`: nada de rendimiento por aumento u objeto de Arena.
 */
export function elementosPopulares(ps: Participacion[], elegir: (p: Participacion) => number[], max = MAX_AUMENTOS): ElementoPopular[] {
  const cuentas = new Map<number, number>();
  for (const p of ps) for (const id of new Set(elegir(p))) cuentas.set(id, (cuentas.get(id) ?? 0) + 1);
  return [...cuentas.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, max)
    .map(([id, partidas]) => ({ id, partidas, uso: ps.length > 0 ? partidas / ps.length : 0 }));
}

/**
 * Build de Arena de un campeón: sin runas ni orden de habilidades (Arena no los usa), con las cifras del modo
 * (posición media, top 4 y victorias = 1.er puesto) y los aumentos y objetos del inventario final más elegidos,
 * solo con su uso.
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
    kda: kdaMedio(ps),
    calculadoEn: ahora.toISOString(),
    popularidad: 1,
    arena: {
      posicionMedia: posiciones.reduce((s, x) => s + x, 0) / ps.length,
      top4: posiciones.filter((x) => x <= 4).length / ps.length,
      victorias,
    },
    aumentosPopulares: elementosPopulares(ps, (p) => p.aumentos ?? [], MAX_AUMENTOS),
    objetosArenaPopulares: elementosPopulares(ps, (p) => p.compras, MAX_OBJETOS_ARENA),
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
  // Páginas de runas elegibles aparte (3.0.1); se omite el campo si ningún grupo llega a 10 partidas.
  const opcionesRunas = agregarOpcionesRunas(ps);
  const build: Build = {
    ...agregarBuild(ps, objetos, parche, mezcla, ahora),
    popularidad: 1,
    opciones,
    ...(opcionesRunas.length > 0 ? { opcionesRunas } : {}),
  };
  if (modo === 'clasificatoria') {
    // Track F2: la ruta habitual del jungla, solo con 30 partidas o más que la tengan (las antiguas no la tienen).
    const ruta = build.rol === 'JUNGLE' ? agregarRuta(ps.map((p) => p.rutaJungla).filter((r): r is RutaPartida => !!r)) : null;
    return ruta ? { ...build, rutaJungla: ruta } : build; // sin `modo`, igual que en v1
  }
  // Los aumentos son del campeón, no de una opción: se copian en cada opción, porque la vista pinta la opción elegida.
  const extra: Partial<Build> =
    modo === 'caos'
      ? { aumentosPopulares: elementosPopulares(ps, (p) => p.aumentos ?? [], MAX_AUMENTOS) }
      : {};
  for (const o of opciones) Object.assign(o, { modo }, extra);
  return { ...build, modo, ...extra };
}

/**
 * 3.8: build de un modo rotativo (URF, Uno para todos…): como la de ARAM, por campeón (rol null), con opciones por
 * núcleo y páginas de runas, más la cola y el `gameMode`. Si el modo tiene aumentos, solo su uso (`politica.ts`).
 * Sin `modo` en el JSON: el contrato (`BuildRotativa`) identifica el modo por `cola`.
 */
export function agregarRotativo(
  modo: ModoRotativoInterno,
  ps: Participacion[],
  objetos: Record<number, ItemDDragonCrudo>,
  parche: string,
  mezcla: boolean,
  ahora: Date = new Date(),
): BuildRotativa {
  const cola = colaDeModo(modo)!;
  const gameMode = moda(ps.map((p) => p.gameMode).filter((g): g is string => !!g)) ?? '';
  const sinRol = ps.map((p) => ({ ...p, rol: null }));
  const opciones = agregarOpciones(sinRol, objetos, parche, mezcla, MAX_OPCIONES, ahora);
  const opcionesRunas = agregarOpcionesRunas(sinRol);
  const conAumentos = sinRol.some((p) => (p.aumentos?.length ?? 0) > 0);
  const extra = conAumentos ? { aumentosPopulares: elementosPopulares(sinRol, (p) => p.aumentos ?? [], MAX_AUMENTOS) } : {};
  for (const o of opciones) Object.assign(o, { rol: null, cola, gameMode }, extra);
  return {
    ...agregarBuild(sinRol, objetos, parche, mezcla, ahora),
    popularidad: 1,
    opciones,
    ...(opcionesRunas.length > 0 ? { opcionesRunas } : {}),
    ...extra,
    rol: null,
    cola,
    gameMode,
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
  // 3.9.1: tasas de bloqueo y de selección de clasificatoria (por campeón, todos los roles), en su build.
  const tasas = tasasCampeones(db.sql, parcheActual, parcheAnterior);
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
      const build = buildDeModo(modo, ps, objetos, parcheActual, mezcla, new Date());
      db.guardarBuild(modo === 'clasificatoria' ? { ...build, ...tasas.get(campeon) } : build);
      guardadas++;
    }
  }
  // 3.8: cada cola rotativa con datos, por campeón (rol null), como ARAM.
  for (const modo of db.modosRotativos([parcheActual, parcheAnterior])) {
    for (const { campeon } of db.combinaciones([parcheActual, parcheAnterior], modo)) {
      const actuales = db.participacionesDe(campeon, null, [parcheActual], modo);
      let ps = actuales;
      let mezcla = false;
      if (actuales.length < MIN_PARTIDAS_PARCHE) {
        ps = db.participacionesDe(campeon, null, [parcheActual, parcheAnterior], modo);
        mezcla = true;
      }
      if (ps.length < MIN_PARTIDAS_PUBLICAR) continue;
      db.guardarBuild(agregarRotativo(modo, ps, objetos, parcheActual, mezcla, new Date()), modo);
      guardadas++;
    }
  }
  return guardadas;
}
