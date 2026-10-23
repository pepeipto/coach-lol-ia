import { COLAS_GRIETA_NORMAL, COLAS_MODO } from '@coach/shared';
import type { Db } from '../db';
import { ErrorRiot, REGIONES, type Region, type RiotApi } from '../riot/riotApi';

/*
 * 3.8 «Todo LoL»: qué colas rotativas (URF, Uno para todos, Nexus Blitz, Libro de hechizos, Enjambre…) se están
 * jugando ahora.
 *
 * 1. Candidatas: las colas de LoL de la lista oficial de Riot (URL_COLAS, pública y sin clave) que no son
 *    clasificatoria, ARAM, ARAM: Caos ni Arena (COLAS_MODO), ni normales de la Grieta (COLAS_GRIETA_NORMAL), ni TFT,
 *    tutoriales, partidas personalizadas, Clash, cooperativo contra la IA de la Grieta o mapas retirados. Si la lista
 *    no se puede leer, se usan las conocidas (CANDIDATAS_RESPALDO).
 * 2. Sondeo con pocas peticiones: por cada candidata se piden los ids de la última partida (`count=1`, de los últimos
 *    VENTANA_ACTIVA_S segundos) de como mucho MAX_SONDEOS_POR_COLA jugadores conocidos, primero los que ya jugaron ese
 *    modo y luego los de las partidas de ARAM (los que más juegan modos de evento) y los de las ligas. Al primer id se
 *    descarga esa partida para confirmar la cola y leer su `gameMode` y su mapa (1 petición más por cola activa).
 * 3. Caché: el resultado se guarda en la base (`ajustes_servidor`, clave CLAVE_ESTADO) y no se vuelve a sondear hasta
 *    pasadas INTERVALO_REVISION_MS (algo menos que un ciclo de 6 h): como mucho una revisión por ciclo, aunque se
 *    recolecten varias regiones o el servidor se reinicie.
 */

export const URL_COLAS = 'https://static.developer.riotgames.com/docs/lol/queues.json';
export const CLAVE_ESTADO = 'rotativos_estado';
/** Una revisión por ciclo de 6 h (con margen por si un ciclo tarda en empezar). */
export const INTERVALO_REVISION_MS = 5 * 60 * 60 * 1000;
/** Una cola está activa si un jugador sondeado tiene una partida suya de los últimos 3 días. */
export const VENTANA_ACTIVA_S = 3 * 24 * 60 * 60;
export const MAX_SONDEOS_POR_COLA = 3;
/** Jugadores de cada modo rotativo que se recuerdan por región (para el sondeo y la siembra del siguiente ciclo). */
export const MAX_JUGADORES_MODO = 100;

export interface ColaRotativa {
  cola: number;
  /** Nombre en inglés de queues.json (sin «games»). */
  nombre: string;
  mapa: number;
  /** `gameMode` de Match-v5 / Live Client Data; '' si aún no se conoce. */
  gameMode: string;
  pve: boolean;
}

export interface EstadoRotativos {
  /** ISO de la última revisión completa; null si nunca se ha hecho. */
  actualizado: string | null;
  /** Colas activas en la última revisión. */
  activas: number[];
  /** Lo que se sabe de cada cola vista activa alguna vez (para listar también las que ya solo tienen datos). */
  info: Record<string, ColaRotativa>;
}

/** Mapas de queues.json (https://static.developer.riotgames.com/docs/lol/maps.json). */
const MAPAS: Record<string, number> = {
  "Summoner's Rift": 11,
  'Howling Abyss': 12,
  'Nexus Blitz': 21,
  'Rings of Wrath': 30,
  Swarm: 33,
  'Swarm Mode Games': 33,
};
/** Mapas que ya no están en el juego: sus colas no se sondean. */
const MAPAS_RETIRADOS = [
  'Twisted Treeline',
  'Crystal Scar',
  "Butcher's Bridge",
  'Cosmic Ruins',
  'Valoran City Park',
  'Overcharge',
  'Crash Site',
  'Convergence',
];
/**
 * `gameMode` conocido de algunas colas (gameModes.json de Riot y Match-v5). Solo es un valor inicial: al confirmar
 * una cola activa se usa el `gameMode` de su partida.
 */
const GAME_MODE: Record<number, string> = {
  72: 'FIRSTBLOOD',
  73: 'FIRSTBLOOD',
  76: 'URF',
  78: 'ONEFORALL',
  83: 'URF',
  325: 'ARSR',
  600: 'ASSASSINATE',
  900: 'URF',
  920: 'KINGPORO',
  940: 'SIEGE',
  1010: 'URF',
  1020: 'ONEFORALL',
  1300: 'NEXUSBLITZ',
  1400: 'ULTBOOK',
  1810: 'STRAWBERRY',
  1820: 'STRAWBERRY',
  1830: 'STRAWBERRY',
  1840: 'STRAWBERRY',
  1900: 'URF',
};

