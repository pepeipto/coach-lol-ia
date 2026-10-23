import { esColaGrietaNormal, modoDeCola, type Rol } from '@coach/shared';
import type { ColaRango, EventoLinea, JugadorHistorial, LineaTiempo, MinutoPartida, PartidaHistorial, PuntoPl, RangoCola } from '../../shared/perfil';
import { contextos, etiquetar, puntuar } from './puntuaciones';

/*
 * 3.5: lectura del perfil desde la LCU (cliente de LoL del propio jugador, sin clave de Riot):
 * - /lol-summoner/v1/current-summoner: nombre, nivel e icono.
 * - /lol-ranked/v1/current-ranked-stats: rango Solo/Dúo y Flexible.
 * - /lol-match-history/v1/products/lol/current-summoner/matches: últimas partidas (solo el jugador).
 * - /lol-match-history/v1/games/{id}: la partida con los 10 jugadores y sus estadísticas de fin de partida.
 * - /lol-match-history/v1/game-timelines/{id}: la línea de tiempo por minutos (formato de match-v4).
 * Las funciones `interpretar*` son puras y no confían en la forma de lo que llega.
 */

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const txt = (v: unknown) => (typeof v === 'string' ? v : '');

export const RUTAS_LCU = {
  invocador: '/lol-summoner/v1/current-summoner',
  rango: '/lol-ranked/v1/current-ranked-stats',
  partidas: (n: number) => `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=${n}`,
  partida: (id: number) => `/lol-match-history/v1/games/${id}`,
  lineaTiempo: (id: number) => `/lol-match-history/v1/game-timelines/${id}`,
} as const;

export function interpretarInvocador(j: unknown): { nombre: string; tag: string; nivel: number; icono: number; puuid: string } | null {
  if (!esObj(j)) return null;
  const nombre = txt(j.gameName) || txt(j.displayName);
  if (!nombre) return null;
  return { nombre, tag: txt(j.tagLine), nivel: num(j.summonerLevel), icono: num(j.profileIconId), puuid: txt(j.puuid) };
}

const COLAS: [ColaRango, string][] = [
  ['solo', 'RANKED_SOLO_5x5'],
  ['flex', 'RANKED_FLEX_SR'],
];

export function interpretarRango(j: unknown): RangoCola[] {
  if (!esObj(j)) return [];
  const mapa = esObj(j.queueMap) ? j.queueMap : {};
  const lista = Array.isArray(j.queues) ? (j.queues as unknown[]) : [];
  const r: RangoCola[] = [];
  for (const [cola, clave] of COLAS) {
    const q = esObj(mapa[clave]) ? (mapa[clave] as Obj) : (lista.find((x) => esObj(x) && x.queueType === clave) as Obj | undefined);
    if (!q) continue;
    const tier = txt(q.tier).toUpperCase();
    const sinRango = !tier || tier === 'NONE' || tier === 'UNRANKED';
    r.push({
      cola,
      tier: sinRango ? '' : tier,
      division: sinRango || txt(q.division) === 'NA' ? '' : txt(q.division),
      lp: num(q.leaguePoints),
      victorias: num(q.wins),
      derrotas: num(q.losses),
    });
  }
  return r;
}

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVISIONES: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

/** Valor continuo del rango para la gráfica de PL (Maestro y por encima: los PL se suman sin divisiones). */
export function valorRango(r: Pick<RangoCola, 'tier' | 'division' | 'lp'>): number | null {
  const i = TIERS.indexOf(r.tier);
  if (i < 0) return null;
  if (i >= 7) return 7 * 400 + r.lp;
  return i * 400 + (DIVISIONES[r.division] ?? 0) * 100 + r.lp;
}

/** Añade una foto del rango al historial de PL si cambió respecto a la última de esa cola (máx. 200). */
export function anotarPl(pl: PuntoPl[], rangos: RangoCola[], fecha: string): PuntoPl[] {
  let r = pl;
  for (const rango of rangos) {
    const valor = valorRango(rango);
    if (valor === null) continue;
    const ultimo = [...r].reverse().find((p) => p.cola === rango.cola);
    if (ultimo && ultimo.valor === valor) continue;
    r = [...r, { fecha, cola: rango.cola, tier: rango.tier, division: rango.division, lp: rango.lp, valor }];
  }
  return r.slice(-200);
}

