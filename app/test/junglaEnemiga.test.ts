import { describe, expect, it } from 'vitest';
import { AvisadorJunglaEnemiga, calleDeEstructura, HASTA_S, INTERVALO_AVISO_S, junglaEnemigo, rolDe, zonaDeRol } from '../src/main/consejos/junglaEnemiga';
import type { EstadoPartida, EventoPartida, JugadorCarga, JugadorPartida } from '../src/shared/tiposApp';

const jugador = (campeon: string, equipo: 'ORDER' | 'CHAOS', extra: Partial<JugadorPartida> = {}): JugadorPartida => ({
  campeon,
  equipo,
  posicion: null,
  castigo: false,
  ...extra,
});

/** Yo (Ahri, ORDER) contra un equipo con Lee Sin en la jungla. */
const JUGADORES: JugadorPartida[] = [
  jugador('Garen', 'ORDER'),
  jugador('Vi', 'ORDER', { castigo: true }),
  jugador('Ahri', 'ORDER'),
  jugador('Jinx', 'ORDER'),
  jugador('Thresh', 'ORDER'),
  jugador('Darius', 'CHAOS'),
  jugador('LeeSin', 'CHAOS', { castigo: true }),
  jugador('Zed', 'CHAOS'),
  jugador('Caitlyn', 'CHAOS'),
  jugador('Lux', 'CHAOS'),
];

const carga = (campeon: string, equipo: 'aliado' | 'enemigo', rol: JugadorCarga['rol']): JugadorCarga => ({
  equipo,
  riotId: `${campeon}#X`,
  campeonId: 1,
  campeon,
  nombre: campeon,
  rol,
  rango: null,
  maestria: null,
  campeonWinrate: null,
  etiquetas: [],
});

const CARGA: JugadorCarga[] = [
  carga('Garen', 'aliado', 'TOP'),
  carga('Vi', 'aliado', 'JUNGLE'),
  carga('Ahri', 'aliado', 'MIDDLE'),
  carga('Jinx', 'aliado', 'BOTTOM'),
  carga('Thresh', 'aliado', 'UTILITY'),
  carga('Darius', 'enemigo', 'TOP'),
  carga('LeeSin', 'enemigo', 'JUNGLE'),
  carga('Zed', 'enemigo', 'MIDDLE'),
  carga('Caitlyn', 'enemigo', 'BOTTOM'),
  carga('Lux', 'enemigo', 'UTILITY'),
];

const muerte = (id: number, tiempo: number, asesino: string, victima: string, asistentes: string[] = []): EventoPartida => ({
  nombre: 'ChampionKill',
  tiempo,
  id,
  asesino,
  victima,
  asistentes,
});

function estado(tiempo: number, eventos: EventoPartida[] = [], extra: Partial<EstadoPartida> = {}): EstadoPartida {
  return {
    tiempo,
    oro: 0,
    nivel: 1,
    campeon: 'Ahri',
    objetos: [],
    habilidades: { Q: 1, W: 0, E: 0, R: 0 },
    eventos,
    equipo: 'ORDER',
    modo: 'clasificatoria',
    jugadores: JUGADORES,
    ...extra,
  };
}

