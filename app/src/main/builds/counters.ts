import { ROLES, type CountersCampeon, type EnfrentamientoLinea, type ListaCampeones, type Rol } from '@coach/shared';
import { claveCampeon } from '../../shared/campeones';
import type { CampeonDDragon, CountersVista, LineaEnfrentamientoVista, RivalesSeleccion } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';

/** Campeones de Data Dragon por clave en minúsculas (Match-v5 y Data Dragon no siempre coinciden en mayúsculas). */
export function indiceCampeones(d: Pick<DatosEstaticos, 'campeones'>): Map<string, CampeonDDragon> {
  const indice = new Map<string, CampeonDDragon>();
  for (const [key, c] of d.campeones) indice.set(claveCampeon(c.id), { id: c.id, nombre: c.nombre, key });
  return indice;
}

/** Un cruce del servidor con el campeón resuelto; null si Data Dragon no lo conoce (se descarta). */
function lineaVista(e: EnfrentamientoLinea, indice: Map<string, CampeonDDragon>, invertir = false): LineaEnfrentamientoVista | null {
  const campeon = indice.get(claveCampeon(e.rival));
  if (!campeon) return null;
  return { campeon, partidas: e.partidas, tasaVictoria: invertir ? 1 - e.tasaVictoria : e.tasaVictoria, datosLimitados: e.datosLimitados };
}

const resolver = (lista: EnfrentamientoLinea[], indice: Map<string, CampeonDDragon>, invertir = false) =>
  lista.map((e) => lineaVista(e, indice, invertir)).filter((x): x is LineaEnfrentamientoVista => x !== null);

/** Counters del servidor listos para la vista. */
export function countersVista(c: CountersCampeon, indice: Map<string, CampeonDDragon>, sinConexion: boolean): CountersVista {
  return {
    parche: c.parche,
    partidas: c.partidas,
    todos: resolver(c.enfrentamientos ?? [], indice),
    faciles: resolver(c.faciles, indice),
    dificiles: resolver(c.dificiles, indice),
    sinConexion,
  };
}

/** Elecciones contra un rival que mejor funcionan en tu rol: quienes más le cuestan a él, con tu % (el inverso del suyo). */
export const MAX_BUENAS_ELECCIONES = 5;
export function buenasEleccionesContra(delRival: CountersCampeon, indice: Map<string, CampeonDDragon>): LineaEnfrentamientoVista[] {
  return resolver(delRival.dificiles, indice, true).slice(0, MAX_BUENAS_ELECCIONES);
}

/** Fracción mínima de partidas en tu rol para dar a un rival por «de tu línea» cuando su rol se deduce. */
export const FRACCION_MIN_ROL_RIVAL = 0.1;

/**
 * El rival de tu línea entre los campeones ya elegidos por el otro equipo. Si el cliente dice su rol (algunas colas),
 * ese manda. En clasificatoria no lo dice: se reparten los rivales sin rol entre los roles libres de la forma más
 * probable según cuánto juega cada campeón cada rol (lista de campeones del servidor, datos agregados), y el que
 * cae en tu rol es tu rival si juega ese rol al menos un 10 % de sus partidas. Null si no hay ninguno.
 */
export function rivalDeLinea(
  rivales: RivalesSeleccion,
  rol: Rol,
  indice: Map<number, CampeonDDragon>,
  lista: ListaCampeones | null,
): (CampeonDDragon & { inferido: boolean }) | null {
  const conocidos = rivales.rivales.map((r) => ({ ...r, campeon: indice.get(r.campeonId) })).filter((r) => !!r.campeon);
  const explicito = conocidos.find((r) => r.rol === rol);
  if (explicito) return { ...explicito.campeon!, inferido: false };
  if (conocidos.some((r) => r.rol !== null) && conocidos.every((r) => r.rol !== null)) return null;
  if (!lista) return null;

  const ocupados = new Set(conocidos.map((r) => r.rol).filter((r): r is Rol => r !== null));
  const libres = ROLES.filter((r) => !ocupados.has(r));
  const sinRol = conocidos.filter((r) => r.rol === null).slice(0, libres.length);
  const reparto = (c: CampeonDDragon): Record<Rol, number> => {
    const partidas = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Rol, number>;
    for (const e of lista.campeones) if (e.rol && claveCampeon(e.campeon) === claveCampeon(c.id)) partidas[e.rol] += e.partidas;
    const total = ROLES.reduce((s, r) => s + partidas[r], 0);
    for (const r of ROLES) partidas[r] = total > 0 ? partidas[r] / total : 0;
    return partidas;
  };
  const fracciones = sinRol.map((r) => reparto(r.campeon!));

  // Todas las formas de repartir (como mucho 5 rivales en 5 roles: 120), la de mayor probabilidad conjunta.
  let mejor: { puntos: number; asignacion: Rol[] } | null = null;
  const probar = (i: number, usados: Rol[]) => {
    if (i === sinRol.length) {
      const puntos = usados.reduce((s, r, j) => s + Math.log(fracciones[j]![r] + 0.01), 0);
      if (!mejor || puntos > mejor.puntos) mejor = { puntos, asignacion: [...usados] };
      return;
    }
    for (const r of libres) if (!usados.includes(r)) probar(i + 1, [...usados, r]);
  };
  probar(0, []);
  const elegido = (mejor as { asignacion: Rol[] } | null)?.asignacion.indexOf(rol) ?? -1;
  if (elegido < 0 || fracciones[elegido]![rol] < FRACCION_MIN_ROL_RIVAL) return null;
  return { ...sinRol[elegido]!.campeon!, inferido: true };
}
