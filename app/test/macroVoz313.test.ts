import { describe, expect, it } from 'vitest';
import type { Build, Rol } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { resumenOverlay } from '../src/main/consejos/motor';
import { SelectorFijo, textosVariantes } from '../src/main/consejos/variantes';
import { DisparadorVoz, type EntradaVoz } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { normalizarDatosPartida } from '../src/main/partida/normalizar';
import { t } from '../src/shared/i18n';
import type { AjustesVoz, EstadoPartida, EventoPartida, JugadorCarga, JugadorPartida, TipoVoz } from '../src/shared/tiposApp';
import { tiposDeNivel } from '../src/shared/vozCategorias';

/*
 * 3.13: más estrategia por voz (de la guía de conceptos y frases): oleada de cañón, inicio de la fase de líneas,
 * cruce con tu rival, inferioridad numérica, cambio de objetivos, qué hacer tras el Barón, el ancestral o un as,
 * líneas laterales, maná bajo y la lente. Solo con eventos oficiales y lo que enseña el marcador.
 */

const objetos = {
  3089: { name: 'Sombrero mortal de Rabadon', gold: { total: 3600, purchasable: true }, from: [], into: [] },
  3340: { name: 'Tótem vigilante', gold: { total: 0, purchasable: true }, tags: ['Trinket'], into: [] },
  1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true }, into: [] },
} as unknown as DatosEstaticos['objetos'];
const build = { nucleo: [3089], botas: null, situacionales: [], ordenHabilidades: ['Q', 'E', 'W'] } as unknown as Build;
const COMPLETA: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, tipos: tiposDeNivel('completo') };
const solo = (...tipos: TipoVoz[]): AjustesVoz => ({
  ...COMPLETA,
  tipos: Object.fromEntries(Object.keys(COMPLETA.tipos).map((k) => [k, tipos.includes(k as TipoVoz)])) as AjustesVoz['tipos'],
});

const BASE: JugadorPartida[] = [
  { campeon: 'Ahri', nombre: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Jinx', nombre: 'Jinx', equipo: 'ORDER', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Garen', nombre: 'Garen', equipo: 'ORDER', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Vi', nombre: 'Vi', equipo: 'ORDER', posicion: null, castigo: true, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Zed', nombre: 'Zed', equipo: 'CHAOS', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'LeeSin', nombre: 'Lee Sin', equipo: 'CHAOS', posicion: null, castigo: true, nivel: 5, muerto: false, reaparece: 0 },
];
const CARGA = [
  { equipo: 'aliado', campeon: 'Ahri', rol: 'MIDDLE' },
  { equipo: 'aliado', campeon: 'Jinx', rol: 'BOTTOM' },
  { equipo: 'aliado', campeon: 'Garen', rol: 'TOP' },
  { equipo: 'aliado', campeon: 'Vi', rol: 'JUNGLE' },
  { equipo: 'enemigo', campeon: 'Zed', rol: 'MIDDLE' },
  { equipo: 'enemigo', campeon: 'LeeSin', rol: 'JUNGLE' },
] as unknown as JugadorCarga[];

const con = (cambios: Record<string, Partial<JugadorPartida>> = {}): JugadorPartida[] => BASE.map((j) => ({ ...j, ...cambios[j.campeon] }));

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return {
    tiempo: 20, oro: 0, nivel: 5, campeon: 'Ahri', objetos: [1056, 3340], habilidades: { Q: 3, W: 1, E: 1, R: 0 }, eventos: [],
    equipo: 'ORDER', modo: 'clasificatoria', jugadores: con(), muerto: false, ...p,
  };
}

let siguienteId = 900;
const ev = (nombre: string, tiempo: number, extra: Partial<EventoPartida> = {}): EventoPartida => ({ nombre, tiempo, id: siguienteId++, ...extra });
const OLEADAS = ev('MinionsSpawning', 65);

function correr(estados: EstadoPartida[], o: { voz?: AjustesVoz; rol?: Rol } = {}) {
  const d = new DisparadorVoz({ selector: new SelectorFijo() });
  const rol = o.rol ?? 'MIDDLE';
  return estados
    .map((e) => {
      const entrada: EntradaVoz = {
        estado: e, overlay: resumenOverlay(e, build, rol, objetos, ''), rol, marcas: {}, jungla: false, objetos, build, carga: CARGA,
      };
      return d.procesar(entrada, o.voz ?? solo('macro', 'nivel', 'vision')).map((f) => f.texto);
    })
    .flat();
}
const primera = (base: string, params?: Record<string, string | number>) => textosVariantes(base, params)[0]!;
/** Tres estados seguidos que acaban en `hasta` (el primero solo sirve para aprender lo que ya pasó). */
const tramo = (hasta: number, p: Partial<EstadoPartida> = {}, ultimo: Partial<EstadoPartida> = {}) => [
  estado({ tiempo: hasta - 2, ...p }),
  estado({ tiempo: hasta - 1, ...p }),
  estado({ tiempo: hasta, ...p, ...ultimo }),
];