/** Ids de las partidas de la lista del historial, de la más reciente a la más antigua. */
export function interpretarListaPartidas(j: unknown): number[] {
  const games = esObj(j) && esObj(j.games) ? j.games.games : null;
  if (!Array.isArray(games)) return [];
  return games
    .filter(esObj)
    .map((g) => ({ id: num(g.gameId, NaN), creada: num(g.gameCreation) }))
    .filter((g) => Number.isFinite(g.id))
    .sort((a, b) => b.creada - a.creada)
    .map((g) => g.id);
}

const HECHIZO_CASTIGAR = 11;

/** Rol a partir de lo que guarda el cliente (timeline.lane/role) y de Castigar. Null si no se sabe. */
export function rolDe(p: Obj): Rol | null {
  const hechizos = [num(p.spell1Id), num(p.spell2Id)];
  if (hechizos.includes(HECHIZO_CASTIGAR)) return 'JUNGLE';
  const tl = esObj(p.timeline) ? p.timeline : {};
  const linea = txt(tl.lane).toUpperCase();
  const papel = txt(tl.role).toUpperCase();
  if (linea === 'TOP') return 'TOP';
  if (linea === 'JUNGLE') return 'JUNGLE';
  if (linea === 'MIDDLE' || linea === 'MID') return 'MIDDLE';
  if (linea === 'BOTTOM' || linea === 'BOT') return papel === 'DUO_SUPPORT' ? 'UTILITY' : 'BOTTOM';
  return null;
}

/**
 * La partida con los 10 jugadores, sus puntuaciones y etiquetas. `puuid` es el del jugador (para saber quién es);
 * sin él, se usa `participanteYo` si se conoce. Null si la partida no tiene la forma esperada.
 */
export function interpretarPartida(j: unknown, puuid: string): PartidaHistorial | null {
  if (!esObj(j) || !Array.isArray(j.participants)) return null;
  const id = num(j.gameId, NaN);
  if (!Number.isFinite(id)) return null;
  const duracion = num(j.gameDuration);
  const cola = num(j.queueId);
  const modo = modoDeCola(cola) ?? 'otro';
  const identidades = Array.isArray(j.participantIdentities) ? (j.participantIdentities as unknown[]).filter(esObj) : [];
  const jugadorDe = (pid: number) => {
    const ident = identidades.find((x) => num(x.participantId) === pid);
    return esObj(ident?.player) ? (ident!.player as Obj) : {};
  };
  // 3.8: las normales de la Grieta también tienen roles (aunque su modo siga siendo «otro» y no cuenten para retos).
  const conRoles = modo === 'clasificatoria' || esColaGrietaNormal(cola);
  const base = (j.participants as unknown[]).filter(esObj).map((p) => {
    const s = esObj(p.stats) ? p.stats : {};
    const pid = num(p.participantId);
    const jugador = jugadorDe(pid);
    return {
      participante: pid,
      equipo: (num(p.teamId) === 200 ? 200 : 100) as 100 | 200,
      campeonId: num(p.championId),
      nombre: txt(jugador.gameName) || txt(jugador.summonerName),
      puuid: txt(jugador.puuid),
      rol: conRoles ? rolDe(p) : null,
      asesinatos: num(s.kills),
      muertes: num(s.deaths),
      asistencias: num(s.assists),
      cs: num(s.totalMinionsKilled) + num(s.neutralMinionsKilled),
      oro: num(s.goldEarned),
      dano: num(s.totalDamageDealtToChampions),
      danoRecibido: num(s.totalDamageTaken),
      vision: num(s.visionScore),
      nivel: num(s.champLevel),
      objetos: [0, 1, 2, 3, 4, 5, 6].map((i) => num(s[`item${i}`])).filter((x) => x > 0),
      hechizos: [num(p.spell1Id), num(p.spell2Id)] as [number, number],
      victoria: s.win === true,
    };
  });
  if (!base.length) return null;
  const yo = base.find((b) => puuid && b.puuid === puuid) ?? (base.length === 1 ? base[0] : null);
  if (!yo) return null;
  const ctx = contextos(base);
  const jugadores: JugadorHistorial[] = base.map(({ puuid: _p, ...b }) => ({
    ...b,
    puntuaciones: puntuar(b, b.rol ?? (conRoles ? 'MIDDLE' : null), duracion, ctx[b.equipo]),
    etiquetas: [],
  }));
  const etiquetas = etiquetar(jugadores, duracion, conRoles);
  for (const jg of jugadores) jg.etiquetas = etiquetas.get(jg.participante) ?? [];
  const creada = num(j.gameCreation);
  return {
    id,
    fecha: creada ? new Date(creada).toISOString() : txt(j.gameCreationDate),
    duracion,
    cola,
    modo,
    yo: yo.participante,
    victoria: yo.victoria,
    rehecha: duracion > 0 && duracion < 300,
    jugadores,
  };
}

