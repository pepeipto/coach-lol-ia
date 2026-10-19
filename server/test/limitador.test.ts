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
    // 4 por segundo: las interactivas pueden usar 2 (su tope del 60 %), así que caben las dos.
    const lim = crearLimitador([{ peticiones: 4, ventanaMs: 1000 }]);
    const orden: string[] = [];
    for (let i = 1; i <= 4; i++) void lim.esperarTurno().then(() => orden.push(`fondo-${i}`));
    await vi.advanceTimersByTimeAsync(0);
    void lim.esperarTurno('interactiva').then(() => orden.push('interactiva-1'));
    void lim.esperarTurno('interactiva').then(() => orden.push('interactiva-2'));
    void lim.esperarTurno().then(() => orden.push('fondo-5'));
    await vi.advanceTimersByTimeAsync(999);
    expect(orden).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1);
    // El fondo llegó antes de que se liberara la ventana, pero sale después de las interactivas.
    expect(orden).toEqual(['fondo-1', 'fondo-2', 'fondo-3', 'fondo-4', 'interactiva-1', 'interactiva-2', 'fondo-5']);
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

describe('crearLimitador bajo carga (plazos, pausa y reparto)', () => {
  it('más de 100 interactivas abandonadas (plazo vencido) salen de la cola y no bloquean al resto', async () => {
    vi.useFakeTimers();
    const { TurnoCancelado } = await import('../src/riot/limitador');
    const lim = crearLimitador([{ peticiones: 1, ventanaMs: 1000 }]);
    let resueltas = 0;
    let canceladas = 0;
    for (let i = 0; i < 150; i++) {
      lim.esperarTurno('interactiva', { plazo: Date.now() + 2500 }).then(
        () => resueltas++,
        (e) => {
          expect(e).toBeInstanceOf(TurnoCancelado);
          canceladas++;
        },
      );
    }
    let fondo = false;
    void lim.esperarTurno('fondo').then(() => (fondo = true));
    await vi.advanceTimersByTimeAsync(2500);
    // Con 1 por segundo, en 2,5 s solo pudieron salir 3; el resto se descarta al vencer su plazo.
    expect(resueltas).toBe(3);
    expect(canceladas).toBe(147);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fondo).toBe(true);
    // Una interactiva nueva no espera detrás de las abandonadas.
    let nueva = false;
    void lim.esperarTurno('interactiva', { plazo: Date.now() + 2000 }).then(() => (nueva = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(nueva).toBe(true);
  });

  it('una interactiva cancelada con su signal deja la cola; con plazo ya vencido ni entra', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 1, ventanaMs: 1000 }]);
    await lim.esperarTurno('interactiva');
    const control = new AbortController();
    const cancelada = lim.esperarTurno('interactiva', { signal: control.signal });
    let fondo = false;
    void lim.esperarTurno('fondo').then(() => (fondo = true));
    control.abort();
    await expect(cancelada).rejects.toThrow(/cancelada/);
    await expect(lim.esperarTurno('interactiva', { plazo: Date.now() - 1 })).rejects.toThrow(/plazo/);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fondo).toBe(true);
  });

  it('con las dos colas llenas, el fondo tiene al menos 1 de cada 5 turnos', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 1, ventanaMs: 100 }]);
    await lim.esperarTurno(); // ocupa la ventana: a partir de aquí las dos colas esperan a la vez
    const orden: string[] = [];
    for (let i = 0; i < 40; i++) void lim.esperarTurno('interactiva').then(() => orden.push('I'));
    for (let i = 0; i < 10; i++) void lim.esperarTurno('fondo').then(() => orden.push('F'));
    await vi.advanceTimersByTimeAsync(100 * 25);
    const primeros = orden.slice(0, 25);
    for (let i = 0; i + 5 <= primeros.length; i += 5) expect(primeros.slice(i, i + 5)).toContain('F');
  });

  it('pausar() para todo el host durante el tiempo indicado', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 10, ventanaMs: 1000 }]);
    lim.pausar(3000);
    let hecho = false;
    void lim.esperarTurno('interactiva').then(() => (hecho = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(hecho).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(hecho).toBe(true);
  });
});

describe('tope global de las peticiones interactivas por host', () => {
  it('las interactivas usan como mucho la fracción indicada de cada regla, aunque no haya fondo', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 10, ventanaMs: 60_000 }], { fraccionInteractiva: 0.6 });
    let hechas = 0;
    for (let i = 0; i < 20; i++) void lim.esperarTurno('interactiva').then(() => hechas++);
    await vi.advanceTimersByTimeAsync(0);
    expect(hechas).toBe(6);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(hechas).toBe(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(hechas).toBe(12);
  });

  it('con las interactivas en su tope, el recolector sigue teniendo hueco', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 10, ventanaMs: 60_000 }], { fraccionInteractiva: 0.6 });
    for (let i = 0; i < 50; i++) void lim.esperarTurno('interactiva').catch(() => undefined);
    let fondo = 0;
    for (let i = 0; i < 10; i++) void lim.esperarTurno('fondo').then(() => fondo++);
    await vi.advanceTimersByTimeAsync(0);
    expect(fondo).toBe(4);
  });

  it('la fracción nunca pasa del 70 % (aunque se pida más) y por defecto es el 60 %', async () => {
    const { FRACCION_INTERACTIVA_MAXIMA, FRACCION_INTERACTIVA_POR_DEFECTO } = await import('../src/riot/limitador');
    expect(FRACCION_INTERACTIVA_MAXIMA).toBe(0.7);
    expect(FRACCION_INTERACTIVA_POR_DEFECTO).toBe(0.6);
    vi.useFakeTimers();
    const lim = crearLimitador([{ peticiones: 100, ventanaMs: 120_000 }], { fraccionInteractiva: 1 });
    let hechas = 0;
    for (let i = 0; i < 100; i++) void lim.esperarTurno('interactiva').then(() => hechas++);
    await vi.advanceTimersByTimeAsync(0);
    expect(hechas).toBe(70);
  });

  it('reglas por defecto (clave de desarrollo): como mucho 12 de 20 por segundo y 60 de 100 cada 2 minutos', async () => {
    vi.useFakeTimers();
    const lim = crearLimitador();
    let hechas = 0;
    for (let i = 0; i < 200; i++) void lim.esperarTurno('interactiva').then(() => hechas++);
    await vi.advanceTimersByTimeAsync(0);
    expect(hechas).toBe(12);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(hechas).toBe(60);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(hechas).toBe(60);
  });
});
