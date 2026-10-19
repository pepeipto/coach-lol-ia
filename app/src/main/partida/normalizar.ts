import { MAPA_DE_MODO, modoDeGameMode, modoDeMapa, type ModoJuego } from '@coach/shared';
import type { EstadoPartida, EventoPartida } from '../../shared/tiposApp';

/*
 * El modo sale de `gameData.gameMode` (ver `modoDeGameMode` en shared/modos.ts) y tiene que jugarse en su mapa
 * (MAPA_DE_MODO, de maps.json). Un gameMode que no conocemos (Herramienta de práctica, URF, Uno para todos…) o
 * que falta usa el modo de su mapa: en la Grieta (11) el overlay de la Grieta, en el Abismo (12) el de ARAM y en
 * Rings of Wrath (30) el de Arena. En cualquier otro mapa (TFT…) no hay overlay.
 */
const PREFIJO_CAMPEON = 'game_character_displayname_';

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const nfc = (v: unknown): string | null => (typeof v === 'string' && v ? v.normalize('NFC') : null);

/**
 * Convierte la respuesta de /liveclientdata/allgamedata en el estado del coach; null si no es una partida con
 * jugador activo de un modo con datos (Grieta, ARAM, ARAM: Caos o Arena) en su mapa.
 */
export function normalizarDatosPartida(json: unknown): EstadoPartida | null {
  if (!esObj(json)) return null;
  const { activePlayer, allPlayers, events, gameData } = json;
  if (!esObj(activePlayer) || !esObj(gameData) || !Array.isArray(allPlayers)) return null;
  const conocido = modoDeGameMode(gameData.gameMode);
  const modo: ModoJuego | null = conocido ?? modoDeMapa(gameData.mapNumber);
  if (!modo || gameData.mapNumber !== MAPA_DE_MODO[modo]) return null;

  const id = nfc(activePlayer.riotId);
  if (!id) return null;
  const yo = allPlayers.find((p): p is Obj => esObj(p) && nfc(p.riotId) === id);
  if (!yo) return null;

  const crudo = typeof yo.rawChampionName === 'string' ? yo.rawChampionName : '';
  const campeon = crudo.startsWith(PREFIJO_CAMPEON) ? crudo.slice(PREFIJO_CAMPEON.length) : crudo;
  if (!campeon) return null;

  const habs = esObj(activePlayer.abilities) ? activePlayer.abilities : {};
  const nivelHab = (k: string) => (esObj(habs[k]) ? num(habs[k].abilityLevel) : 0);

  const objetos = (Array.isArray(yo.items) ? yo.items : [])
    .filter(esObj)
    .map((o) => o.itemID)
    .filter((n): n is number => typeof n === 'number');

  // Equipo de cada jugador por los nombres con que puede salir en KillerName (nombre de juego, Riot ID o nombre antiguo).
  const equipos = new Map<string, 'ORDER' | 'CHAOS'>();
  for (const p of allPlayers.filter(esObj)) {
    if (p.team !== 'ORDER' && p.team !== 'CHAOS') continue;
    const riotId = nfc(p.riotId);
    for (const n of [nfc(p.riotIdGameName), riotId, riotId?.split('#')[0] ?? null, nfc(p.summonerName)]) {
      if (n) equipos.set(n, p.team);
    }
  }

  const lista = esObj(events) && Array.isArray(events.Events) ? events.Events : [];
  const eventos = lista
    .filter(esObj)
    .filter((e) => typeof e.EventName === 'string')
    .map((e): EventoPartida => {
      const evento: EventoPartida = { nombre: e.EventName as string, tiempo: num(e.EventTime) };
      if (evento.nombre === 'DragonKill') {
        if (typeof e.DragonType === 'string') evento.dragon = e.DragonType;
        const equipo = equipos.get(nfc(e.KillerName) ?? '');
        if (equipo) evento.equipo = equipo;
      }
      return evento;
    });

  const estado: EstadoPartida = {
    tiempo: num(gameData.gameTime),
    oro: num(activePlayer.currentGold),
    nivel: num(activePlayer.level),
    campeon,
    objetos,
    habilidades: { Q: nivelHab('Q'), W: nivelHab('W'), E: nivelHab('E'), R: nivelHab('R') },
    eventos,
    modo,
  };
  const scores = esObj(yo.scores) ? yo.scores : null;
  if (scores && typeof scores.creepScore === 'number' && Number.isFinite(scores.creepScore)) estado.cs = scores.creepScore;
  if (scores) {
    const [k, d, a] = [scores.kills, scores.deaths, scores.assists];
    const conteo = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    if (conteo(k) && conteo(d) && conteo(a)) estado.kda = { k, d, a };
  }
  if (yo.team === 'ORDER' || yo.team === 'CHAOS') estado.equipo = yo.team;
  // Terreno de la Grieta elemental: tras el segundo dragón dice el tipo de todos los siguientes.
  if (typeof gameData.mapTerrain === 'string' && gameData.mapTerrain && gameData.mapTerrain !== 'Default') estado.terreno = gameData.mapTerrain;
  return estado;
}
