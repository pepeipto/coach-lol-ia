import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { asegurarInstanciaUnica } from '../src/main/instancia';

function appFalsa(bloqueo: boolean) {
  return Object.assign(new EventEmitter(), { requestSingleInstanceLock: vi.fn(() => bloqueo), quit: vi.fn() });
}

describe('asegurarInstanciaUnica', () => {
  it('si otra instancia ya tiene el bloqueo, sale y devuelve false', () => {
    const app = appFalsa(false);
    expect(asegurarInstanciaUnica(app, vi.fn())).toBe(false);
    expect(app.quit).toHaveBeenCalled();
  });

  it('con el bloqueo, una segunda instancia muestra y enfoca la ventana principal', () => {
    const app = appFalsa(true);
    const ventana = { isDestroyed: () => false, isMinimized: () => true, restore: vi.fn(), show: vi.fn(), focus: vi.fn() };
    expect(asegurarInstanciaUnica(app, () => ventana)).toBe(true);
    expect(app.quit).not.toHaveBeenCalled();
    app.emit('second-instance');
    expect(ventana.restore).toHaveBeenCalled();
    expect(ventana.show).toHaveBeenCalled();
    expect(ventana.focus).toHaveBeenCalled();
  });

  it('una segunda instancia sin ventana no falla', () => {
    const app = appFalsa(true);
    asegurarInstanciaUnica(app, () => null);
    expect(() => app.emit('second-instance')).not.toThrow();
  });
});
