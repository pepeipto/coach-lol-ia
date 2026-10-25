import type Database from 'better-sqlite3';
import {
  MAX_SINERGIAS_POR_ROL,
  MIN_PARTIDAS_ENFRENTAMIENTO,
  PARTIDAS_ENFRENTAMIENTO_FIABLE,
  ROLES,
  tasaSuavizada,
  type Rol,
  type SinergiaAliado,
  type SinergiasCampeon,
} from '@coach/shared';
import type { Db } from './db';
import { idDDragon } from './enfrentamientos';

/*
 * 3.9.1 «Sinergias»: con qué compañeros de equipo gana más cada campeón en cada rol (clasificatoria; las normales de
 * la Grieta usan los mismos datos).
 *
 * Se recalculan en cada ciclo junto a los enfrentamientos y se guardan en la tabla `sinergias` (una fila por campeón,
 * rol, compañero y rol del compañero, desde los dos lados). La ruta solo lee esa tabla. Mismas reglas que los
 * enfrentamientos: parche actual si el par tiene `PARTIDAS_ENFRENTAMIENTO_FIABLE` partidas o más en él (si no, el
 * actual y el anterior), `MIN_PARTIDAS_ENFRENTAMIENTO` partidas como mínimo y orden por tasa suavizada.
 */

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS sinergias (
    campeon TEXT NOT NULL,
    rol TEXT NOT NULL,
    aliado TEXT NOT NULL,
    rol_aliado TEXT NOT NULL,
    parche TEXT NOT NULL,
    campeon_id TEXT NOT NULL,
    aliado_id TEXT NOT NULL,
    partidas INTEGER NOT NULL,
    victorias INTEGER NOT NULL,
    PRIMARY KEY (campeon, rol, aliado, rol_aliado)
  );`;

export function asegurarTablaSinergias(sql: Database.Database): void {
  sql.exec(ESQUEMA);
}

interface Lado {
  partidas: number;
  victorias: number;
}

interface Par {
  campeon: string;
  rol: Rol;
  aliado: string;
  rolAliado: Rol;
  nombre: string;
  nombreAliado: string;
  actual: Lado;
  anterior: Lado;
}

interface FilaEquipo {
  match_id: string;
  campeon: string;
  rol: string;
  parche: string;
  v: number | null;
  nombre: string | null;
}

/**
 * Pares de compañeros de los parches dados: en cada partida, los jugadores con el mismo resultado son del mismo
 * equipo. Un equipo con un rol repetido o fuera de `ROLES`, o con un resultado que no es 0/1, se descarta entero.
 */
export function emparejarEquipos(sql: Database.Database, parcheActual: string, parcheAnterior: string): Map<string, Par> {
  const parches = parcheActual === parcheAnterior ? [parcheActual] : [parcheActual, parcheAnterior];
  const consulta = sql.prepare(
    `SELECT match_id, campeon, rol, parche,
            json_extract(datos, '$.victoria') AS v, json_extract(datos, '$.campeon') AS nombre
     FROM participaciones
     WHERE modo = 'clasificatoria' AND rol <> '' AND parche IN (${parches.map(() => '?').join(',')})
     ORDER BY match_id`,
  );
  const pares = new Map<string, Par>();
  const sumar = (yo: FilaEquipo, el: FilaEquipo) => {
    const k = `${yo.campeon}|${yo.rol}|${el.campeon}|${el.rol}`;
    let p = pares.get(k);
    if (!p) {
      p = {
        campeon: yo.campeon,
        rol: yo.rol as Rol,
        aliado: el.campeon,
        rolAliado: el.rol as Rol,
        nombre: yo.nombre ?? yo.campeon,
        nombreAliado: el.nombre ?? el.campeon,
        actual: { partidas: 0, victorias: 0 },
        anterior: { partidas: 0, victorias: 0 },
      };
      pares.set(k, p);
    }
    const lado = yo.parche === parcheActual ? p.actual : p.anterior;
    lado.partidas++;
    if (yo.v === 1) lado.victorias++;
  };
  const equipo = (filas: FilaEquipo[]) => {
    const roles = new Set(filas.map((f) => f.rol));
    if (roles.size !== filas.length || filas.some((f) => !ROLES.includes(f.rol as Rol))) return;
    for (let i = 0; i < filas.length; i++) {
      for (let j = i + 1; j < filas.length; j++) {
        sumar(filas[i]!, filas[j]!);
        sumar(filas[j]!, filas[i]!);
      }
    }
  };

  let partida: FilaEquipo[] = [];
  const cerrar = () => {
    if (partida.every((f) => f.v === 0 || f.v === 1)) {
      equipo(partida.filter((f) => f.v === 1));
      equipo(partida.filter((f) => f.v === 0));
    }
    partida = [];
  };
  for (const fila of consulta.iterate(...parches) as IterableIterator<FilaEquipo>) {
    if (partida[0] && partida[0].match_id !== fila.match_id) cerrar();
    partida.push(fila);
  }
  cerrar();
  return pares;
}

/** Recalcula todas las sinergias de clasificatoria y las guarda (sustituyendo las anteriores). Devuelve cuántas guardó. */
export function calcularSinergias(db: Db, parcheActual: string, parcheAnterior: string): number {
  const sql = db.sql;
  asegurarTablaSinergias(sql);
  const filas: unknown[][] = [];
  for (const p of emparejarEquipos(sql, parcheActual, parcheAnterior).values()) {
    const mezcla = p.actual.partidas < PARTIDAS_ENFRENTAMIENTO_FIABLE;
    const partidas = p.actual.partidas + (mezcla ? p.anterior.partidas : 0);
    if (partidas < MIN_PARTIDAS_ENFRENTAMIENTO) continue;
    const victorias = p.actual.victorias + (mezcla ? p.anterior.victorias : 0);
    filas.push([p.campeon, p.rol, p.aliado, p.rolAliado, parcheActual, idDDragon(p.nombre), idDDragon(p.nombreAliado), partidas, victorias]);
  }
  const insertar = sql.prepare(
    `INSERT INTO sinergias (campeon, rol, aliado, rol_aliado, parche, campeon_id, aliado_id, partidas, victorias)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  sql.transaction(() => {
    sql.exec('DELETE FROM sinergias');
    for (const f of filas) insertar.run(...f);
  })();
  return filas.length;
}

