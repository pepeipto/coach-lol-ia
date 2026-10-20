import { crearLimitador, type Limitador, type OpcionesTurno, type PrioridadRiot } from './limitador';

export type Region = 'EUW' | 'LAN' | 'LAS' | 'BR' | 'NA';

/**
 * Regiones que conoce el servidor (pantalla de carga y recolector). BR (br1) y NA (na1) se añadieron en la 3.0
 * para los jugadores de allí: comparten el enrutado «americas» con LAN y LAS.
 */
export const REGIONES: Record<
  Region,
  { plataforma: 'euw1' | 'la1' | 'la2' | 'br1' | 'na1'; ruta: 'europe' | 'americas' }
> = {
  EUW: { plataforma: 'euw1', ruta: 'europe' },
  LAN: { plataforma: 'la1', ruta: 'americas' },
  LAS: { plataforma: 'la2', ruta: 'americas' },
  BR: { plataforma: 'br1', ruta: 'americas' },
  NA: { plataforma: 'na1', ruta: 'americas' },
};

/**
 * Regiones del recolector por defecto: las de siempre, para no repartir el presupuesto de la clave de desarrollo
 * entre más regiones. Se cambian con REGIONES_RECOLECTOR (p. ej. «EUW,LAN,LAS,BR,NA»).
 */
export const REGIONES_RECOLECTOR_POR_DEFECTO: readonly Region[] = ['EUW', 'LAN', 'LAS'];

export class ErrorRiot extends Error {
  estado: number;
  constructor(estado: number, mensaje?: string) {
    super(mensaje ?? `Error de la API de Riot (${estado})`);
    this.name = 'ErrorRiot';
    this.estado = estado;
  }
}

export interface PerkRiot {
  perk: number;
}
export interface EstiloRiot {
  style: number;
  selections: PerkRiot[];
}
export interface ParticipanteRiot {
  participantId: number;
  puuid: string;
  championName: string;
  teamPosition: string;
  /** 100 (azul, ORDER) o 200 (rojo, CHAOS). Opcional en las partidas guardadas en las pruebas. */
  teamId?: number;
  win: boolean;
  /** Match-v5 los trae siempre; opcionales para las partidas guardadas en las pruebas. */
  kills?: number;
  deaths?: number;
  assists?: number;
  summoner1Id: number;
  summoner2Id: number;
  perks: {
    statPerks: { offense: number; flex: number; defense: number };
    styles: EstiloRiot[];
  };
  /*
   * Campos de ARAM: Caos y Arena. La documentación oficial de Match-v5
   * (https://developer.riotgames.com/apis#match-v5, ParticipantDto) lista `playerAugment1..4`, `placement`,
   * `playerSubteamId` y `subteamPlacement` (int). `playerAugment5` y `playerAugment6` (lo pide el plan) no
   * salen en esa documentación: se leen si vienen y se ignoran si faltan o valen 0.
   */
  playerAugment1?: number;
  playerAugment2?: number;
  playerAugment3?: number;
  playerAugment4?: number;
  playerAugment5?: number;
  playerAugment6?: number;
  /** Arena: puesto final del jugador (1..8). */
  placement?: number;
  /** Arena: dúo del jugador. */
  playerSubteamId?: number;
  /** Arena: puesto final del dúo (1..8). */
  subteamPlacement?: number;
  /** Inventario final (item6 es el abalorio). */
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
}
export interface PartidaRiot {
  metadata: { matchId: string };
  info: {
    gameVersion: string;
    queueId: number;
    /** Duración en segundos (Match-v5). */
    gameDuration: number;
    participants: ParticipanteRiot[];
  };
}
export interface EventoRiot {
  type: string;
  timestamp: number;
  participantId?: number;
  itemId?: number;
  beforeId?: number;
  skillSlot?: number;
  levelUpType?: string;
}
/** Frame de la línea de tiempo (uno por minuto): `participantFrames` va por participantId ("1".."10"). */
export interface FrameRiot {
  timestamp?: number;
  events: EventoRiot[];
  participantFrames?: Record<string, { position?: { x: number; y: number } }>;
}
export interface LineaTiempoRiot {
  info: { frames: FrameRiot[] };
}

