import {
  clasificarObjeto,
  ROLES,
  type Habilidad,
  type ItemDDragonCrudo,
  type PaginaRunas,
  type Rol,
} from '@coach/shared';
import type { LineaTiempoRiot, ParticipanteRiot, PartidaRiot } from './riot/riotApi';

export interface Participacion {
  matchId: string;
  campeon: string;
  rol: Rol;
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

export function extraerParticipaciones(
  partida: PartidaRiot,
  linea: LineaTiempoRiot,
  objetos: Record<number, ItemDDragonCrudo>,
): Participacion[] {
  const eventos = linea.info.frames.flatMap((f) => f.events);
  const resultado: Participacion[] = [];

  for (const p of partida.info.participants) {
    if (!ROLES.includes(p.teamPosition as Rol)) continue;

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
      if (clasificarObjeto(itemId, objeto) === 'otro') continue;
      vistos.add(itemId);
      clave.push(itemId);
    }

    resultado.push({
      matchId: partida.metadata.matchId,
      campeon: p.championName,
      rol: p.teamPosition as Rol,
      victoria: p.win,
      parche: parcheDe(partida.info.gameVersion),
      runas: extraerRunas(p),
      hechizos: [Math.min(p.summoner1Id, p.summoner2Id), Math.max(p.summoner1Id, p.summoner2Id)],
      iniciales,
      compras: clave,
      habilidades,
      ...kdaDe(p),
    });
  }
  return resultado;
}
