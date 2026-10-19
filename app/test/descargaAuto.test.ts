import { describe, expect, it, vi } from 'vitest';
import { ESPERA_INICIAL_MS, MAX_FALLOS_AUTO, programarDescargaAutomatica, REINTENTO_MAX_MS, REINTENTO_MS, VIGILANCIA_MS } from '../src/main/voz/descargaAuto';

function montar(o: { motor?: 'pack' | 'natural' | 'sistema'; pendiente?: boolean; ocupado?: boolean; falla?: boolean; lenta?: boolean } = {}) {
  const estado = { motor: o.motor ?? 'pack', pendiente: o.pendiente ?? true, ocupado: o.ocupado ?? false, falla: o.falla ?? false, lenta: o.lenta ?? false };
  const tareas: { cb: () => void; ms: number; cancelada: boolean }[] = [];
  let terminarDescarga: (() => void) | null = null;
  const descargar = vi.fn(async () => {
    if (estado.falla) throw new Error('sin red');
    if (estado.lenta) {
      // Descarga larga: sigue «en curso» hasta que se cancela o se termina a mano.
      await new Promise<void>((ok) => (terminarDescarga = ok));
      return;
    }
    estado.pendiente = false;
  });
  const cancelarDescarga = vi.fn(() => terminarDescarga?.());
  const detener = programarDescargaAutomatica({
    motor: () => estado.motor,
    pendiente: () => estado.pendiente,
    ocupado: () => estado.ocupado,
    descargar,
    cancelar: cancelarDescarga,
    programar: (cb, ms) => {
      const t = { cb, ms, cancelada: false };
      tareas.push(t);
      return () => (t.cancelada = true);
    },
  });
  const siguiente = () => tareas.filter((t) => !t.cancelada).at(-1)!;
  const disparar = async () => {
    const t = siguiente();
    t.cancelada = true;
    t.cb();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { estado, tareas, descargar, cancelarDescarga, detener, siguiente, disparar };
}

describe('descarga automática de la voz natural (3.1)', () => {
  it('descarga sola a los 20 s de arrancar si falta la voz', async () => {
    const m = montar();
    expect(m.siguiente().ms).toBe(ESPERA_INICIAL_MS);
    await m.disparar();
    expect(m.descargar).toHaveBeenCalledOnce();
  });

  it('nunca durante la selección, la carga o la partida: espera y reintenta', async () => {
    const m = montar({ ocupado: true });
    await m.disparar();
    expect(m.descargar).not.toHaveBeenCalled();
    expect(m.siguiente().ms).toBe(REINTENTO_MS);
    m.estado.ocupado = false;
    await m.disparar();
    expect(m.descargar).toHaveBeenCalledOnce();
  });

  it('con la voz de Windows elegida o ya instalada no descarga nada', async () => {
    const a = montar({ motor: 'sistema' });
    await a.disparar();
    expect(a.descargar).not.toHaveBeenCalled();
    const b = montar({ pendiente: false });
    await b.disparar();
    expect(b.descargar).not.toHaveBeenCalled();
  });

  it('si la descarga falla, lo vuelve a intentar más tarde', async () => {
    const m = montar({ falla: true });
    await m.disparar();
    expect(m.descargar).toHaveBeenCalledOnce();
    expect(m.siguiente().ms).toBe(REINTENTO_MS);
  });

  it('detener() cancela lo pendiente', () => {
    const m = montar();
    m.detener();
    expect(m.tareas.every((t) => t.cancelada)).toBe(true);
  });

  it('si empieza la selección, la carga o la partida mientras descarga, la corta y vuelve a intentarlo luego', async () => {
    const m = montar({ lenta: true });
    await m.disparar();
    expect(m.descargar).toHaveBeenCalledOnce();
    // Mientras no hay partida, solo vigila.
    expect(m.siguiente().ms).toBe(VIGILANCIA_MS);
    await m.disparar();
    expect(m.cancelarDescarga).not.toHaveBeenCalled();
    m.estado.ocupado = true;
    await m.disparar();
    expect(m.cancelarDescarga).toHaveBeenCalledOnce();
    await Promise.resolve();
    // Cortarla por la partida no cuenta como fallo: se reintenta al minuto (y solo si ya no hay partida).
    expect(m.siguiente().ms).toBe(REINTENTO_MS);
  });

  it('tras un fallo espera cada vez más y, tras varios seguidos, deja de intentarlo sola', async () => {
    const m = montar({ falla: true });
    const esperas: number[] = [];
    for (let i = 0; i < MAX_FALLOS_AUTO; i++) {
      await m.disparar();
      const s = m.tareas.filter((t) => !t.cancelada).at(-1);
      if (s) esperas.push(s.ms);
    }
    expect(m.descargar).toHaveBeenCalledTimes(MAX_FALLOS_AUTO);
    expect(esperas).toEqual([REINTENTO_MS, REINTENTO_MS * 2, REINTENTO_MS * 4, REINTENTO_MS * 8].map((ms) => Math.min(ms, REINTENTO_MAX_MS)));
    expect(m.tareas.every((t) => t.cancelada)).toBe(true);
  });
});
