import type Database from 'better-sqlite3';
import {
  MAX_ENFRENTAMIENTOS_LISTA,
  MIN_PARTIDAS_BUILD_ENFRENTAMIENTO,
  MIN_PARTIDAS_ENFRENTAMIENTO,
  PARTIDAS_ENFRENTAMIENTO_FIABLE,
  ROLES,
  sanearBuildPolitica,
  tasaSuavizada,
  type Build,
  type CountersCampeon,
  type Enfrentamiento,
  type EnfrentamientoLinea,
  type ItemDDragonCrudo,
  type Rol,
} from '@coach/shared';
import { agregarOpciones, agregarOpcionesRunas } from './agregador';
import type { Db } from './db';
import type { Participacion } from './extraer';

/*
 * 3.9 «Counters»: enfrentamientos de línea de clasificatoria (las normales de la Grieta usan los mismos datos).
 *
 * Se recalculan en cada ciclo, después de las builds, y se guardan en la tabla `enfrentamientos` (una fila por
 * campeón, rol y rival, desde los dos lados). Las rutas solo leen esa tabla por su clave primaria: nada se calcula al
 * pedirlas. Solo datos agregados de partidas terminadas: nada de la partida en curso ni del jugador rival.
 */

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS enfrentamientos (
    campeon TEXT NOT NULL,
    rol TEXT NOT NULL,
    rival TEXT NOT NULL,
    parche TEXT NOT NULL,
    campeon_id TEXT NOT NULL,
    rival_id TEXT NOT NULL,
    partidas INTEGER NOT NULL,
    victorias INTEGER NOT NULL,
    build TEXT,
    PRIMARY KEY (campeon, rol, rival)
  );`;

export function asegurarTablaEnfrentamientos(sql: Database.Database): void {
  sql.exec(ESQUEMA);
}

/**
 * Id de Data Dragon a partir del `championName` de Match-v5: coinciden salvo en mayúsculas en algún caso conocido.
 * La app los compara sin distinguir mayúsculas de todos modos.
 */
const EXCEPCIONES_DDRAGON: Record<string, string> = { FiddleSticks: 'Fiddlesticks' };
export const idDDragon = (nombre: string): string => EXCEPCIONES_DDRAGON[nombre] ?? nombre;

const clave = (campeon: string) => campeon.toLowerCase();

interface Lado {
  partidas: number;
  victorias: number;
  matchIds: string[];
}

interface Cruce {
  campeon: string;
  rol: Rol;
  rival: string;
  nombre: string;
  nombreRival: string;
  actual: Lado;
  anterior: Lado;
}

/** Fila de la consulta: una participación de clasificatoria reducida a lo que hace falta para emparejar. */
interface FilaLinea {
  match_id: string;
  campeon: string;
  rol: string;
  parche: string;
  v: number | null;
  nombre: string | null;
}

/**
 * Rivales de línea de los parches dados: por cada partida y rol, si hay exactamente dos jugadores (uno por equipo, es
 * decir, con resultados distintos) de campeones distintos, cada uno es el rival del otro. Las partidas con un rol
 * repetido, vacío o con el mismo resultado en los dos (remakes raros, datos incompletos) se descartan; los espejos
 * (mismo campeón) no se guardan dos veces en `participaciones` y tampoco cuentan.
 */
export function emparejarLineas(sql: Database.Database, parcheActual: string, parcheAnterior: string): Map<string, Cruce> {
  const parches = parcheActual === parcheAnterior ? [parcheActual] : [parcheActual, parcheAnterior];
  const consulta = sql.prepare(
    `SELECT match_id, campeon, rol, parche,
            json_extract(datos, '$.victoria') AS v, json_extract(datos, '$.campeon') AS nombre
     FROM participaciones
     WHERE modo = 'clasificatoria' AND rol <> '' AND parche IN (${parches.map(() => '?').join(',')})
     ORDER BY match_id, rol`,
  );
  const cruces = new Map<string, Cruce>();
  const sumar = (yo: FilaLinea, el: FilaLinea) => {
    const k = `${yo.campeon}|${yo.rol}|${el.campeon}`;
    let c = cruces.get(k);
    if (!c) {
      c = {
        campeon: yo.campeon,
        rol: yo.rol as Rol,
        rival: el.campeon,
        nombre: yo.nombre ?? yo.campeon,
        nombreRival: el.nombre ?? el.campeon,
        actual: { partidas: 0, victorias: 0, matchIds: [] },
        anterior: { partidas: 0, victorias: 0, matchIds: [] },
      };
      cruces.set(k, c);
    }
    const lado = yo.parche === parcheActual ? c.actual : c.anterior;
    lado.partidas++;
    if (yo.v === 1) lado.victorias++;
    lado.matchIds.push(yo.match_id);
  };

  let grupo: FilaLinea[] = [];
  const cerrar = () => {
    if (grupo.length === 2) {
      const [a, b] = grupo as [FilaLinea, FilaLinea];
      const resultadosValidos = (a.v === 0 || a.v === 1) && (b.v === 0 || b.v === 1) && a.v !== b.v;
      if (resultadosValidos && a.campeon !== b.campeon && ROLES.includes(a.rol as Rol)) {
        sumar(a, b);
        sumar(b, a);
      }
    }
    grupo = [];
  };
  for (const fila of consulta.iterate(...parches) as IterableIterator<FilaLinea>) {
    const previa = grupo[0];
    if (previa && (previa.match_id !== fila.match_id || previa.rol !== fila.rol)) cerrar();
    grupo.push(fila);
  }
  cerrar();
  return cruces;
}

/**
 * Build propia de un cruce: entre las opciones de núcleo (las de las builds: 10 partidas y 5 % como mínimo), la que
 * más gana con suavizado; y, si hay páginas de runas elegibles, la que más gana del mismo modo. Es una build normal
 * (se importa como las demás), sin `opciones`.
 */
export function buildDeEnfrentamiento(
  ps: Participacion[],
  objetos: Record<number, ItemDDragonCrudo>,
  parche: string,
  mezcla: boolean,
  ahora: Date = new Date(),
): Build | null {
  if (ps.length === 0) return null;
  const puntuar = (tasa: number, partidas: number) => tasaSuavizada(tasa * partidas, partidas);
  const opciones = agregarOpciones(ps, objetos, parche, mezcla, Number.MAX_SAFE_INTEGER, ahora);
  let mejor = opciones[0]!;
  for (const o of opciones) if (puntuar(o.tasaVictoria, o.partidas) > puntuar(mejor.tasaVictoria, mejor.partidas)) mejor = o;
  const paginas = agregarOpcionesRunas(ps, Number.MAX_SAFE_INTEGER);
  let runas = mejor.runas;
  if (paginas.length > 0) {
    let pagina = paginas[0]!;
    for (const p of paginas) if (puntuar(p.tasaVictoria, p.partidas) > puntuar(pagina.tasaVictoria, pagina.partidas)) pagina = p;
    runas = pagina.runas;
  }
  const { opciones: _o, opcionesRunas: _r, ...build } = mejor;
  return { ...build, runas };
}

/**
 * Recalcula todos los enfrentamientos de línea de clasificatoria y los guarda (sustituyendo los anteriores). Cada
 * cruce usa el parche actual si tiene `PARTIDAS_ENFRENTAMIENTO_FIABLE` partidas o más en él; si no, mezcla el actual y
 * el anterior (como las builds). Solo se guardan los cruces con `MIN_PARTIDAS_ENFRENTAMIENTO` o más; los de
 * `MIN_PARTIDAS_BUILD_ENFRENTAMIENTO` o más llevan además su build. Devuelve cuántos guardó.
 */
export function calcularEnfrentamientos(
  db: Db,
  objetos: Record<number, ItemDDragonCrudo>,
  parcheActual: string,
  parcheAnterior: string,
  ahora: Date = new Date(),
): number {
  const sql = db.sql;
  asegurarTablaEnfrentamientos(sql);
  const cruces = emparejarLineas(sql, parcheActual, parcheAnterior);
  const selDatos = sql.prepare('SELECT datos FROM participaciones WHERE match_id = ? AND campeon = ?');
  const filas: unknown[][] = [];
  for (const c of cruces.values()) {
    const mezcla = c.actual.partidas < PARTIDAS_ENFRENTAMIENTO_FIABLE;
    const partidas = c.actual.partidas + (mezcla ? c.anterior.partidas : 0);
    if (partidas < MIN_PARTIDAS_ENFRENTAMIENTO) continue;
    const victorias = c.actual.victorias + (mezcla ? c.anterior.victorias : 0);
    let build: Build | null = null;
    if (partidas >= MIN_PARTIDAS_BUILD_ENFRENTAMIENTO) {
      const ids = mezcla ? [...c.actual.matchIds, ...c.anterior.matchIds] : c.actual.matchIds;
      const ps: Participacion[] = [];
      for (const id of ids) {
        const f = selDatos.get(id, c.campeon) as { datos: string } | undefined;
        if (f) ps.push(JSON.parse(f.datos) as Participacion);
      }
      build = buildDeEnfrentamiento(ps, objetos, parcheActual, mezcla, ahora);
    }
    filas.push([
      c.campeon,
      c.rol,
      c.rival,
      parcheActual,
      idDDragon(c.nombre),
      idDDragon(c.nombreRival),
      partidas,
      victorias,
      build ? JSON.stringify(build) : null,
    ]);
  }
  const insertar = sql.prepare(
    `INSERT INTO enfrentamientos (campeon, rol, rival, parche, campeon_id, rival_id, partidas, victorias, build)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  sql.transaction(() => {
    sql.exec('DELETE FROM enfrentamientos');
    for (const f of filas) insertar.run(...f);
  })();
  return filas.length;
}

