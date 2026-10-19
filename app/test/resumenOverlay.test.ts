import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { resumenOverlay } from '../src/main/consejos/motor';
import { CS_OBJETIVO_POR_MINUTO } from '../src/main/consejos/objetivos';
import type { EstadoPartida } from '../src/shared/tiposApp';
import type { DatosEstaticos } from '../src/main/datos/estaticos';

const objetos = {
  3108: { name: 'Códice demoníaco', gold: { total: 1250, purchasable: true }, from: ['1052', '1026'] },
  1052: { name: 'Tomo amplificador', gold: { total: 435, purchasable: true } },
  1026: { name: 'Vara explosiva', gold: { total: 850, purchasable: true } },
} as unknown as DatosEstaticos['objetos'];

const build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  nucleo: [3108],
  botas: null,
  situacionales: [],
  ordenHabilidades: ['Q', 'E', 'W', 'Q', 'Q', 'R'],
} as unknown as Build;

function estado(parcial: Partial<EstadoPartida> = {}): EstadoPartida {
  return { tiempo: 100, oro: 0, nivel: 1, campeon: 'Ahri', objetos: [], habilidades: { Q: 1, W: 0, E: 0, R: 0 }, eventos: [], ...parcial };
}
const dragon = (tiempo: number, tipo = 'Fire', equipo?: 'ORDER' | 'CHAOS') => ({ nombre: 'DragonKill', tiempo, dragon: tipo, equipo });
const resumen = (e: EstadoPartida, b: Build | null = build, rol: Parameters<typeof resumenOverlay>[2] = 'MIDDLE') =>
  resumenOverlay(e, b, rol, objetos, '16.20.1');
const obj = (e: EstadoPartida, id: string) => resumen(e).objetivos.find((o) => o.id === id);

