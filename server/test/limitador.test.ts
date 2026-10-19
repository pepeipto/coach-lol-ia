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

describe('crearLimitador con prioridad', () => {
  it('sin prioridad las peticiones son de fondo (el recolector no cambia)', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 1, ventanaMs: 1000 }]);
    const orden: string[] = [];
    void lim.esperarTurno().then(() => orden.push('fondo-1'));
    void lim.esperarTurno().then(() => orden.push('fondo-2'));
    void lim.esperarTurno('interactiva').then(() => orden.push('interactiva'));
    await vi.advanceTimersByTimeAsync(0);
    expect(orden).toEqual(['fondo-1']);
    await vi.advanceTimersByTimeAsync(1000);
    // La interactiva llegó después, pero pasa antes que la de fondo que ya esperaba.
    expect(orden).toEqual(['fondo-1', 'interactiva']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(orden).toEqual(['fondo-1', 'interactiva', 'fondo-2']);
  });

  it('con una interactiva en cola, el fondo espera aunque su hueco ya esté libre', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 2, ventanaMs: 1000 }]);
    const orden: string[] = [];
    for (let i = 1; i <= 2; i++) void lim.esperarTurno().then(() => orden.push(`fondo-${i}`));
    await vi.advanceTimersByTimeAsync(0);
    void lim.esperarTurno('interactiva').then(() => orden.push('interactiva-1'));
    void lim.esperarTurno('interactiva').then(() => orden.push('interactiva-2'));
    void lim.esperarTurno().then(() => orden.push('fondo-3'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(orden).toEqual(['fondo-1', 'fondo-2', 'interactiva-1', 'interactiva-2']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(orden.at(-1)).toBe('fondo-3');
  });

  it('dentro de cada prioridad se respeta el orden de llegada', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 1, ventanaMs: 100 }]);
    const orden: number[] = [];
    for (let i = 0; i < 5; i++) void lim.esperarTurno('interactiva').then(() => orden.push(i));
    await vi.advanceTimersByTimeAsync(1000);
    expect(orden).toEqual([0, 1, 2, 3, 4]);
  });

  it('la reserva interactiva: el fondo no gasta los últimos huecos y la interactiva sí', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 5, ventanaMs: 60_000, reservaInteractiva: 2 }]);
    let fondo = 0;
    for (let i = 0; i < 5; i++) void lim.esperarTurno().then(() => fondo++);
    await vi.advanceTimersByTimeAsync(0);
    expect(fondo).toBe(3);
    let interactivas = 0;
    for (let i = 0; i < 3; i++) void lim.esperarTurno('interactiva').then(() => interactivas++);
    await vi.advanceTimersByTimeAsync(0);
    // Las dos primeras usan la reserva sin esperar; la tercera ya no cabe en la ventana.
    expect(interactivas).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(interactivas).toBe(3);
  });

  it('las reglas por defecto (clave de desarrollo de Riot) guardan hueco para la pantalla de carga', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador();
    let fondo = 0;
    // El recolector satura la regla de 2 minutos (100 peticiones), a ritmo de 20 por segundo.
    for (let i = 0; i < 100; i++) void lim.esperarTurno().then(() => fondo++);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fondo).toBe(90);
    let interactiva = false;
    void lim.esperarTurno('interactiva').then(() => (interactiva = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(interactiva).toBe(true);
  });
});
