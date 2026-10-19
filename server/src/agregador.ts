import {
  clasificarObjeto,
  type Build,
  type KdaMedio,
  type Habilidad,
  type ItemDDragonCrudo,
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
/** Partidas con KDA necesarias para dar el KDA medio. */
export const MIN_PARTIDAS_KDA = 10;

const FRACCION_MIN_BOTAS = 0.3;
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

export function calcularBuilds(
  db: Db,
  objetos: Record<number, ItemDDragonCrudo>,
  parcheActual: string,
  parcheAnterior: string,
): number {
  let guardadas = 0;
  for (const { campeon, rol } of db.combinaciones([parcheActual, parcheAnterior])) {
    const actuales = db.participacionesDe(campeon, rol, [parcheActual]);
    let ps = actuales;
    let mezcla = false;
    if (actuales.length < MIN_PARTIDAS_PARCHE) {
      ps = db.participacionesDe(campeon, rol, [parcheActual, parcheAnterior]);
      mezcla = true;
    }
    if (ps.length < MIN_PARTIDAS_PUBLICAR) continue;
    // Arriba, la build global de v1 (todas las partidas), que leen tal cual los clientes antiguos;
    // en `opciones`, las 1-3 opciones por núcleo (la primera ya no coincide con la de arriba).
    const ahora = new Date();
    const opciones = agregarOpciones(ps, objetos, parcheActual, mezcla, MAX_OPCIONES, ahora);
    db.guardarBuild({ ...agregarBuild(ps, objetos, parcheActual, mezcla, ahora), popularidad: 1, opciones });
    guardadas++;
  }
  return guardadas;
}
