import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { marcarCampamento, type MarcasJungla } from '../src/main/consejos/jungla';
import { cs10Tras, resumenOverlay } from '../src/main/consejos/motor';
import { DisparadorVoz } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { AjustesVoz, EstadoPartida, TipoVoz } from '../src/shared/tiposApp';

const objetos = { 3108: { name: 'Códice demoníaco', gold: { total: 1250 }, from: [] } } as unknown as DatosEstaticos['objetos'];
const build = { nucleo: [3108], botas: null, situacionales: [], ordenHabilidades: ['Q', 'E', 'W', 'Q'] } as unknown as Build;
const VOZ: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true };

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return { tiempo: 20, oro: 0, nivel: 1, campeon: 'Ahri', objetos: [], habilidades: { Q: 1, W: 0, E: 0, R: 0 }, eventos: [], ...p };
}

/** Pasa una secuencia de estados por el disparador y devuelve los textos dichos en cada uno. */
function correr(d: DisparadorVoz, estados: EstadoPartida[], o: { voz?: AjustesVoz; marcas?: MarcasJungla; jungla?: boolean } = {}) {
  let cs10: number | null = null;
  return estados.map((e) => {
    cs10 = cs10Tras(cs10, e);
    return d
      .procesar(
        { estado: e, overlay: resumenOverlay(e, build, 'MIDDLE', objetos, '', cs10), rol: 'MIDDLE', marcas: o.marcas ?? {}, jungla: o.jungla ?? false },
        o.voz ?? VOZ,
      )
      .map((f) => f.texto);
  });
}
/** Voz encendida solo para un tipo de frase. */
const solo = (tipo: TipoVoz): AjustesVoz => ({
  ...VOZ,
  tipos: Object.fromEntries(Object.keys(VOZ.tipos).map((k) => [k, k === tipo])) as AjustesVoz['tipos'],
});
const todos = (r: string[][]) => r.flat();

