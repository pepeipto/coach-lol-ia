/**
 * Perfil de muestra para las capturas de la vista «Perfil» (3.5): 14 partidas coherentes de un jugador de Zed en
 * mitad, con rango, historial de PL, reto y una línea de tiempo. Se construye con el mismo código que la app
 * (interpretarPartida, tendencias, retos…) a partir de partidas con la forma de la LCU. Jugadores ficticios.
 */
import type { LineaTiempo, Perfil, PuntoPl } from '../src/shared/perfil';
import { anotarPl, interpretarLineaTiempo, interpretarPartida } from '../src/main/perfil/lcuPerfil';
import { tendencias } from '../src/main/perfil/puntuaciones';
import { estadoReto, retoSugerido } from '../src/main/perfil/retos';
import { campeonesDe } from '../src/main/perfil/servicio';

const YO = 'muestra-yo';
/** Pseudoaleatorio con semilla: las capturas salen siempre iguales. */
function azar(semilla: number) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

const MIOS = [238, 238, 238, 91, 238, 246, 238, 238, 777, 238, 238, 91, 238, 238];
const RIVALES = [103, 157, 134, 4, 1, 7, 61, 112, 517, 99];
const OTROS = [86, 64, 222, 412, 122, 121, 202, 350, 17, 89, 54, 39, 245, 266, 875, 799];
const OBJETOS_YO = [6692, 3142, 6694, 3814, 3158, 3071];
const OBJETOS = [3031, 3094, 3036, 3046, 6672, 3089, 3157, 3020, 3068, 3075, 6665, 3190, 3107, 2065];
const NOMBRES = ['Sombra Fría', 'NoxusPrime', 'Tilted Mage', 'Kraken Jr', 'Luz de Demacia', 'ZaunRat', 'Freljord Wind', 'Piltover Ace', 'Bandle Bard'];

function partidaLcu(i: number, r: () => number) {
  const gano = [true, true, false, true, true, false, true, false, true, true, false, true, true, false][i]!;
  const duracion = 1500 + Math.round(r() * 900);
  const lanes: [string, string, number][] = [
    ['MIDDLE', 'SOLO', 4],
    ['TOP', 'SOLO', 12],
    ['JUNGLE', 'NONE', 11],
    ['BOTTOM', 'DUO_CARRY', 7],
    ['BOTTOM', 'DUO_SUPPORT', 14],
  ];
  const participants = Array.from({ length: 10 }, (_, k) => {
    const [lane, role, spell] = lanes[k % 5]!;
    const azul = k < 5;
    const ganaEste = azul ? gano : !gano;
    const yo = k === 0;
    const apoyo = role === 'DUO_SUPPORT';
    const min = duracion / 60;
    const kills = yo ? 5 + Math.round(r() * 9) : Math.round(r() * (apoyo ? 3 : 8));
    return {
      participantId: k + 1,
      teamId: azul ? 100 : 200,
      championId: yo ? MIOS[i]! : k === 5 ? RIVALES[i % RIVALES.length]! : OTROS[(i * 3 + k) % OTROS.length]!,
      spell1Id: 4,
      spell2Id: spell,
      timeline: { lane, role },
      stats: {
        kills,
        deaths: yo ? Math.round(1 + r() * (gano ? 4 : 7)) : Math.round(2 + r() * 6),
        assists: Math.round(r() * (apoyo ? 18 : 10)) + (ganaEste ? 3 : 0),
        totalMinionsKilled: Math.round(min * (apoyo ? 1.2 : lane === 'JUNGLE' ? 1.5 : yo ? 6.6 + r() * 1.8 : 5.5 + r() * 2)),
        neutralMinionsKilled: lane === 'JUNGLE' ? Math.round(min * 4.5) : 0,
        goldEarned: Math.round(min * (apoyo ? 290 : yo ? 440 + r() * 60 : 360 + r() * 80)),
        totalDamageDealtToChampions: Math.round(min * (apoyo ? 350 : yo ? 1050 + r() * 400 : 600 + r() * 450)),
        totalDamageTaken: Math.round(min * (lane === 'TOP' || lane === 'JUNGLE' ? 1100 : 700) * (0.8 + r() * 0.4)),
        visionScore: Math.round(min * (apoyo ? 2.1 : lane === 'JUNGLE' ? 1.2 : yo ? 0.7 + r() * 0.4 : 0.6 + r() * 0.3)),
        champLevel: Math.min(18, Math.round(10 + min / 4 + (yo ? 1 : 0))),
        ...Object.fromEntries((yo ? OBJETOS_YO : OBJETOS.slice((k + i) % 6, ((k + i) % 6) + 6)).map((o, j) => [`item${j}`, o])),
        item6: apoyo ? 3364 : 3340,
        win: ganaEste,
      },
    };
  });
  return {
    gameId: 7_200_000_000 + i,
    gameCreation: Date.UTC(2026, 9, 21, 22) - i * 5 * 3_600_000,
    gameDuration: duracion,
    queueId: i === 4 ? 450 : 420,
    participants,
    participantIdentities: participants.map((p) => ({
      participantId: p.participantId,
      player: { gameName: p.participantId === 1 ? 'AKIRA88' : NOMBRES[(p.participantId + i) % NOMBRES.length], tagLine: 'EUW', puuid: p.participantId === 1 ? YO : `x${p.participantId}` },
    })),
  };
}

