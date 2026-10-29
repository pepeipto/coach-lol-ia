import { describe, expect, it } from 'vitest';
import { colaDeSesion, esJugadorOculto, interpretarSesionPartida, regionDeLcu } from '../src/main/lcu/sesionPartida';

const jugador = (puuid: string, championId: number, selectedPosition: string, extra: Record<string, unknown> = {}) => ({
  puuid,
  championId,
  selectedPosition,
  ...extra,
});

const sesion = (o: Record<string, unknown> = {}) => ({
  map: { id: 11 },
  gameData: {
    teamOne: [
      jugador('a1', 103, 'MIDDLE', { gameName: 'Ana', tagLine: 'EUW' }),
      jugador('a2', 64, 'JUNGLE', { riotIdGameName: 'Beto', riotIdTagLine: '1234' }),
      jugador('a3', 86, 'TOP', { summonerName: 'Carla' }),
      jugador('a4', 222, 'BOTTOM'),
      jugador('a5', 412, 'UTILITY'),
    ],
    teamTwo: [
      jugador('e1', 62, 'top'),
      jugador('e2', 11, 'NONE'),
      jugador('e3', 7, ''),
      jugador('e4', 51, 'BOTTOM'),
      jugador('e5', 0, 'UTILITY'),
    ],
    ...o,
  },
});

describe('interpretarSesionPartida: jungla por Castigo (sin selectedPosition)', () => {
  it('el único jugador sin posición con Castigo es el JUNGLE de su equipo (hechizos del jugador o de playerChampionSelections)', () => {
    const r = interpretarSesionPartida(sesion({ playerChampionSelections: [{ championId: 7, spell1Id: 4, spell2Id: 11 }] }), 'a1')!;
    expect(r.find((j) => j.campeonId === 7)?.rol).toBe('JUNGLE');
    const directo = sesion();
    (directo.gameData.teamTwo[2] as Record<string, unknown>).spell1Id = 11;
    expect(interpretarSesionPartida(directo, 'a1')!.find((j) => j.campeonId === 7)?.rol).toBe('JUNGLE');
  });

  it('no cambia nada si el equipo ya tiene JUNGLE o si hay dos con Castigo sin posición', () => {
    const conJungla = sesion({ playerChampionSelections: [{ championId: 103, spell1Id: 11, spell2Id: 4 }] });
    expect(interpretarSesionPartida(conJungla, 'a1')!.find((j) => j.campeonId === 103)?.rol).toBe('MIDDLE');
    const dos = sesion({
      playerChampionSelections: [
        { championId: 7, spell1Id: 11, spell2Id: 4 },
        { championId: 11, spell1Id: 11, spell2Id: 4 },
      ],
    });
    const r = interpretarSesionPartida(dos, 'a1')!;
    expect(r.filter((j) => j.equipo === 'enemigo' && j.rol === 'JUNGLE')).toHaveLength(0);
  });
});

