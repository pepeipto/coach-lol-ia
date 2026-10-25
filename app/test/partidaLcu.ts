const YO = 'puuid-yo';

/** Partida de la LCU (/lol-match-history/v1/games/{id}) con 10 jugadores; el 1 es el jugador. */
export function partidaLcu(id: number, o: { creada?: number; duracion?: number; cola?: number; gano?: boolean; yo?: Partial<Record<string, number>> } = {}) {
  const gano = o.gano ?? true;
  const lanes: [string, string, number][] = [
    ['MIDDLE', 'SOLO', 4],
    ['TOP', 'SOLO', 12],
    ['JUNGLE', 'NONE', 11],
    ['BOTTOM', 'DUO_CARRY', 7],
    ['BOTTOM', 'DUO_SUPPORT', 14],
  ];
  const participants = Array.from({ length: 10 }, (_, i) => {
    const [lane, role, spell] = lanes[i % 5]!;
    const azul = i < 5;
    const stats: Record<string, unknown> = {
      kills: 3,
      deaths: 4,
      assists: 5,
      totalMinionsKilled: lane === 'BOTTOM' && role === 'DUO_SUPPORT' ? 30 : 180,
      neutralMinionsKilled: lane === 'JUNGLE' ? 140 : 0,
      goldEarned: 11000,
      totalDamageDealtToChampions: 15000,
      totalDamageTaken: 20000,
      visionScore: 20,
      champLevel: 15,
      item0: 3089,
      item1: 0,
      win: azul ? gano : !gano,
      ...(i === 0 ? o.yo : {}),
    };
    return { participantId: i + 1, teamId: azul ? 100 : 200, championId: i === 0 ? 238 : 100 + i, spell1Id: 4, spell2Id: spell, stats, timeline: { lane, role } };
  });
  return {
    gameId: id,
    gameCreation: o.creada ?? Date.UTC(2026, 9, 20, 18) + id * 60_000,
    gameDuration: o.duracion ?? 1800,
    queueId: o.cola ?? 420,
    participants,
    participantIdentities: participants.map((p) => ({
      participantId: p.participantId,
      player: { gameName: p.participantId === 1 ? 'AKIRA88' : `J${p.participantId}`, tagLine: 'EUW', puuid: p.participantId === 1 ? YO : `p${p.participantId}` },
    })),
  };
}
