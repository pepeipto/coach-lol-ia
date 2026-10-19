import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { generarIndicaciones, resumenPanel } from '../src/main/consejos/motor';
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
    expect(resumenPanel(e, build, objetos).proximaCompra).toBe('Códice demoníaco (0 de oro)');
    const e2 = estado({ oro: 400, objetos: [1052] });
    expect(resumenPanel(e2, build, objetos).proximaCompra).toBe('Códice demoníaco (815 de oro)');
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
    expect(resumenPanel(e, null, objetos).proximaCompra).toBeNull();
  });

  it('el panel muestra el objetivo más cercano, aunque falte más de 60 s', () => {
    expect(resumenPanel(estado({ tiempo: 100 }), build, objetos).proximoObjetivo).toBe('El dragón aparece en 200 s');
    expect(resumenPanel(estado({ tiempo: 330 }), build, objetos).proximoObjetivo).toBe('El dragón está disponible');
  });

  it('las compras saltan los objetos que no están en los datos', () => {
    const b = { ...build, nucleo: [9999, 3108] } as Build;
    expect(resumenPanel(estado(), b, objetos).proximaCompra).toBe('Códice demoníaco (1250 de oro)');
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

  describe('panel: próxima habilidad y objetivos (parche 26.20)', () => {
    const ids = (e: EstadoPartida) => resumenPanel(e, build, objetos).objetivos.map((o) => o.id);
    const objetivo = (e: EstadoPartida, id: string) => resumenPanel(e, build, objetos).objetivos.find((o) => o.id === id);
    const dragon = (tiempo: number, equipo?: 'ORDER' | 'CHAOS', tipo = 'Fire') => ({ nombre: 'DragonKill', tiempo, dragon: tipo, equipo });

    it('próxima habilidad: la del orden de la build para el siguiente punto, aunque aún no haya punto libre', () => {
      expect(resumenPanel(estado({ nivel: 1, habilidades: { Q: 1, W: 0, E: 0, R: 0 } }), build, objetos).proximaHabilidad).toBe('E');
      expect(resumenPanel(estado({ nivel: 6, habilidades: { Q: 3, W: 1, E: 1, R: 0 } }), build, objetos).proximaHabilidad).toBe('R');
      // Orden completo o sin build: no hay próxima habilidad.
      expect(resumenPanel(estado({ habilidades: { Q: 3, W: 1, E: 1, R: 1 } }), build, objetos).proximaHabilidad).toBeNull();
      expect(resumenPanel(estado(), null, objetos).proximaHabilidad).toBeNull();
    });

    it('compraId y versión de Data Dragon para el icono de la próxima compra', () => {
      const p = resumenPanel(estado(), build, objetos, '16.20.1');
      expect(p.compraId).toBe(3108);
      expect(p.version).toBe('16.20.1');
      expect(resumenPanel(estado(), null, objetos, '16.20.1').compraId).toBeNull();
    });

    it('al empezar: campamentos (0:55), Escarabajo (2:55), larvas (8:00), dragón (5:00), Heraldo (15:00) y Barón (20:00); sin Atakhan', () => {
      const p = resumenPanel(estado({ tiempo: 30 }), build, objetos);
      expect(p.objetivos).toEqual([
        { id: 'campamentos', nombre: 'Campamentos', aparece: 25, disponible: false },
        { id: 'escarabajo', nombre: 'Escarabajo', aparece: 145, disponible: false },
        { id: 'larvas', nombre: 'Larvas', aparece: 450, disponible: false },
        { id: 'dragon', nombre: 'Dragón', aparece: 270, disponible: false },
        { id: 'heraldo', nombre: 'Heraldo', aparece: 870, disponible: false },
        { id: 'baron', nombre: 'Barón', aparece: 1170, disponible: false },
      ]);
    });

    it('los campamentos y el Escarabajo solo se muestran hasta su primera aparición (nada de reapariciones)', () => {
      expect(ids(estado({ tiempo: 55 }))).not.toContain('campamentos');
      expect(ids(estado({ tiempo: 100 }))).toContain('escarabajo');
      expect(ids(estado({ tiempo: 175 }))).not.toContain('escarabajo');
    });

    it('larvas: disponibles entre 8:00 y 14:45; desaparecen antes si caen las 3 (HordeKill)', () => {
      expect(objetivo(estado({ tiempo: 500 }), 'larvas')).toEqual({ id: 'larvas', nombre: 'Larvas', aparece: null, disponible: true });
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
      expect(objetivo(e, 'baron')).toEqual({ id: 'baron', nombre: 'Barón', aparece: 260, disponible: false });
      expect(resumenPanel(e, build, objetos).proximoObjetivo).not.toBe('El Barón está disponible');
    });

    it('el Dragón Anciano sale 6 min después del cuarto dragón de un equipo (alma) y reaparece a los 6 min', () => {
      const alma = [dragon(300, 'ORDER'), dragon(600, 'CHAOS'), dragon(900, 'ORDER'), dragon(1200, 'ORDER'), dragon(1500, 'ORDER')];
      const e = estado({ tiempo: 1600, eventos: alma });
      expect(ids(e)).not.toContain('dragon');
      expect(objetivo(e, 'anciano')).toEqual({ id: 'anciano', nombre: 'Anciano', aparece: 260, disponible: false });
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

    it('los campamentos y el Escarabajo no generan avisos ni son el «próximo objetivo»', () => {
      const r = generarIndicaciones(estado({ tiempo: 20 }), null, 'MIDDLE', objetos);
      expect(r.some((i) => /campamentos|escarabajo/.test(i.clave))).toBe(false);
      expect(resumenPanel(estado({ tiempo: 20 }), build, objetos).proximoObjetivo).toBe('El dragón aparece en 280 s');
    });
  });
});