interface FilaEnfrentamiento {
  parche: string;
  campeon_id: string;
  rival_id: string;
  partidas: number;
  victorias: number;
  build: string | null;
}

const linea = (f: FilaEnfrentamiento): EnfrentamientoLinea => ({
  rival: f.rival_id,
  partidas: f.partidas,
  tasaVictoria: f.victorias / f.partidas,
  datosLimitados: f.partidas < PARTIDAS_ENFRENTAMIENTO_FIABLE,
});

/** Lectura de la tabla para las rutas (consultas preparadas, por clave primaria). */
export function crearConsultasEnfrentamientos(sql: Database.Database) {
  asegurarTablaEnfrentamientos(sql);
  const selCampeon = sql.prepare(
    'SELECT parche, campeon_id, rival_id, partidas, victorias, NULL AS build FROM enfrentamientos WHERE campeon = ? AND rol = ?',
  );
  const selCruce = sql.prepare(
    'SELECT parche, campeon_id, rival_id, partidas, victorias, build FROM enfrentamientos WHERE campeon = ? AND rol = ? AND rival = ?',
  );
  return {
    /**
     * Counters de un campeón en un rol: `faciles`, los cruces con tasa suavizada por encima del 50 % (de mayor a
     * menor), y `dificiles`, los de por debajo (de menor a mayor); 6 de cada como mucho. Null sin datos.
     */
    counters(campeon: string, rol: Rol): CountersCampeon | null {
      const filas = selCampeon.all(clave(campeon), rol) as FilaEnfrentamiento[];
      if (filas.length === 0) return null;
      const puntuadas = filas.map((f) => ({ f, s: tasaSuavizada(f.victorias, f.partidas) }));
      // En empate, más partidas primero y luego por nombre, para que el orden sea estable.
      const desempate = (a: (typeof puntuadas)[number], b: (typeof puntuadas)[number]) =>
        b.f.partidas - a.f.partidas || a.f.rival_id.localeCompare(b.f.rival_id);
      const faciles = puntuadas
        .filter((x) => x.s > 0.5)
        .sort((a, b) => b.s - a.s || desempate(a, b))
        .slice(0, MAX_ENFRENTAMIENTOS_LISTA)
        .map((x) => linea(x.f));
      const dificiles = puntuadas
        .filter((x) => x.s < 0.5)
        .sort((a, b) => a.s - b.s || desempate(a, b))
        .slice(0, MAX_ENFRENTAMIENTOS_LISTA)
        .map((x) => linea(x.f));
      return {
        campeon: filas[0]!.campeon_id,
        rol,
        parche: filas[0]!.parche,
        partidas: filas.reduce((s, f) => s + f.partidas, 0),
        faciles,
        dificiles,
      };
    },
    /** Un cruce concreto (con su build si la tiene). Null sin datos. */
    enfrentamiento(campeon: string, rival: string, rol: Rol): Enfrentamiento | null {
      const f = selCruce.get(clave(campeon), rol, clave(rival)) as FilaEnfrentamiento | undefined;
      if (!f) return null;
      return {
        campeon: f.campeon_id,
        rival: f.rival_id,
        rol,
        parche: f.parche,
        partidas: f.partidas,
        tasaVictoria: f.victorias / f.partidas,
        datosLimitados: f.partidas < PARTIDAS_ENFRENTAMIENTO_FIABLE,
        ...(f.build ? { build: sanearBuildPolitica(JSON.parse(f.build) as Build) } : {}),
      };
    },
  };
}
