import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  anotarPl,
  interpretarInvocador,
  interpretarLineaTiempo,
  interpretarListaPartidas,
  interpretarPartida,
  interpretarRango,
  rolDe,
  RUTAS_LCU,
  valorRango,
} from '../src/main/perfil/lcuPerfil';
import { contextos, etiquetar, puntuar, tendencias } from '../src/main/perfil/puntuaciones';
import { estadoReto, retoSugerido } from '../src/main/perfil/retos';
import { campeonesDe, crearServicioPerfil } from '../src/main/perfil/servicio';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import type { PartidaHistorial } from '../src/shared/perfil';

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

const partida = (id: number, o?: Parameters<typeof partidaLcu>[1]) => interpretarPartida(partidaLcu(id, o), YO)!;

describe('perfil: lectura de la LCU', () => {
  it('invocador y rango (queueMap) con «sin clasificar»', () => {
    expect(interpretarInvocador({ gameName: 'AKIRA88', tagLine: 'EUW', summonerLevel: 300, profileIconId: 29, puuid: YO })).toEqual({
      nombre: 'AKIRA88', tag: 'EUW', nivel: 300, icono: 29, puuid: YO,
    });
    expect(interpretarInvocador(null)).toBeNull();
    const r = interpretarRango({
      queueMap: {
        RANKED_SOLO_5x5: { tier: 'EMERALD', division: 'II', leaguePoints: 42, wins: 60, losses: 50 },
        RANKED_FLEX_SR: { tier: 'NONE', division: 'NA', leaguePoints: 0, wins: 0, losses: 0 },
      },
    });
    expect(r).toEqual([
      { cola: 'solo', tier: 'EMERALD', division: 'II', lp: 42, victorias: 60, derrotas: 50 },
      { cola: 'flex', tier: '', division: '', lp: 0, victorias: 0, derrotas: 0 },
    ]);
  });

  it('valor del rango y gráfica de PL sin repetir puntos iguales', () => {
    expect(valorRango({ tier: 'IRON', division: 'IV', lp: 0 })).toBe(0);
    expect(valorRango({ tier: 'EMERALD', division: 'II', lp: 42 })).toBe(5 * 400 + 200 + 42);
    expect(valorRango({ tier: 'MASTER', division: 'I', lp: 120 })).toBe(2800 + 120);
    expect(valorRango({ tier: '', division: '', lp: 0 })).toBeNull();
    const solo = { cola: 'solo' as const, tier: 'GOLD', division: 'I', lp: 10, victorias: 1, derrotas: 1 };
    let pl = anotarPl([], [solo], 'a');
    pl = anotarPl(pl, [solo], 'b');
    pl = anotarPl(pl, [{ ...solo, lp: 30 }], 'c');
    expect(pl.map((p) => [p.fecha, p.lp])).toEqual([['a', 10], ['c', 30]]);
  });

  it('lista de partidas de la más reciente a la más antigua', () => {
    expect(interpretarListaPartidas({ games: { games: [{ gameId: 1, gameCreation: 10 }, { gameId: 2, gameCreation: 20 }, { nada: 1 }] } })).toEqual([2, 1]);
    expect(interpretarListaPartidas({})).toEqual([]);
  });

  it('rol por Castigar y por línea', () => {
    expect(rolDe({ spell1Id: 11, spell2Id: 4 })).toBe('JUNGLE');
    expect(rolDe({ timeline: { lane: 'BOTTOM', role: 'DUO_SUPPORT' } })).toBe('UTILITY');
    expect(rolDe({ timeline: { lane: 'BOTTOM', role: 'DUO_CARRY' } })).toBe('BOTTOM');
    expect(rolDe({ timeline: { lane: 'NONE' } })).toBeNull();
  });

  it('la partida trae a los 10 con puntuaciones y etiquetas, y sabe quién es el jugador', () => {
    const p = partida(5, { yo: { kills: 12, deaths: 1, assists: 8, totalDamageDealtToChampions: 40000 } });
    expect(p.jugadores).toHaveLength(10);
    expect(p.yo).toBe(1);
    expect(p.modo).toBe('clasificatoria');
    expect(p.victoria).toBe(true);
    const yo = p.jugadores[0]!;
    expect(yo.nombre).toBe('AKIRA88');
    expect(yo.rol).toBe('MIDDLE');
    expect(yo.cs).toBe(180);
    expect(yo.objetos).toEqual([3089]);
    expect(yo.etiquetas).toEqual(expect.arrayContaining(['mvp', 'masDano', 'masAsesinatos']));
    for (const j of p.jugadores) for (const v of Object.values(j.puntuaciones)) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    // Sin el jugador, no hay partida (no se adivina quién es).
    expect(interpretarPartida(partidaLcu(5), 'otro')).toBeNull();
    expect(interpretarPartida(partidaLcu(6, { duracion: 200 }), YO)!.rehecha).toBe(true);
    expect(interpretarPartida(partidaLcu(7, { cola: 450 }), YO)!.jugadores[0]!.rol).toBeNull();
  });

  it('las etiquetas son solo positivas y únicas', () => {
    const p = partida(8);
    const todas = p.jugadores.flatMap((j) => j.etiquetas);
    for (const e of ['mvp', 'masDano', 'masOro', 'masVision', 'masAsesinatos', 'muroDefensivo', 'farmeador']) expect(todas.filter((x) => x === e).length).toBeLessThanOrEqual(1);
    expect(etiquetar(p.jugadores, 600, false).get(1)).not.toContain('sinMuertes');
  });

  it('puntuaciones: la referencia del rol vale 60; en ARAM sin visión', () => {
    const c = { asesinatosEquipo: 16, danoEquipo: 60000 };
    const medio = puntuar({ asesinatos: 3, muertes: 2, asistencias: 3, cs: 225, oro: 12300, dano: 15600, vision: 24 }, 'MIDDLE', 1800, c);
    expect(medio.farmeo).toBe(60);
    expect(medio.vision).toBe(60);
    const aram = puntuar({ asesinatos: 10, muertes: 5, asistencias: 20, cs: 70, oro: 12000, dano: 30000, vision: 0 }, null, 1200, c);
    expect(aram.vision).toBe(0);
    expect(aram.total).toBe(Math.round((aram.combate + aram.farmeo) / 2));
    expect(contextos([{ equipo: 100, asesinatos: 2, dano: 5 }, { equipo: 200, asesinatos: 1, dano: 3 }])).toEqual({
      100: { asesinatosEquipo: 2, danoEquipo: 5 },
      200: { asesinatosEquipo: 1, danoEquipo: 3 },
    });
  });

  it('línea de tiempo por minutos con asesinatos, monstruos y edificios', () => {
    const l = interpretarLineaTiempo(
      {
        frames: [
          { timestamp: 0, participantFrames: { '1': { participantId: 1, totalGold: 500, minionsKilled: 0, jungleMinionsKilled: 0, xp: 0, level: 1 } }, events: [] },
          {
            timestamp: 60000,
            participantFrames: { '1': { participantId: 1, totalGold: 900, minionsKilled: 6, jungleMinionsKilled: 1, xp: 300, level: 2 } },
            events: [
              { type: 'CHAMPION_KILL', timestamp: 65000, killerId: 1, victimId: 6 },
              { type: 'CHAMPION_KILL', timestamp: 66000, killerId: 0, victimId: 2 },
              { type: 'ELITE_MONSTER_KILL', timestamp: 70000, killerId: 3, killerTeamId: 100, monsterType: 'DRAGON' },
              { type: 'BUILDING_KILL', timestamp: 80000, killerId: 6, teamId: 100, buildingType: 'TOWER_BUILDING' },
              { type: 'WARD_PLACED', timestamp: 81000 },
            ],
          },
        ],
      },
      (pid) => (pid <= 5 ? 100 : 200),
    )!;
    expect(l.minutos.map((m) => [m.m, m.oro[1], m.cs[1]])).toEqual([[0, 500, 0], [1, 900, 7]]);
    expect(l.eventos.map((e) => [e.tipo, e.equipo])).toEqual([['asesinato', 100], ['asesinato', 200], ['dragon', 100], ['torre', 200]]);
    expect(interpretarLineaTiempo({}, () => 100)).toBeNull();
  });
});