function lineaDeMuestra(duracionS: number, r: () => number): LineaTiempo {
  const frames: { timestamp: number; participantFrames: Record<string, unknown>; events: unknown[] }[] = [];
  const oro: number[] = Array(11).fill(500);
  const cs: number[] = Array(11).fill(0);
  const xp: number[] = Array(11).fill(0);
  for (let m = 0; m <= Math.floor(duracionS / 60); m++) {
    const participantFrames: Record<string, unknown> = {};
    for (let p = 1; p <= 10; p++) {
      const azul = p <= 5;
      if (m > 0) {
        oro[p]! += 330 + r() * 120 + (azul ? 25 : 0) + (p === 1 ? 45 : 0);
        cs[p]! += p % 5 === 0 ? 1 : 6 + r() * 2 + (p === 1 ? 0.8 : 0);
        xp[p]! += 380 + r() * 90 + (p === 1 ? 30 : 0);
      }
      participantFrames[String(p)] = { participantId: p, totalGold: Math.round(oro[p]!), minionsKilled: Math.round(cs[p]!), jungleMinionsKilled: 0, xp: Math.round(xp[p]!), level: Math.min(18, 1 + Math.floor(xp[p]! / 600)) };
    }
    frames.push({ timestamp: m * 60000, participantFrames, events: [] });
  }
  const ev = (m: number, e: Record<string, unknown>) => frames[Math.min(m, frames.length - 1)]!.events.push({ timestamp: m * 60000 + 15000, ...e });
  ev(6, { type: 'ELITE_MONSTER_KILL', killerId: 3, killerTeamId: 100, monsterType: 'HORDE' });
  ev(9, { type: 'ELITE_MONSTER_KILL', killerId: 3, killerTeamId: 100, monsterType: 'DRAGON' });
  ev(15, { type: 'ELITE_MONSTER_KILL', killerId: 8, killerTeamId: 200, monsterType: 'DRAGON' });
  ev(16, { type: 'ELITE_MONSTER_KILL', killerId: 3, killerTeamId: 100, monsterType: 'RIFTHERALD' });
  ev(22, { type: 'ELITE_MONSTER_KILL', killerId: 1, killerTeamId: 100, monsterType: 'BARON_NASHOR' });
  ev(12, { type: 'CHAMPION_KILL', killerId: 6, victimId: 1 });
  ev(19, { type: 'CHAMPION_KILL', killerId: 7, victimId: 1 });
  return interpretarLineaTiempo({ frames }, (pid) => (pid <= 5 ? 100 : 200))!;
}

export function perfilDeMuestra(version: string, campeonesDD: Perfil['campeonesDD']): { perfil: Perfil; lineaTiempo: LineaTiempo } {
  const r = azar(2026);
  const partidas = MIOS.map((_, i) => interpretarPartida(partidaLcu(i, r), YO)!).filter(Boolean);
  // PL: subida de Esmeralda III a Esmeralda I con algún tropiezo.
  const pasos: [string, number][] = [['III', 12], ['III', 33], ['III', 54], ['III', 38], ['III', 61], ['III', 82], ['II', 0], ['II', 21], ['II', 4], ['II', 26], ['II', 47], ['II', 68], ['II', 89], ['I', 9], ['I', 31]];
  let pl: PuntoPl[] = [];
  pasos.forEach(([division, lp], i) => {
    pl = anotarPl(pl, [{ cola: 'solo', tier: 'EMERALD', division, lp, victorias: 0, derrotas: 0 }], new Date(Date.UTC(2026, 9, 10 + i)).toISOString());
  });
  const desde = partidas[6]!.fecha;
  const perfil: Perfil = {
    invocador: { nombre: 'AKIRA88', tag: 'EUW', nivel: 412, icono: 6631 },
    rangos: [
      { cola: 'solo', tier: 'EMERALD', division: 'I', lp: 31, victorias: 118, derrotas: 97 },
      { cola: 'flex', tier: 'DIAMOND', division: 'IV', lp: 12, victorias: 34, derrotas: 26 },
    ],
    pl,
    partidas,
    campeones: campeonesDe(partidas),
    tendencias: tendencias(partidas),
    reto: estadoReto('muertes4', desde, partidas),
    retoSugerido: retoSugerido(partidas),
    actualizado: new Date(Date.UTC(2026, 9, 21, 22, 40)).toISOString(),
    conectado: true,
    version,
    campeonesDD,
  };
  return { perfil, lineaTiempo: lineaDeMuestra(partidas[0]!.duracion, r) };
}