const EXCLUIDAS = new Set<number>([0, ...Object.values(COLAS_MODO).flat(), ...COLAS_GRIETA_NORMAL]);
const DESCARTE = /teamfight tactics|tutorial|clash|co-op vs\.? ai (intro|beginner|intermediate)/i;
const PVE = /swarm|doom bots|co-op|vs\.? ai/i;

/** Las conocidas, por si queues.json no se puede leer. */
export const CANDIDATAS_RESPALDO: ColaRotativa[] = [
  { cola: 900, nombre: 'ARURF', mapa: 11, gameMode: 'URF', pve: false },
  { cola: 1900, nombre: 'Pick URF', mapa: 11, gameMode: 'URF', pve: false },
  { cola: 1020, nombre: 'One for All', mapa: 11, gameMode: 'ONEFORALL', pve: false },
  { cola: 1300, nombre: 'Nexus Blitz', mapa: 21, gameMode: 'NEXUSBLITZ', pve: false },
  { cola: 1400, nombre: 'Ultimate Spellbook', mapa: 11, gameMode: 'ULTBOOK', pve: false },
  { cola: 1810, nombre: 'Swarm', mapa: 33, gameMode: 'STRAWBERRY', pve: true },
  { cola: 1820, nombre: 'Swarm', mapa: 33, gameMode: 'STRAWBERRY', pve: true },
  { cola: 1830, nombre: 'Swarm', mapa: 33, gameMode: 'STRAWBERRY', pve: true },
  { cola: 1840, nombre: 'Swarm', mapa: 33, gameMode: 'STRAWBERRY', pve: true },
];

const texto = (v: unknown): string => (typeof v === 'string' && v !== 'null' ? v : '');

/** Candidatas a partir del JSON de queues.json (entradas mal formadas o excluidas se ignoran). */
export function candidatasDeColas(json: unknown): ColaRotativa[] {
  if (!Array.isArray(json)) return [];
  const resultado: ColaRotativa[] = [];
  const vistas = new Set<number>();
  for (const x of json) {
    if (typeof x !== 'object' || x === null) continue;
    const { queueId, map, description, notes } = x as Record<string, unknown>;
    if (typeof queueId !== 'number' || !Number.isInteger(queueId) || queueId <= 0) continue;
    if (EXCLUIDAS.has(queueId) || vistas.has(queueId)) continue;
    const mapa = texto(map);
    const descripcion = texto(description);
    const nota = texto(notes);
    if (/deprecated/i.test(nota) || MAPAS_RETIRADOS.includes(mapa)) continue;
    if (DESCARTE.test(descripcion) || DESCARTE.test(mapa)) continue;
    vistas.add(queueId);
    const nombre = descripcion.replace(/\s+games$/i, '').trim() || `Queue ${queueId}`;
    resultado.push({
      cola: queueId,
      nombre,
      mapa: MAPAS[mapa] ?? 0,
      gameMode: GAME_MODE[queueId] ?? '',
      pve: PVE.test(`${descripcion} ${mapa} ${nota}`),
    });
  }
  return resultado;
}

const ESTADO_VACIO: EstadoRotativos = { actualizado: null, activas: [], info: {} };

export function leerEstadoRotativos(db: Db): EstadoRotativos {
  try {
    const fila = db.sql.prepare('SELECT valor FROM ajustes_servidor WHERE clave = ?').get(CLAVE_ESTADO) as { valor: string } | undefined;
    if (!fila) return { ...ESTADO_VACIO, info: {} };
    const e = JSON.parse(fila.valor) as Partial<EstadoRotativos>;
    return {
      actualizado: typeof e.actualizado === 'string' ? e.actualizado : null,
      activas: Array.isArray(e.activas) ? e.activas.filter((c): c is number => typeof c === 'number') : [],
      info: typeof e.info === 'object' && e.info !== null ? e.info : {},
    };
  } catch {
    return { ...ESTADO_VACIO, info: {} };
  }
}

function guardarEstado(db: Db, e: EstadoRotativos): void {
  db.sql
    .prepare('INSERT OR REPLACE INTO ajustes_servidor (clave, valor) VALUES (?, ?)')
    .run(CLAVE_ESTADO, JSON.stringify(e));
}

export interface DetectorRotativos {
  /**
   * Colas rotativas activas (PvE incluidas: quien recolecta las descarta). Sondea con los `jugadores` de la región
   * solo si la última revisión tiene más de INTERVALO_REVISION_MS; si no, devuelve la guardada.
   */
  revisar(region: Region, jugadores: string[]): Promise<ColaRotativa[]>;
  /** Jugadores que han jugado ese modo en la región (de las partidas del sondeo y de las recogidas). */
  jugadoresDe(region: Region, cola: number): string[];
  anotarJugadores(region: Region, cola: number, puuids: string[]): void;
}

export interface OpcionesDetector {
  api: RiotApi;
  db: Db;
  fetch?: typeof fetch;
  ahora?: () => number;
}