describe('perfil: tendencias, campeones y retos', () => {
  const lista = (n: number, f: (i: number) => Parameters<typeof partidaLcu>[1]): PartidaHistorial[] =>
    Array.from({ length: n }, (_, i) => partida(100 - i, { creada: Date.UTC(2026, 9, 20) - i * 3_600_000, ...f(i) }));

  it('tendencias: media de las 10 últimas y cambio frente a las 10 anteriores', () => {
    const ps = lista(20, (i) => ({ yo: { deaths: i < 10 ? 2 : 6 } }));
    const muertes = tendencias(ps).find((t) => t.id === 'muertes')!;
    expect(muertes.valor).toBe(2);
    expect(muertes.cambio).toBe(-4);
    expect(muertes.mejorSiSube).toBe(false);
    expect(tendencias([])).toEqual([]);
  });

  it('campeones: del más jugado al menos, sin rehechas', () => {
    const ps = [...lista(3, () => ({})), partida(1, { duracion: 100 })];
    const c = campeonesDe(ps);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ campeonId: 238, partidas: 3, victorias: 3 });
  });

  it('reto: cuenta las partidas que lo cumplen desde que se eligió, con racha', () => {
    const ps = lista(6, (i) => ({ yo: { deaths: i === 2 ? 9 : 3 } }));
    const desde = ps.at(-1)!.fecha;
    const r = estadoReto('muertes4', desde, ps);
    expect(r).toMatchObject({ id: 'muertes4', objetivo: 5, hechas: 5, racha: 2, completado: true });
    expect(r.ultimas.slice(0, 3)).toEqual([true, true, false]);
    // Antes de elegirlo no cuenta nada.
    expect(estadoReto('muertes4', '2099-01-01', ps).hechas).toBe(0);
  });

  it('reto sugerido: el que menos cumple el jugador', () => {
    const ps = lista(6, () => ({ yo: { deaths: 9, kills: 10, assists: 10, totalMinionsKilled: 300, visionScore: 60, totalDamageDealtToChampions: 40000 } }));
    expect(retoSugerido(ps)).toBe('muertes4');
    expect(retoSugerido([])).toBe('muertes4');
  });
});

