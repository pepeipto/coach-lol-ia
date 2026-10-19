import { describe, expect, it, vi } from 'vitest';
import { registrarIpcOpcion } from '../src/main/ipcOpcion';

describe("IPC 'coach:cambiar-opcion'", () => {
  function montar() {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ipc = { handle: (c: string, h: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(c, h) };
    const cambiar = vi.fn(async () => undefined);
    const principal = {};
    registrarIpcOpcion(ipc, { cambiar, esPrincipal: (s) => s === principal });
    const invocar = (sender: unknown, i: unknown) => Promise.resolve().then(() => manejadores.get('coach:cambiar-opcion')!({ sender }, i));
    return { invocar, cambiar, principal };
  }

  it('solo atiende a la ventana principal', async () => {
    const { invocar, cambiar, principal } = montar();
    await invocar(principal, 2);
    expect(cambiar).toHaveBeenCalledWith(2);
    await expect(invocar({}, 1)).rejects.toThrow();
    expect(cambiar).toHaveBeenCalledTimes(1);
  });

  it('valida el índice', async () => {
    const { invocar, cambiar, principal } = montar();
    for (const malo of [-1, 1.5, '1', null, Number.NaN]) await expect(invocar(principal, malo)).rejects.toThrow('Opción no válida');
    expect(cambiar).not.toHaveBeenCalled();
  });
});
