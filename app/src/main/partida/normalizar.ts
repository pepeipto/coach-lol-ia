import { MAPA_DE_MODO, modoDeGameMode, modoDeMapa, ROLES, type ModoJuego, type Rol } from '@coach/shared';
import type { EstadoPartida, EventoPartida, JugadorPartida } from '../../shared/tiposApp';

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

  const campeon = campeonDe(yo);
  if (!campeon) return null;

  const habs = esObj(activePlayer.abilities) ? activePlayer.abilities : {};
  const nivelHab = (k: string) => (esObj(habs[k]) ? num(habs[k].abilityLevel) : 0);

  const objetos = (Array.isArray(yo.items) ? yo.items : [])
    .filter(esObj)
    .map((o) => o.itemID)
    .filter((n): n is number => typeof n === 'number');

  // Equipo y campeón de cada jugador por los nombres con que puede salir en el registro de eventos
  // (KillerName, VictimName, Assisters): nombre de juego, Riot ID o nombre antiguo.
  const equipos = new Map<string, 'ORDER' | 'CHAOS'>();
  const campeones = new Map<string, string>();
  const jugadores: JugadorPartida[] = [];
  for (const p of allPlayers.filter(esObj)) {
    if (p.team !== 'ORDER' && p.team !== 'CHAOS') continue;
    const suCampeon = campeonDe(p);
    const riotId = nfc(p.riotId);
    for (const n of [nfc(p.riotIdGameName), riotId, riotId?.split('#')[0] ?? null, nfc(p.summonerName)]) {
      if (!n) continue;
      equipos.set(n, p.team);
      if (suCampeon) campeones.set(n, suCampeon);
    }
    if (suCampeon) jugadores.push({ campeon: suCampeon, equipo: p.team, posicion: posicionDe(p.position), castigo: llevaCastigo(p) });
  }
  const campeonDeNombre = (v: unknown) => campeones.get(nfc(v) ?? '');

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
      if (evento.nombre === 'ChampionKill') {
        if (typeof e.EventID === 'number') evento.id = e.EventID;
        const asesino = campeonDeNombre(e.KillerName);
        const victima = campeonDeNombre(e.VictimName);
        if (asesino) evento.asesino = asesino;
        if (victima) evento.victima = victima;
        evento.asistentes = (Array.isArray(e.Assisters) ? e.Assisters : []).map(campeonDeNombre).filter((c): c is string => !!c);
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
    jugadores,
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

function campeonDe(p: Obj): string {
  const crudo = typeof p.rawChampionName === 'string' ? p.rawChampionName : '';
  return crudo.startsWith(PREFIJO_CAMPEON) ? crudo.slice(PREFIJO_CAMPEON.length) : crudo;
}

const posicionDe = (v: unknown): Rol | null => (ROLES.includes(v as Rol) ? (v as Rol) : null);

/** Castigo en cualquiera de sus variantes (SummonerSmite…), tal como sale en el marcador. */
function llevaCastigo(p: Obj): boolean {
  const hechizos = esObj(p.summonerSpells) ? p.summonerSpells : {};
  return [hechizos.summonerSpellOne, hechizos.summonerSpellTwo].some(
    (h) => esObj(h) && typeof h.rawDisplayName === 'string' && /Smite/i.test(h.rawDisplayName),
  );
}
