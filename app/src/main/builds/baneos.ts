import type { EntradaCampeon, ListaCampeones, Rol } from '@coach/shared';
import { claveCampeon } from '../../shared/campeones';
import type { CampeonDDragon, CountersVista, IdeaBaneoVista, IdeasBaneoVista } from '../../shared/tiposApp';

/*
 * 3.9.2 «Ideas para banear»: durante la fase de bloqueos de la selección (Grieta), de 3 a 5 campeones con el motivo de
 * cada uno. Se calculan con lo que la app ya pide al servidor (`/counters` de tu campeón y `/campeones` de
 * clasificatoria): ninguna llamada nueva a la API de Riot.
 *
 * Normas de Riot (https://developer.riotgames.com/docs/lol, «Game Policy»): «Products should not remove game
 * decisions» y no se permiten las «Apps that dictate player decisions»; sí se pueden resaltar decisiones importantes y
 * ofrecer varias opciones. Por eso siempre son varias ideas con su motivo y nunca un «banea X»: la decisión es del
 * jugador. Con menos de `MIN_IDEAS_BANEO` no se enseña la tarjeta.
 */

export const MIN_IDEAS_BANEO = 3;
export const MAX_IDEAS_BANEO = 5;
/** Counters de tu campeón como mucho; el resto de huecos, para los más fuertes del rol (dos motivos distintos). */
export const MAX_COUNTERS_BANEO = 3;

/**
 * Ideas de bloqueo para tu línea.
 * 1. Con tu campeón (elegido o en intención) y sus counters: los que más le cuestan en tu rol (`dificiles`, ya
 *    ordenados por tasa suavizada, del más difícil al menos), solo con tu % de victorias por debajo del 50 % y sin
 *    «datos limitados»; como mucho `MAX_COUNTERS_BANEO`.
 * 2. Hasta `MAX_IDEAS_BANEO`, los más fuertes del parche en tu rol (el del rival de tu línea): de mayor a menor
 *    tasa de victorias × tasa de selección en el rol (`uso` de `/campeones`), solo con 30 partidas o más y una tasa
 *    de victorias del 50 % o más (un campeón muy jugado que pierde no es una amenaza).
 * Fuera siempre los campeones de `excluir` (ya bloqueados, de tus compañeros, ya elegidos por el rival y el tuyo).
 * Cada idea lleva la tasa de bloqueo del campeón si el servidor la da. Null si salen menos de `MIN_IDEAS_BANEO`.
 */
export function ideasBaneo(o: {
  rol: Rol;
  campeon: CampeonDDragon | null;
  counters: CountersVista | null;
  lista: ListaCampeones | null;
  /** Campeones de Data Dragon por clave en minúsculas (`indiceCampeones`). */
  indice: Map<string, CampeonDDragon>;
  /** Claves numéricas que no se proponen. */
  excluir: Set<number>;
}): IdeasBaneoVista | null {
  const { rol, campeon, counters, lista, indice, excluir } = o;
  const bloqueoDe = new Map<string, number>();
  for (const e of lista?.campeones ?? []) if (e.tasaBloqueo !== undefined) bloqueoDe.set(claveCampeon(e.campeon), e.tasaBloqueo);
  const usadas = new Set<number>(excluir);
  if (campeon) usadas.add(campeon.key);
  const ideas: IdeaBaneoVista[] = [];
  const conBloqueo = (c: CampeonDDragon) => {
    const b = bloqueoDe.get(claveCampeon(c.id));
    return b !== undefined ? { tasaBloqueo: b } : {};
  };

  if (campeon && counters) {
    for (const l of counters.dificiles) {
      if (ideas.length >= MAX_COUNTERS_BANEO) break;
      if (l.tasaVictoria >= 0.5 || l.datosLimitados || usadas.has(l.campeon.key)) continue;
      usadas.add(l.campeon.key);
      ideas.push({ campeon: l.campeon, motivo: 'counter', tasaVictoria: l.tasaVictoria, partidas: l.partidas, ...conBloqueo(l.campeon) });
    }
  }

  const delRol = (lista?.campeones ?? [])
    .filter((e): e is EntradaCampeon & { rol: Rol } => e.rol === rol && !e.datosLimitados && e.tasaVictoria >= 0.5)
    .map((e) => ({ e, c: indice.get(claveCampeon(e.campeon)) }))
    .filter((x): x is { e: EntradaCampeon & { rol: Rol }; c: CampeonDDragon } => !!x.c)
    .sort((a, b) => b.e.tasaVictoria * b.e.uso - a.e.tasaVictoria * a.e.uso || a.c.nombre.localeCompare(b.c.nombre));
  for (const { e, c } of delRol) {
    if (ideas.length >= MAX_IDEAS_BANEO) break;
    if (usadas.has(c.key)) continue;
    usadas.add(c.key);
    ideas.push({ campeon: c, motivo: 'fuerte', tasaVictoria: e.tasaVictoria, partidas: e.partidas, seleccionRol: e.uso, ...conBloqueo(c) });
  }

  return ideas.length >= MIN_IDEAS_BANEO ? { campeon, ideas } : null;
}
