import { describe, expect, it, vi } from 'vitest';
import { registrarControlVentana, type VentanaControlable } from '../src/main/ventanas/controlVentana';

function montar(maximizada = false) {
  const oyentes = new Map<string, (e: { sender: unknown }) => void>();
  const ipc = { on: vi.fn((canal: string, f: (e: { sender: unknown }) => void) => void oyentes.set(canal, f)) };
  const webContents = {};
  let max = maximizada;
  const ventana: VentanaControlable = {
    isDestroyed: () => false,
    webContents,
    minimize: vi.fn(),
    maximize: vi.fn(() => void (max = true)),
    unmaximize: vi.fn(() => void (max = false)),
    isMaximized: () => max,
    close: vi.fn(),
  };
  registrarControlVentana(ipc, () => ventana);
  const emitir = (canal: string, sender: unknown) => oyentes.get(canal)!({ sender });
  return { ventana, webContents, emitir, ipc };
}

describe('control de la ventana principal (barra de título propia)', () => {
  it('registra minimizar, maximizar y cerrar', () => {
    const { ipc } = montar();
    expect(ipc.on.mock.calls.map((c) => c[0]).sort()).toEqual(['ventana:cerrar', 'ventana:maximizar', 'ventana:minimizar']);
  });

  it('atiende las órdenes de la ventana principal', () => {
    const { ventana, webContents, emitir } = montar();
    emitir('ventana:minimizar', webContents);
    emitir('ventana:maximizar', webContents);
    emitir('ventana:maximizar', webContents);
    emitir('ventana:cerrar', webContents);
    expect(ventana.minimize).toHaveBeenCalledOnce();
    expect(ventana.maximize).toHaveBeenCalledOnce();
    expect(ventana.unmaximize).toHaveBeenCalledOnce();
    expect(ventana.close).toHaveBeenCalledOnce();
  });

  it('ignora las órdenes de otro remitente (p. ej. el overlay)', () => {
    const { ventana, emitir } = montar();
    const ajeno = {};
    for (const canal of ['ventana:minimizar', 'ventana:maximizar', 'ventana:cerrar']) emitir(canal, ajeno);
    expect(ventana.minimize).not.toHaveBeenCalled();
    expect(ventana.maximize).not.toHaveBeenCalled();
    expect(ventana.close).not.toHaveBeenCalled();
  });

  it('no hace nada si la ventana ya no existe', () => {
    const oyentes = new Map<string, (e: { sender: unknown }) => void>();
    registrarControlVentana({ on: (c, f) => void oyentes.set(c, f) }, () => null);
    expect(() => oyentes.get('ventana:cerrar')!({ sender: {} })).not.toThrow();
  });
});
