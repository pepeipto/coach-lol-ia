import { TIERS, type EntradaCampeon, type ListaCampeones, type Rol } from '@coach/shared';
import { claveCampeon } from '../../shared/campeones';
import type { CampeonDDragon, IdeaEleccionVista, LineaEnfrentamientoVista, MainEleccionVista, MainsEleccionVista } from '../../shared/tiposApp';

/*
 * 3.16 «Ideas para elegir»: durante la selección (Grieta con roles) y hasta que fijas campeón, varias opciones para tu
 * línea con su motivo:
 * - con el rival de tu línea ya elegido, los que mejor le van contra él (sus counters, `buenasEleccionesContra`);
 * - sin él, los más fuertes del parche en tu rol según la tier list propia del servidor (`/campeones`).
 * Solo datos propios del servidor (partidas de la API de Riot): ninguna llamada nueva.
 *
 * Normas de Riot («Products should not remove game decisions»): siempre varias opciones con su motivo, nunca un
 * «elige X». Con menos de `MIN_IDEAS_ELECCION` no se enseña la tarjeta.
 */

export const MIN_IDEAS_ELECCION = 3;
export const MAX_IDEAS_ELECCION = 5;

const ordenTier = (t: EntradaCampeon['tier']) => TIERS.indexOf(t);

/**
 * Los más fuertes del parche en tu rol: por tier (S, A, B, C) y, a igual tier, de mayor a menor tasa de victorias ×
 * selección en el rol. Fuera los de «datos limitados», los que pierden (menos del 50 %) y los de `excluir`. Null si
 * salen menos de `MIN_IDEAS_ELECCION`.
 */
export function fuertesDelParche(o: {
  rol: Rol;
  lista: ListaCampeones | null;
  indice: Map<string, CampeonDDragon>;
  excluir: Set<number>;
}): IdeaEleccionVista[] | null {
  const ideas = (o.lista?.campeones ?? [])
    .filter((e) => e.rol === o.rol && !e.datosLimitados && e.tasaVictoria >= 0.5)
    .map((e) => ({ e, c: o.indice.get(claveCampeon(e.campeon)) }))
    .filter((x): x is { e: EntradaCampeon; c: CampeonDDragon } => !!x.c && !o.excluir.has(x.c.key))
    .sort(
      (a, b) =>
        ordenTier(a.e.tier) - ordenTier(b.e.tier) ||
        b.e.tasaVictoria * b.e.uso - a.e.tasaVictoria * a.e.uso ||
        a.c.nombre.localeCompare(b.c.nombre),
    )
    .slice(0, MAX_IDEAS_ELECCION)
    .map(({ e, c }): IdeaEleccionVista => ({ campeon: c, tasaVictoria: e.tasaVictoria, partidas: e.partidas, tier: e.tier }));
  return ideas.length >= MIN_IDEAS_ELECCION ? ideas : null;
}

/** Counters del rival de tu línea como ideas: sin los de `excluir` ni los de pocos datos. Null si salen menos de 3. */
export function contraElRival(buenas: LineaEnfrentamientoVista[], excluir: Set<number>): IdeaEleccionVista[] | null {
  const ideas = buenas
    .filter((l) => !l.datosLimitados && !excluir.has(l.campeon.key))
    .slice(0, MAX_IDEAS_ELECCION)
    .map((l): IdeaEleccionVista => ({ campeon: l.campeon, tasaVictoria: l.tasaVictoria, partidas: l.partidas }));
  return ideas.length >= MIN_IDEAS_ELECCION ? ideas : null;
}

/** 3.18: «Tus mains» se enseña solo con 2 opciones o más (normas de Riot: opciones, nunca un «elige X»). */
export const MIN_MAINS_ELECCION = 2;

/** Un main con lo que dicen los datos del servidor de él en esta partida (null: sin datos fiables). */
export interface MainConDatos {
  campeon: CampeonDDragon;
  tuyas: { partidas: number; victorias: number };
  datos: { tasaVictoria: number; partidas: number } | null;
}

/** % de victorias de un campeón en `rol` según la tier list del parche (sin los de datos limitados). */
export function tasaEnRol(lista: ListaCampeones | null, rol: Rol, campeon: CampeonDDragon): { tasaVictoria: number; partidas: number } | null {
  const e = (lista?.campeones ?? []).find((x) => x.rol === rol && !x.datosLimitados && claveCampeon(x.campeon) === claveCampeon(campeon.id));
  return e ? { tasaVictoria: e.tasaVictoria, partidas: e.partidas } : null;
}

/**
 * 3.18 «Tus mains para esta partida»: tus campeones más jugados del rol con su ventaja en esta partida (su % de
 * victorias contra el rival de tu línea o en el parche, menos el 50 %), de más a menos ventaja. Fuera los de `excluir`
 * (bloqueados o ya elegidos) y los que no tienen datos. Null si quedan menos de `MIN_MAINS_ELECCION`.
 */
export function mainsParaElegir(mains: MainConDatos[], motivo: MainsEleccionVista['motivo'], excluir: Set<number>): MainsEleccionVista | null {
  const lista = mains
    .filter((m): m is MainConDatos & { datos: NonNullable<MainConDatos['datos']> } => !!m.datos && !excluir.has(m.campeon.key))
    .map(
      (m): MainEleccionVista => ({
        campeon: m.campeon,
        ventaja: Math.round((m.datos.tasaVictoria - 0.5) * 1000) / 1000,
        partidasServidor: m.datos.partidas,
        tuyas: m.tuyas,
      }),
    )
    .sort((a, b) => b.ventaja - a.ventaja || b.tuyas.partidas - a.tuyas.partidas || a.campeon.nombre.localeCompare(b.campeon.nombre));
  return lista.length >= MIN_MAINS_ELECCION ? { motivo, mains: lista } : null;
}
