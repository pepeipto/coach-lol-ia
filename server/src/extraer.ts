import {
  clasificarObjeto,
  ROLES,
  type Habilidad,
  type ItemDDragonCrudo,
  type PaginaRunas,
  type Rol,
} from '@coach/shared';
import { rutaDePartida, type RutaPartida } from './rutaJungla';
import { esModoRotativo, mapaDeModo, type ModoInterno } from './rotativos/modos';
import type { LineaTiempoRiot, ParticipanteRiot, PartidaRiot } from './riot/riotApi';

export interface Participacion {
  matchId: string;
  campeon: string;
  /** null en los modos sin roles (ARAM, ARAM: Caos y Arena). */
  rol: Rol | null;
  /** Falta en las participaciones guardadas antes de 3.0: son de clasificatoria. */
  modo?: ModoInterno;
  /** 3.8, modos rotativos: mapa (`mapId`) y `gameMode` de la partida. */
  mapa?: number;
  gameMode?: string;
  victoria: boolean;
  parche: string;
  runas: PaginaRunas;
  hechizos: [number, number];
  iniciales: number[];
  /** Botas y legendarios en el orden de su primera compra (sin repetir). */
  compras: number[];
  /**
   * 3.10 (tiempos objetivo): minuto de partida (con un decimal) de la primera compra de cada objeto de `compras`, en el
   * mismo orden: el `timestamp` del evento ITEM_PURCHASED de la línea de tiempo, que en un legendario o unas botas es
   * el momento de completarlo. Falta en las participaciones guardadas antes y en Arena (sin línea de tiempo).
   */
  minutosCompras?: number[];
  habilidades: Habilidad[];
  /** KDA de la partida (3.0); falta en las participaciones guardadas antes. */
  asesinatos?: number;
  muertes?: number;
  asistencias?: number;
  /** ARAM: Caos y Arena: ids de los aumentos elegidos (Match-v5 `playerAugment1..6`, sin los 0). */
  aumentos?: number[];
  /** Arena: puesto final (1..8). */
  posicion?: number;
  /** Jungla de clasificatoria (Track F2): lado de inicio y primer gank de esta partida, por las posiciones de los minutos 1 a 4. */
  rutaJungla?: RutaPartida;
  /**
   * Clasificatoria (3.9.1): oro total, CS (súbditos y monstruos) y experiencia del jugador en el frame del minuto 14
   * de la línea de tiempo, para la «fase de líneas» de los enfrentamientos. Falta en las participaciones guardadas
   * antes y en las partidas que no llegan al minuto 14.
   */
  minuto14?: EstadoMinuto;
  /**
   * Ficha del campeón: daño a campeones por tipo (Match-v5 `physical/magic/trueDamageDealtToChampions`), para el
   * desglose medio por campeón. Falta en las participaciones guardadas antes y si Riot no manda las tres cifras.
   */
  danio?: DanioPartida;
}

/** Daño a campeones de un jugador en una partida, por tipo. */
export interface DanioPartida {
  fisico: number;
  magico: number;
  verdadero: number;
}

/** Oro, CS y experiencia de un jugador en un frame de la línea de tiempo. */
export interface EstadoMinuto {
  oro: number;
  cs: number;
  xp: number;
}

/** Minuto de la «fase de líneas» (Blitz la mide hacia el 14-15). */
export const MINUTO_FASE_LINEAS = 14;

const CAMPOS_AUMENTO = [
  'playerAugment1',
  'playerAugment2',
  'playerAugment3',
  'playerAugment4',
  'playerAugment5',
  'playerAugment6',
] as const satisfies readonly (keyof ParticipanteRiot)[];
const CAMPOS_OBJETO = ['item0', 'item1', 'item2', 'item3', 'item4', 'item5'] as const satisfies readonly (keyof ParticipanteRiot)[];
const RUNAS_VACIAS: PaginaRunas = { estiloPrincipal: 0, estiloSecundario: 0, runas: [] };

const esIdValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

function aumentosDe(p: ParticipanteRiot): number[] {
  return CAMPOS_AUMENTO.map((c) => p[c]).filter(esIdValido);
}

/** Puesto final de Arena: `placement` y, si falta o no es válido, `subteamPlacement`. Null si ninguno está en 1..8. */
function posicionDe(p: ParticipanteRiot): number | null {
  for (const v of [p.placement, p.subteamPlacement]) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 8) return v;
  }
  return null;
}

const LIMITE_INICIALES_MS = 60000;
const HABILIDADES: Record<number, Habilidad> = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' };

function parcheDe(gameVersion: string): string {
  const [mayor, menor] = gameVersion.split('.');
  return `${mayor}.${menor}`;
}

function extraerRunas(p: ParticipanteRiot): PaginaRunas {
  const [principal, secundario] = p.perks.styles;
  const { offense, flex, defense } = p.perks.statPerks;
  return {
    estiloPrincipal: principal.style,
    estiloSecundario: secundario.style,
    runas: [
      ...principal.selections.slice(0, 4).map((s) => s.perk),
      ...secundario.selections.slice(0, 2).map((s) => s.perk),
      offense,
      flex,
      defense,
    ],
  };
}

