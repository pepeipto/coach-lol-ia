import { describe, expect, it } from 'vitest';
import { clasificarObjeto } from '../src/objetos';

const legendario = { gold: { total: 2900, purchasable: true }, into: [], tags: ['SpellDamage'], maps: { '11': true } };

describe('clasificarObjeto', () => {
  it('legendario: completo, comprable y de 2000 de oro o más', () => expect(clasificarObjeto(6655, legendario)).toBe('legendario'));
  it('componente épico (Códice demoníaco, se mejora a otro)', () =>
    expect(clasificarObjeto(3108, { gold: { total: 900, purchasable: true }, into: ['6655'], maps: { '11': true } })).toBe('otro'));
  it('botas mejoradas', () => expect(clasificarObjeto(3020, { gold: { total: 1100, purchasable: true }, tags: ['Boots'], into: [] })).toBe('botas'));
  it('botas básicas (1001) no cuentan como botas', () => expect(clasificarObjeto(1001, { gold: { total: 300, purchasable: true }, tags: ['Boots'], into: ['3020'] })).toBe('otro'));
  it('consumibles nunca son legendarios', () => expect(clasificarObjeto(2003, { gold: { total: 50, purchasable: true }, consumed: true })).toBe('otro'));
  it('no disponible en la Grieta (maps["11"] false)', () => expect(clasificarObjeto(9999, { ...legendario, maps: { '11': false } })).toBe('otro'));
});
