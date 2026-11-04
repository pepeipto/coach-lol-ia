import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { esTorreExterior } from '../src/main/consejos/macro';
import { resumenOverlay } from '../src/main/consejos/motor';
import { SelectorFijo, textosVariantes } from '../src/main/consejos/variantes';
import { DisparadorVoz, type EntradaVoz } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { t } from '../src/shared/i18n';
import type { AjustesVoz, EstadoPartida, EventoPartida, JugadorCarga, JugadorPartida, TipoVoz } from '../src/shared/tiposApp';
import { tiposDeNivel } from '../src/shared/vozCategorias';

/*
 * 3.12: coach de estrategia (macro). Rival de línea muerto, ventaja numérica, preparar objetivos, placas, primera torre
 * de tu calle y vida baja; todo con datos del marcador y eventos oficiales.
 */

const objetos = {
  3089: { name: 'Sombrero mortal de Rabadon', gold: { total: 3600, purchasable: true }, from: [], into: [] },
  3340: { name: 'Tótem vigilante', gold: { total: 0, purchasable: true }, tags: ['Trinket'], into: [] },
  1056: { name: 'Anillo de Doran', gold: { total: 400, purchasable: true }, into: [] },
} as unknown as DatosEstaticos['objetos'];
const build = { nucleo: [3089], botas: null, situacionales: [], ordenHabilidades: ['Q', 'E', 'W'] } as unknown as Build;
const COMPLETA: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, tipos: tiposDeNivel('completo') };
const solo = (...tipos: TipoVoz[]): AjustesVoz => ({ ...COMPLETA, tipos: Object.fromEntries(Object.keys(COMPLETA.tipos).map((k) => [k, tipos.includes(k as TipoVoz)])) as AjustesVoz['tipos'] });

const BASE: JugadorPartida[] = [
  { campeon: 'Ahri', nombre: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Jinx', nombre: 'Jinx', equipo: 'ORDER', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Zed', nombre: 'Zed', equipo: 'CHAOS', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'LeeSin', nombre: 'Lee Sin', equipo: 'CHAOS', posicion: null, castigo: true, nivel: 5, muerto: false, reaparece: 0 },
  { campeon: 'Caitlyn', nombre: 'Caitlyn', equipo: 'CHAOS', posicion: null, castigo: false, nivel: 5, muerto: false, reaparece: 0 },
];
const CARGA = [
  { equipo: 'aliado', campeon: 'Ahri', rol: 'MIDDLE' },
  { equipo: 'aliado', campeon: 'Jinx', rol: 'BOTTOM' },
  { equipo: 'enemigo', campeon: 'Zed', rol: 'MIDDLE' },
  { equipo: 'enemigo', campeon: 'LeeSin', rol: 'JUNGLE' },
  { equipo: 'enemigo', campeon: 'Caitlyn', rol: 'BOTTOM' },
] as unknown as JugadorCarga[];

/** Jugadores con cambios por campeón. */
const con = (cambios: Record<string, Partial<JugadorPartida>> = {}): JugadorPartida[] => BASE.map((j) => ({ ...j, ...cambios[j.campeon] }));

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return {
    tiempo: 20, oro: 0, nivel: 5, campeon: 'Ahri', objetos: [1056, 3340], habilidades: { Q: 3, W: 1, E: 1, R: 0 }, eventos: [],
    equipo: 'ORDER', modo: 'clasificatoria', jugadores: con(), muerto: false, ...p,
  };
}

let siguienteId = 500;
const ev = (nombre: string, tiempo: number, extra: Partial<EventoPartida> = {}): EventoPartida => ({ nombre, tiempo, id: siguienteId++, ...extra });