describe('perfil: servicio con la LCU', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  function lcuFalsa(ids: number[], pedidas: string[] = []): ClienteLcu {
    return {
      peticion: async (_m: string, ruta: string) => {
        pedidas.push(ruta);
        if (ruta === RUTAS_LCU.invocador) return { gameName: 'AKIRA88', tagLine: 'EUW', summonerLevel: 300, profileIconId: 29, puuid: YO };
        if (ruta === RUTAS_LCU.rango) return { queueMap: { RANKED_SOLO_5x5: { tier: 'GOLD', division: 'I', leaguePoints: 50, wins: 5, losses: 3 } } };
        if (ruta.startsWith('/lol-match-history/v1/products')) return { games: { games: ids.map((id) => ({ gameId: id, gameCreation: id })) } };
        const m = /games\/(\d+)$/.exec(ruta);
        if (m) return partidaLcu(Number(m[1]));
        if (ruta.includes('game-timelines')) return { frames: [{ timestamp: 60000, participantFrames: { '1': { participantId: 1, totalGold: 900 } }, events: [] }] };
        throw new Error('ruta');
      },
      suscribir: () => {},
      cerrar: () => {},
    } as unknown as ClienteLcu;
  }

  it('guarda el perfil, solo pide las partidas nuevas y lo conserva sin el cliente', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perfil-'));
    dirs.push(dir);
    const pedidas: string[] = [];
    let lcu: ClienteLcu | null = lcuFalsa([1, 2], pedidas);
    const s = crearServicioPerfil({ dir, lcu: () => lcu, campeones: async () => ({ version: '16.21.1', porId: { 238: { id: 'Zed', nombre: 'Zed' } } }) });
    await s.actualizar();
    let p = await s.perfil();
    expect(p.invocador?.nombre).toBe('AKIRA88');
    expect(p.partidas.map((x) => x.id)).toEqual([2, 1]);
    expect(p.pl).toHaveLength(1);
    expect(p.campeonesDD[238]?.id).toBe('Zed');
    lcu = lcuFalsa([3, 2, 1], pedidas);
    pedidas.length = 0;
    await s.actualizar();
    expect(pedidas.filter((r) => /games\/\d+$/.test(r))).toEqual(['/lol-match-history/v1/games/3']);
    // Otro proceso (o un reinicio) lee lo guardado sin el cliente.
    const s2 = crearServicioPerfil({ dir, lcu: () => null, campeones: async () => ({ version: '', porId: {} }) });
    p = await s2.perfil();
    expect(p.conectado).toBe(false);
    expect(p.partidas).toHaveLength(3);
    // Línea de tiempo: del cliente la primera vez y de la copia después.
    expect((await s.lineaTiempo(3))?.minutos[0]?.oro[1]).toBe(900);
    lcu = null;
    expect((await s.lineaTiempo(3))?.minutos).toHaveLength(1);
    expect(await s.lineaTiempo(999)).toBeNull();
  });

  it('elegir reto lo guarda y lo avisa', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perfil-'));
    dirs.push(dir);
    const avisos: unknown[] = [];
    const s = crearServicioPerfil({ dir, lcu: () => null, campeones: async () => ({ version: '', porId: {} }), alCambiar: (p) => avisos.push(p) });
    const p = await s.elegirReto('kp50');
    expect(p.reto?.id).toBe('kp50');
    expect(avisos).toHaveLength(1);
    expect((await s.elegirReto(null)).reto).toBeNull();
  });
});
