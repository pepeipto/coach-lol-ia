import { describe, expect, it, vi } from 'vitest';
import { ESPERA_INICIAL_MS, programarDescargaAutomatica, REINTENTO_MS } from '../src/main/voz/descargaAuto';

function montar(o: { motor?: 'pack' | 'natural' | 'sistema'; pendiente?: boolean; ocupado?: boolean; falla?: boolean } = {}) {
  const estado = { motor: o.motor ?? 'pack', pendiente: o.pendiente ?? true, ocupado: o.ocupado ?? false, falla: o.falla ?? false };
  const tareas: { cb: () => void; ms: number; cancelada: boolean }[] = [];
  const descargar = vi.fn(async () => {
    if (estado.falla) throw new Error('sin red');
    estado.pendiente = false;
  });
  const detener = programarDescargaAutomatica({
    motor: () => estado.motor,
    pendiente: () => estado.pendiente,
    ocupado: () => estado.ocupado,
    descargar,
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
  return { estado, tareas, descargar, detener, siguiente, disparar };
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
});
