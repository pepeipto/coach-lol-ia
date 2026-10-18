import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { protegerNavegacion } from '../src/main/ventanas/navegacion';

function contenidoFalso(url: string) {
  let manejador: ((d: { url: string }) => { action: string }) | null = null;
  const wc = Object.assign(new EventEmitter(), {
    getURL: () => url,
    setWindowOpenHandler: vi.fn((h: typeof manejador) => { manejador = h; }),
  });
  return { wc, abrir: (u: string) => manejador!({ url: u }) };
}

describe('protegerNavegacion', () => {
  it('niega abrir ventanas nuevas', () => {
    const { wc, abrir } = contenidoFalso('file:///app/index.html');
    protegerNavegacion(wc);
    expect(abrir('https://example.com')).toEqual({ action: 'deny' });
  });

  it('impide navegar a otra página pero deja recargar la misma', () => {
    const { wc } = contenidoFalso('file:///app/index.html');
    protegerNavegacion(wc);
    const fuera = { preventDefault: vi.fn() };
    wc.emit('will-navigate', fuera, 'https://example.com');
    expect(fuera.preventDefault).toHaveBeenCalled();
    const misma = { preventDefault: vi.fn() };
    wc.emit('will-navigate', misma, 'file:///app/index.html');
    expect(misma.preventDefault).not.toHaveBeenCalled();
  });
});
