import {
  clasificarObjeto,
  type Build,
  type Habilidad,
  type ItemDDragonCrudo,
} from '@coach/shared';
import type { Db } from './db';
import type { Participacion } from './extraer';

export const MIN_PARTIDAS_PARCHE = 200;
export const MIN_PARTIDAS_PUBLICAR = 20;

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
    db.guardarBuild(agregarBuild(ps, objetos, parcheActual, mezcla));
    guardadas++;
  }
  return guardadas;
}
