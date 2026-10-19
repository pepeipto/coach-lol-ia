import { describe, expect, it, vi } from 'vitest';
import { crearAtajosJungla } from '../src/main/consejos/atajosJungla';

function montar() {
  const registradas = new Map<string, () => void>();
  const gs = {
    register: vi.fn((tecla: string, cb: () => void) => (registradas.has(tecla) ? false : (registradas.set(tecla, cb), true))),
    unregister: vi.fn((tecla: string) => void registradas.delete(tecla)),
  };
  const alPulsar = vi.fn();
  return { a: crearAtajosJungla(gs, alPulsar), registradas, alPulsar };
}

describe('teclas de la jungla', () => {
  it('sin teclas configuradas no registra nada (apagadas por defecto)', () => {
    const { a, registradas } = montar();
    a.sincronizar({ activo: true, teclas: {}, teclaOverlay: 'Ctrl+Shift+O' });
    expect(registradas.size).toBe(0);
  });

  it('con el widget activo registra cada tecla y al pulsarla marca su campamento', () => {
    const { a, registradas, alPulsar } = montar();
    a.sincronizar({ activo: true, teclas: { azul: 'F5', rojo: 'F6' }, teclaOverlay: 'Ctrl+Shift+O' });
    expect([...registradas.keys()].sort()).toEqual(['F5', 'F6']);
    registradas.get('F6')!();
    expect(alPulsar).toHaveBeenCalledWith('rojo');
  });

  it('fuera de partida o con el widget apagado las libera; nunca pisa la tecla del overlay ni repite una', () => {
    const { a, registradas } = montar();
    a.sincronizar({ activo: true, teclas: { azul: 'F5', gromp: 'f5', rojo: 'Ctrl+Shift+O' }, teclaOverlay: 'Ctrl+Shift+O' });
    expect([...registradas.keys()]).toEqual(['F5']);
    a.sincronizar({ activo: false, teclas: { azul: 'F5' }, teclaOverlay: 'Ctrl+Shift+O' });
    expect(registradas.size).toBe(0);
    a.sincronizar({ activo: true, teclas: { azul: 'F7' }, teclaOverlay: 'Ctrl+Shift+O' });
    a.liberar();
    expect(registradas.size).toBe(0);
  });
});
