import { describe, expect, it } from 'vitest';
import { AvisadorJunglaEnemiga, HASTA_S, INTERVALO_AVISO_S, junglaEnemigo, rolDe, zonaDeRol } from '../src/main/consejos/junglaEnemiga';
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
