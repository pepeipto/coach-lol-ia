import { describe, expect, it, vi } from 'vitest';
import { crearControlOverlay, type VentanaOverlay } from '../src/main/ventanas/overlayControl';

function montar() {
  let visible = false;
  const ventana: VentanaOverlay = {
    isDestroyed: () => false,
    isVisible: () => visible,
    showInactive: vi.fn(() => { visible = true; }),
    hide: vi.fn(() => { visible = false; }),
    setIgnoreMouseEvents: vi.fn(),
    webContents: { send: vi.fn() },
  };
  const persistir = vi.fn();
  const c = crearControlOverlay(() => ventana, persistir);
  return { c, ventana, persistir };
}

describe('control del overlay: modo mover', () => {
  it('mover(true) deja pasar los clics al overlay y lo refleja en el estado', () => {
    const { c, ventana } = montar();
    c.mover(true);
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    expect(c.estaMoviendo()).toBe(true);
    expect(ventana.webContents.send).toHaveBeenCalledWith('overlay:mover', true);
  });

  it('mostrar() para una partida restaura el click-through y guarda la posición', () => {
    const { c, ventana, persistir } = montar();
    c.mover(true);
    c.guardarPosicion(10, 20);
    c.mostrar();
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    expect(c.estaMoviendo()).toBe(false);
    expect(persistir).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:mover', false);
    expect(ventana.showInactive).toHaveBeenCalled();
  });

  it('ocultar() también sale del modo mover y guarda la posición', () => {
    const { c, ventana, persistir } = montar();
    c.mover(true);
    c.guardarPosicion(1, 2);
    c.ocultar();
    expect(c.estaMoviendo()).toBe(false);
    expect(persistir).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(ventana.hide).toHaveBeenCalled();
  });

  it('la posición se guarda una sola vez y sin arrastre no se guarda nada', () => {
    const { c, persistir } = montar();
    c.mover(true);
    c.mover(false);
    expect(persistir).not.toHaveBeenCalled();
    c.mover(true);
    c.guardarPosicion(5, 6);
    c.mover(false);
    c.mover(false);
    expect(persistir).toHaveBeenCalledTimes(1);
  });

  it('mostrar/ocultar fuera del modo mover no tocan el ratón', () => {
    const { c, ventana } = montar();
    c.mostrar();
    c.ocultar();
    expect(ventana.setIgnoreMouseEvents).not.toHaveBeenCalled();
  });
});