function describir(e: unknown): string {
  if (e instanceof ErrorRiot) return `error ${e.estado}`;
  return e instanceof Error ? e.message : String(e);
}

export function crearDetectorRotativos(o: OpcionesDetector): DetectorRotativos {
  const ahora = o.ahora ?? Date.now;
  const hacerFetch = o.fetch ?? fetch;
  const jugadores = new Map<string, string[]>();
  let enCurso: Promise<ColaRotativa[]> | null = null;

  const claveJ = (region: Region, cola: number) => `${region}:${cola}`;
  const jugadoresDe = (region: Region, cola: number) => [...(jugadores.get(claveJ(region, cola)) ?? [])];
  const anotarJugadores = (region: Region, cola: number, puuids: string[]) => {
    const lista = jugadores.get(claveJ(region, cola)) ?? [];
    for (const p of puuids) if (typeof p === 'string' && p && !lista.includes(p)) lista.push(p);
    jugadores.set(claveJ(region, cola), lista.slice(-MAX_JUGADORES_MODO));
  };

  const activasDe = (e: EstadoRotativos): ColaRotativa[] =>
    e.activas.map((c) => e.info[String(c)]).filter((c): c is ColaRotativa => !!c);

  async function candidatas(): Promise<ColaRotativa[]> {
    try {
      const resp = await hacerFetch(URL_COLAS);
      if (!resp.ok) throw new Error(`respuesta ${resp.status}`);
      const lista = candidatasDeColas(await resp.json());
      if (lista.length > 0) return lista;
      throw new Error('lista vacía o con otra forma');
    } catch (e) {
      console.warn(`[rotativos] no se pudo leer queues.json (${describir(e)}): se usan las colas conocidas`);
      return CANDIDATAS_RESPALDO.map((c) => ({ ...c }));
    }
  }

  async function sondear(region: Region, deRegion: string[]): Promise<ColaRotativa[]> {
    const previo = leerEstadoRotativos(o.db);
    const lista = await candidatas();
    // Las que estaban activas, primero (sus jugadores casi siempre aciertan a la primera).
    lista.sort((a, b) => Number(previo.activas.includes(b.cola)) - Number(previo.activas.includes(a.cola)));
    const { ruta } = REGIONES[region];
    const inicio = Math.floor(ahora() / 1000) - VENTANA_ACTIVA_S;
    const activas: ColaRotativa[] = [];
    let respuestas = 0;
    for (const candidata of lista) {
      const probar = [...new Set([...jugadoresDe(region, candidata.cola), ...deRegion])].slice(0, MAX_SONDEOS_POR_COLA);
      for (const puuid of probar) {
        let ids: string[];
        try {
          ids = await o.api.idsPartidas(ruta, puuid, 1, candidata.cola, inicio);
          respuestas++;
        } catch (e) {
          console.error(`[rotativos] ${region}: fallo al sondear la cola ${candidata.cola}: ${describir(e)}`);
          continue;
        }
        if (ids.length === 0) continue;
        try {
          const partida = await o.api.partida(ruta, ids[0]!);
          if (!partida || partida.info.queueId !== candidata.cola) continue;
          const confirmada: ColaRotativa = {
            ...candidata,
            gameMode: typeof partida.info.gameMode === 'string' && partida.info.gameMode ? partida.info.gameMode : candidata.gameMode,
            mapa: typeof partida.info.mapId === 'number' && partida.info.mapId > 0 ? partida.info.mapId : candidata.mapa,
          };
          activas.push(confirmada);
          anotarJugadores(region, candidata.cola, partida.info.participants.map((p) => p.puuid));
          break;
        } catch (e) {
          console.error(`[rotativos] ${region}: no se pudo confirmar la cola ${candidata.cola}: ${describir(e)}`);
        }
      }
    }
    // Sin ninguna respuesta de Riot (clave caducada, caída…) no se da por revisado: se reintenta con otra región.
    if (respuestas === 0) return activasDe(previo);
    const info = { ...previo.info };
    for (const c of activas) info[String(c.cola)] = c;
    guardarEstado(o.db, { actualizado: new Date(ahora()).toISOString(), activas: activas.map((c) => c.cola), info });
    console.info(
      `[rotativos] colas activas: ${activas.length ? activas.map((c) => `${c.cola} (${c.nombre})`).join(', ') : 'ninguna'}`,
    );
    return activas;
  }

  return {
    jugadoresDe,
    anotarJugadores,
    async revisar(region, deRegion) {
      const estado = leerEstadoRotativos(o.db);
      const ultima = estado.actualizado ? Date.parse(estado.actualizado) : NaN;
      if (Number.isFinite(ultima) && ahora() - ultima < INTERVALO_REVISION_MS) return activasDe(estado);
      if (enCurso) return enCurso;
      if (deRegion.length === 0) return activasDe(estado);
      enCurso = sondear(region, deRegion).finally(() => {
        enCurso = null;
      });
      return enCurso;
    },
  };
}
