import { TIERS, type EntradaCampeon, type Rol } from '@coach/shared';
import type { CampeonDDragon } from '../../../shared/tiposApp';

/** Una fila de la tabla: un campeón en un rol con datos, o un campeón sin ningún dato (entrada null). */
export interface Fila {
  campeon: CampeonDDragon;
  entrada: EntradaCampeon | null;
  /** Con una pestaña de rol: el campeón tiene datos, pero en otros roles. */
  sinDatosEnRol?: boolean;
}

export type FiltroRol = Rol | 'TODOS';
export type ClaveOrden = 'tier' | 'tasaVictoria' | 'uso' | 'partidas' | 'nombre';
export interface Orden {
  clave: ClaveOrden;
  direccion: 'asc' | 'desc';
}

export const ORDEN_POR_DEFECTO: Orden = { clave: 'tier', direccion: 'desc' };

/**
 * Une los campeones de Data Dragon con la lista del servidor: una fila por campeón y rol con datos y
 * una fila «sin datos» por cada campeón que no tiene ninguno. El servidor guarda el nombre de Match-v5,
 * que puede diferir en mayúsculas del id de Data Dragon («FiddleSticks»); las entradas de campeones
 * que no están en Data Dragon se ignoran.
 */
export function construirFilas(campeones: CampeonDDragon[], lista: EntradaCampeon[] | null): Fila[] {
  const porId = new Map(campeones.map((c) => [c.id.toLowerCase(), c]));
  const conDatos = new Set<string>();
  const filas: Fila[] = [];
  for (const entrada of lista ?? []) {
    const campeon = porId.get(entrada.campeon.toLowerCase());
    if (!campeon) continue;
    conDatos.add(campeon.id);
    filas.push({ campeon, entrada });
  }
  for (const campeon of campeones) if (!conDatos.has(campeon.id)) filas.push({ campeon, entrada: null });
  return filas;
}

/** Texto comparable: sin tildes, en minúsculas y solo letras y números («Kai'Sa» → «kaisa»). */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Filtra por búsqueda (nombre en español o id de Data Dragon) y por rol. Con un rol se ven los
 * campeones con datos en ese rol y, en gris, todos los demás: sin datos en ese rol (`sinDatosEnRol`)
 * o sin ningún dato. Así cada campeón aparece en todas las pestañas.
 */
export function filtrarFilas(filas: Fila[], f: { busqueda: string; rol: FiltroRol }): Fila[] {
  const q = normalizarBusqueda(f.busqueda);
  const coincide = (fila: Fila) =>
    !q || normalizarBusqueda(fila.campeon.nombre).includes(q) || normalizarBusqueda(fila.campeon.id).includes(q);
  if (f.rol === 'TODOS') return filas.filter(coincide);

  const enRol = filas.filter((fila) => fila.entrada?.rol === f.rol);
  const conRol = new Set(enRol.map((fila) => fila.campeon.id));
  const grises = new Map<string, Fila>();
  for (const fila of filas) {
    if (conRol.has(fila.campeon.id)) continue;
    const previa = grises.get(fila.campeon.id);
    const conOtrosRoles = !!fila.entrada || !!previa?.sinDatosEnRol;
    grises.set(fila.campeon.id, { campeon: fila.campeon, entrada: null, ...(conOtrosRoles ? { sinDatosEnRol: true } : {}) });
  }
  return [...enRol, ...grises.values()].filter(coincide);
}

const porNombre = (a: Fila, b: Fila) => a.campeon.nombre.localeCompare(b.campeon.nombre, 'es');

/** Valor numérico de la columna (más alto = mejor); el tier usa la tasa de victorias para desempatar. */
function valor(e: EntradaCampeon, clave: Exclude<ClaveOrden, 'nombre'>): number {
  if (clave === 'tier') return (TIERS.length - TIERS.indexOf(e.tier)) * 10 + e.tasaVictoria;
  return e[clave];
}

/** Ordena una copia de las filas; las que no tienen datos van siempre al final, por nombre. */
export function ordenarFilas(filas: Fila[], orden: Orden): Fila[] {
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    if (!a.entrada || !b.entrada) {
      if (a.entrada) return -1;
      if (b.entrada) return 1;
      return porNombre(a, b);
    }
    if (orden.clave === 'nombre') return signo * porNombre(a, b) || a.entrada.rol.localeCompare(b.entrada.rol);
    const d = valor(a.entrada, orden.clave) - valor(b.entrada, orden.clave);
    return d !== 0 ? signo * d : porNombre(a, b);
  });
}

/** Al pulsar una columna: la misma invierte la dirección; otra empieza de mejor a peor (el nombre, de la A a la Z). */
export function siguienteOrden(actual: Orden, clave: ClaveOrden): Orden {
  if (actual.clave === clave) return { clave, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
  return { clave, direccion: clave === 'nombre' ? 'asc' : 'desc' };
}
