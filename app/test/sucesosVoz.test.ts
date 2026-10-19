import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { resumenOverlay } from '../src/main/consejos/motor';
import { equipoDeEstructura } from '../src/main/consejos/sucesos';
import { SelectorFijo, textosVariantes } from '../src/main/consejos/variantes';
import { DisparadorVoz, type EntradaVoz } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { t } from '../src/shared/i18n';
import type { AjustesVoz, EstadoPartida, EventoPartida, JugadorCarga, JugadorPartida, TipoVoz } from '../src/shared/tiposApp';
import { tiposDeNivel } from '../src/shared/vozCategorias';

/*
 * 3.1: disparadores de cada categoría de la voz (detector de sucesos). Todo con eventos oficiales y datos del
 * marcador; las frases se comparan con su primera variante (SelectorFijo) o con el conjunto de sus variantes.
 */

const objetos = {
  3108: { name: 'Códice demoníaco', gold: { total: 1250, purchasable: true }, from: [], into: ['3089'] },
  3089: { name: 'Sombrero mortal de Rabadon', gold: { total: 3600, purchasable: true }, from: ['3108'], into: [] },
  3020: { name: 'Botas del hechicero', gold: { total: 1100, purchasable: true }, tags: ['Boots'], into: [] },
  3340: { name: 'Tótem vigilante', gold: { total: 0, purchasable: true }, tags: ['Trinket'], into: [] },
  2055: { name: 'Guardián de control', gold: { total: 75, purchasable: true }, consumed: true },
  1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true }, into: [] },
} as unknown as DatosEstaticos['objetos'];
const build = { nucleo: [3089], botas: 3020, situacionales: [], ordenHabilidades: ['Q', 'E', 'W'] } as unknown as Build;
const COMPLETA: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, tipos: tiposDeNivel('completo') };
const solo = (...tipos: TipoVoz[]): AjustesVoz => ({ ...COMPLETA, tipos: Object.fromEntries(Object.keys(COMPLETA.tipos).map((k) => [k, tipos.includes(k as TipoVoz)])) as AjustesVoz['tipos'] });

const JUGADORES: JugadorPartida[] = [
  { campeon: 'Ahri', nombre: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false, nivel: 1, asesinatos: 0 },
  { campeon: 'Jinx', nombre: 'Jinx', equipo: 'ORDER', posicion: null, castigo: false, nivel: 1, asesinatos: 0 },
  { campeon: 'Zed', nombre: 'Zed', equipo: 'CHAOS', posicion: null, castigo: false, nivel: 1, asesinatos: 0 },
  { campeon: 'LeeSin', nombre: 'Lee Sin', equipo: 'CHAOS', posicion: null, castigo: true, nivel: 1, asesinatos: 0 },
];
const CARGA = [
  { equipo: 'aliado', campeon: 'Ahri', rol: 'MIDDLE' },
  { equipo: 'aliado', campeon: 'Jinx', rol: 'BOTTOM' },
  { equipo: 'enemigo', campeon: 'Zed', rol: 'MIDDLE' },
  { equipo: 'enemigo', campeon: 'LeeSin', rol: 'JUNGLE' },
] as unknown as JugadorCarga[];

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return {
    tiempo: 20, oro: 0, nivel: 1, campeon: 'Ahri', objetos: [1056, 3340], habilidades: { Q: 1, W: 0, E: 0, R: 0 }, eventos: [],
    equipo: 'ORDER', modo: 'clasificatoria', jugadores: JUGADORES, muerto: false, ...p,
  };
}

let siguienteId = 100;
const kill = (tiempo: number, asesino: string | undefined, victima: string, asistentes: string[] = []): EventoPartida => ({
  nombre: 'ChampionKill', tiempo, id: siguienteId++, ...(asesino && { asesino }), victima, asistentes,
});
const ev = (nombre: string, tiempo: number, extra: Partial<EventoPartida> = {}): EventoPartida => ({ nombre, tiempo, id: siguienteId++, ...extra });