const esConteo = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Daño a campeones por tipo, solo si vienen las tres cifras (números finitos no negativos). */
export function danioDe(p: ParticipanteRiot): Pick<Participacion, 'danio'> {
  const { physicalDamageDealtToChampions: f, magicDamageDealtToChampions: m, trueDamageDealtToChampions: v } = p;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (!ok(f) || !ok(m) || !ok(v)) return {};
  return { danio: { fisico: Math.round(f), magico: Math.round(m), verdadero: Math.round(v) } };
}

/** Asesinatos, muertes y asistencias, solo si vienen los tres. */
function kdaDe(p: ParticipanteRiot): Pick<Participacion, 'asesinatos' | 'muertes' | 'asistencias'> {
  if (!esConteo(p.kills) || !esConteo(p.deaths) || !esConteo(p.assists)) return {};
  return { asesinatos: p.kills, muertes: p.deaths, asistencias: p.assists };
}

/**
 * Participaciones de una partida de clasificatoria, ARAM o ARAM: Caos (con línea de tiempo).
 * En clasificatoria solo cuentan los jugadores con rol (teamPosition); en ARAM y ARAM: Caos, todos, sin rol.
 * En ARAM: Caos se añaden los aumentos.
 */
export function extraerParticipaciones(
  partida: PartidaRiot,
  linea: LineaTiempoRiot,
  objetos: Record<number, ItemDDragonCrudo>,
  modo: Exclude<ModoInterno, 'arena'> = 'clasificatoria',
): Participacion[] {
  // 3.8: en los modos rotativos, el mapa es el de la partida (Nexus Blitz se juega en su propio mapa) y se guardan
  // los aumentos si el modo los tiene (solo se publicará su uso: `politica.ts`).
  const rotativo = esModoRotativo(modo);
  const mapa = rotativo ? (typeof partida.info.mapId === 'number' ? partida.info.mapId : 11) : mapaDeModo(modo);
  const extraRotativo: Pick<Participacion, 'mapa' | 'gameMode'> = rotativo
    ? { mapa, ...(typeof partida.info.gameMode === 'string' ? { gameMode: partida.info.gameMode } : {}) }
    : {};
  const eventos = linea.info.frames.flatMap((f) => f.events);
  const resultado: Participacion[] = [];

  for (const p of partida.info.participants) {
    const conRol = modo === 'clasificatoria';
    if (conRol && !ROLES.includes(p.teamPosition as Rol)) continue;

    const compras: { itemId: number; timestamp: number }[] = [];
    const habilidades: Habilidad[] = [];
    for (const e of eventos) {
      if (e.participantId !== p.participantId) continue;
      if (e.type === 'ITEM_PURCHASED' && e.itemId !== undefined) {
        compras.push({ itemId: e.itemId, timestamp: e.timestamp });
      } else if (e.type === 'ITEM_UNDO' && e.beforeId !== undefined) {
        for (let i = compras.length - 1; i >= 0; i--) {
          if (compras[i].itemId === e.beforeId) {
            compras.splice(i, 1);
            break;
          }
        }
      } else if (
        e.type === 'SKILL_LEVEL_UP' &&
        e.levelUpType === 'NORMAL' &&
        e.skillSlot !== undefined &&
        HABILIDADES[e.skillSlot]
      ) {
        habilidades.push(HABILIDADES[e.skillSlot]);
      }
    }

    const iniciales = compras
      .filter((c) => c.timestamp < LIMITE_INICIALES_MS)
      .map((c) => c.itemId)
      .sort((a, b) => a - b);

    const vistos = new Set<number>();
    const clave: number[] = [];
    const minutosClave: number[] = [];
    for (const { itemId, timestamp } of compras) {
      const objeto = objetos[itemId];
      if (!objeto || vistos.has(itemId)) continue;
      if (clasificarObjeto(itemId, objeto, mapa) === 'otro') continue;
      vistos.add(itemId);
      clave.push(itemId);
      minutosClave.push(minutoDe(timestamp));
    }
    const conMinutos = minutosClave.every((m) => Number.isFinite(m) && m >= 0);

    resultado.push({
      matchId: partida.metadata.matchId,
      campeon: p.championName,
      rol: conRol ? (p.teamPosition as Rol) : null,
      modo,
      ...extraRotativo,
      ...(modo === 'caos' || (rotativo && aumentosDe(p).length > 0) ? { aumentos: aumentosDe(p) } : {}),
      victoria: p.win,
      parche: parcheDe(partida.info.gameVersion),
      runas: extraerRunas(p),
      hechizos: [Math.min(p.summoner1Id, p.summoner2Id), Math.max(p.summoner1Id, p.summoner2Id)],
      iniciales,
      compras: clave,
      ...(conMinutos ? { minutosCompras: minutosClave } : {}),
      habilidades,
      ...kdaDe(p),
      ...danioDe(p),
      ...rutaDe(p, linea, conRol),
      ...(conRol ? minuto14De(linea, p.participantId) : {}),
    });
  }
  return resultado;
}

