import { describe, expect, it } from 'vitest';
import { FiltroAvisos } from '../src/main/consejos/antispam';
import type { Indicacion, TipoAviso } from '../src/shared/tiposApp';

const TODOS: Record<TipoAviso, boolean> = { compra: true, habilidad: true, objetivo: true, vision: true, fase: true };
const ind = (tipo: TipoAviso, clave: string): Indicacion => ({ tipo, clave, texto: clave });

describe('FiltroAvisos', () => {
  it('emite como mucho una indicación cada 10 s', () => {
    const f = new FiltroAvisos();
    expect(f.procesar([ind('compra', 'a')], 0, TODOS)?.clave).toBe('a');
    expect(f.procesar([ind('compra', 'a'), ind('vision', 'b')], 9999, TODOS)).toBeNull();
    expect(f.procesar([ind('compra', 'a'), ind('vision', 'b')], 10000, TODOS)?.clave).toBe('b');
  });

  it('prioriza un objetivo sobre una compra en el mismo instante', () => {
    const f = new FiltroAvisos();
    const r = f.procesar([ind('fase', 'f'), ind('compra', 'c'), ind('objetivo', 'o'), ind('vision', 'v')], 0, TODOS);
    expect(r?.clave).toBe('o');
  });

  it('respeta el orden objetivo > compra > habilidad > vision > fase', () => {
    const f = new FiltroAvisos(1);
    const lista = [ind('fase', 'f'), ind('vision', 'v'), ind('habilidad', 'h'), ind('compra', 'c'), ind('objetivo', 'o')];
    const emitidas = [0, 10, 20, 30, 40].map((t) => f.procesar(lista, t, TODOS)?.clave);
    expect(emitidas).toEqual(['o', 'c', 'h', 'v', 'f']);
  });

  it('no repite una clave mientras sigue presente', () => {
    const f = new FiltroAvisos();
    expect(f.procesar([ind('compra', 'a')], 0, TODOS)).not.toBeNull();
    expect(f.procesar([ind('compra', 'a')], 20000, TODOS)).toBeNull();
    expect(f.procesar([ind('compra', 'a')], 40000, TODOS)).toBeNull();
  });

  it('una clave que desaparece y reaparece puede emitirse otra vez', () => {
    const f = new FiltroAvisos();
    expect(f.procesar([ind('compra', 'a')], 0, TODOS)).not.toBeNull();
    expect(f.procesar([], 20000, TODOS)).toBeNull();
    expect(f.procesar([ind('compra', 'a')], 40000, TODOS)?.clave).toBe('a');
  });

  it('respeta los tipos desactivados en ajustes', () => {
    const f = new FiltroAvisos();
    const r = f.procesar([ind('objetivo', 'o'), ind('compra', 'c')], 0, { ...TODOS, objetivo: false });
    expect(r?.clave).toBe('c');
    expect(f.procesar([ind('objetivo', 'o')], 20000, { ...TODOS, objetivo: false })).toBeNull();
  });

  it('la indicación retenida por el intervalo sale en el siguiente hueco', () => {
    const f = new FiltroAvisos();
    const lista = [ind('objetivo', 'o'), ind('compra', 'c')];
    expect(f.procesar(lista, 0, TODOS)?.clave).toBe('o');
    expect(f.procesar(lista, 5000, TODOS)).toBeNull();
    expect(f.procesar(lista, 10000, TODOS)?.clave).toBe('c');
  });

  it('reiniciar permite emitir otra vez de inmediato', () => {
    const f = new FiltroAvisos();
    expect(f.procesar([ind('compra', 'a')], 0, TODOS)).not.toBeNull();
    f.reiniciar();
    expect(f.procesar([ind('compra', 'a')], 1, TODOS)?.clave).toBe('a');
  });
});