const MONSTRUOS: Record<string, EventoLinea['tipo']> = {
  DRAGON: 'dragon',
  RIFTHERALD: 'heraldo',
  BARON_NASHOR: 'baron',
  HORDE: 'larvas',
};

/** Línea de tiempo por minutos y eventos importantes. `equipoDe` da el equipo de cada participante. */
export function interpretarLineaTiempo(j: unknown, equipoDe: (pid: number) => 100 | 200): LineaTiempo | null {
  if (!esObj(j) || !Array.isArray(j.frames)) return null;
  const minutos: MinutoPartida[] = [];
  const eventos: EventoLinea[] = [];
  for (const f of (j.frames as unknown[]).filter(esObj)) {
    const m = Math.round(num(f.timestamp) / 60000);
    const pf = esObj(f.participantFrames) ? f.participantFrames : {};
    const minuto: MinutoPartida = { m, oro: {}, cs: {}, xp: {}, nivel: {} };
    for (const v of Object.values(pf)) {
      if (!esObj(v)) continue;
      const pid = num(v.participantId);
      if (!pid) continue;
      minuto.oro[pid] = num(v.totalGold);
      minuto.cs[pid] = num(v.minionsKilled) + num(v.jungleMinionsKilled);
      minuto.xp[pid] = num(v.xp);
      minuto.nivel[pid] = num(v.level);
    }
    minutos.push(minuto);
    for (const e of Array.isArray(f.events) ? (f.events as unknown[]).filter(esObj) : []) {
      const t = Math.round(num(e.timestamp) / 1000);
      const autor = num(e.killerId);
      const tipo = txt(e.type);
      if (tipo === 'CHAMPION_KILL') {
        const victima = num(e.victimId);
        // El equipo es el de quien mata; si lo mata una torre o un súbdito, el contrario a la víctima.
        const equipo = autor ? equipoDe(autor) : equipoDe(victima) === 100 ? 200 : 100;
        eventos.push({ t, tipo: 'asesinato', autor, victima, equipo });
      } else if (tipo === 'ELITE_MONSTER_KILL' && MONSTRUOS[txt(e.monsterType)]) {
        const equipo = num(e.killerTeamId) === 200 ? 200 : num(e.killerTeamId) === 100 ? 100 : autor ? equipoDe(autor) : 100;
        eventos.push({ t, tipo: MONSTRUOS[txt(e.monsterType)]!, autor, equipo });
      } else if (tipo === 'BUILDING_KILL') {
        // teamId es el del edificio destruido: lo gana el otro equipo.
        const equipo = num(e.teamId) === 100 ? 200 : 100;
        eventos.push({ t, tipo: txt(e.buildingType) === 'INHIBITOR_BUILDING' ? 'inhibidor' : 'torre', autor, equipo });
      }
    }
  }
  return { minutos, eventos };
}
