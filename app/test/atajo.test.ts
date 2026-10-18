import { describe, expect, it, vi } from 'vitest';
import { crearAtajo, crearGestorAtajos } from '../src/main/atajo';

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

describe('gestor de atajos (tecla rápida y Esc)', () => {
  function montar() {
    const g = { register: vi.fn((_tecla: string, _cb: () => void) => true), unregister: vi.fn((_tecla: string) => undefined) };
    let tecla = 'CommandOrControl+Shift+O';
    const gestor = crearGestorAtajos(g, { tecla: () => tecla, alPulsar: () => undefined, alEsc: () => undefined });
    const registradas = () => g.register.mock.calls.map((c) => c[0]);
    return { g, gestor, registradas, cambiar: (t: string) => (tecla = t) };
  }

  it('fuera de partida y sin modo mover no registra ninguna tecla', () => {
    const { g, gestor } = montar();
    gestor.cambiarTecla();
    expect(g.register).not.toHaveBeenCalled();
  });

  it('en partida registra la tecla rápida y la libera al terminar', () => {
    const { g, gestor, registradas } = montar();
    gestor.enPartida(true);
    expect(registradas()).toEqual(['CommandOrControl+Shift+O']);
    gestor.enPartida(false);
    expect(g.unregister).toHaveBeenCalledWith('CommandOrControl+Shift+O');
  });

  it('el modo mover registra la tecla rápida y Esc, y los libera al salir', () => {
    const { g, gestor, registradas } = montar();
    gestor.moviendo(true);
    expect(registradas()).toEqual(['CommandOrControl+Shift+O', 'Escape']);
    gestor.moviendo(false);
    expect(g.unregister).toHaveBeenCalledWith('Escape');
    expect(g.unregister).toHaveBeenCalledWith('CommandOrControl+Shift+O');
  });

  it('al salir del modo mover en partida conserva la tecla rápida pero libera Esc', () => {
    const { g, gestor } = montar();
    gestor.enPartida(true);
    gestor.moviendo(true);
    gestor.moviendo(false);
    expect(g.unregister.mock.calls.map((c) => c[0])).toEqual(['Escape']);
  });

  it('cambiar la tecla en partida re-registra la nueva', () => {
    const { gestor, registradas, cambiar } = montar();
    gestor.enPartida(true);
    cambiar('F8');
    gestor.cambiarTecla();
    expect(registradas()).toEqual(['CommandOrControl+Shift+O', 'F8']);
  });
});
