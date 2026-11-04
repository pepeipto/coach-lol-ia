import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { recargarAlCaer, seguirPantallaPrincipal } from '../src/main/ventanas/recuperacion';

describe('recargarAlCaer', () => {
  const montar = () => {
    let ahora = 0;
    const wc = Object.assign(new EventEmitter(), { reload: vi.fn(), isDestroyed: () => false });
    recargarAlCaer(wc as never, 'el overlay', () => ahora);
    return { wc, avanzar: (ms: number) => (ahora += ms) };
  };

  it('si el renderizador se cae, recarga la página; si se cerró limpiamente, no', () => {
    const { wc } = montar();
    wc.emit('render-process-gone', {}, { reason: 'clean-exit', exitCode: 0 });
    expect(wc.reload).not.toHaveBeenCalled();
    wc.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    expect(wc.reload).toHaveBeenCalledTimes(1);
    wc.emit('render-process-gone', {}, { reason: 'oom', exitCode: 1 });
    expect(wc.reload).toHaveBeenCalledTimes(2);
  });

  it('si se cae en bucle deja de recargar (como mucho 3 veces por minuto)', () => {
    const { wc, avanzar } = montar();
    for (let i = 0; i < 6; i++) wc.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    expect(wc.reload).toHaveBeenCalledTimes(3);
    avanzar(61_000);
    wc.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    expect(wc.reload).toHaveBeenCalledTimes(4);
  });
});

describe('seguirPantallaPrincipal', () => {
  it('al cambiar las pantallas, la ventana vuelve a ocupar la principal; al cerrarse deja de escuchar', () => {
    const pantalla = Object.assign(new EventEmitter(), { getPrimaryDisplay: vi.fn(() => ({ bounds: { x: 0, y: 0, width: 2560, height: 1440 } })) });
    const ventana = Object.assign(new EventEmitter(), { setBounds: vi.fn(), isDestroyed: () => false });
    seguirPantallaPrincipal(ventana as never, pantalla as never);
    for (const evento of ['display-metrics-changed', 'display-added', 'display-removed']) pantalla.emit(evento);
    expect(ventana.setBounds).toHaveBeenCalledTimes(3);
    expect(ventana.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 2560, height: 1440 });
    ventana.emit('closed');
    pantalla.emit('display-metrics-changed');
    expect(ventana.setBounds).toHaveBeenCalledTimes(3);
    expect(pantalla.listenerCount('display-added')).toBe(0);
  });
});