describe('quién es el jungla enemigo', () => {
  it('el enemigo con rol JUNGLE en la pantalla de carga', () => {
    expect(junglaEnemigo(estado(100), CARGA)).toBe('LeeSin');
  });

  it('sin pantalla de carga: el único enemigo con Castigo y, si no hay uno solo, la posición de la API', () => {
    expect(junglaEnemigo(estado(100), null)).toBe('LeeSin');
    const sinCastigo = JUGADORES.map((j) => ({ ...j, castigo: false, posicion: j.campeon === 'Zed' ? ('JUNGLE' as const) : null }));
    expect(junglaEnemigo(estado(100, [], { jugadores: sinCastigo }), null)).toBe('Zed');
  });

  it('si la pantalla de carga y el Castigo no coinciden, gana el único enemigo con Castigo', () => {
    const otra = CARGA.map((j) => (j.campeon === 'Zed' ? { ...j, rol: 'JUNGLE' as const } : j.campeon === 'LeeSin' ? { ...j, rol: 'MIDDLE' as const } : j));
    expect(junglaEnemigo(estado(100), otra)).toBe('LeeSin');
    const sinCastigo = JUGADORES.map((j) => ({ ...j, castigo: false }));
    expect(junglaEnemigo(estado(100, [], { jugadores: sinCastigo }), otra)).toBe('Zed');
  });

  it('los nombres de campeón se comparan sin distinguir mayúsculas', () => {
    const carga2 = CARGA.map((j) => ({ ...j, campeon: j.campeon.toLowerCase() }));
    const sinCastigo = JUGADORES.map((j) => ({ ...j, castigo: false }));
    expect(junglaEnemigo(estado(100, [], { jugadores: sinCastigo }), carga2)?.toLowerCase()).toBe('leesin');
    expect(rolDe('JINX', estado(100), carga2)).toBe('BOTTOM');
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(10), carga2);
    expect(a.procesar(estado(181, [muerte(1, 180, 'LEESIN', 'jinx')]), carga2)?.zona).toBe('bot');
  });

  it('sin saber mi equipo, o con dos enemigos con Castigo y sin roles, no se adivina', () => {
    expect(junglaEnemigo(estado(100, [], { equipo: undefined }), null)).toBeNull();
    const dos = JUGADORES.map((j) => (j.campeon === 'Darius' ? { ...j, castigo: true } : j));
    expect(junglaEnemigo(estado(100, [], { jugadores: dos }), null)).toBeNull();
  });
});

describe('rol y zona de la víctima', () => {
  it('el rol sale de la pantalla de carga o de la posición de la API', () => {
    expect(rolDe('Jinx', estado(100), CARGA)).toBe('BOTTOM');
    const conPosicion = JUGADORES.map((j) => (j.campeon === 'Garen' ? { ...j, posicion: 'TOP' as const } : j));
    expect(rolDe('Garen', estado(100, [], { jugadores: conPosicion }), null)).toBe('TOP');
    expect(rolDe('Garen', estado(100), null)).toBeNull();
  });

  it('top, mid y bot (tirador y apoyo) y la jungla', () => {
    expect(zonaDeRol('TOP')).toBe('top');
    expect(zonaDeRol('MIDDLE')).toBe('mid');
    expect(zonaDeRol('BOTTOM')).toBe('bot');
    expect(zonaDeRol('UTILITY')).toBe('bot');
    expect(zonaDeRol('JUNGLE')).toBe('jungla');
  });
});