describe('disparadores de voz', () => {
  it('objetivo: a 60 s, a 30 s y al aparecer, una sola vez cada uno', () => {
    const d = new DisparadorVoz();
    const r = correr(d, [estado({ tiempo: 230 }), estado({ tiempo: 241 }), estado({ tiempo: 242 }), estado({ tiempo: 271 }), estado({ tiempo: 300 }), estado({ tiempo: 301 })]);
    expect(r).toEqual([[], ['El dragón aparece en un minuto'], [], ['El dragón aparece en 30 segundos'], ['El dragón ha aparecido'], []]);
  });

  it('con el tipo de dragón conocido lo dice; las larvas van en plural', () => {
    const d = new DisparadorVoz();
    const tres = [600, 900, 1200].map((tiempo, i) => ({ nombre: 'DragonKill', tiempo, dragon: ['Fire', 'Water', 'Earth'][i] }));
    const dragon = todos(correr(d, [estado({ tiempo: 1400, eventos: tres }), estado({ tiempo: 1441, eventos: tres })]));
    expect(dragon).toContain('El dragón de montaña aparece en un minuto');
    const larvas = todos(correr(new DisparadorVoz(), [estado({ tiempo: 410 }), estado({ tiempo: 421 }), estado({ tiempo: 480 })]));
    expect(larvas).toEqual(['Las larvas del Vacío aparecen en un minuto', 'Las larvas del Vacío han aparecido']);
  });

  it('cada reaparición vuelve a avisar (otra generación de muertes)', () => {
    const d = new DisparadorVoz();
    const muerto = [{ nombre: 'DragonKill', tiempo: 310, dragon: 'Fire' }];
    const r = todos(correr(d, [estado({ tiempo: 20 }), estado({ tiempo: 300 }), estado({ tiempo: 301 }), estado({ tiempo: 550, eventos: muerto }), estado({ tiempo: 551, eventos: muerto }), estado({ tiempo: 610, eventos: muerto })]));
    expect(r.filter((x) => x === 'El dragón ha aparecido')).toHaveLength(2);
  });

  it('«Puedes comprar X» al llegar el oro, una vez por objeto', () => {
    const d = new DisparadorVoz();
    const r = correr(d, [estado({ oro: 500 }), estado({ oro: 1300 }), estado({ oro: 1400 })], { voz: solo('compra') });
    expect(r).toEqual([[], ['Puedes comprar Códice demoníaco'], []]);
  });

  it('«Sube la Q» al subir de nivel', () => {
    const d = new DisparadorVoz();
    const r = correr(d, [estado(), estado({ nivel: 2 }), estado({ nivel: 2, habilidades: { Q: 1, W: 0, E: 1, R: 0 } }), estado({ nivel: 3, habilidades: { Q: 1, W: 0, E: 1, R: 0 } })], { voz: solo('habilidad') });
    expect(r).toEqual([[], ['Sube la E'], [], ['Sube la W']]);
  });

  it('CS: una vez a los 10:00 si va por debajo del 85 % del objetivo; nunca si llega', () => {
    const bajo = correr(new DisparadorVoz(), [estado({ tiempo: 590, cs: 50 }), estado({ tiempo: 601, cs: 60 }), estado({ tiempo: 640, cs: 61 })], { voz: solo('cs') });
    expect(todos(bajo)).toEqual(['Vas por debajo del objetivo de CS']);
    const bien = correr(new DisparadorVoz(), [estado({ tiempo: 20, cs: 0 }), estado({ tiempo: 601, cs: 70 })], { voz: solo('cs') });
    expect(todos(bien)).not.toContain('Vas por debajo del objetivo de CS');
  });

  it('guardián de control: como mucho una vez cada 5 minutos mientras falte', () => {
    const d = new DisparadorVoz();
    const sin = (tiempo: number) => estado({ tiempo, oro: 100, habilidades: { Q: 1, W: 0, E: 0, R: 0 } });
    const r = todos(correr(d, [estado(), sin(310), sin(320), sin(400), sin(610)])).filter((x) => x.includes('guardián'));
    expect(r).toEqual(['Compra un guardián de control', 'Compra un guardián de control']);
  });

  it('cambios de fase con el consejo del rol; la fase inicial no se dice', () => {
    const d = new DisparadorVoz();
    const r = todos(correr(d, [estado({ tiempo: 20 }), estado({ tiempo: 840 }), estado({ tiempo: 1500 })]));
    expect(r).not.toContain('Fase temprana: controla la oleada y busca oportunidades para moverte a los lados');
    expect(r).toContain('Fase media: agrupa con tu equipo para los objetivos');
    expect(r).toContain('Fase tardía: mantén la posición y no te adelantes sin visión');
    // Al reconectar en fase media tampoco se dice la fase en la que ya estás.
    expect(todos(correr(new DisparadorVoz(), [estado({ tiempo: 900 }), estado({ tiempo: 901 })]))).toEqual([]);
  });

  it('jungla: «<campamento> en 30 segundos» solo con el widget activo', () => {
    const marcas = marcarCampamento({}, 'gromp', 200);
    const r = correr(new DisparadorVoz(), [estado({ tiempo: 300 }), estado({ tiempo: 306 }), estado({ tiempo: 307 })], { marcas, jungla: true });
    expect(todos(r)).toContain('El Gromp en 30 segundos');
    expect(todos(r).filter((x) => x.includes('Gromp'))).toHaveLength(1);
    const apagado = correr(new DisparadorVoz(), [estado({ tiempo: 300 }), estado({ tiempo: 306 })], { marcas, jungla: false });
    expect(todos(apagado).some((x) => x.includes('Gromp'))).toBe(false);
  });

  it('voz apagada o tipo desactivado: no dice nada, pero tampoco lo acumula para luego', () => {
    const d = new DisparadorVoz();
    const apagada = { ...VOZ, activa: false };
    expect(todos(correr(d, [estado({ tiempo: 242 }), estado({ tiempo: 243, nivel: 2 })], { voz: apagada }))).toEqual([]);
    // Al encenderla no salen las frases que ya pasaron.
    expect(todos(correr(d, [estado({ tiempo: 244, nivel: 2 })]))).toEqual([]);
    const sinObjetivos = { ...VOZ, tipos: { ...VOZ.tipos, objetivo: false } };
    expect(todos(correr(new DisparadorVoz(), [estado({ tiempo: 20 }), estado({ tiempo: 241 })], { voz: sinObjetivos }))).not.toContain('El dragón aparece en un minuto');
  });

  it('al entrar a mitad de partida (reconexión) no suelta de golpe lo que ya estaba pasando', () => {
    const d = new DisparadorVoz();
    const r = correr(d, [estado({ tiempo: 900, oro: 2000, nivel: 2 }), estado({ tiempo: 901, oro: 2000, nivel: 2 })]);
    expect(todos(r)).toEqual([]);
  });

  it('las frases traen tipo, prioridad (objetivo antes que fase) y caducidad', () => {
    const d = new DisparadorVoz();
    const [primero] = [
      d.procesar(
        { estado: estado({ tiempo: 20 }), overlay: resumenOverlay(estado({ tiempo: 20 }), build, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false },
        VOZ,
      ),
    ];
    expect(primero).toEqual([]);
    const f = d.procesar(
      { estado: estado({ tiempo: 300 }), overlay: resumenOverlay(estado({ tiempo: 300 }), build, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false },
      VOZ,
    );
    const ya = f.find((x) => x.tipo === 'objetivo')!;
    const fase = d.procesar(
      { estado: estado({ tiempo: 840 }), overlay: resumenOverlay(estado({ tiempo: 840 }), build, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false },
      VOZ,
    ).find((x) => x.tipo === 'fase')!;
    expect(ya.prioridad).toBeLessThan(fase.prioridad);
    expect(ya.caducaMs).toBeGreaterThan(0);
    expect(ya.clave).toMatch(/^objetivo:dragon/);
  });

  it('reiniciar() olvida lo dicho (partida nueva)', () => {
    const d = new DisparadorVoz();
    correr(d, [estado({ tiempo: 20 }), estado({ oro: 1300 })]);
    d.reiniciar();
    expect(todos(correr(d, [estado({ tiempo: 20, oro: 1300 })]))).toContain('Puedes comprar Códice demoníaco');
  });

  it('fuera de la Grieta solo se dicen la compra y la habilidad (sin objetivos, visión ni fase)', () => {
    const d = new DisparadorVoz();
    const r = todos(correr(d, [estado({ modo: 'aram', tiempo: 20 }), estado({ modo: 'aram', tiempo: 300, nivel: 2, oro: 1300 }), estado({ modo: 'aram', tiempo: 900, nivel: 2, oro: 1300 })]));
    expect(r.some((x) => /dragón|larvas|guardián|control/i.test(x))).toBe(false);
    expect(r.length).toBe(2);
  });
});
