import type { AlmacenTft, TableroTft } from './datos';
import type { InformeRecolectorTft } from './recolector';

/**
 * Estadísticas de TFT que se calculan con los tableros guardados. Política de Riot: nada de aumentos ni de Leyendas;
 * solo composiciones, unidades y objetos, para consultarlos fuera de la partida.
 */

/** Mínimo de tableros para publicar una composición o una combinación de objetos. */
export const MIN_TABLEROS_COMP = 30;
export const MIN_TABLEROS_OBJETOS = 20;
/** Con menos partidas en el parche actual se suman las del anterior. */
const MIN_PARTIDAS_PARCHE = 200;

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

export interface CompTft extends ResumenPuestos {
  /** Clave estable de la composición («rasgoA+rasgoB|portador»). */
  id: string;
  /** Los dos rasgos principales (nombres internos). */
  rasgos: string[];
  /** Unidad con más objetos (id interno). */
  portador: string;
  /** Unidades presentes en al menos el 50 % de los tableros, de más a menos frecuente. */
  unidades: { id: string; frecuencia: number }[];
  /** Objetos más usados en el portador (hasta 3). */
  objetosPortador: string[];
  nivelMedio: number;
  tier: 'S' | 'A' | 'B' | 'C';
}

export interface ObjetosCampeonTft {
  campeon: string;
  tableros: number;
  /** Juegos de 3 objetos con muestra suficiente, de mejor a peor top 4. */
  juegos: ({ objetos: string[] } & ResumenPuestos)[];
  /** Objetos sueltos más usados (hasta 6). */
  populares: { objeto: string; frecuencia: number }[];
}

/** Resultado del último ciclo de TFT (GET /tft/estado). Los errores son mensajes del servidor, nunca la clave. */
export interface EstadoTft {
  fecha: string;
  parche: string;
  regiones: Record<string, InformeRecolectorTft | { error: string }>;
  partidasParche: number;
  partidasParcheAnterior?: number;
}

export interface ResultadoTft {
  parche: string;
  partidas: number;
  comps: CompTft[];
}

function resumir(puestos: number[], total: number): ResumenPuestos {
  const n = puestos.length;
  const suma = puestos.reduce((a, p) => a + p, 0);
  return {
    tableros: n,
    frecuencia: total > 0 ? n / total : 0,
    puestoMedio: n > 0 ? Math.round((suma / n) * 100) / 100 : 0,
    top4: n > 0 ? puestos.filter((p) => p <= 4).length / n : 0,
    victorias: n > 0 ? puestos.filter((p) => p === 1).length / n : 0,
  };
}

/** Unidad portadora: la que lleva más objetos (a igualdad, más estrellas; luego id). */
export function portadorDe(t: TableroTft): string | null {
  const candidatas = t.unidades.filter((u) => u.objetos.length > 0);
  if (candidatas.length === 0) return null;
  candidatas.sort((a, b) => b.objetos.length - a.objetos.length || b.estrellas - a.estrellas || a.id.localeCompare(b.id));
  return candidatas[0].id;
}

/** Los dos rasgos principales: mayor estilo, luego más unidades; los de una sola unidad (únicos) no cuentan. */
export function rasgosPrincipales(t: TableroTft): string[] {
  return t.rasgos
    .filter((r) => r.unidades >= 2)
    .sort((a, b) => b.estilo - a.estilo || b.unidades - a.unidades || a.nombre.localeCompare(b.nombre))
    .slice(0, 2)
    .map((r) => r.nombre)
    .sort();
}

export function claveComp(t: TableroTft): string | null {
  const rasgos = rasgosPrincipales(t);
  const portador = portadorDe(t);
  if (rasgos.length === 0 || !portador) return null;
  return `${rasgos.join('+')}|${portador}`;
}

/** Tier por puesto medio: S < 4,0; A < 4,3; B < 4,6; C el resto. */
export function tierDe(puestoMedio: number): CompTft['tier'] {
  if (puestoMedio < 4.0) return 'S';
  if (puestoMedio < 4.3) return 'A';
  if (puestoMedio < 4.6) return 'B';
  return 'C';
}

