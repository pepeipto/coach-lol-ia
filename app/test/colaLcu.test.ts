import { describe, expect, it } from 'vitest';
import { conReintentos, crearCola, ErrorLcu, REINTENTOS_429 } from '../src/main/lcu/cliente';

describe('3.6: cola y reintentos de la LCU', () => {
  it('deja pasar como mucho N peticiones a la vez y respeta el orden', async () => {
    const enCola = crearCola(2);
    let activas = 0;
    let maxima = 0;
    const orden: number[] = [];
    const tarea = (n: number) =>
      enCola(async () => {
        maxima = Math.max(maxima, ++activas);
        await new Promise((r) => setTimeout(r, 5));
        orden.push(n);
        activas--;
        return n;
      });
    expect(await Promise.all([1, 2, 3, 4, 5].map(tarea))).toEqual([1, 2, 3, 4, 5]);
    expect(maxima).toBe(2);
    expect(orden[0]).toBe(1);
  });

  it('un error no bloquea la cola', async () => {
    const enCola = crearCola(1);
    await expect(enCola(async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await enCola(async () => 'sigue')).toBe('sigue');
  });

  it('ante un 429 espera lo que diga Retry-After y reintenta; otros errores no se reintentan', async () => {
    const esperas: number[] = [];
    let n = 0;
    const r = await conReintentos(
      async () => {
        if (n++ < 2) throw new ErrorLcu(429, 'demasiadas', n === 1 ? 3 : null);
        return 'ok';
      },
      async (ms) => void esperas.push(ms),
    );
    expect(r).toBe('ok');
    expect(esperas).toEqual([3000, 2000]);
    let m = 0;
    await expect(conReintentos(async () => { m++; throw new ErrorLcu(404, 'no'); }, async () => {})).rejects.toThrow('no');
    expect(m).toBe(1);
    let k = 0;
    await expect(conReintentos(async () => { k++; throw new ErrorLcu(429, 'siempre'); }, async () => {})).rejects.toThrow('siempre');
    expect(k).toBe(REINTENTOS_429 + 1);
  });
});
