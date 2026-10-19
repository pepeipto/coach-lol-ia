import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { generarIndicaciones, resumenOverlay } from '../src/main/consejos/motor';

const resumir = (e: EstadoPartida, b: Build | null, o: DatosEstaticos['objetos']) => resumenOverlay(e, b, 'MIDDLE', o, '');
import type { EstadoPartida } from '../src/shared/tiposApp';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import es from '../src/shared/i18n/es.json';

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
  return {
    tiempo: 100,
    oro: 0,
    nivel: 1,
    campeon: 'Ahri',
    objetos: [],
    habilidades: { Q: 1, W: 0, E: 0, R: 0 },
    eventos: [],
    ...parcial,
  };
}

const textos = (e: EstadoPartida, b: Build | null = build) =>
  generarIndicaciones(e, b, 'MIDDLE', objetos).map((i) => i.texto);

describe('motor de consejos', () => {
  it('1250 de oro con Códice demoníaco pendiente (y sus componentes) → aviso de compra con el texto exacto', () => {
    const r = generarIndicaciones(estado({ oro: 1250 }), build, 'MIDDLE', objetos);
    expect(r[0]).toEqual({
      tipo: 'compra',
      clave: 'compra:3108',
      texto: 'Tienes 1250 de oro: ya puedes comprar Códice demoníaco',
    });
  });

  it('descuenta del coste los componentes que ya se tienen', () => {
    const e = estado({ oro: 400, objetos: [1052, 1026] });
    expect(resumir(e, build, objetos).compra).toMatchObject({ nombre: 'Códice demoníaco', coste: 0 });
    const e2 = estado({ oro: 400, objetos: [1052] });
    expect(resumir(e2, build, objetos).compra).toMatchObject({ nombre: 'Códice demoníaco', coste: 815 });
    expect(textos(e2).some((x) => x.includes('comprar'))).toBe(false);
    expect(textos(estado({ oro: 815, objetos: [1052] })).some((x) => x.includes('comprar'))).toBe(true);
  });

  it('nivel 4 con 3 puntos y orden Q,E,W,Q → "Nivel 4: sube la Q"', () => {
    const b = { ...build, ordenHabilidades: ['Q', 'E', 'W', 'Q'] } as Build;
    const e = estado({ nivel: 4, habilidades: { Q: 1, W: 1, E: 1, R: 0 } });
    const r = generarIndicaciones(e, b, 'MIDDLE', objetos).find((i) => i.tipo === 'habilidad');
    expect(r).toEqual({ tipo: 'habilidad', clave: 'habilidad:4', texto: 'Nivel 4: sube la Q' });
  });

  it('minuto 4:00 → "El dragón aparece en 60 s"; 5:30 sin DragonKill → "El dragón está disponible"', () => {
    const a = generarIndicaciones(estado({ tiempo: 240 }), null, 'MIDDLE', objetos).find((i) => i.tipo === 'objetivo');
    expect(a).toEqual({ tipo: 'objetivo', clave: 'objetivo:dragon:pronto:300', texto: 'El dragón aparece en 60 s' });
    const b = generarIndicaciones(estado({ tiempo: 330 }), null, 'MIDDLE', objetos).find((i) => i.tipo === 'objetivo');
    expect(b).toEqual({ tipo: 'objetivo', clave: 'objetivo:dragon:disp:300', texto: 'El dragón está disponible' });
  });

  it('DragonKill en 600 → siguiente dragón en 900', () => {
    const eventos = [{ nombre: 'DragonKill', tiempo: 600 }];
    // A las 14:10 también están las larvas: se busca el aviso del dragón.
    const r = generarIndicaciones(estado({ tiempo: 850, eventos }), null, 'MIDDLE', objetos).find((i) =>
      i.clave.startsWith('objetivo:dragon'),
    );
    expect(r?.clave).toBe('objetivo:dragon:pronto:900');
    expect(r?.texto).toBe('El dragón aparece en 50 s');
    const lejos = generarIndicaciones(estado({ tiempo: 700, eventos }), null, 'MIDDLE', objetos);
    expect(lejos.some((i) => i.clave.startsWith('objetivo:dragon'))).toBe(false);
  });

  it('el Heraldo no reaparece tras HeraldKill', () => {
    const eventos = [{ nombre: 'HeraldKill', tiempo: 1000 }];
    const r = generarIndicaciones(estado({ tiempo: 1900, eventos }), null, 'MIDDLE', objetos);
    expect(r.some((i) => i.clave.startsWith('objetivo:heraldo'))).toBe(false);
    const sin = generarIndicaciones(estado({ tiempo: 1000 }), null, 'MIDDLE', objetos);
    expect(sin.some((i) => i.clave === 'objetivo:heraldo:disp:900')).toBe(true);
  });

  it('visión: a los 6 minutos sin guardián de control y con 100 de oro → aviso', () => {
    const r = generarIndicaciones(estado({ tiempo: 360, oro: 100 }), null, 'MIDDLE', objetos);
    expect(r).toContainEqual({ tipo: 'vision', clave: 'vision', texto: 'No llevas guardianes de control' });
    const con = generarIndicaciones(estado({ tiempo: 360, oro: 100, objetos: [2055] }), null, 'MIDDLE', objetos);
    expect(con.some((i) => i.tipo === 'vision')).toBe(false);
  });

  it('fase media a los 15 minutos para MIDDLE', () => {
    const r = generarIndicaciones(estado({ tiempo: 900 }), null, 'MIDDLE', objetos).find((i) => i.tipo === 'fase');
    expect(r).toEqual({ tipo: 'fase', clave: 'fase:media', texto: es['fase.MIDDLE.media'] });
  });

  it('sin build: no hay avisos de compra ni de habilidad, pero sí de objetivos, visión y fase', () => {
    const e = estado({ tiempo: 330, oro: 2000, nivel: 5 });
    const tipos = generarIndicaciones(e, null, 'MIDDLE', objetos).map((i) => i.tipo);
    expect(tipos).not.toContain('compra');
    expect(tipos).not.toContain('habilidad');
    expect(tipos).toEqual(expect.arrayContaining(['objetivo', 'vision', 'fase']));
    expect(resumir(e, null, objetos).compra).toBeNull();
  });

  it('las compras saltan los objetos que no están en los datos', () => {
    const b = { ...build, nucleo: [9999, 3108] } as Build;
    expect(resumir(estado(), b, objetos).compra).toMatchObject({ nombre: 'Códice demoníaco', coste: 1250 });
  });

  it('ninguna indicación menciona enemigos (todos los textos salen de las claves aviso.*, objetivo.* y fase.*)', () => {
    const e = estado({ tiempo: 1250, oro: 3000, nivel: 6 });
    const plantillas = Object.entries(es)
      .filter(([k]) => /^(aviso|objetivo|fase)\./.test(k))
      .map(([, v]) => v);
    const permitidos = plantillas.map(
      (p) => new RegExp('^' + p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+') + '$'),
    );
    const r = generarIndicaciones(e, build, 'MIDDLE', objetos);
    expect(r.length).toBeGreaterThan(3);
    for (const i of r) {
      expect(permitidos.some((re) => re.test(i.texto))).toBe(true);
      expect(i.texto.toLowerCase()).not.toMatch(/enemig|rival/);
    }
  });

  describe('objetivos del overlay (parche 26.20)', () => {
    const ids = (e: EstadoPartida) => resumir(e, build, objetos).objetivos.map((o) => o.id);
    const objetivo = (e: EstadoPartida, id: string) => resumir(e, build, objetos).objetivos.find((o) => o.id === id);
    const dragon = (tiempo: number, equipo?: 'ORDER' | 'CHAOS', tipo = 'Fire') => ({ nombre: 'DragonKill', tiempo, dragon: tipo, equipo });

    it('la barra de objetivos no incluye campamentos ni Escarabajo (son del widget de la jungla)', () => {
      expect(ids(estado({ tiempo: 20 }))).not.toContain('campamentos');
      expect(ids(estado({ tiempo: 100 }))).not.toContain('escarabajo');
    });

    it('larvas: disponibles entre 8:00 y 14:45; desaparecen antes si caen las 3 (HordeKill)', () => {
      expect(objetivo(estado({ tiempo: 500 }), 'larvas')).toEqual({ id: 'larvas', nombre: 'Larvas', subtipo: null, aparece: null, disponible: true });
      expect(ids(estado({ tiempo: 885 }))).not.toContain('larvas');
      const dos = [{ nombre: 'HordeKill', tiempo: 520 }, { nombre: 'HordeKill', tiempo: 525 }];
      expect(ids(estado({ tiempo: 530, eventos: dos }))).toContain('larvas');
      const tres = [...dos, { nombre: 'HordeKill', tiempo: 528 }];
      expect(ids(estado({ tiempo: 530, eventos: tres }))).not.toContain('larvas');
    });

    it('Heraldo: aparece a las 15:00 y se va a las 19:45 o al morir (no reaparece)', () => {
      expect(objetivo(estado({ tiempo: 1000 }), 'heraldo')).toMatchObject({ aparece: null, disponible: true });
      expect(ids(estado({ tiempo: 1185 }))).not.toContain('heraldo');
      expect(ids(estado({ tiempo: 1000, eventos: [{ nombre: 'HeraldKill', tiempo: 990 }] }))).not.toContain('heraldo');
    });

    it('el Barón reaparece a los 6 min', () => {
      const e = estado({ tiempo: 1600, eventos: [{ nombre: 'BaronKill', tiempo: 1500 }] });
      expect(objetivo(e, 'baron')).toEqual({ id: 'baron', nombre: 'Barón', subtipo: null, aparece: 260, disponible: false });
    });

    it('el Dragón Anciano sale 6 min después del cuarto dragón de un equipo (alma) y reaparece a los 6 min', () => {
      const alma = [dragon(300, 'ORDER'), dragon(600, 'CHAOS'), dragon(900, 'ORDER'), dragon(1200, 'ORDER'), dragon(1500, 'ORDER')];
      const e = estado({ tiempo: 1600, eventos: alma });
      expect(ids(e)).not.toContain('dragon');
      expect(objetivo(e, 'anciano')).toEqual({ id: 'anciano', nombre: 'Anciano', subtipo: null, aparece: 260, disponible: false });
      const tras = estado({ tiempo: 2000, eventos: [...alma, dragon(1900, 'CHAOS', 'Elder')] });
      expect(objetivo(tras, 'anciano')).toMatchObject({ aparece: 260, disponible: false });
      // Aviso con su nombre completo.
      const aviso = generarIndicaciones(estado({ tiempo: 1820, eventos: alma }), null, 'MIDDLE', objetos).find((i) =>
        i.clave.startsWith('objetivo:anciano'),
      );
      expect(aviso?.texto).toBe('El Dragón Anciano aparece en 40 s');
    });

    it('cuatro dragones repartidos (2 y 2) no dan alma: sigue el dragón elemental', () => {
      const e = estado({ tiempo: 1300, eventos: [dragon(300, 'ORDER'), dragon(600, 'CHAOS'), dragon(900, 'ORDER'), dragon(1200, 'CHAOS')] });
      expect(objetivo(e, 'dragon')).toMatchObject({ aparece: 200 });
      expect(ids(e)).not.toContain('anciano');
    });

    it('un DragonKill de tipo Elder basta para saber que el foso ya es del Anciano, aunque falte el equipo', () => {
      const e = estado({ tiempo: 2100, eventos: [dragon(2000, undefined, 'Elder')] });
      expect(objetivo(e, 'anciano')).toMatchObject({ aparece: 260 });
      expect(ids(e)).not.toContain('dragon');
    });

    it('sin saber los equipos, el 7.º dragón implica alma (4 de un equipo seguro): el foso pasa al Anciano', () => {
      const siete = [300, 600, 900, 1200, 1500, 1800, 2100].map((t) => dragon(t));
      const e = estado({ tiempo: 2200, eventos: siete });
      expect(ids(e)).not.toContain('dragon');
      expect(objetivo(e, 'anciano')).toMatchObject({ aparece: 2100 + 360 - 2200 });
      const seis = estado({ tiempo: 1900, eventos: siete.slice(0, 6) });
      expect(ids(seis)).toContain('dragon');
    });

    it('las larvas avisan en plural', () => {
      const a = generarIndicaciones(estado({ tiempo: 430 }), null, 'MIDDLE', objetos).find((i) => i.clave.startsWith('objetivo:larvas'));
      expect(a?.texto).toBe('Las larvas del Vacío aparecen en 50 s');
      const b = generarIndicaciones(estado({ tiempo: 500 }), null, 'MIDDLE', objetos).find((i) => i.clave.startsWith('objetivo:larvas'));
      expect(b?.texto).toBe('Las larvas del Vacío están disponibles');
    });

    it('los campamentos y el Escarabajo no generan avisos', () => {
      const r = generarIndicaciones(estado({ tiempo: 20 }), null, 'MIDDLE', objetos);
      expect(r.some((i) => /campamentos|escarabajo/.test(i.clave))).toBe(false);
    });
  });
});

describe('motor de consejos fuera de la Grieta', () => {
  it('en ARAM solo hay avisos de compra y de habilidad (sin objetivos, visión ni fase)', () => {
    const e = estado({ modo: 'aram', tiempo: 1500, oro: 1300, nivel: 2 });
    const tipos = generarIndicaciones(e, build, 'MIDDLE', objetos).map((i) => i.tipo);
    expect(tipos).toEqual(['compra', 'habilidad']);
    expect(generarIndicaciones(estado({ tiempo: 1500, oro: 1300, nivel: 2 }), build, 'MIDDLE', objetos).map((i) => i.tipo)).toContain('fase');
  });

  it('en Arena el overlay no tiene objetivos, ni CS, ni flecha de habilidad, y sí el KDA con su media', () => {
    const conKda = { ...build, kda: { asesinatos: 5, muertes: 3, asistencias: 6, ratio: 3.67 } } as Build;
    const r = resumir(estado({ modo: 'arena', tiempo: 1500, nivel: 2, cs: 40, kda: { k: 2, d: 1, a: 3 } }), conKda, objetos);
    expect(r.objetivos).toEqual([]);
    expect(r.proximaHabilidad).toBeNull();
    expect(r.modo).toBe('arena');
    expect(r.widgets).toEqual({ objetivos: false, habilidad: false, cs: true, compra: true, jungla: false, avisos: true });
    expect(r.rendimiento?.cs).toBeNull();
    expect(r.rendimiento?.kda).toEqual({ k: 2, d: 1, a: 3, ratio: 5 });
    expect(r.rendimiento?.kdaMedio?.ratio).toBe(3.67);
  });

  it('en ARAM queda la flecha de habilidad y el KDA, sin objetivos ni CS', () => {
    const r = resumir(estado({ modo: 'aram', tiempo: 1500, nivel: 2, cs: 40, kda: { k: 1, d: 0, a: 4 } }), build, objetos);
    expect(r.objetivos).toEqual([]);
    expect(r.proximaHabilidad).toBe('E');
    expect(r.widgets).toMatchObject({ objetivos: false, habilidad: true, cs: true, jungla: false });
    expect(r.rendimiento).toMatchObject({ cs: null, kda: { k: 1, d: 0, a: 4, ratio: 5 } });
  });

  it('fuera de la Grieta sin KDA no hay rendimiento; en la Grieta siguen los objetivos y el CS', () => {
    expect(resumir(estado({ modo: 'caos', tiempo: 1500, cs: 40 }), build, objetos).rendimiento).toBeNull();
    const g = resumir(estado({ tiempo: 1500, cs: 120 }), build, objetos);
    expect(g.objetivos.length).toBeGreaterThan(0);
    expect(g.rendimiento?.cs?.cs).toBe(120);
    expect(g.modo).toBe('clasificatoria');
    expect(Object.values(g.widgets).every(Boolean)).toBe(true);
  });
});
