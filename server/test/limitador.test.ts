import { describe, it, expect, vi, afterEach } from 'vitest';
import { crearLimitador } from '../src/riot/limitador';

afterEach(() => vi.useRealTimers());

describe('crearLimitador', () => {
  it('la 3.ª llamada espera hasta que pase la ventana', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 2, ventanaMs: 1000 }]);
    let resueltas = 0;
    for (let i = 0; i < 3; i++) lim.esperarTurno().then(() => resueltas++);
    await vi.advanceTimersByTimeAsync(0);
    expect(resueltas).toBe(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(resueltas).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(resueltas).toBe(3);
  });

  it('respeta todas las reglas a la vez', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([
      { peticiones: 2, ventanaMs: 1000 },
      { peticiones: 3, ventanaMs: 5000 },
    ]);
    let resueltas = 0;
    for (let i = 0; i < 4; i++) lim.esperarTurno().then(() => resueltas++);
    await vi.advanceTimersByTimeAsync(1000);
    expect(resueltas).toBe(3);
    await vi.advanceTimersByTimeAsync(3999);
    expect(resueltas).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(resueltas).toBe(4);
  });
});