const esCifra = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Milisegundos de partida → minuto con un decimal (NaN si el timestamp no es una cifra válida). */
function minutoDe(timestamp: unknown): number {
  return esCifra(timestamp) ? Math.round(timestamp / 6000) / 10 : NaN;
}

/**
 * Oro, CS y experiencia del jugador en el frame del minuto `minuto`: el primero con timestamp en [minuto, minuto + 1)
 * minutos. Las partidas que acaban antes no tienen ese frame (el último es el del final): no se guarda nada, y
 * tampoco si al frame le falta alguna cifra del jugador.
 */
export function estadoEnMinuto(linea: LineaTiempoRiot, participantId: number, minuto = MINUTO_FASE_LINEAS): EstadoMinuto | null {
  const desde = minuto * 60000;
  const frame = linea.info.frames.find((f) => typeof f.timestamp === 'number' && f.timestamp >= desde && f.timestamp < desde + 60000);
  const pf = frame?.participantFrames?.[String(participantId)];
  if (!pf || !esCifra(pf.totalGold) || !esCifra(pf.xp) || !esCifra(pf.minionsKilled)) return null;
  const jungla = esCifra(pf.jungleMinionsKilled) ? pf.jungleMinionsKilled : 0;
  return { oro: pf.totalGold, cs: pf.minionsKilled + jungla, xp: pf.xp };
}

function minuto14De(linea: LineaTiempoRiot, participantId: number): Pick<Participacion, 'minuto14'> {
  const estado = estadoEnMinuto(linea, participantId);
  return estado ? { minuto14: estado } : {};
}

/** Bloqueos y campeones de una partida de clasificatoria (3.9.1), para la tasa de bloqueo y de selección por parche. */
export interface BansPartida {
  matchId: string;
  parche: string;
  /** Claves numéricas de los campeones bloqueados por cualquiera de los dos equipos, sin repetir (sin los -1). */
  bans: number[];
  /** Clave numérica → `championName` de los campeones de la partida (para traducir los bloqueos a nombres). */
  campeones: { id: number; nombre: string }[];
}

/**
 * Bloqueos de Match-v5 (`info.teams[].bans[].championId`). Null si la partida no trae `teams` (partidas de las
 * pruebas o respuestas incompletas): entonces no cuenta ni en el numerador ni en el denominador de la tasa.
 */
export function extraerBans(partida: PartidaRiot): BansPartida | null {
  const equipos = partida.info.teams;
  if (!Array.isArray(equipos) || equipos.length === 0) return null;
  const bans = new Set<number>();
  for (const e of equipos) for (const b of e?.bans ?? []) if (esIdValido(b?.championId)) bans.add(b.championId);
  const campeones = new Map<number, string>();
  for (const p of partida.info.participants) {
    if (esIdValido(p.championId) && typeof p.championName === 'string' && p.championName) campeones.set(p.championId, p.championName);
  }
  return {
    matchId: partida.metadata.matchId,
    parche: parcheDe(partida.info.gameVersion),
    bans: [...bans].sort((a, b) => a - b),
    campeones: [...campeones].map(([id, nombre]) => ({ id, nombre })),
  };
}

/** Track F2: la ruta del jungla de clasificatoria en esta partida (equipo por teamId o, si falta, por participantId 1-5 / 6-10). */
function rutaDe(p: ParticipanteRiot, linea: LineaTiempoRiot, conRol: boolean): Pick<Participacion, 'rutaJungla'> {
  if (!conRol || p.teamPosition !== 'JUNGLE') return {};
  const equipo = p.teamId === 100 || p.teamId === 200 ? p.teamId : p.participantId <= 5 ? 100 : 200;
  const ruta = rutaDePartida(linea, p.participantId, equipo);
  return ruta ? { rutaJungla: ruta } : {};
}

/**
 * Participaciones de una partida de Arena, sin línea de tiempo (no se usan ni el orden de habilidades ni las
 * compras en orden): puesto, aumentos, hechizos y objetos del inventario final (sin abalorio ni repetidos).
 * Ganar es terminar 1.º. Los jugadores sin un puesto válido se descartan.
 */
export function extraerParticipacionesArena(partida: PartidaRiot): Participacion[] {
  const resultado: Participacion[] = [];
  for (const p of partida.info.participants) {
    const posicion = posicionDe(p);
    if (posicion === null || !p.championName) continue;
    let runas = RUNAS_VACIAS;
    try {
      if (p.perks?.styles?.length >= 2) runas = extraerRunas(p);
    } catch {
      runas = RUNAS_VACIAS;
    }
    resultado.push({
      matchId: partida.metadata.matchId,
      campeon: p.championName,
      rol: null,
      modo: 'arena',
      victoria: posicion === 1,
      parche: parcheDe(partida.info.gameVersion),
      runas,
      hechizos: [Math.min(p.summoner1Id, p.summoner2Id), Math.max(p.summoner1Id, p.summoner2Id)],
      iniciales: [],
      compras: [...new Set(CAMPOS_OBJETO.map((c) => p[c]).filter(esIdValido))],
      habilidades: [],
      aumentos: aumentosDe(p),
      posicion,
      ...kdaDe(p),
    });
  }
  return resultado;
}