export interface RiotApi {
  entradasLiga(
    plataforma: string,
    tier: 'EMERALD' | 'DIAMOND',
    division: 'I' | 'II' | 'III' | 'IV',
    pagina: number,
  ): Promise<{ puuid: string }[]>;
  ligaApex(
    plataforma: string,
    liga: 'challenger' | 'grandmaster' | 'master',
  ): Promise<{ puuid: string }[]>;
  /**
   * Ids de las últimas partidas del jugador en una cola (420, clasificatoria, por defecto). `inicio` (segundos
   * epoch) es el `startTime` de Match-v5: solo partidas posteriores.
   */
  idsPartidas(ruta: string, puuid: string, cantidad: number, cola?: number, inicio?: number): Promise<string[]>;
  partida(ruta: string, id: string): Promise<PartidaRiot | null>;
  lineaTiempo(ruta: string, id: string): Promise<LineaTiempoRiot | null>;
}

/** Entrada de league-v4 de un jugador en una cola (solo se usa RANKED_SOLO_5x5). */
export interface EntradaLigaRiot {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

/** Maestría de champion-mastery-v4 de un jugador con un campeón. */
export interface MaestriaRiot {
  championLevel: number;
  championPoints: number;
}

/** Consultas por jugador para la pantalla de carga (rango oficial y maestría). */
export interface RiotApiJugadores {
  /** Rango oficial en clasificatoria en solitario; null si no tiene o si Riot responde 404. */
  rangoPorPuuid(plataforma: string, puuid: string, opciones?: OpcionesTurno): Promise<EntradaLigaRiot | null>;
  /** Maestría con un campeón; null si Riot responde 404 (no lo ha jugado). */
  maestria(plataforma: string, puuid: string, championId: number, opciones?: OpcionesTurno): Promise<MaestriaRiot | null>;
}

export type RiotApiCompleta = RiotApi & RiotApiJugadores;

/** El cliente real del servidor: además, la comprobación barata de la clave (ver estadoClave.ts). */
export interface RiotApiServidor extends RiotApiCompleta {
  /**
   * Una sola petición a lol-status (platform-data de euw1), lo más barato de la API: devuelve el código HTTP
   * (401/403 = clave caducada) sin lanzar, o null si no hubo respuesta.
   */
  comprobarClave(): Promise<number | null>;
}

export interface OpcionesRiotApi {
  clave: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  limitadores?: Map<string, Limitador>;
  /** Fracción de cada regla para las consultas interactivas (ver crearLimitador); por defecto, el 60 %. */
  fraccionInteractiva?: number;
  /** Se llama con el código HTTP de cada respuesta de Riot (para el estado de la clave). Nunca recibe la clave. */
  alResponder?: (estadoHttp: number) => void;
}

const MAX_REINTENTOS = 3;
const ESPERA_POR_DEFECTO_MS = 10000;
const COLA = 'RANKED_SOLO_5x5';

export function crearRiotApi(opciones: OpcionesRiotApi): RiotApiServidor {
  const hacerFetch = opciones.fetch ?? fetch;
  const esperar =
    opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const limitadores = opciones.limitadores ?? new Map<string, Limitador>();

  function limitadorDe(host: string): Limitador {
    let l = limitadores.get(host);
    if (!l) {
      l = crearLimitador(undefined, { fraccionInteractiva: opciones.fraccionInteractiva });
      limitadores.set(host, l);
    }
    return l;
  }

  /**
   * Las consultas de la pantalla de carga son 'interactiva' (alguien espera): pasan antes que las del
   * recolector, que comparte la clave y el limitador de cada host.
   */
  async function pedir<T>(
    subdominio: string,
    ruta: string,
    prioridad: PrioridadRiot = 'fondo',
    turno: OpcionesTurno = {},
  ): Promise<T | null> {
    const host = `${subdominio}.api.riotgames.com`;
    const url = `https://${host}${ruta}`;
    for (let intento = 0; ; intento++) {
      await limitadorDe(host).esperarTurno(prioridad, turno);
      const resp = await hacerFetch(url, { headers: { 'X-Riot-Token': opciones.clave } });
      opciones.alResponder?.(resp.status);
      if (resp.status === 404) return null;
      if (resp.status === 429) {
        if (intento >= MAX_REINTENTOS) throw new ErrorRiot(429);
        const cabecera = resp.headers.get('Retry-After');
        const segundos = Number(cabecera);
        const conRetry = cabecera !== null && Number.isFinite(segundos);
        const ms = conRetry ? segundos * 1000 : ESPERA_POR_DEFECTO_MS;
        // Quien espera la respuesta (pantalla de carga) no reintenta si el Retry-After pasa de su plazo.
        if (turno.plazo !== undefined && Date.now() + ms > turno.plazo) throw new ErrorRiot(429);
        const tipo = resp.headers.get('X-Rate-Limit-Type');
        if (conRetry && (tipo === 'application' || tipo === 'method')) {
          // Límite de la clave o del método: se para todo el host, no solo esta petición; el reintento
          // vuelve a la cola y sale cuando acaba la pausa.
          limitadorDe(host).pausar(ms);
        } else {
          await esperar(ms);
        }
        continue;
      }
      if (!resp.ok) throw new ErrorRiot(resp.status);
      return (await resp.json()) as T;
    }
  }

  return {
    async comprobarClave() {
      const host = 'euw1.api.riotgames.com';
      try {
        await limitadorDe(host).esperarTurno('interactiva');
        const resp = await hacerFetch(`https://${host}/lol/status/v4/platform-data`, {
          headers: { 'X-Riot-Token': opciones.clave },
        });
        opciones.alResponder?.(resp.status);
        return resp.status;
      } catch {
        return null;
      }
    },
    async entradasLiga(plataforma, tier, division, pagina) {
      const r = await pedir<{ puuid: string }[]>(
        plataforma,
        `/lol/league/v4/entries/${COLA}/${tier}/${division}?page=${pagina}`,
      );
      return r ?? [];
    },
    async ligaApex(plataforma, liga) {
      const r = await pedir<{ entries: { puuid: string }[] }>(
        plataforma,
        `/lol/league/v4/${liga}leagues/by-queue/${COLA}`,
      );
      return r?.entries ?? [];
    },
    async idsPartidas(ruta, puuid, cantidad, cola = 420, inicio) {
      const desde = inicio !== undefined && Number.isFinite(inicio) ? `&startTime=${Math.floor(inicio)}` : '';
      const r = await pedir<string[]>(
        ruta,
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${cola}&count=${cantidad}${desde}`,
      );
      return r ?? [];
    },
    partida: (ruta, id) => pedir<PartidaRiot>(ruta, `/lol/match/v5/matches/${id}`),
    lineaTiempo: (ruta, id) =>
      pedir<LineaTiempoRiot>(ruta, `/lol/match/v5/matches/${id}/timeline`),
    async rangoPorPuuid(plataforma, puuid, turno) {
      const r = await pedir<EntradaLigaRiot[]>(
        plataforma,
        `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
        'interactiva',
        turno,
      );
      const solo = r?.find((e) => e.queueType === COLA);
      if (!solo) return null;
      const { queueType, tier, rank, leaguePoints, wins, losses } = solo;
      return { queueType, tier, rank, leaguePoints, wins, losses };
    },
    maestria: (plataforma, puuid, championId, turno) =>
      pedir<MaestriaRiot>(
        plataforma,
        `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/by-champion/${championId}`,
        'interactiva',
        turno,
      ).then((m) => (m ? { championLevel: m.championLevel, championPoints: m.championPoints } : null)),
  };
}
