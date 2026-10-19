import { ROLES, type Rol } from '@coach/shared';

/** Regiones que conoce el servidor de Coach LoL IA. */
export type RegionCoach = 'EUW' | 'LAN' | 'LAS' | 'BR' | 'NA';

/** Un jugador de la partida tal y como lo cuenta `GET /lol-gameflow/v1/session`. */
export interface JugadorSesion {
  /** '' para los bots. */
  puuid: string;
  campeonId: number;
  rol: Rol | null;
  equipo: 'aliado' | 'enemigo';
  /** «Nombre#TAG» si el cliente lo da; si no, el nombre de invocador o ''. */
  riotId: string;
}

/** Id del mapa de la Grieta del Invocador: la pantalla de carga solo se muestra ahí. */
const GRIETA = 11;
const MAX_JUGADORES = 10;

const ALIAS_ROL: Record<string, Rol> = { MID: 'MIDDLE', BOT: 'BOTTOM', ADC: 'BOTTOM', SUPPORT: 'UTILITY' };

function rolDe(valor: unknown): Rol | null {
  if (typeof valor !== 'string') return null;
  const mayus = valor.toUpperCase();
  if (ROLES.includes(mayus as Rol)) return mayus as Rol;
  return ALIAS_ROL[mayus] ?? null;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function riotIdDe(j: Record<string, unknown>): string {
  const nombre = texto(j.riotIdGameName) || texto(j.gameName);
  const tag = texto(j.riotIdTagLine) || texto(j.tagLine);
  if (nombre) return tag ? `${nombre}#${tag}` : nombre;
  return texto(j.summonerName);
}

function equipoDe(lista: unknown): Record<string, unknown>[] {
  return Array.isArray(lista) ? lista.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}

function mapaDe(s: Record<string, unknown>): number | null {
  const mapa = s.map as { id?: unknown } | undefined;
  if (typeof mapa?.id === 'number') return mapa.id;
  const cola = (s.gameData as { queue?: { mapId?: unknown } } | undefined)?.queue;
  return typeof cola?.mapId === 'number' ? cola.mapId : null;
}

/** Id del hechizo de invocador Castigo. */
const CASTIGO = 11;

/** Hechizos del jugador: en su propia entrada o en `gameData.playerChampionSelections` (por puuid o campeón). */
function llevaCastigo(j: Record<string, unknown>, selecciones: Record<string, unknown>[]): boolean {
  const propia = [j.spell1Id, j.spell2Id];
  if (propia.some((h) => typeof h === 'number')) return propia.includes(CASTIGO);
  const sel = selecciones.find((x) => (j.puuid && x.puuid === j.puuid) || x.championId === j.championId);
  return !!sel && [sel.spell1Id, sel.spell2Id].includes(CASTIGO);
}

/** Sin selectedPosition (personalizadas, cliente sin roles…): el único sin rol con Castigo es el JUNGLE de su equipo. */
function junglaPorCastigo(eq: JugadorSesion[], castigo: boolean[]): JugadorSesion[] {
  if (eq.some((j) => j.rol === 'JUNGLE')) return eq;
  const candidatos = eq.map((j, i) => (j.rol === null && castigo[i] ? i : -1)).filter((i) => i >= 0);
  if (candidatos.length !== 1) return eq;
  return eq.map((j, i) => (i === candidatos[0] ? { ...j, rol: 'JUNGLE' as Rol } : j));
}

const ordenRol = (r: Rol | null) => (r ? ROLES.indexOf(r) : ROLES.length);

/**
 * Jugadores de la partida a partir de la sesión de gameflow (`gameData.teamOne` / `teamTwo`).
 * Aliados son los del equipo del jugador local (`puuidPropio`); sin él, teamOne. Devuelve null fuera
 * de la Grieta del Invocador, sin jugadores o como espectador (el jugador local no está en la partida).
 */
export function interpretarSesionPartida(sesion: unknown, puuidPropio: string | null): JugadorSesion[] | null {
  if (typeof sesion !== 'object' || sesion === null) return null;
  const s = sesion as Record<string, unknown>;
  const mapa = mapaDe(s);
  if (mapa !== null && mapa !== GRIETA) return null;
  const datos = (s.gameData ?? {}) as { teamOne?: unknown; teamTwo?: unknown; playerChampionSelections?: unknown };
  const selecciones = equipoDe(datos.playerChampionSelections);
  const uno = equipoDe(datos.teamOne);
  const dos = equipoDe(datos.teamTwo);
  let aliadoEsUno = true;
  if (puuidPropio) {
    const esta = (eq: Record<string, unknown>[]) => eq.some((j) => j.puuid === puuidPropio);
    if (esta(dos)) aliadoEsUno = false;
    else if (!esta(uno)) return null;
  }
  const convertir = (eq: Record<string, unknown>[], equipo: JugadorSesion['equipo']): JugadorSesion[] => {
    const validos = eq.filter((j) => typeof j.championId === 'number' && Number.isInteger(j.championId) && j.championId > 0);
    const lista = validos.map((j) => ({
      puuid: texto(j.puuid),
      campeonId: j.championId as number,
      rol: rolDe(j.selectedPosition),
      equipo,
      riotId: riotIdDe(j),
    }));
    return junglaPorCastigo(lista, validos.map((j) => llevaCastigo(j, selecciones)))
      .sort((a, b) => ordenRol(a.rol) - ordenRol(b.rol))
      .slice(0, MAX_JUGADORES / 2);
  };
  const jugadores = [
    ...convertir(aliadoEsUno ? uno : dos, 'aliado'),
    ...convertir(aliadoEsUno ? dos : uno, 'enemigo'),
  ];
  return jugadores.length > 0 ? jugadores : null;
}

const REGIONES: Record<string, RegionCoach> = {
  EUW: 'EUW',
  EUW1: 'EUW',
  LA1: 'LAN',
  LAN: 'LAN',
  LA2: 'LAS',
  LAS: 'LAS',
  // 3.0: Brasil y Norteamérica (el cliente da «BR»/«NA»; las plataformas son BR1 y NA1).
  BR: 'BR',
  BR1: 'BR',
  NA: 'NA',
  NA1: 'NA',
};

/** Región del cliente (`GET /riotclient/region-locale`) → la del servidor; null si no la conoce. */
export function regionDeLcu(respuesta: unknown): RegionCoach | null {
  if (typeof respuesta !== 'object' || respuesta === null) return null;
  const region = (respuesta as { region?: unknown }).region;
  return typeof region === 'string' ? (REGIONES[region.toUpperCase()] ?? null) : null;
}