describe('resumenOverlay', () => {
  it('al empezar: solo épicos (larvas, dragón, Heraldo, Barón) con su cuenta atrás; sin campamentos ni Escarabajo', () => {
    const r = resumen(estado({ tiempo: 30 }));
    expect(r.tiempo).toBe(30);
    expect(r.version).toBe('16.20.1');
    expect(r.objetivos).toEqual([
      { id: 'larvas', nombre: 'Larvas', subtipo: null, aparece: 450, disponible: false },
      { id: 'dragon', nombre: 'Dragón', subtipo: null, aparece: 270, disponible: false },
      { id: 'heraldo', nombre: 'Heraldo', subtipo: null, aparece: 870, disponible: false },
      { id: 'baron', nombre: 'Barón', subtipo: null, aparece: 1170, disponible: false },
    ]);
  });

  it('un objetivo ya aparecido está disponible y sin cuenta atrás', () => {
    expect(obj(estado({ tiempo: 330 }), 'dragon')).toMatchObject({ aparece: null, disponible: true });
  });

  it('tipo del dragón: desconocido con 0–2 dragones; el terreno de la Grieta lo dice en cuanto cambia', () => {
    expect(obj(estado({ tiempo: 700, eventos: [dragon(300, 'Fire'), dragon(600, 'Water')] }), 'dragon')?.subtipo).toBeNull();
    expect(obj(estado({ tiempo: 700, eventos: [dragon(300), dragon(600, 'Water')], terreno: 'Mountain' }), 'dragon')?.subtipo).toBe('Montaña');
  });

  it('sin terreno, a partir del tercer dragón el siguiente es del mismo tipo que el tercero (DragonType)', () => {
    const e = estado({ tiempo: 1000, eventos: [dragon(300, 'Fire'), dragon(600, 'Water'), dragon(900, 'Chemtech')] });
    expect(obj(e, 'dragon')?.subtipo).toBe('Quimtech');
  });

  it('el Anciano no lleva subtipo y sustituye al dragón tras el alma', () => {
    const alma = [dragon(300, 'Air', 'ORDER'), dragon(600, 'Fire', 'ORDER'), dragon(900, 'Hextech', 'ORDER'), dragon(1200, 'Hextech', 'ORDER')];
    const r = resumen(estado({ tiempo: 1300, eventos: alma }));
    expect(r.objetivos.find((o) => o.id === 'dragon')).toBeUndefined();
    expect(r.objetivos.find((o) => o.id === 'anciano')).toEqual({ id: 'anciano', nombre: 'Anciano', subtipo: null, aparece: 260, disponible: false });
  });

  it('larvas y Heraldo desaparecen al irse del mapa; el Barón reaparece a los 6 min', () => {
    expect(obj(estado({ tiempo: 885 }), 'larvas')).toBeUndefined();
    expect(obj(estado({ tiempo: 1000, eventos: [{ nombre: 'HeraldKill', tiempo: 990 }] }), 'heraldo')).toBeUndefined();
    expect(obj(estado({ tiempo: 1600, eventos: [{ nombre: 'BaronKill', tiempo: 1500 }] }), 'baron')).toMatchObject({ aparece: 260 });
  });

  it('próxima habilidad solo cuando hay un punto libre', () => {
    // Nivel 1 con 1 punto gastado: no hay punto libre.
    expect(resumen(estado({ nivel: 1 })).proximaHabilidad).toBeNull();
    expect(resumen(estado({ nivel: 2 })).proximaHabilidad).toBe('E');
    expect(resumen(estado({ nivel: 6, habilidades: { Q: 3, W: 1, E: 1, R: 0 } })).proximaHabilidad).toBe('R');
    expect(resumen(estado({ nivel: 2 }), null).proximaHabilidad).toBeNull();
    // Orden de la build agotado.
    expect(resumen(estado({ nivel: 7, habilidades: { Q: 3, W: 1, E: 1, R: 1 } })).proximaHabilidad).toBeNull();
  });

  it('próxima compra: coste restante descontando componentes y si llega el oro', () => {
    expect(resumen(estado({ oro: 400, objetos: [1052] })).compra).toEqual({ id: 3108, nombre: 'Códice demoníaco', coste: 815, puedeComprar: false });
    expect(resumen(estado({ oro: 815, objetos: [1052] })).compra?.puedeComprar).toBe(true);
    expect(resumen(estado({ oro: 9999 }), null).compra).toBeNull();
  });

  it('las compras saltan los objetos que no están en los datos', () => {
    const b = { ...build, nucleo: [9999, 3108] } as Build;
    expect(resumen(estado(), b).compra?.id).toBe(3108);
  });

  it('objetivo de CS por minuto según el rol', () => {
    expect(CS_OBJETIVO_POR_MINUTO).toEqual({ TOP: 7, JUNGLE: 6, MIDDLE: 7.5, BOTTOM: 8, UTILITY: 1.5 });
    expect(resumen(estado({ cs: 10 }), build, 'BOTTOM').cs?.objetivoPorMinuto).toBe(8);
  });

  it('CS por minuto con un decimal y CS@10 de la memoria del orquestador', () => {
    const r = resumenOverlay(estado({ tiempo: 450, cs: 52 }), build, 'MIDDLE', objetos, '', null);
    expect(r.cs).toEqual({ cs: 52, porMinuto: 6.9, objetivoPorMinuto: 7.5, cs10: null });
    expect(resumenOverlay(estado({ tiempo: 700, cs: 80 }), build, 'MIDDLE', objetos, '', 71).cs?.cs10).toBe(71);
  });

  it('sin creepScore no hay widget de CS; a los 0 s el ritmo es 0', () => {
    expect(resumen(estado()).cs).toBeNull();
    expect(resumen(estado({ tiempo: 0, cs: 0 })).cs?.porMinuto).toBe(0);
  });
});

describe('cs10Tras', () => {
  it('guarda el CS del primer estado con 600 s o más y no lo cambia después', async () => {
    const { cs10Tras } = await import('../src/main/consejos/motor');
    expect(cs10Tras(null, estado({ tiempo: 599, cs: 70 }))).toBeNull();
    expect(cs10Tras(null, estado({ tiempo: 601, cs: 72 }))).toBe(72);
    expect(cs10Tras(72, estado({ tiempo: 660, cs: 80 }))).toBe(72);
    expect(cs10Tras(null, estado({ tiempo: 620 }))).toBeNull();
  });

  it('al reconectar después de las 10:30 no hay CS@10 (sería el CS de otro minuto)', async () => {
    const { cs10Tras } = await import('../src/main/consejos/motor');
    expect(cs10Tras(null, estado({ tiempo: 629, cs: 80 }))).toBe(80);
    expect(cs10Tras(null, estado({ tiempo: 630, cs: 81 }))).toBeNull();
    expect(cs10Tras(null, estado({ tiempo: 900, cs: 120 }))).toBeNull();
  });
});
