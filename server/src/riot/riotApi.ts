import { crearLimitador, type Limitador } from './limitador';

export type Region = 'EUW' | 'LAN' | 'LAS';

export const REGIONES: Record<
  Region,
  { plataforma: 'euw1' | 'la1' | 'la2'; ruta: 'europe' | 'americas' }
> = {
  EUW: { plataforma: 'euw1', ruta: 'europe' },
  LAN: { plataforma: 'la1', ruta: 'americas' },
  LAS: { plataforma: 'la2', ruta: 'americas' },
};

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
  win: boolean;
  summoner1Id: number;
  summoner2Id: number;
  perks: {
    statPerks: { offense: number; flex: number; defense: number };
    styles: EstiloRiot[];
  };
}
export interface PartidaRiot {
  metadata: { matchId: string };
  info: {
    gameVersion: string;
    queueId: number;
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
export interface LineaTiempoRiot {
  info: { frames: { events: EventoRiot[] }[] };
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
  idsPartidas(ruta: string, puuid: string, cantidad: number): Promise<string[]>;
  partida(ruta: string, id: string): Promise<PartidaRiot | null>;
  lineaTiempo(ruta: string, id: string): Promise<LineaTiempoRiot | null>;
}

export interface OpcionesRiotApi {
  clave: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  limitadores?: Map<string, Limitador>;
}

const MAX_REINTENTOS = 3;
const ESPERA_POR_DEFECTO_MS = 10000;
const COLA = 'RANKED_SOLO_5x5';

export function crearRiotApi(opciones: OpcionesRiotApi): RiotApi {
  const hacerFetch = opciones.fetch ?? fetch;
  const esperar =
    opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const limitadores = opciones.limitadores ?? new Map<string, Limitador>();

  function limitadorDe(host: string): Limitador {
    let l = limitadores.get(host);
    if (!l) {
      l = crearLimitador();
      limitadores.set(host, l);
    }
    return l;
  }

  async function pedir<T>(subdominio: string, ruta: string): Promise<T | null> {
    const host = `${subdominio}.api.riotgames.com`;
    const url = `https://${host}${ruta}`;
    for (let intento = 0; ; intento++) {
      await limitadorDe(host).esperarTurno();
      const resp = await hacerFetch(url, { headers: { 'X-Riot-Token': opciones.clave } });
      if (resp.status === 404) return null;
      if (resp.status === 429) {
        if (intento >= MAX_REINTENTOS) throw new ErrorRiot(429);
        const segundos = Number(resp.headers.get('Retry-After'));
        await esperar(
          resp.headers.get('Retry-After') !== null && Number.isFinite(segundos)
            ? segundos * 1000
            : ESPERA_POR_DEFECTO_MS,
        );
        continue;
      }
      if (!resp.ok) throw new ErrorRiot(resp.status);
      return (await resp.json()) as T;
    }
  }

  return {
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
    async idsPartidas(ruta, puuid, cantidad) {
      const r = await pedir<string[]>(
        ruta,
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&count=${cantidad}`,
      );
      return r ?? [];
    },
    partida: (ruta, id) => pedir<PartidaRiot>(ruta, `/lol/match/v5/matches/${id}`),
    lineaTiempo: (ruta, id) =>
      pedir<LineaTiempoRiot>(ruta, `/lol/match/v5/matches/${id}/timeline`),
  };
}