describe('interpretarSesionPartida', () => {
  it('reparte aliados y enemigos según el equipo del jugador local', () => {
    const r = interpretarSesionPartida(sesion(), 'a2');
    expect(r).not.toBeNull();
    expect(r!.filter((j) => j.equipo === 'aliado').map((j) => j.puuid)).toEqual(['a3', 'a2', 'a1', 'a4', 'a5']);
    // Sin campeón (0) se descarta; los roles desconocidos van al final.
    expect(r!.filter((j) => j.equipo === 'enemigo').map((j) => j.puuid)).toEqual(['e1', 'e4', 'e2', 'e3']);
  });

  it('el jugador local en teamTwo convierte teamTwo en aliado', () => {
    const r = interpretarSesionPartida(sesion(), 'e4')!;
    expect(r.find((j) => j.puuid === 'e4')!.equipo).toBe('aliado');
    expect(r.find((j) => j.puuid === 'a1')!.equipo).toBe('enemigo');
  });

  it('sin puuid local, teamOne es el aliado', () => {
    expect(interpretarSesionPartida(sesion(), null)!.find((j) => j.puuid === 'a1')!.equipo).toBe('aliado');
  });

  it('normaliza el rol y el Riot ID', () => {
    const r = interpretarSesionPartida(sesion(), 'a1')!;
    const por = (p: string) => r.find((j) => j.puuid === p)!;
    expect(por('a1')).toEqual({ puuid: 'a1', campeonId: 103, rol: 'MIDDLE', equipo: 'aliado', riotId: 'Ana#EUW', propio: true });
    // 3.1: solo el jugador local lleva la marca `propio`.
    expect(r.filter((j) => j.propio).map((j) => j.puuid)).toEqual(['a1']);
    expect('propio' in por('a2')).toBe(false);
    expect(por('a2').riotId).toBe('Beto#1234');
    expect(por('a3').riotId).toBe('Carla');
    expect(por('a4').riotId).toBe('');
    expect(por('e1').rol).toBe('TOP');
    expect(por('e2').rol).toBeNull();
  });

  it('3.1: sin el puuid propio nadie lleva la marca `propio`', () => {
    expect(interpretarSesionPartida(sesion(), null)!.some((j) => j.propio)).toBe(false);
  });

  it('3.1: la cola sale de gameData.queue.id (las personalizadas son la 0)', () => {
    expect(colaDeSesion({ gameData: { queue: { id: 420 } } })).toBe(420);
    expect(colaDeSesion({ gameData: { queue: { id: 440 }, isCustomGame: false } })).toBe(440);
    expect(colaDeSesion({ gameData: { queue: { id: -1 }, isCustomGame: true } })).toBe(0);
    expect(colaDeSesion({ gameData: { queue: { id: -1 } } })).toBeNull();
    expect(colaDeSesion({ gameData: {} })).toBeNull();
    expect(colaDeSesion(null)).toBeNull();
    expect(colaDeSesion({ gameData: { queue: { id: '420' } } })).toBeNull();
  });

  it('como espectador (el jugador local no está en ningún equipo) no hay pantalla de carga', () => {
    expect(interpretarSesionPartida(sesion(), 'otro')).toBeNull();
  });

  it('fuera de la Grieta del Invocador o sin datos → null', () => {
    expect(interpretarSesionPartida({ ...sesion(), map: { id: 12 } }, 'a1')).toBeNull();
    expect(interpretarSesionPartida({ gameData: { teamOne: [], teamTwo: [] } }, null)).toBeNull();
    expect(interpretarSesionPartida(null, null)).toBeNull();
    expect(interpretarSesionPartida('x', null)).toBeNull();
  });

  it('acepta el mapa en gameData.queue.mapId', () => {
    const s = sesion({ queue: { mapId: 11 } }) as Record<string, unknown>;
    delete s.map;
    expect(interpretarSesionPartida(s, 'a1')).not.toBeNull();
  });

  it('nunca pasa de 10 jugadores', () => {
    const muchos = Array.from({ length: 8 }, (_, i) => jugador(`x${i}`, 1 + i, 'TOP'));
    const r = interpretarSesionPartida(sesion({ teamOne: muchos, teamTwo: muchos.map((j) => ({ ...j, puuid: `y${j.puuid}` })) }), null)!;
    expect(r).toHaveLength(10);
  });
});

describe('3.2: jugadores anonimizados u ocultos (política de Riot: nunca se identifican)', () => {
  it('esJugadorOculto: nameVisibilityType HIDDEN, PUUID ofuscado sin PUUID, banderas de oculto o sin PUUID', () => {
    expect(esJugadorOculto({ puuid: 'p1', nameVisibilityType: 'VISIBLE' })).toBe(false);
    expect(esJugadorOculto({ puuid: 'p1' })).toBe(false);
    expect(esJugadorOculto({ puuid: 'p1', nameVisibilityType: 'HIDDEN' })).toBe(true);
    expect(esJugadorOculto({ puuid: '', obfuscatedPuuid: 'xyz', obfuscatedSummonerId: 123, summonerId: 0 })).toBe(true);
    expect(esJugadorOculto({ puuid: 'p1', isHidden: true })).toBe(true);
    expect(esJugadorOculto({ puuid: 'p1', streamerMode: true })).toBe(true);
    expect(esJugadorOculto({ puuid: '' })).toBe(true);
    expect(esJugadorOculto({})).toBe(true);
  });

  it('a un jugador oculto no se le guarda ni el PUUID ni el nombre, y lleva la marca `anonimo`', () => {
    const s = sesion({
      teamTwo: [
        jugador('e1', 62, 'TOP', { gameName: 'Rival', tagLine: '1', nameVisibilityType: 'HIDDEN' }),
        jugador('', 11, 'JUNGLE', { obfuscatedPuuid: 'ofuscado', summonerName: 'Oculto' }),
        jugador('e3', 7, 'MIDDLE', { gameName: 'Visible', tagLine: 'EUW', nameVisibilityType: 'VISIBLE' }),
      ],
    });
    const r = interpretarSesionPartida(s, 'a1')!;
    const enemigos = r.filter((j) => j.equipo === 'enemigo');
    expect(enemigos.find((j) => j.campeonId === 62)).toEqual({ puuid: '', campeonId: 62, rol: 'TOP', equipo: 'enemigo', riotId: '', anonimo: true });
    expect(enemigos.find((j) => j.campeonId === 11)).toMatchObject({ puuid: '', riotId: '', anonimo: true });
    expect(enemigos.find((j) => j.campeonId === 7)).toMatchObject({ puuid: 'e3', riotId: 'Visible#EUW' });
    expect('anonimo' in enemigos.find((j) => j.campeonId === 7)!).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/Rival|Oculto|ofuscado/);
  });

  it('el jugador local nunca se marca como oculto para sí mismo', () => {
    const s = sesion({ teamOne: [jugador('a1', 103, 'MIDDLE', { gameName: 'Ana', tagLine: 'EUW', nameVisibilityType: 'HIDDEN' })] });
    expect(interpretarSesionPartida(s, 'a1')!.find((j) => j.propio)).toMatchObject({ puuid: 'a1', riotId: 'Ana#EUW' });
  });
});