interface FilaSinergia {
  parche: string;
  campeon_id: string;
  aliado_id: string;
  rol_aliado: string;
  partidas: number;
  victorias: number;
}

/** Lectura de la tabla para la ruta (consulta preparada, por el principio de la clave primaria). */
export function crearConsultasSinergias(sql: Database.Database) {
  asegurarTablaSinergias(sql);
  const sel = sql.prepare(
    'SELECT parche, campeon_id, aliado_id, rol_aliado, partidas, victorias FROM sinergias WHERE campeon = ? AND rol = ?',
  );
  return {
    /** Mejores compañeros por rol (tasa suavizada, desempate por partidas y nombre). Null sin datos. */
    sinergias(campeon: string, rol: Rol): SinergiasCampeon | null {
      const filas = sel.all(campeon.toLowerCase(), rol) as FilaSinergia[];
      if (filas.length === 0) return null;
      const porRol: SinergiasCampeon['porRol'] = [];
      for (const r of ROLES) {
        if (r === rol) continue;
        const aliados: SinergiaAliado[] = filas
          .filter((f) => f.rol_aliado === r)
          .map((f) => ({ f, s: tasaSuavizada(f.victorias, f.partidas) }))
          .sort((a, b) => b.s - a.s || b.f.partidas - a.f.partidas || a.f.aliado_id.localeCompare(b.f.aliado_id))
          .slice(0, MAX_SINERGIAS_POR_ROL)
          .map(({ f }) => ({
            aliado: f.aliado_id,
            partidas: f.partidas,
            tasaVictoria: f.victorias / f.partidas,
            datosLimitados: f.partidas < PARTIDAS_ENFRENTAMIENTO_FIABLE,
          }));
        if (aliados.length > 0) porRol.push({ rol: r, aliados });
      }
      return { campeon: filas[0]!.campeon_id, rol, parche: filas[0]!.parche, porRol };
    },
  };
}
