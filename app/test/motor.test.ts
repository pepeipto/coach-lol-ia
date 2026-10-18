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
    const r = generarIndicaciones(estado({ tiempo: 850, eventos }), null, 'MIDDLE', objetos).find(
      (i) => i.tipo === 'objetivo',
    );
    expect(r?.clave).toBe('objetivo:dragon:pronto:900');
    expect(r?.texto).toBe('El dragón aparece en 50 s');
    const lejos = generarIndicaciones(estado({ tiempo: 700, eventos }), null, 'MIDDLE', objetos);
    expect(lejos.some((i) => i.tipo === 'objetivo')).toBe(false);
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
});