describe('AvisadorJunglaEnemiga', () => {
  it('el jungla enemigo mata o asiste: avisa de la zona de la víctima, siempre por la kill', () => {
    const a = new AvisadorJunglaEnemiga();
    expect(a.procesar(estado(100), CARGA)).toBeNull();
    const r = a.procesar(estado(181, [muerte(1, 180, 'LeeSin', 'Jinx')]), CARGA);
    expect(r).toEqual({ clave: 'junglaEnemiga:1', zona: 'bot', texto: 'El jungla enemigo acaba de aparecer en bot (kill)' });
    const asistencia = a.procesar(estado(260, [muerte(1, 180, 'LeeSin', 'Jinx'), muerte(2, 259, 'Darius', 'Garen', ['LeeSin'])]), CARGA);
    expect(asistencia?.texto).toBe('El jungla enemigo acaba de aparecer en top (kill)');
    expect(asistencia?.texto).not.toMatch(/está en/);
  });

  it('cada kill se avisa una sola vez', () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(10), CARGA);
    const eventos = [muerte(1, 180, 'LeeSin', 'Ahri')];
    expect(a.procesar(estado(181, eventos), CARGA)?.zona).toBe('mid');
    expect(a.procesar(estado(182, eventos), CARGA)).toBeNull();
  });

  it(`como mucho un aviso cada ${INTERVALO_AVISO_S} s de partida`, () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(10), CARGA);
    const e1 = [muerte(1, 180, 'LeeSin', 'Jinx')];
    expect(a.procesar(estado(181, e1), CARGA)).not.toBeNull();
    const e2 = [...e1, muerte(2, 190, 'LeeSin', 'Thresh')];
    expect(a.procesar(estado(191, e2), CARGA)).toBeNull();
    const e3 = [...e2, muerte(3, 205, 'LeeSin', 'Garen')];
    expect(a.procesar(estado(206, e3), CARGA)?.zona).toBe('top');
  });

  it('no avisa de kills de otros, de víctimas sin rol conocido ni de las que ya había al empezar (reconexión)', () => {
    const a = new AvisadorJunglaEnemiga();
    expect(a.procesar(estado(600, [muerte(1, 590, 'LeeSin', 'Jinx')]), CARGA)).toBeNull();
    expect(a.procesar(estado(700, [muerte(1, 590, 'LeeSin', 'Jinx'), muerte(2, 699, 'Zed', 'Ahri')]), CARGA)).toBeNull();
    const sinRol = new AvisadorJunglaEnemiga();
    sinRol.procesar(estado(10), null);
    expect(sinRol.procesar(estado(200, [muerte(1, 199, 'LeeSin', 'Jinx')]), null)).toBeNull();
  });

  it('una kill que llega tarde (más de 10 s) ya no se avisa', () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(10), CARGA);
    expect(a.procesar(estado(200, [muerte(1, 180, 'LeeSin', 'Jinx')]), CARGA)).toBeNull();
  });

  it(`solo antes del minuto 14 (después el rol de la víctima ya no dice la zona)`, () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(800), CARGA);
    expect(a.procesar(estado(841, [muerte(1, 840, 'LeeSin', 'Jinx')]), CARGA)).toBeNull();
    const b = new AvisadorJunglaEnemiga();
    b.procesar(estado(800), CARGA);
    expect(b.procesar(estado(840, [muerte(1, 839, 'LeeSin', 'Jinx')]), CARGA)).not.toBeNull();
    expect(HASTA_S).toBe(14 * 60);
  });

  it('fuera de la Grieta no hay avisos del jungla enemigo', () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(10, [], { modo: 'aram' }), CARGA);
    expect(a.procesar(estado(181, [muerte(1, 180, 'LeeSin', 'Jinx')], { modo: 'aram' }), CARGA)).toBeNull();
  });

  it('reiniciar() empieza una partida nueva', () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesar(estado(10), CARGA);
    expect(a.procesar(estado(181, [muerte(1, 180, 'LeeSin', 'Jinx')]), CARGA)).not.toBeNull();
    a.reiniciar();
    a.procesar(estado(5), CARGA);
    expect(a.procesar(estado(181, [muerte(1, 180, 'LeeSin', 'Jinx')]), CARGA)).not.toBeNull();
  });
});

describe('texto de la ruta estimada (Track F2)', () => {
  it('siempre «Estimación» y «suele», nunca «está en»', async () => {
    const { textoRutaJungla, validarRutaJungla } = await import('../src/main/consejos/junglaEnemiga');
    expect(textoRutaJungla('Lee Sin', { inicio: 'azul', primerGank: { calle: 'top', minuto: 3.5 }, partidas: 40 })).toBe(
      'Estimación: Lee Sin suele empezar por azul y gankear top hacia el minuto 3,5',
    );
    expect(textoRutaJungla('Vi', { inicio: 'rojo', primerGank: null, partidas: 40 })).toBe('Estimación: Vi suele empezar por rojo');
    expect(textoRutaJungla('Vi', { inicio: null, primerGank: { calle: 'mid', minuto: 3 }, partidas: 40 })).toBe('Estimación: Vi suele gankear mid hacia el minuto 3');
    expect(textoRutaJungla('Vi', { inicio: null, primerGank: null, partidas: 40 })).toBeNull();
    expect(validarRutaJungla({ inicio: 'rojo', primerGank: null, partidas: 30 })).toEqual({ inicio: 'rojo', primerGank: null, partidas: 30 });
    expect(validarRutaJungla({ inicio: 'verde', primerGank: null, partidas: 30 })).toBeNull();
    expect(validarRutaJungla({ inicio: null, primerGank: { calle: 'top', minuto: 9 }, partidas: 30 })).toBeNull();
  });
});

