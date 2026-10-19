import { describe, expect, it } from 'vitest';
import {
  AVISO_JUNGLA_ANTES,
  CAMPAMENTOS_JUNGLA,
  estadoJungla,
  marcarCampamento,
  type MarcasJungla,
} from '../src/main/consejos/jungla';
import es from '../src/shared/i18n/es.json';

const camp = (marcas: MarcasJungla, tiempo: number, id: string, equipo?: 'ORDER' | 'CHAOS') =>
  estadoJungla(marcas, tiempo, equipo).campamentos.find((c) => c.id === id)!;

describe('temporizadores manuales de la jungla', () => {
  it('solo tus campamentos y los dos Escarabajos: ni un campamento del rival', () => {
    expect(CAMPAMENTOS_JUNGLA.map((c) => c.id)).toEqual(['azul', 'gromp', 'lobos', 'aviar', 'rojo', 'krugs', 'escarabajoArriba', 'escarabajoAbajo']);
    const ids = estadoJungla({}, 0, 'ORDER').campamentos.map((c) => c.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) expect(id).not.toMatch(/enemig|rival/i);
    // Los textos de la jungla tampoco hablan del rival.
    for (const [k, v] of Object.entries(es)) if (k.startsWith('jungla.')) expect(v.toLowerCase()).not.toMatch(/enemig|rival/);
  });

  it('tiempos del parche: primera aparición y reaparición', () => {
    const t = Object.fromEntries(CAMPAMENTOS_JUNGLA.map((c) => [c.id, [c.aparece, c.reaparece]]));
    expect(t).toEqual({
      azul: [55, 300],
      rojo: [55, 300],
      lobos: [55, 135],
      aviar: [55, 135],
      gromp: [67, 135],
      krugs: [67, 135],
      escarabajoArriba: [175, 150],
      escarabajoAbajo: [175, 150],
    });
  });

  it('desde el inicio cuenta hasta la primera aparición; luego está disponible', () => {
    expect(camp({}, 30, 'azul')).toMatchObject({ aparece: 25, disponible: false, marcado: false });
    expect(camp({}, 30, 'gromp')).toMatchObject({ aparece: 37 });
    expect(camp({}, 30, 'escarabajoAbajo')).toMatchObject({ aparece: 145 });
    expect(camp({}, 70, 'gromp')).toMatchObject({ aparece: null, disponible: true });
  });

  it('marcar un campamento cuenta su reaparición desde ese momento', () => {
    const m = marcarCampamento({}, 'rojo', 100.4);
    expect(camp(m, 160, 'rojo')).toMatchObject({ aparece: 241, disponible: false, marcado: true });
    expect(camp(m, 400.4, 'rojo')).toMatchObject({ aparece: null, disponible: true, marcado: false });
    const k = marcarCampamento({}, 'krugs', 200);
    expect(camp(k, 334.2, 'krugs').aparece).toBe(1);
  });

  it('marcar otra vez un campamento que está reapareciendo cancela la marca (corrige un clic por error)', () => {
    const m = marcarCampamento({}, 'lobos', 100);
    const sin = marcarCampamento(m, 'lobos', 120);
    expect(sin.lobos).toBeUndefined();
    // Ya reaparecido: marcarlo de nuevo empieza otra cuenta.
    const otra = marcarCampamento(m, 'lobos', 300);
    expect(otra.lobos).toBe(300);
  });

  it('tu lado (ORDER = azul) decide qué campamentos están arriba y cuáles abajo', () => {
    const zona = (equipo: 'ORDER' | 'CHAOS', id: string) => camp({}, 0, id, equipo).zona;
    expect(estadoJungla({}, 0, 'ORDER').lado).toBe('azul');
    expect(estadoJungla({}, 0, 'CHAOS').lado).toBe('rojo');
    expect([zona('ORDER', 'azul'), zona('ORDER', 'gromp'), zona('ORDER', 'rojo'), zona('ORDER', 'krugs')]).toEqual(['arriba', 'arriba', 'abajo', 'abajo']);
    expect([zona('CHAOS', 'azul'), zona('CHAOS', 'gromp'), zona('CHAOS', 'rojo'), zona('CHAOS', 'krugs')]).toEqual(['abajo', 'abajo', 'arriba', 'arriba']);
    expect([zona('CHAOS', 'escarabajoArriba'), zona('CHAOS', 'escarabajoAbajo')]).toEqual(['arriba', 'abajo']);
  });

  it('el aviso de voz se da 30 s antes', () => {
    expect(AVISO_JUNGLA_ANTES).toBe(30);
  });
});

