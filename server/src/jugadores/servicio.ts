import { ROLES, type Rol } from '@coach/shared';
import type { Db } from '../db';
import { REGIONES, type Region, type RiotApiJugadores } from '../riot/riotApi';
import { etiquetasDe } from './etiquetas';
import type { InfoCampeon, JugadorCarga, JugadorPedido } from './tipos';

export interface CatalogoCampeones {
  campeones(): Promise<Map<number, InfoCampeon>>;
}

/** Caché de 10 min por puuid (rango) y por puuid y campeón (maestría). */
export const VIGENCIA_CACHE_MS = 10 * 60_000;
/** Lo máximo que se espera a Riot por cada dato: la pantalla de carga dura poco. */
const TIEMPO_MAXIMO_POR_DEFECTO_MS = 8000;
const MAX_ENTRADAS_CACHE = 5000;

interface Entrada<T> {
  valor: T;
  caduca: number;
}

/** Resultado de una consulta a Riot: `fallo` si hubo error o se agotó el tiempo (no se guarda en caché). */
type Consulta<T> = { ok: true; valor: T } | { ok: false };

export function crearServicioJugadores(o: {
  api: RiotApiJugadores;
  db: Db;
  catalogo: CatalogoCampeones;
  ahora?: () => number;
  tiempoMaximoMs?: number;
}) {
  const ahora = o.ahora ?? Date.now;
  const tiempoMaximoMs = o.tiempoMaximoMs ?? TIEMPO_MAXIMO_POR_DEFECTO_MS;
  const cache = new Map<string, Entrada<unknown>>();

  function purgar(t: number): void {
    if (cache.size <= MAX_ENTRADAS_CACHE) return;
    for (const [clave, e] of cache) if (e.caduca <= t) cache.delete(clave);
    // Si aún sobran, fuera las más antiguas (el Map conserva el orden de inserción).
    for (const clave of cache.keys()) {
      if (cache.size <= MAX_ENTRADAS_CACHE) break;
      cache.delete(clave);
    }
  }

  /** Consultas en curso por clave: dos peticiones simultáneas del mismo dato comparten la llamada a Riot. */
  const enVuelo = new Map<string, Promise<Consulta<unknown>>>();

  function conCache<T>(clave: string, pedir: () => Promise<T>): Promise<Consulta<T>> {
    const guardada = cache.get(clave);
    if (guardada && guardada.caduca > ahora()) return Promise.resolve({ ok: true, valor: guardada.valor as T });
    const enCurso = enVuelo.get(clave);
    if (enCurso) return enCurso as Promise<Consulta<T>>;
    const promesa = consultarRiot(clave, pedir).finally(() => enVuelo.delete(clave));
    enVuelo.set(clave, promesa);
    return promesa;
  }

  async function consultarRiot<T>(clave: string, pedir: () => Promise<T>): Promise<Consulta<T>> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      const limite = new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error('tiempo agotado')), tiempoMaximoMs);
      });
      const valor = await Promise.race([pedir(), limite]);
      cache.set(clave, { valor, caduca: ahora() + VIGENCIA_CACHE_MS });
      purgar(ahora());
      return { ok: true, valor };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(temporizador);
    }
  }

  /** Winrate de nuestras builds: la del rol pedido o, sin rol, la del rol con más partidas. */
  function winrate(campeon: InfoCampeon | undefined, rol: Rol | null): number | null {
    if (!campeon) return null;
    const clave = campeon.id.toLowerCase();
    if (rol) return o.db.build(clave, rol)?.tasaVictoria ?? null;
    let mejor: { partidas: number; tasa: number } | null = null;
    for (const r of ROLES) {
      const b = o.db.build(clave, r);
      if (b && (!mejor || b.partidas > mejor.partidas)) mejor = { partidas: b.partidas, tasa: b.tasaVictoria };
    }
    return mejor?.tasa ?? null;
  }

  async function uno(plataforma: string, p: JugadorPedido, campeones: Map<number, InfoCampeon>): Promise<JugadorCarga> {
    const info = campeones.get(p.campeonId);
    let rango: JugadorCarga['rango'] = null;
    let maestria: JugadorCarga['maestria'] = null;
    if (p.puuid) {
      const [r, m] = await Promise.all([
        conCache(`r:${plataforma}:${p.puuid}`, () => o.api.rangoPorPuuid(plataforma, p.puuid)),
        conCache(`m:${plataforma}:${p.puuid}:${p.campeonId}`, () => o.api.maestria(plataforma, p.puuid, p.campeonId)),
      ]);
      if (r.ok && r.valor) {
        const e = r.valor;
        rango = { tier: e.tier, division: e.rank, lp: e.leaguePoints, victorias: e.wins, derrotas: e.losses };
      }
      // Un 404 de champion-mastery significa que nunca lo ha jugado: 0 puntos (es un dato, no un fallo).
      if (m.ok) maestria = m.valor ? { nivel: m.valor.championLevel, puntos: m.valor.championPoints } : { nivel: 0, puntos: 0 };
    }
    return {
      equipo: p.equipo,
      riotId: p.riotId ?? '',
      campeonId: p.campeonId,
      // Id de Data Dragon (como `EstadoPartida.campeon`): sirve para el icono; el nombre va en las etiquetas.
      campeon: info?.id ?? '',
      nombre: info?.nombre ?? '',
      rol: p.rol,
      rango,
      maestria,
      campeonWinrate: winrate(info, p.rol),
      etiquetas: info ? etiquetasDe({ campeon: info.nombre, maestria, rango, tags: info.tags, dificultad: info.dificultad }) : [],
    };
  }

  return {
    /** Nunca falla entera: cada dato que no se puede consultar queda a null. */
    async consultar(region: Region, jugadores: JugadorPedido[]): Promise<JugadorCarga[]> {
      const { plataforma } = REGIONES[region];
      let campeones: Map<number, InfoCampeon>;
      try {
        campeones = await o.catalogo.campeones();
      } catch {
        campeones = new Map();
      }
      return Promise.all(jugadores.map((p) => uno(plataforma, p, campeones)));
    },
  };
}

export type ServicioJugadores = ReturnType<typeof crearServicioJugadores>;