/** Pasa estados por un disparador; devuelve lo dicho en cada uno. El primer estado (t=20) solo arranca. */
function correr(estados: EstadoPartida[], o: { voz?: AjustesVoz; yaAvisados?: Set<string>; d?: DisparadorVoz } = {}) {
  const d = o.d ?? new DisparadorVoz({ selector: new SelectorFijo() });
  return estados.map((e) => {
    const entrada: EntradaVoz = {
      estado: e, overlay: resumenOverlay(e, build, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false,
      objetos, build, carga: CARGA, yaAvisados: o.yaAvisados,
    };
    return d.procesar(entrada, o.voz ?? COMPLETA).map((f) => f.texto);
  });
}
const plano = (r: string[][]) => r.flat();
const primera = (base: string, params?: Record<string, string | number>) => textosVariantes(base, params)[0]!;

describe('combate (eventos oficiales)', () => {
  it('tu asesinato, tu asistencia y tu muerte', () => {
    const k1 = kill(200, 'Ahri', 'Zed');
    const a1 = kill(260, 'Jinx', 'Zed', ['Ahri']);
    const m1 = kill(320, 'Zed', 'Ahri');
    const r = correr([estado(), estado({ tiempo: 201, eventos: [k1] }), estado({ tiempo: 261, eventos: [k1, a1] }), estado({ tiempo: 321, eventos: [k1, a1, m1] })], { voz: solo('combate') });
    expect(r).toEqual([[], [primera('voz.combate.asesinato')], [primera('voz.combate.asistencia')], [primera('voz.combate.muerte')]]);
  });

  it('un multikill dice solo el multikill (no «buen asesinato» además); el pentakill tiene el suyo', () => {
    const k = [kill(400, 'Ahri', 'Zed'), kill(401, 'Ahri', 'LeeSin')];
    const multi = ev('Multikill', 401, { asesino: 'Ahri', racha: 2 });
    const r = plano(correr([estado(), estado({ tiempo: 402, eventos: [...k, multi] })], { voz: solo('combate') }));
    expect(r).toEqual([primera('voz.combate.multi.2')]);
    const penta = ev('Multikill', 500, { asesino: 'Ahri', racha: 5 });
    expect(plano(correr([estado(), estado({ tiempo: 501, eventos: [penta] })], { voz: solo('combate') }))).toEqual([primera('voz.combate.multi.5')]);
  });

  it('primera sangre (tuya, de tu equipo o del rival) y as a favor o en contra', () => {
    const fbYo = [kill(150, 'Ahri', 'Zed'), ev('FirstBlood', 150, { asesino: 'Ahri' })];
    expect(plano(correr([estado(), estado({ tiempo: 151, eventos: fbYo })], { voz: solo('combate') }))).toEqual([primera('voz.combate.primeraSangre.yo')]);
    const fbRival = [kill(150, 'Zed', 'Jinx'), ev('FirstBlood', 150, { asesino: 'Zed' })];
    expect(plano(correr([estado(), estado({ tiempo: 151, eventos: fbRival })], { voz: solo('combate') }))).toEqual([primera('voz.combate.primeraSangre.rival')]);
    const ace = [ev('Ace', 900, { equipo: 'ORDER' })];
    expect(plano(correr([estado(), estado({ tiempo: 901, eventos: ace })], { voz: solo('combate') }))).toEqual([primera('voz.combate.ace.aliado')]);
    const aceEnContra = [ev('Ace', 900, { equipo: 'CHAOS' })];
    expect(plano(correr([estado(), estado({ tiempo: 901, eventos: aceEnContra })], { voz: solo('combate') }))).toEqual([primera('voz.combate.ace.rival')]);
  });

  it('racha de tres y cortar la racha de un rival (shutdown)', () => {
    const tres = [kill(100, 'Ahri', 'Zed'), kill(200, 'Ahri', 'LeeSin'), kill(300, 'Ahri', 'Zed')];
    const r = correr([estado(), estado({ tiempo: 101, eventos: tres.slice(0, 1) }), estado({ tiempo: 201, eventos: tres.slice(0, 2) }), estado({ tiempo: 301, eventos: tres })], { voz: solo('combate') });
    expect(r[3]).toEqual([primera('voz.combate.asesinato'), primera('voz.combate.racha.3')]);
    const rachaZed = [kill(100, 'Zed', 'Jinx'), kill(150, 'Zed', 'Jinx'), kill(200, 'Zed', 'Jinx')];
    const corto = kill(260, 'Ahri', 'Zed');
    const s = correr([estado({ eventos: [] }), estado({ tiempo: 201, eventos: rachaZed }), estado({ tiempo: 261, eventos: [...rachaZed, corto] })], { voz: solo('combate') });
    expect(s[2]).toEqual([primera('voz.combate.shutdown')]);
  });

  it('un evento atrasado (más de 15 s) o de antes de conectar no se dice', () => {
    const viejo = kill(100, 'Ahri', 'Zed');
    expect(plano(correr([estado({ tiempo: 101, eventos: [viejo] }), estado({ tiempo: 102, eventos: [viejo] })], { voz: solo('combate') }))).toEqual([]);
    const tarde = kill(100, 'Ahri', 'Zed');
    expect(plano(correr([estado(), estado({ tiempo: 130, eventos: [tarde] })], { voz: solo('combate') }))).toEqual([]);
  });
});

describe('ánimo y control del tilt', () => {
  it('tres muertes seguidas: frase de calma; al volver a participar, ánimo', () => {
    const m = [kill(100, 'Zed', 'Ahri'), kill(200, 'Zed', 'Ahri'), kill(300, 'LeeSin', 'Ahri')];
    const vuelta = kill(400, 'Ahri', 'Zed');
    const r = correr(
      [estado(), estado({ tiempo: 101, eventos: m.slice(0, 1) }), estado({ tiempo: 201, eventos: m.slice(0, 2) }), estado({ tiempo: 301, eventos: m }), estado({ tiempo: 401, eventos: [...m, vuelta] })],
      { voz: solo('animo') },
    );
    expect(r).toEqual([[], [], [], [primera('voz.animo.tilt3')], [primera('voz.animo.remontada')]]);
  });

  it('saludo al empezar (no al reconectar), diez minutos sin morir y el resultado final', () => {
    expect(plano(correr([estado({ tiempo: 5 }), estado({ tiempo: 16 })], { voz: solo('animo') }))).toEqual([primera('voz.animo.inicio')]);
    expect(plano(correr([estado({ tiempo: 200 }), estado({ tiempo: 201 })], { voz: solo('animo') }))).toEqual([]);
    const sinMorir = correr([estado({ tiempo: 590, kda: { k: 1, d: 0, a: 2 } }), estado({ tiempo: 601, kda: { k: 1, d: 0, a: 2 } })], { voz: solo('animo') });
    expect(plano(sinMorir)).toEqual([primera('voz.animo.sinMorir10')]);
    const fin = [ev('GameEnd', 1800, { resultado: 'Win' })];
    expect(plano(correr([estado({ tiempo: 1790 }), estado({ tiempo: 1801, eventos: fin })], { voz: solo('animo') }))).toEqual([primera('voz.animo.victoria')]);
  });
});

describe('objetivos conseguidos, alma y estructuras', () => {
  it('dragón de tu equipo (con su tipo) o del rival; punto de alma y alma', () => {
    const d1 = ev('DragonKill', 310, { dragon: 'Fire', equipo: 'ORDER' });
    const r = plano(correr([estado({ tiempo: 300 }), estado({ tiempo: 311, eventos: [d1] })], { voz: solo('objetivo') }));
    expect(r).toContain(primera('voz.tomado.dragon.aliado', { dragon: t('voz.dragonNombre.infernal') }));
    const tres = [600, 900, 1200].map((tiempo) => ev('DragonKill', tiempo, { dragon: 'Water', equipo: 'CHAOS' }));
    const s = plano(correr([estado({ tiempo: 1190, eventos: tres.slice(0, 2) }), estado({ tiempo: 1201, eventos: tres })], { voz: solo('objetivo') }));
    expect(s).toContain(primera('voz.alma.punto.rival'));
    const cuatro = [...tres, ev('DragonKill', 1500, { dragon: 'Water', equipo: 'CHAOS' })];
    const u = plano(correr([estado({ tiempo: 1490, eventos: tres }), estado({ tiempo: 1501, eventos: cuatro })], { voz: solo('objetivo') }));
    expect(u).toContain(primera('voz.alma.conseguida.rival'));
    expect(u).not.toContain(primera('voz.tomado.dragon.rival', { dragon: t('voz.dragonNombre.oceano') }));
  });

  it('robo del Barón; las tres larvas se dicen una vez; lo que ya dijo el jungla enemigo no se repite', () => {
    const robo = ev('BaronKill', 1300, { equipo: 'ORDER', robado: true });
    expect(plano(correr([estado({ tiempo: 1290 }), estado({ tiempo: 1301, eventos: [robo] })], { voz: solo('objetivo') }))).toContain(
      primera('voz.robo.aliado', { objetivo: t('voz.nombre.baron') }),
    );
    const larvas = [1, 2, 3].map((i) => ev('HordeKill', 500 + i, { equipo: 'ORDER' }));
    expect(plano(correr([estado({ tiempo: 490 }), estado({ tiempo: 505, eventos: larvas })], { voz: solo('objetivo') })).filter((x) => x === primera('voz.tomado.larvas.aliado'))).toHaveLength(1);
    const heraldo = ev('HeraldKill', 960, { equipo: 'CHAOS', id: 77 });
    const ya = plano(correr([estado({ tiempo: 950 }), estado({ tiempo: 961, eventos: [heraldo] })], { voz: solo('objetivo'), yaAvisados: new Set(['77']) }));
    expect(ya).not.toContain(primera('voz.tomado.heraldo.rival'));
  });

  it('torres: la primera de la partida, luego derribadas o perdidas con su calle', () => {
    expect(equipoDeEstructura('Turret_T1_L_03_A')).toBe('ORDER');
    expect(equipoDeEstructura('Barracks_T2_R1')).toBe('CHAOS');
    expect(equipoDeEstructura('Turret_OrderTurretShrine')).toBeNull();
    const t1 = ev('TurretKilled', 700, { estructura: 'Turret_T2_C_05_A' });
    const t2 = ev('TurretKilled', 800, { estructura: 'Turret_T1_R_03_A' });
    const r = correr([estado({ tiempo: 690 }), estado({ tiempo: 701, eventos: [t1] }), estado({ tiempo: 801, eventos: [t1, t2] })], { voz: solo('equipo') });
    expect(r[1]).toEqual([primera('voz.estructura.primeraTorre.aliado')]);
    expect(r[2]).toEqual([primera('voz.estructura.torrePerdida', { torre: t('voz.torre.bot') })]);
  });

  it('inhibidor propio: caído, aviso un minuto antes de volver y cuando vuelve', () => {
    const caido = ev('InhibKilled', 1600, { estructura: 'Barracks_T1_L1' });
    const vuelve = ev('InhibRespawned', 1900, { estructura: 'Barracks_T1_L1' });
    const inhibidor = t('voz.inhibidor.top');
    const r = correr(
      [estado({ tiempo: 1590 }), estado({ tiempo: 1601, eventos: [caido] }), estado({ tiempo: 1839, eventos: [caido] }), estado({ tiempo: 1841, eventos: [caido] }), estado({ tiempo: 1901, eventos: [caido, vuelve] })],
      { voz: solo('equipo') },
    );
    expect(r).toEqual([
      [],
      [primera('voz.estructura.inhibPerdido', { inhibidor })],
      [],
      [primera('voz.estructura.inhibVuelve60', { inhibidor })],
      [primera('voz.estructura.inhibVuelto', { inhibidor })],
    ]);
  });

  it('rachas: de un compañero (con su nombre) y de un rival', () => {
    const tres = [kill(100, 'Jinx', 'Zed'), kill(150, 'Jinx', 'LeeSin'), kill(200, 'Jinx', 'Zed')];
    expect(plano(correr([estado(), estado({ tiempo: 201, eventos: tres })], { voz: solo('equipo') }))).toEqual([primera('voz.equipo.rachaAliado', { campeon: 'Jinx' })]);
    const cuatro = [100, 150, 200, 250].map((x) => kill(x, 'LeeSin', 'Jinx'));
    expect(plano(correr([estado(), estado({ tiempo: 251, eventos: cuatro })], { voz: solo('equipo') }))).toEqual([primera('voz.equipo.rachaRival', { campeon: 'Lee Sin' })]);
  });
});

describe('arreglos de la revisión de punta a punta (3.1)', () => {
  it('las larvas no vuelven a anunciarse como «han aparecido» tras cada larva muerta', () => {
    const larva = (i: number) => ev('HordeKill', 500 + i, { equipo: 'ORDER' });
    const r = plano(correr([estado({ tiempo: 470 }), estado({ tiempo: 481 }), estado({ tiempo: 501, eventos: [larva(0)] }), estado({ tiempo: 503, eventos: [larva(0), larva(2)] })], { voz: solo('objetivo') }));
    expect(r.filter((x) => textosVariantes('voz.obj.larvas.ya').includes(x))).toHaveLength(1);
  });

  it('el aviso del jungla enemigo dice las larvas una vez por campamento, no una por larva', async () => {
    const { AvisadorJunglaEnemiga } = await import('../src/main/consejos/junglaEnemiga');
    const a = new AvisadorJunglaEnemiga({ selector: new SelectorFijo() });
    const jugadores = JUGADORES;
    a.procesarTodos(estado({ tiempo: 490, jugadores }), CARGA);
    const larvas = [0, 4, 8].map((i) => ev('HordeKill', 500 + i, { asesino: 'LeeSin', asistentes: [] }));
    const avisos = [
      ...a.procesarTodos(estado({ tiempo: 501, jugadores, eventos: larvas.slice(0, 1) }), CARGA),
      ...a.procesarTodos(estado({ tiempo: 509, jugadores, eventos: larvas }), CARGA),
    ];
    expect(avisos.map((x) => x.texto)).toEqual([t('junglaEnemiga.objetivo.larvas')]);
  });
});

describe('economía, nivel, farmeo y visión', () => {
  it('objeto legendario completado y, tras comprar sin guardián, recordar el guardián de control', () => {
    const r = correr([estado({ tiempo: 600, objetos: [3108, 3340] }), estado({ tiempo: 601, objetos: [3089, 3340], oro: 200 })], { voz: solo('economia', 'vision') });
    expect(r[1]).toContain(primera('voz.economia.objetoCompletado', { objeto: 'Sombrero mortal de Rabadon' }));
    expect(r[1]).toContain(primera('voz.vision.trasCompra'));
    // Un objeto que no es legendario (componente) no se celebra.
    const componente = correr([estado({ tiempo: 500, objetos: [3340] }), estado({ tiempo: 501, objetos: [3108, 3340] })], { voz: solo('economia') });
    expect(plano(componente)).toEqual([]);
  });

  it('mucho oro sin gastar durante 45 s vivo; botas a los 10 min si la build las lleva', () => {
    const r = correr([estado({ tiempo: 400, oro: 1600 }), estado({ tiempo: 401, oro: 1600 }), estado({ tiempo: 430, oro: 1700 }), estado({ tiempo: 446, oro: 1800 })], { voz: solo('economia') });
    expect(plano(r)).toEqual([primera('voz.economia.oroSinGastar')]);
    const muerto = correr([estado({ tiempo: 400, oro: 1600 }), estado({ tiempo: 401, oro: 1600 }), estado({ tiempo: 446, oro: 1800, muerto: true })], { voz: solo('economia') });
    expect(plano(muerto)).toEqual([]);
    expect(plano(correr([estado({ tiempo: 590 }), estado({ tiempo: 601 })], { voz: solo('economia') }))).toEqual([primera('voz.economia.botas')]);
    expect(plano(correr([estado({ tiempo: 590, objetos: [3020] }), estado({ tiempo: 601, objetos: [3020] })], { voz: solo('economia') }))).toEqual([]);
  });

  it('nivel seis antes que tu rival de línea (marcador), definitiva en el once y nivel máximo', () => {
    const conNiveles = (yo: number, rival: number) => JUGADORES.map((j) => (j.campeon === 'Zed' ? { ...j, nivel: rival } : j.campeon === 'Ahri' ? { ...j, nivel: yo } : j));
    const r = correr([estado({ tiempo: 400, nivel: 5, jugadores: conNiveles(5, 5) }), estado({ tiempo: 401, nivel: 6, jugadores: conNiveles(6, 5) })], { voz: solo('nivel') });
    expect(plano(r)).toEqual([primera('voz.nivel.antesQueRival')]);
    const igual = correr([estado({ tiempo: 400, nivel: 5 }), estado({ tiempo: 401, nivel: 6, jugadores: conNiveles(6, 6) })], { voz: solo('nivel') });
    expect(plano(igual)).toEqual([primera('voz.nivel.definitiva6')]);
    expect(plano(correr([estado({ tiempo: 900, nivel: 10 }), estado({ tiempo: 901, nivel: 11 })], { voz: solo('nivel') }))).toEqual([primera('voz.nivel.definitiva11')]);
    expect(plano(correr([estado({ tiempo: 1900, nivel: 17 }), estado({ tiempo: 1901, nivel: 18 })], { voz: solo('nivel') }))).toEqual([primera('voz.nivel.maximo')]);
    // Campeones sin definitiva normal (Udyr): no se habla de la definitiva.
    expect(plano(correr([estado({ tiempo: 400, nivel: 5, campeon: 'Udyr' }), estado({ tiempo: 401, nivel: 6, campeon: 'Udyr' })], { voz: solo('nivel') }))).toEqual([]);
  });

  it('farmeo a los 5, 10, 15 y 20 minutos según el objetivo del rol (el apoyo no)', () => {
    const r = correr(
      [estado({ tiempo: 290, cs: 35 }), estado({ tiempo: 301, cs: 40 }), estado({ tiempo: 601, cs: 66 }), estado({ tiempo: 901, cs: 80 })],
      { voz: solo('cs') },
    );
    expect(r).toEqual([[], [primera('voz.cs.bien')], [primera('voz.cs.cerca')], [primera('voz.cs.bajo')]]);
  });

  it('abalorio que falta, y la puntuación de visión baja o buena a los 10 minutos', () => {
    expect(plano(correr([estado({ tiempo: 80, objetos: [1056] }), estado({ tiempo: 91, objetos: [1056] })], { voz: solo('vision') }))).toEqual([primera('voz.vision.abalorio')]);
    expect(plano(correr([estado({ tiempo: 590, vision: 2 }), estado({ tiempo: 601, vision: 2 })], { voz: solo('vision') }))).toContain(primera('voz.vision.baja'));
    expect(plano(correr([estado({ tiempo: 590, vision: 9 }), estado({ tiempo: 601, vision: 9 })], { voz: solo('vision') }))).toContain(primera('voz.vision.buena'));
  });
});

describe('muerte, reaparición, fases y modos', () => {
  it('mientras estás muerto, un consejo; al reaparecer, el próximo objetivo si está cerca', () => {
    const r = correr(
      [estado({ tiempo: 1100 }), estado({ tiempo: 1101, muerto: true, reaparece: 25 }), estado({ tiempo: 1105, muerto: true, reaparece: 21 }), estado({ tiempo: 1126, muerto: false })],
      { voz: solo('muerte') },
    );
    expect(r[2]).toEqual([primera('voz.muerte.consejo')]);
    // A los 18:46 el dragón sigue en el foso (nadie lo ha matado).
    expect(r[3]).toEqual([primera('voz.muerte.reaparecerObjetivo', { objetivo: t('voz.nombre.dragon') })]);
    // Sin objetivos cerca (a los 2:30 el dragón aún tarda), la frase general; y una muerte muy corta, nada.
    const s = correr([estado({ tiempo: 120 }), estado({ tiempo: 121, muerto: true, reaparece: 20 }), estado({ tiempo: 141, muerto: false })], { voz: solo('muerte') });
    expect(s[2]).toEqual([primera('voz.muerte.reaparecer')]);
  });

  it('marcador a los 15 minutos solo con lo que se ve: asesinatos y torres', () => {
    const conKills = (nuestras: number, suyas: number) =>
      JUGADORES.map((j) => ({ ...j, asesinatos: j.equipo === 'ORDER' ? (j.campeon === 'Ahri' ? nuestras : 0) : j.campeon === 'Zed' ? suyas : 0 }));
    const delante = correr([estado({ tiempo: 890, jugadores: conKills(9, 2) }), estado({ tiempo: 901, jugadores: conKills(9, 2) })], { voz: solo('fase') });
    expect(plano(delante)).toEqual([primera('voz.marcador.delante')]);
    const igualada = correr([estado({ tiempo: 890, jugadores: conKills(4, 5) }), estado({ tiempo: 901, jugadores: conKills(4, 5) })], { voz: solo('fase') });
    expect(plano(igualada)).toEqual([primera('voz.marcador.igualada')]);
    // Sin asesinatos en el marcador (API antigua) no se dice nada.
    const sinDatos = JUGADORES.map(({ asesinatos: _a, ...j }) => j);
    expect(plano(correr([estado({ tiempo: 890, jugadores: sinDatos }), estado({ tiempo: 901, jugadores: sinDatos })], { voz: solo('fase') }))).toEqual([]);
  });

  it('ARAM: saludo, consejos del modo y comprar al morir; sin consejos de la Grieta', () => {
    const aram = (p: Partial<EstadoPartida>) => estado({ modo: 'aram', ...p });
    const r = correr([aram({ tiempo: 5 }), aram({ tiempo: 16 }), aram({ tiempo: 91 }), aram({ tiempo: 200, muerto: true, reaparece: 20 }), aram({ tiempo: 204, muerto: true, reaparece: 16 })], { voz: COMPLETA });
    expect(r[1]).toEqual([primera('voz.modo.aram.inicio')]);
    expect(r[2]).toEqual([primera('voz.modo.aram.consejo')]);
    expect(r[4]).toEqual([primera('voz.modo.aram.muerte')]);
    expect(plano(r).some((x) => textosVariantes('voz.muerte.consejo').includes(x))).toBe(false);
  });

  it('Arena: saludo y caída en la ronda, sin niveles ni habilidad', () => {
    const arena = (p: Partial<EstadoPartida>) => estado({ modo: 'arena', ...p });
    const r = correr([arena({ tiempo: 5 }), arena({ tiempo: 16, nivel: 6 }), arena({ tiempo: 60, muerto: true, reaparece: 12 }), arena({ tiempo: 64, muerto: true, reaparece: 10 })], { voz: COMPLETA });
    expect(r[1]).toEqual([primera('voz.modo.arena.inicio')]);
    expect(r[3]).toEqual([primera('voz.modo.arena.muerte')]);
  });

  it('las categorías apagadas no se dicen, y tampoco se acumulan para después', () => {
    const k = kill(200, 'Ahri', 'Zed');
    const d = new DisparadorVoz({ selector: new SelectorFijo() });
    expect(plano(correr([estado(), estado({ tiempo: 201, eventos: [k] })], { voz: solo('animo'), d }))).toEqual([]);
    expect(plano(correr([estado({ tiempo: 202, eventos: [k] })], { d }))).toEqual([]);
  });
});