describe('regionDeLcu', () => {
  it.each([
    ['EUW', 'EUW'],
    ['euw1', 'EUW'],
    ['LA1', 'LAN'],
    ['LAN', 'LAN'],
    ['LA2', 'LAS'],
    ['las', 'LAS'],
    ['BR', 'BR'],
    ['br1', 'BR'],
    ['NA', 'NA'],
    ['NA1', 'NA'],
  ])('%s → %s', (entrada, salida) => {
    expect(regionDeLcu({ region: entrada, locale: 'es_ES' })).toBe(salida);
  });

  it.each([['KR'], ['EUNE'], ['OC1'], ['']])('%s → null (sin consultar el servidor)', (entrada) => {
    expect(regionDeLcu({ region: entrada })).toBeNull();
  });

  it('respuesta inesperada → null', () => {
    expect(regionDeLcu(null)).toBeNull();
    expect(regionDeLcu({})).toBeNull();
  });
});

describe('interpretarSesionPartida: skins', () => {
  it('toma selectedSkinIndex del jugador o de playerChampionSelections (por puuid o campeón); la clásica no se pone', () => {
    const s = sesion({
      playerChampionSelections: [
        { puuid: 'a1', championId: 103, selectedSkinIndex: 27 },
        { championId: 62, selectedSkinIndex: 4 },
        { championId: 64, selectedSkinIndex: 0 },
      ],
    });
    (s.gameData.teamOne[3] as Record<string, unknown>).selectedSkinIndex = 9;
    const r = interpretarSesionPartida(s, 'a1')!;
    const skin = (id: number) => r.find((j) => j.campeonId === id)?.skin;
    expect(skin(103)).toBe(27);
    expect(skin(62)).toBe(4);
    expect(skin(222)).toBe(9);
    expect(skin(64)).toBeUndefined();
    expect(skin(86)).toBeUndefined();
  });

  it('descarta valores que no son un número de skin', () => {
    const s = sesion({ playerChampionSelections: [{ championId: 103, selectedSkinIndex: '5' }, { championId: 64, selectedSkinIndex: 1.5 }] });
    const r = interpretarSesionPartida(s, 'a1')!;
    expect(r.every((j) => j.skin === undefined)).toBe(true);
  });
});

describe('interpretarSesionPartida: hechizos', () => {
  it('toma los hechizos del jugador o de playerChampionSelections; sin los dos, no los pone', () => {
    const s = sesion({ playerChampionSelections: [{ puuid: 'a1', championId: 103, spell1Id: 4, spell2Id: 14 }, { championId: 62, spell1Id: 4 }] });
    Object.assign(s.gameData.teamOne[1] as Record<string, unknown>, { spell1Id: 11, spell2Id: 4 });
    const r = interpretarSesionPartida(s, 'a1')!;
    const de = (id: number) => r.find((j) => j.campeonId === id)?.hechizos;
    expect(de(103)).toEqual([4, 14]);
    expect(de(64)).toEqual([11, 4]);
    expect(de(62)).toBeUndefined();
    expect(de(86)).toBeUndefined();
  });
});