describe('3.0.2: más avisos del jungla enemigo, solo con eventos oficiales de la Live Client Data API', () => {
  const evento = (nombre: string, id: number, tiempo: number, asesino: string | undefined, asistentes: string[] = [], extra: Partial<EventoPartida> = {}): EventoPartida => ({
    nombre,
    id,
    tiempo,
    ...(asesino && { asesino }),
    asistentes,
    ...extra,
  });
  /** Avisador ya arrancado (el primer estado nunca avisa: lo que ya había pasado no se dice). */
  const arrancado = (t0 = 10) => {
    const a = new AvisadorJunglaEnemiga();
    a.procesarTodos(estado(t0), CARGA);
    return a;
  };
  const textos = (a: AvisadorJunglaEnemiga, tiempo: number, eventos: EventoPartida[]) => a.procesarTodos(estado(tiempo, eventos), CARGA).map((x) => x.texto);

  it('si el que muere es el jungla enemigo, la zona es la del que lo mata', () => {
    const a = arrancado();
    expect(textos(a, 181, [muerte(1, 180, 'Garen', 'LeeSin')])).toEqual(['El jungla enemigo acaba de aparecer en top (kill)']);
    const b = arrancado();
    expect(textos(b, 181, [muerte(1, 180, 'Ahri', 'LeeSin', ['Vi'])])).toEqual(['El jungla enemigo acaba de aparecer en mid (kill)']);
  });

  it('dragón (y ancestral), larvas, Heraldo, Barón y Atakhan: como autor o como asistente', () => {
    const a = arrancado();
    expect(textos(a, 301, [evento('DragonKill', 1, 300, 'LeeSin', [], { dragon: 'Fire' })])).toEqual(['El jungla enemigo acaba de hacer el dragón']);
    expect(textos(a, 401, [evento('HordeKill', 2, 400, 'Zed', ['LeeSin'])])).toEqual(['El jungla enemigo acaba de hacer las larvas']);
    expect(textos(a, 501, [evento('HeraldKill', 3, 500, 'LeeSin')])).toEqual(['El jungla enemigo acaba de hacer el Heraldo']);
    expect(textos(a, 1501, [evento('BaronKill', 4, 1500, 'Darius', ['LeeSin', 'Zed'])])).toEqual(['El jungla enemigo acaba de hacer el Barón']);
    expect(textos(a, 1801, [evento('DragonKill', 5, 1800, 'LeeSin', [], { dragon: 'Elder' })])).toEqual(['El jungla enemigo acaba de hacer el dragón ancestral']);
    expect(textos(a, 1301, [evento('AtakhanKill', 6, 1300, 'LeeSin')])).toEqual(['El jungla enemigo acaba de hacer Atakhan']);
  });

  it('torres e inhibidores: la calle sale del nombre de la estructura', () => {
    expect(calleDeEstructura('Turret_T1_L_03_A')).toBe('top');
    expect(calleDeEstructura('Turret_T2_C_05_A')).toBe('mid');
    expect(calleDeEstructura('Turret_T1_R_02_A')).toBe('bot');
    expect(calleDeEstructura('Turret_T1_C_01_A')).toBe('nexo');
    expect(calleDeEstructura('Barracks_T1_L1')).toBe('top');
    expect(calleDeEstructura('Barracks_T2_R1')).toBe('bot');
    expect(calleDeEstructura('Algo_Raro')).toBeNull();
    const a = arrancado();
    expect(textos(a, 601, [evento('TurretKilled', 1, 600, 'LeeSin', [], { estructura: 'Turret_T1_L_03_A' })])).toEqual(['El jungla enemigo acaba de tirar la torre de top']);
    expect(textos(a, 701, [evento('TurretKilled', 2, 700, undefined, ['Zed', 'LeeSin'], { estructura: 'Turret_T1_C_04_A' })])).toEqual(['El jungla enemigo acaba de tirar la torre de mid']);
    expect(textos(a, 1601, [evento('InhibKilled', 3, 1600, undefined, ['LeeSin'], { estructura: 'Barracks_T1_R1' })])).toEqual(['El jungla enemigo acaba de tirar el inhibidor de bot']);
    expect(textos(a, 1701, [evento('TurretKilled', 4, 1700, 'LeeSin', [], { estructura: 'Turret_T1_C_02_A' })])).toEqual(['El jungla enemigo acaba de tirar una torre del nexo']);
    // Una estructura sin nombre reconocible no se avisa.
    expect(textos(a, 1711, [evento('TurretKilled', 5, 1710, 'LeeSin', [], { estructura: 'Rara' })])).toEqual([]);
  });

  it('objetivos y estructuras se avisan toda la partida (después del 14:00) y sin el intervalo de las kills', () => {
    const a = arrancado(1000);
    const eventos = [
      muerte(1, 1199, 'LeeSin', 'Jinx'),
      evento('DragonKill', 2, 1200, 'LeeSin', [], { dragon: 'Earth' }),
      evento('TurretKilled', 3, 1201, 'LeeSin', [], { estructura: 'Turret_T1_R_03_A' }),
    ];
    // La kill es después del 14:00: no hay aviso de zona; el dragón y la torre sí, aunque vayan seguidos.
    expect(textos(a, 1202, eventos)).toEqual(['El jungla enemigo acaba de hacer el dragón', 'El jungla enemigo acaba de tirar la torre de bot']);
    // Y el intervalo de las kills sigue siendo solo para las kills.
    const b = arrancado();
    expect(textos(b, 181, [muerte(1, 180, 'LeeSin', 'Jinx'), evento('HordeKill', 2, 180.5, 'LeeSin')])).toEqual([
      'El jungla enemigo acaba de aparecer en bot (kill)',
      'El jungla enemigo acaba de hacer las larvas',
    ]);
    expect(textos(b, 190, [muerte(1, 180, 'LeeSin', 'Jinx'), evento('HordeKill', 2, 180.5, 'LeeSin'), muerte(3, 189, 'LeeSin', 'Garen')])).toEqual([]);
  });

  it('cada evento se avisa una sola vez (por EventID), aunque vuelva en cada estado', () => {
    const a = arrancado();
    const eventos = [evento('DragonKill', 7, 300, 'LeeSin', [], { dragon: 'Fire' }), evento('TurretKilled', 8, 302, undefined, ['LeeSin'], { estructura: 'Turret_T1_R_03_A' })];
    expect(textos(a, 303, eventos)).toHaveLength(2);
    expect(textos(a, 304, eventos)).toEqual([]);
    expect(textos(a, 305, [...eventos, evento('DragonKill', 9, 304, 'LeeSin', [], { dragon: 'Fire' })])).toEqual(['El jungla enemigo acaba de hacer el dragón']);
  });

  it('no avisa de objetivos de otros, de tipos de evento desconocidos, de los que llegan tarde ni de los que ya había', () => {
    const a = new AvisadorJunglaEnemiga();
    expect(a.procesarTodos(estado(600, [evento('BaronKill', 1, 590, 'LeeSin')]), CARGA)).toEqual([]);
    expect(textos(a, 700, [evento('DragonKill', 2, 699, 'Zed', ['Darius'], { dragon: 'Fire' })])).toEqual([]);
    expect(textos(a, 701, [evento('EventoNuevoDeRiot', 3, 700, 'LeeSin')])).toEqual([]);
    expect(textos(a, 701, [evento('Multikill', 4, 700, 'LeeSin'), evento('FirstBlood', 5, 700, 'LeeSin')])).toEqual([]);
    expect(textos(a, 800, [evento('HeraldKill', 6, 780, 'LeeSin')])).toEqual([]);
  });

  it('fuera de la Grieta tampoco hay avisos de objetivos', () => {
    const a = new AvisadorJunglaEnemiga();
    a.procesarTodos(estado(10, [], { modo: 'aram' }), CARGA);
    expect(a.procesarTodos(estado(301, [evento('DragonKill', 1, 300, 'LeeSin')], { modo: 'aram' }), CARGA)).toEqual([]);
  });

  it('procesar() sigue dando el último aviso del estado (o null)', () => {
    const a = arrancado();
    expect(a.procesar(estado(301, [evento('HeraldKill', 1, 300, 'LeeSin')]), CARGA)?.texto).toBe('El jungla enemigo acaba de hacer el Heraldo');
    expect(a.procesar(estado(302, [evento('HeraldKill', 1, 300, 'LeeSin')]), CARGA)).toBeNull();
  });
});