const masFrecuentes = (cuenta: Map<string, number>, n: number) =>
  [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

export function calcularComps(tableros: TableroTft[]): CompTft[] {
  const grupos = new Map<string, TableroTft[]>();
  for (const t of tableros) {
    const k = claveComp(t);
    if (!k) continue;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(t);
  }
  const comps: CompTft[] = [];
  for (const [id, ts] of grupos) {
    if (ts.length < MIN_TABLEROS_COMP) continue;
    const [rasgosTxt, portador] = id.split('|');
    const unidades = new Map<string, number>();
    const objetos = new Map<string, number>();
    for (const t of ts) {
      for (const u of new Set(t.unidades.map((x) => x.id))) unidades.set(u, (unidades.get(u) ?? 0) + 1);
      const p = t.unidades.find((u) => u.id === portador);
      for (const o of p?.objetos ?? []) objetos.set(o, (objetos.get(o) ?? 0) + 1);
    }
    const resumen = resumir(ts.map((t) => t.puesto), tableros.length);
    comps.push({
      id,
      rasgos: rasgosTxt.split('+'),
      portador,
      unidades: masFrecuentes(unidades, 20)
        .filter(([, n]) => n / ts.length >= 0.5)
        .map(([u, n]) => ({ id: u, frecuencia: n / ts.length })),
      objetosPortador: masFrecuentes(objetos, 3).map(([o]) => o),
      nivelMedio: Math.round((ts.reduce((a, t) => a + t.nivel, 0) / ts.length) * 10) / 10,
      tier: tierDe(resumen.puestoMedio),
      ...resumen,
    });
  }
  return comps.sort((a, b) => a.puestoMedio - b.puestoMedio || b.tableros - a.tableros);
}

export function calcularObjetosCampeones(tableros: TableroTft[]): ObjetosCampeonTft[] {
  const porCampeon = new Map<string, { puesto: number; objetos: string[] }[]>();
  for (const t of tableros) {
    for (const u of t.unidades) {
      (porCampeon.get(u.id) ?? porCampeon.set(u.id, []).get(u.id)!).push({ puesto: t.puesto, objetos: u.objetos });
    }
  }
  const resultado: ObjetosCampeonTft[] = [];
  for (const [campeon, apariciones] of porCampeon) {
    const juegos = new Map<string, number[]>();
    const sueltos = new Map<string, number>();
    for (const a of apariciones) {
      for (const o of new Set(a.objetos)) sueltos.set(o, (sueltos.get(o) ?? 0) + 1);
      if (a.objetos.length !== 3) continue;
      const k = [...a.objetos].sort().join(',');
      (juegos.get(k) ?? juegos.set(k, []).get(k)!).push(a.puesto);
    }
    const conObjetos = apariciones.filter((a) => a.objetos.length > 0).length;
    const lista = [...juegos.entries()]
      .filter(([, ps]) => ps.length >= MIN_TABLEROS_OBJETOS)
      .map(([k, ps]) => ({ objetos: k.split(','), ...resumir(ps, conObjetos) }))
      .sort((a, b) => b.top4 - a.top4 || b.tableros - a.tableros)
      .slice(0, 5);
    if (lista.length === 0 && sueltos.size === 0) continue;
    resultado.push({
      campeon,
      tableros: apariciones.length,
      juegos: lista,
      populares: masFrecuentes(sueltos, 6).map(([objeto, n]) => ({ objeto, frecuencia: conObjetos > 0 ? n / conObjetos : 0 })),
    });
  }
  return resultado;
}

/**
 * Recalcula y guarda las estadísticas de TFT del parche (con el anterior si hay pocas partidas). Devuelve el
 * resultado guardado, o null si no hay tableros.
 */
export function recalcularTft(almacen: AlmacenTft, parche: string, parcheAnterior: string): ResultadoTft | null {
  const partidas = almacen.partidas(parche);
  const parches = partidas < MIN_PARTIDAS_PARCHE && parcheAnterior !== parche ? [parche, parcheAnterior] : [parche];
  const tableros = almacen.tableros(parches);
  if (tableros.length === 0) return null;
  const resultado: ResultadoTft = { parche, partidas: new Set(tableros.map((t) => t.matchId)).size, comps: calcularComps(tableros) };
  almacen.borrarEstadisticas('comps');
  almacen.guardarEstadistica('comps', 'todas', parche, resultado);
  almacen.borrarEstadisticas('objetos');
  for (const o of calcularObjetosCampeones(tableros)) almacen.guardarEstadistica('objetos', o.campeon.toLowerCase(), parche, o);
  return resultado;
}