describe('posición de cada campamento en el minimapa', () => {
  it('lado azul: los campamentos del cuadrante de abajo a la izquierda, con y hacia abajo (0 arriba, 1 abajo)', async () => {
    const { posicionMinimapa, TAMANO_MAPA } = await import('../src/shared/jungla');
    expect(TAMANO_MAPA).toBe(14870);
    const azul = posicionMinimapa('azul', 'azul');
    expect(azul.x).toBeCloseTo(3821 / 14870, 3);
    expect(azul.y).toBeCloseTo(1 - 8101 / 14870, 3);
    // Arriba de mid (y del mapa > x) quedan el azul, el Gromp y los lobos; abajo, Aves, rojo y Krugs.
    for (const id of ['azul', 'gromp', 'lobos'] as const) {
      const p = posicionMinimapa(id, 'azul');
      expect(1 - p.y, id).toBeGreaterThan(p.x);
    }
    for (const id of ['aviar', 'rojo', 'krugs'] as const) {
      const p = posicionMinimapa(id, 'azul');
      expect(1 - p.y, id).toBeLessThan(p.x);
    }
    // Todos los propios en la mitad azul del río (x + y del mapa < 14870).
    for (const id of ['azul', 'gromp', 'lobos', 'aviar', 'rojo', 'krugs'] as const) {
      const p = posicionMinimapa(id, 'azul');
      expect(p.x + (1 - p.y), id).toBeLessThan(1);
    }
  });

  it('lado rojo: la simetría central de los propios; los Escarabajos no cambian', async () => {
    const { posicionMinimapa } = await import('../src/shared/jungla');
    for (const id of ['azul', 'gromp', 'lobos', 'aviar', 'rojo', 'krugs'] as const) {
      const a = posicionMinimapa(id, 'azul');
      const r = posicionMinimapa(id, 'rojo');
      expect(r.x, id).toBeCloseTo(1 - a.x, 6);
      expect(r.y, id).toBeCloseTo(1 - a.y, 6);
    }
    for (const id of ['escarabajoArriba', 'escarabajoAbajo'] as const) expect(posicionMinimapa(id, 'rojo')).toEqual(posicionMinimapa(id, 'azul'));
    // El de arriba está arriba a la izquierda del minimapa; el de abajo, abajo a la derecha.
    const arriba = posicionMinimapa('escarabajoArriba', 'azul');
    const abajo = posicionMinimapa('escarabajoAbajo', 'azul');
    expect(arriba.x).toBeLessThan(0.5);
    expect(arriba.y).toBeLessThan(0.5);
    expect(abajo.x).toBeGreaterThan(0.5);
    expect(abajo.y).toBeGreaterThan(0.5);
  });

  it('todo dentro del minimapa (0..1) y la zona del campamento coincide con su mitad', async () => {
    const { posicionMinimapa, CAMPAMENTOS_JUNGLA, estadoJungla } = await import('../src/shared/jungla');
    for (const lado of ['azul', 'rojo'] as const) {
      const estado = estadoJungla({}, 100, lado === 'azul' ? 'ORDER' : 'CHAOS');
      for (const c of CAMPAMENTOS_JUNGLA) {
        const p = posicionMinimapa(c.id, lado);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(1);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(1);
        // «arriba» del panel = por encima de la diagonal de mid en el minimapa.
        const zona = estado.campamentos.find((x) => x.id === c.id)!.zona;
        expect(zona === 'arriba', `${lado} ${c.id}`).toBe(1 - p.y > p.x);
      }
    }
  });
});
