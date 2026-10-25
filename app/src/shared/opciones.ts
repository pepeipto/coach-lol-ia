import type { Build, OpcionRunas, PaginaRunas } from '@coach/shared';

/** Opciones de build de una respuesta del servidor; una build de v1 (sin `opciones`) es su única opción. */
export function opcionesDe(build: Build): Build[] {
  return build.opciones && build.opciones.length > 0 ? build.opciones : [build];
}

/** La build de la opción `i` (la 0 si el índice no existe). */
export function buildDeOpcion(build: Build, i: number): Build {
  const opciones = opcionesDe(build);
  return opciones[i] ?? opciones[0]!;
}

/** El índice es un entero válido para esas opciones. */
export function opcionValida(build: Build, i: unknown): i is number {
  return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < opcionesDe(build).length;
}

const esFraccion = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const esId = (x: unknown) => typeof x === 'number' && Number.isInteger(x);

function esPagina(x: unknown): x is PaginaRunas {
  const p = x as Partial<PaginaRunas> | null;
  return !!p && typeof p === 'object' && esId(p.estiloPrincipal) && esId(p.estiloSecundario) && Array.isArray(p.runas) && p.runas.length > 0 && p.runas.every(esId);
}

function esOpcionRunas(x: unknown): x is OpcionRunas {
  const o = x as Partial<OpcionRunas> | null;
  return (
    !!o &&
    typeof o === 'object' &&
    esPagina(o.runas) &&
    typeof o.partidas === 'number' &&
    Number.isInteger(o.partidas) &&
    o.partidas >= 0 &&
    esFraccion(o.tasaVictoria) &&
    esFraccion(o.popularidad) &&
    typeof o.datosLimitados === 'boolean'
  );
}

/**
 * Páginas de runas elegibles de una respuesta del servidor (3.0.1), sin las mal formadas. Vacía con un servidor
 * anterior: entonces las runas son las de cada opción de build, como antes.
 */
export function opcionesRunasDe(build: Build): OpcionRunas[] {
  return Array.isArray(build.opcionesRunas) ? build.opcionesRunas.filter(esOpcionRunas) : [];
}

/** El índice es un entero válido para las páginas de runas de esa build (falso si no las tiene). */
export function runasValida(build: Build, i: unknown): i is number {
  return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < opcionesRunasDe(build).length;
}

/**
 * La build que se ve y se importa: la de la opción de objetos `opcion` (hechizos, objetos, habilidades) con las
 * runas de la página `opcionRunas` (la 0, la más jugada, si el índice no existe). Sin páginas elegibles, la opción
 * tal cual.
 */
export function buildElegida(build: Build, opcion: number, opcionRunas = 0): Build {
  const base = conObjetosDelCampeon(buildDeOpcion(build, opcion), build);
  const paginas = opcionesRunasDe(build);
  const pagina = paginas[opcionRunas] ?? paginas[0];
  return pagina ? { ...base, runas: pagina.runas } : base;
}

/**
 * 3.10: los tiempos objetivo y el rendimiento por objeto son del campeón (y rol), no de una opción: el servidor los
 * manda solo en la build de nivel superior y aquí pasan a la opción elegida (la que se ve y la que usa la voz).
 */
function conObjetosDelCampeon(opcion: Build, build: Build): Build {
  const tiempos = opcion.tiempos ?? build.tiempos;
  const rendimientoObjetos = opcion.rendimientoObjetos ?? build.rendimientoObjetos;
  if (tiempos === opcion.tiempos && rendimientoObjetos === opcion.rendimientoObjetos) return opcion;
  return { ...opcion, ...(tiempos ? { tiempos } : {}), ...(rendimientoObjetos ? { rendimientoObjetos } : {}) };
}