describe('coach de estrategia: más avisos (3.13)', () => {
  it('oleada de cañón: la tercera oleada desde MinionsSpawning; con oro, empuja y vuelve', () => {
    // Oleadas a los 65, 95, 125…: la de cañón número 3 (la novena oleada) sale a los 65 + 8 × 30 = 305 s.
    const sinOro = correr(tramo(306, { eventos: [OLEADAS] }));
    expect(sinOro).toContain(primera('voz.macro.canon.empuja'));
    const conOro = correr(tramo(306, { eventos: [OLEADAS], oro: 1300 }));
    expect(conOro).toContain(primera('voz.macro.canon.back'));
    // Una oleada normal no dice nada, y el jungla no recibe el aviso.
    expect(correr(tramo(276, { eventos: [OLEADAS] }))).not.toContain(primera('voz.macro.canon.empuja'));
    expect(correr(tramo(306, { eventos: [OLEADAS] }), { rol: 'JUNGLE' })).not.toContain(primera('voz.macro.canon.empuja'));
  });

  it('inicio de línea: hechizo del rival, carrera al nivel dos y primer gankeo', () => {
    const conPrender = con({ Zed: { hechizos: ['SummonerFlash', 'SummonerDot'] } });
    expect(correr(tramo(31, { jugadores: conPrender }))).toContain(primera('voz.macro.hechizoRival.prender', { campeon: 'Zed' }));
    const conTp = con({ Zed: { hechizos: ['SummonerFlash', 'SummonerTeleport'] } });
    expect(correr(tramo(31, { jugadores: conTp }))).toContain(primera('voz.macro.hechizoRival.teleport', { campeon: 'Zed' }));
    expect(correr(tramo(86, { eventos: [OLEADAS] }))).toContain(primera('voz.macro.nivel2'));
    expect(correr(tramo(171))).toContain(primera('voz.macro.primerGank'));
    expect(correr(tramo(171), { rol: 'JUNGLE' })).not.toContain(primera('voz.macro.primerGank'));
  });

  it('farmeo frente a tu rival en el minuto 8: por delante o por detrás', () => {
    const delante = correr(tramo(481, { cs: 70, jugadores: con({ Zed: { cs: 50 } }) }));
    expect(delante).toContain(primera('voz.macro.cs.delante', { campeon: 'Zed' }));
    const detras = correr(tramo(481, { cs: 40, jugadores: con({ Zed: { cs: 60 } }) }));
    expect(detras).toContain(primera('voz.macro.cs.detras', { campeon: 'Zed' }));
    const igual = correr(tramo(481, { cs: 55, jugadores: con({ Zed: { cs: 50 } }) }));
    expect(igual.some((x) => x.includes('Zed'))).toBe(false);
  });

  it('le sacas un nivel a tu rival (pero no en el nivel seis, que ya tiene su frase)', () => {
    const r = correr([estado({ tiempo: 300, nivel: 4 }), estado({ tiempo: 301, nivel: 4 }), estado({ tiempo: 302, nivel: 5, jugadores: con({ Zed: { nivel: 4 } }) })]);
    expect(r).toContain(primera('voz.macro.ventajaNivel', { campeon: 'Zed' }));
    const seis = correr([estado({ tiempo: 300, nivel: 5 }), estado({ tiempo: 301, nivel: 5 }), estado({ tiempo: 302, nivel: 6 })]);
    expect(seis).not.toContain(primera('voz.macro.ventajaNivel', { campeon: 'Zed' }));
  });

  it('tu rival de línea te mata por segunda vez', () => {
    const k1 = ev('ChampionKill', 200, { asesino: 'Zed', victima: 'Ahri' });
    const k2 = ev('ChampionKill', 400, { asesino: 'Zed', victima: 'Ahri' });
    const r = correr([estado({ tiempo: 190 }), estado({ tiempo: 201, eventos: [k1] }), estado({ tiempo: 401, eventos: [k1, k2] })]);
    expect(r).toContain(primera('voz.macro.repetido', { campeon: 'Zed' }));
    const una = correr([estado({ tiempo: 190 }), estado({ tiempo: 195 }), estado({ tiempo: 201, eventos: [k1] })]);
    expect(una).not.toContain(primera('voz.macro.repetido', { campeon: 'Zed' }));
  });

  it('inferioridad numérica: tres aliados muertos y tú vivo', () => {
    const tres = con({ Jinx: { muerto: true, reaparece: 30 }, Garen: { muerto: true, reaparece: 25 }, Vi: { muerto: true, reaparece: 20 } });
    expect(correr(tramo(900, {}, { jugadores: tres }))).toContain(primera('voz.macro.desventaja'));
    expect(correr(tramo(900, {}, { jugadores: tres, muerto: true }))).not.toContain(primera('voz.macro.desventaja'));
  });

  it('el rival se lleva un objetivo: cambiarlo por otro o por una torre', () => {
    const dragon = ev('DragonKill', 900, { equipo: 'CHAOS', dragon: 'Fire' });
    const r = correr(tramo(901, {}, { eventos: [dragon] }));
    const opciones = [
      ...['heraldo', 'larvas', 'baron'].map((o) => primera('voz.macro.cambio.objetivo', { objetivo: t(`voz.nombre.${o}`) })),
      primera('voz.macro.cambio.torre'),
    ];
    expect(r.some((x) => opciones.includes(x))).toBe(true);
    // Un objetivo de tu equipo no pide cambio.
    const nuestro = correr(tramo(901, {}, { eventos: [{ ...dragon, id: 999, equipo: 'ORDER' }] }));
    expect(nuestro.some((x) => opciones.includes(x))).toBe(false);
  });

  it('unos segundos después del Barón, del ancestral o de un as: qué hacer con la ventaja', () => {
    const baron = ev('BaronKill', 1500, { equipo: 'ORDER' });
    expect(correr(tramo(1516, { eventos: [baron] }))).toContain(primera('voz.macro.mejora.baron.aliado'));
    const baronRival = ev('BaronKill', 1500, { equipo: 'CHAOS' });
    expect(correr(tramo(1516, { eventos: [baronRival] }))).toContain(primera('voz.macro.mejora.baron.rival'));
    const anciano = ev('DragonKill', 2000, { equipo: 'ORDER', dragon: 'Elder' });
    expect(correr(tramo(2016, { eventos: [anciano] }))).toContain(primera('voz.macro.mejora.anciano.aliado'));
    const as = ev('Ace', 1000, { equipo: 'ORDER' });
    const r = correr(tramo(1016, { eventos: [as] }));
    const opciones = [primera('voz.macro.as.torre'), ...['dragon', 'heraldo', 'larvas', 'baron'].map((o) => primera('voz.macro.as.objetivo', { objetivo: t(`voz.nombre.${o}`) }))];
    expect(r.filter((x) => opciones.includes(x))).toHaveLength(1);
    // El as del rival no da esta orden.
    expect(correr(tramo(1016, { eventos: [{ ...as, id: 998, equipo: 'CHAOS' }] })).some((x) => opciones.includes(x))).toBe(false);
  });

  it('desde el minuto 25, antes de un objetivo se habla de las líneas laterales', () => {
    // Barón que reaparece 6 min después del primero: sale a los 1500 + 360 = 1860; minuto y medio antes, a los 1770.
    const baron = ev('BaronKill', 1500, { equipo: 'CHAOS' });
    const r = correr([estado({ tiempo: 1765, eventos: [baron] }), estado({ tiempo: 1770, eventos: [baron] }), estado({ tiempo: 1775, eventos: [baron] })]);
    expect(r).toContain(primera('voz.macro.lateral', { objetivo: t('voz.nombre.baron') }));
  });

  it('maná bajo unos segundos, con oro y fuera de pelea: vuelve a base', () => {
    const r = correr([estado({ tiempo: 400 }), ...[401, 403, 406].map((tiempo) => estado({ tiempo, mana: 0.05, oro: 900 }))]);
    expect(r).toContain(primera('voz.macro.backMana'));
  });

  it('jungla con el tótem a los 10:00: cambia a la lente', () => {
    expect(correr(tramo(601), { rol: 'JUNGLE' })).toContain(primera('voz.macro.lente'));
    expect(correr(tramo(601, { objetos: [1056] }), { rol: 'JUNGLE' })).not.toContain(primera('voz.macro.lente'));
    expect(correr(tramo(601), { rol: 'MIDDLE' })).not.toContain(primera('voz.macro.lente'));
  });

  it('sin solapes: tras la ventaja numérica el as no repite la orden, y tras «dos veces» no suena el consejo de la muerte', () => {
    const dos = con({ LeeSin: { muerto: true, reaparece: 30 }, Zed: { muerto: true, reaparece: 25 } });
    const as = ev('Ace', 1000, { equipo: 'ORDER' });
    const r = correr([estado({ tiempo: 998 }), estado({ tiempo: 999 }), estado({ tiempo: 1000, jugadores: dos }), ...[1005, 1010, 1016].map((tiempo) => estado({ tiempo, jugadores: dos, eventos: [as] }))]);
    expect(r.some((x) => x === primera('voz.macro.as.torre') || /^As:|^Ahora que/.test(x))).toBe(false);
    const k1 = ev('ChampionKill', 200, { asesino: 'Zed', victima: 'Ahri' });
    const k2 = ev('ChampionKill', 400, { asesino: 'Zed', victima: 'Ahri' });
    const muerto = (tiempo: number) => estado({ tiempo, eventos: [k1, k2], muerto: true, reaparece: 20 });
    const conMuerte = correr([estado({ tiempo: 190 }), estado({ tiempo: 201, eventos: [k1] }), muerto(401), muerto(403), muerto(405)], { voz: solo('macro', 'muerte') });
    expect(conMuerte).toContain(primera('voz.macro.repetido', { campeon: 'Zed' }));
    expect(conMuerte.some((x) => textosVariantes('voz.muerte.consejo').includes(x))).toBe(false);
  });

  it('sin solapes: con tu asesinato en el mismo momento no se dice además «buena asistencia»', () => {
    const k1 = ev('ChampionKill', 600, { asesino: 'Ahri', victima: 'Zed', asistentes: ['Jinx'] });
    const k2 = ev('ChampionKill', 600, { asesino: 'Jinx', victima: 'LeeSin', asistentes: ['Ahri'] });
    const r = correr([estado({ tiempo: 598 }), estado({ tiempo: 599 }), estado({ tiempo: 601, eventos: [k1, k2] })], { voz: solo('combate') });
    expect(r).toContain(primera('voz.combate.asesinato'));
    expect(r.some((x) => textosVariantes('voz.combate.asistencia').includes(x))).toBe(false);
  });

  it('con la categoría de estrategia apagada no suena nada de esto', () => {
    expect(correr(tramo(306, { eventos: [OLEADAS] }), { voz: solo('combate') })).toEqual([]);
  });
});