function correr(estados: EstadoPartida[], voz: AjustesVoz = solo('macro', 'nivel')) {
  const d = new DisparadorVoz({ selector: new SelectorFijo() });
  return estados
    .map((e) => {
      const entrada: EntradaVoz = {
        estado: e, overlay: resumenOverlay(e, build, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false, objetos, build, carga: CARGA,
      };
      return d.procesar(entrada, voz).map((f) => f.texto);
    })
    .flat();
}
const primera = (base: string, params?: Record<string, string | number>) => textosVariantes(base, params)[0]!;

describe('coach de estrategia (3.12)', () => {
  it('rival de línea muerto: empuja; con oro, empuja y vuelve a base', () => {
    const muerto = con({ Zed: { muerto: true, reaparece: 20 } });
    const sinOro = correr([estado({ tiempo: 300 }), estado({ tiempo: 301 }), estado({ tiempo: 302, jugadores: muerto })]);
    expect(sinOro).toContain(primera('voz.macro.rivalMuerto.empuja', { campeon: 'Zed' }));
    const conOro = correr([estado({ tiempo: 300 }), estado({ tiempo: 301, oro: 1300 }), estado({ tiempo: 302, oro: 1300, jugadores: muerto })]);
    expect(conOro).toContain(primera('voz.macro.rivalMuerto.back', { campeon: 'Zed' }));
  });

  it('rival muerto: nada con poca reaparición, al principio de la partida o si tú también estás muerto', () => {
    const corto = con({ Zed: { muerto: true, reaparece: 6 } });
    expect(correr([estado({ tiempo: 300 }), estado({ tiempo: 301 }), estado({ tiempo: 302, jugadores: corto })])).toEqual([]);
    const largo = con({ Zed: { muerto: true, reaparece: 20 } });
    expect(correr([estado({ tiempo: 100 }), estado({ tiempo: 101 }), estado({ tiempo: 102, jugadores: largo })])).toEqual([]);
    expect(correr([estado({ tiempo: 300 }), estado({ tiempo: 301, muerto: true }), estado({ tiempo: 302, muerto: true, jugadores: largo })])).toEqual([]);
  });

  it('tu rival llega a nivel seis antes que tú', () => {
    const r = correr([estado({ tiempo: 300 }), estado({ tiempo: 301 }), estado({ tiempo: 302, jugadores: con({ Zed: { nivel: 6 } }) })]);
    expect(r).toContain(primera('voz.macro.rival6', { campeon: 'Zed' }));
  });

  it('ventaja numérica: con dos rivales muertos, a por un objetivo vivo', () => {
    const dos = con({ LeeSin: { muerto: true, reaparece: 30 }, Caitlyn: { muerto: true, reaparece: 25 } });
    const r = correr([estado({ tiempo: 900 }), estado({ tiempo: 901 }), estado({ tiempo: 902, jugadores: dos })]);
    const opciones = ['dragon', 'heraldo', 'larvas'].map((o) => primera('voz.macro.ventaja.objetivo', { objetivo: t(`voz.nombre.${o}`) }));
    expect(r.some((x) => opciones.includes(x))).toBe(true);
  });

  it('minuto y medio antes del Barón: por rol sin oro, volver a base con oro', () => {
    const baron = t('voz.nombre.baron');
    const sinOro = correr([estado({ tiempo: 1100 }), estado({ tiempo: 1105 }), estado({ tiempo: 1110 })]);
    expect(sinOro).toContain(primera('voz.macro.preparar.MIDDLE', { objetivo: baron }));
    const conOro = correr([estado({ tiempo: 1100, oro: 1500 }), estado({ tiempo: 1105, oro: 1500 }), estado({ tiempo: 1110, oro: 1500 })]);
    expect(conOro).toContain(primera('voz.macro.backObjetivo', { objetivo: baron }));
    // Una sola vez por aparición.
    expect(conOro.filter((x) => x === primera('voz.macro.backObjetivo', { objetivo: baron }))).toHaveLength(1);
  });

  it('placas a los 13:00 y primera torre exterior de tu calle', () => {
    expect(correr([estado({ tiempo: 770 }), estado({ tiempo: 775 }), estado({ tiempo: 781 })])).toContain(primera('voz.macro.placas'));
    const mid = ev('TurretKilled', 600, { estructura: 'Turret_T2_C_05_A' });
    expect(correr([estado({ tiempo: 590 }), estado({ tiempo: 595 }), estado({ tiempo: 601, eventos: [mid] })])).toContain(primera('voz.macro.rotar'));
    const bot = ev('TurretKilled', 600, { estructura: 'Turret_T2_R_03_A' });
    expect(correr([estado({ tiempo: 590 }), estado({ tiempo: 595 }), estado({ tiempo: 601, eventos: [bot] })])).not.toContain(primera('voz.macro.rotar'));
  });

  it('vida baja unos segundos, con oro y fuera de pelea: vuelve a base', () => {
    const r = correr([estado({ tiempo: 400 }), ...[401, 403, 406].map((tiempo) => estado({ tiempo, vida: 0.2, oro: 900 }))]);
    expect(r).toContain(primera('voz.macro.backVida'));
    const breve = correr([estado({ tiempo: 400 }), ...[401, 402].map((tiempo) => estado({ tiempo, vida: 0.2, oro: 900 }))]);
    expect(breve).not.toContain(primera('voz.macro.backVida'));
  });

  it('con la categoría apagada o fuera de la Grieta no dice nada de estrategia', () => {
    const muerto = con({ Zed: { muerto: true, reaparece: 20 } });
    const estados = [estado({ tiempo: 300 }), estado({ tiempo: 301 }), estado({ tiempo: 302, jugadores: muerto })];
    expect(correr(estados, solo('combate'))).toEqual([]);
    expect(correr(estados.map((e) => ({ ...e, modo: 'aram' as const })))).toEqual([]);
  });

  it('torres exteriores por su nombre oficial', () => {
    expect(esTorreExterior('Turret_T1_L_03_A')).toBe(true);
    expect(esTorreExterior('Turret_T2_C_05_A')).toBe(true);
    expect(esTorreExterior('Turret_T1_C_04_A')).toBe(false);
    expect(esTorreExterior('Turret_T2_R_02_A')).toBe(false);
  });
});
