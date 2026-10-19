import {
  clasificarObjeto,
  MAPA_DE_MODO,
  ROLES,
  type Habilidad,
  type ItemDDragonCrudo,
  type ModoJuego,
  type PaginaRunas,
  type Rol,
} from '@coach/shared';
import { rutaDePartida, type RutaPartida } from './rutaJungla';
import type { LineaTiempoRiot, ParticipanteRiot, PartidaRiot } from './riot/riotApi';

export interface Participacion {
  matchId: string;
  campeon: string;
  /** null en los modos sin roles (ARAM, ARAM: Caos y Arena). */
  rol: Rol | null;
  /** Falta en las participaciones guardadas antes de 3.0: son de clasificatoria. */
  modo?: ModoJuego;
  victoria: boolean;
  parche: string;
  runas: PaginaRunas;
  hechizos: [number, number];
  iniciales: number[];
  compras: number[];
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
}

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
  modo: Exclude<ModoJuego, 'arena'> = 'clasificatoria',
): Participacion[] {
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
    for (const { itemId } of compras) {
      const objeto = objetos[itemId];
      if (!objeto || vistos.has(itemId)) continue;
      if (clasificarObjeto(itemId, objeto, MAPA_DE_MODO[modo]) === 'otro') continue;
      vistos.add(itemId);
      clave.push(itemId);
    }

    resultado.push({
      matchId: partida.metadata.matchId,
      campeon: p.championName,
      rol: conRol ? (p.teamPosition as Rol) : null,
      modo,
      ...(modo === 'caos' ? { aumentos: aumentosDe(p) } : {}),
      victoria: p.win,
      parche: parcheDe(partida.info.gameVersion),
      runas: extraerRunas(p),
      hechizos: [Math.min(p.summoner1Id, p.summoner2Id), Math.max(p.summoner1Id, p.summoner2Id)],
      iniciales,
      compras: clave,
      habilidades,
      ...kdaDe(p),
      ...rutaDe(p, linea, conRol),
    });
  }
  return resultado;
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