describe('normalizar (3.13): maná, farmeo y hechizos del marcador', () => {
  const datos = (extra: Record<string, unknown> = {}) => ({
    activePlayer: { riotId: 'Yo#EUW', currentGold: 0, level: 3, championStats: { currentHealth: 500, maxHealth: 1000, resourceType: 'MANA', resourceValue: 100, resourceMax: 400 }, ...extra },
    allPlayers: [
      { riotId: 'Yo#EUW', rawChampionName: 'game_character_displayname_Ahri', championName: 'Ahri', team: 'ORDER', items: [], scores: { creepScore: 30 } },
      {
        riotId: 'Otro#EUW', rawChampionName: 'game_character_displayname_Zed', championName: 'Zed', team: 'CHAOS', items: [], scores: { creepScore: 42 },
        summonerSpells: { summonerSpellOne: { rawDisplayName: 'GeneratedTip_SummonerSpell_SummonerFlash_DisplayName' }, summonerSpellTwo: { rawDisplayName: 'GeneratedTip_SummonerSpell_SummonerDot_DisplayName' } },
      },
    ],
    events: { Events: [] },
    gameData: { gameMode: 'CLASSIC', mapNumber: 11, gameTime: 100 },
  });

  it('lee el maná como fracción solo con campeones de maná', () => {
    expect(normalizarDatosPartida(datos())!.mana).toBeCloseTo(0.25);
    const energia = datos({ championStats: { currentHealth: 500, maxHealth: 1000, resourceType: 'ENERGY', resourceValue: 10, resourceMax: 200 } });
    expect(normalizarDatosPartida(energia)!.mana).toBeUndefined();
  });

  it('lee el farmeo y los hechizos (solo cuáles lleva) de cada jugador', () => {
    const zed = normalizarDatosPartida(datos())!.jugadores!.find((j) => j.campeon === 'Zed')!;
    expect(zed.cs).toBe(42);
    expect(zed.hechizos).toEqual(['SummonerFlash', 'SummonerDot']);
  });
});
