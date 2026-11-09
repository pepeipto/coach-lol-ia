import { describe, expect, it } from 'vitest';
import { RegistroTenidos, SEGUNDOS_TENIDO } from '../src/main/orquestador/partida';

describe('objetos tenidos en la partida (3.17.1)', () => {
  it('un objeto cuenta como tenido tras llevarlo unos segundos y sigue contando aunque lo vendas', () => {
    const r = new RegistroTenidos();
    expect(r.anotar([3020], 100)).toEqual([]);
    expect(r.anotar([3020], 100 + SEGUNDOS_TENIDO)).toEqual([3020]);
    // Vendidas: siguen en la lista.
    expect(r.anotar([3089], 2000)).toEqual([3020]);
  });

  it('comprar y deshacer enseguida no cuenta', () => {
    const r = new RegistroTenidos();
    r.anotar([3089], 500);
    r.anotar([3089], 503);
    expect(r.anotar([], 505)).toEqual([]);
    // Si lo vuelve a comprar, la cuenta empieza de nuevo.
    expect(r.anotar([3089], 600)).toEqual([]);
    expect(r.anotar([3089], 600 + SEGUNDOS_TENIDO)).toEqual([3089]);
  });
});
