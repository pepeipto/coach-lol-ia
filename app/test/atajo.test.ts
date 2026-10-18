import { describe, expect, it, vi } from 'vitest';
import { crearAtajo } from '../src/main/atajo';

describe('atajo global', () => {
  it('re-registra al cambiar la tecla y libera la anterior', () => {
    const g = { register: vi.fn(() => true), unregister: vi.fn() };
    const a = crearAtajo(g, () => undefined);
    a.registrar('A');
    a.registrar('A');
    a.registrar('B');
    expect(g.register).toHaveBeenCalledTimes(2);
    expect(g.unregister).toHaveBeenCalledWith('A');
    a.liberar();
    expect(g.unregister).toHaveBeenCalledWith('B');
  });

  it('una tecla nueva que falla conserva la anterior', () => {
    const g = { register: vi.fn(() => true), unregister: vi.fn() };
    const a = crearAtajo(g, () => undefined);
    a.registrar('A');
    g.register.mockReturnValue(false);
    a.registrar('B');
    expect(g.unregister).not.toHaveBeenCalled();
    a.liberar();
    expect(g.unregister).toHaveBeenCalledWith('A');
  });

  it('si el registro falla o lanza, no propaga el error', () => {
    const g = { register: vi.fn(() => false), unregister: vi.fn() };
    const a = crearAtajo(g, () => undefined);
    expect(() => a.registrar('A')).not.toThrow();
    g.register.mockImplementation(() => { throw new Error('mal'); });
    expect(() => a.registrar('B')).not.toThrow();
    a.liberar();
    expect(g.unregister).not.toHaveBeenCalled();
  });
});
