import { describe, expect, it, vi } from 'vitest';
import { crearAtajosJungla } from '../src/main/consejos/atajosJungla';

function montar() {
  const registradas = new Map<string, () => void>();
  const gs = {
    register: vi.fn((tecla: string, cb: () => void) => (registradas.has(tecla) ? false : (registradas.set(tecla, cb), true))),
    unregister: vi.fn((tecla: string) => void registradas.delete(tecla)),
  };
  const alPulsar = vi.fn();
  const alAlternar = vi.fn();
  return { a: crearAtajosJungla(gs, alPulsar, alAlternar), registradas, alPulsar, alAlternar };
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

  it('la tecla del overlay se reconoce aunque se escriba distinto (CommandOrControl ≡ Ctrl)', () => {
    const { a, registradas } = montar();
    a.sincronizar({ activo: true, teclas: { azul: 'Ctrl+Shift+O', rojo: 'shift+control+o', gromp: 'F8' }, teclaOverlay: 'CommandOrControl+Shift+O' });
    expect([...registradas.keys()]).toEqual(['F8']);
  });

  it('nunca registra combinaciones que LoL ya usa', () => {
    const { a, registradas } = montar();
    a.sincronizar({ activo: true, teclas: { azul: 'Ctrl+Q', rojo: 'Alt+4', gromp: 'Shift+B', lobos: 'Ctrl+K' }, teclaOverlay: 'CommandOrControl+Shift+O' });
    expect([...registradas.keys()]).toEqual(['Ctrl+K']);
  });
});

describe('tecla para mostrar u ocultar los temporizadores (Alt+Shift+L)', () => {
  const base = { teclas: {}, teclaOverlay: 'CommandOrControl+Shift+O', teclaAlternar: 'Alt+Shift+L' };

  it('solo durante la partida, aunque el widget esté apagado (sirve para encenderlo); al pulsarla alterna', () => {
    const { a, registradas, alAlternar } = montar();
    a.sincronizar({ ...base, enPartida: false, activo: false });
    expect(registradas.size).toBe(0);
    a.sincronizar({ ...base, enPartida: true, activo: false, teclas: { azul: 'F5' } });
    expect([...registradas.keys()]).toEqual(['Alt+Shift+L']); // las de los campamentos, solo con el widget activo
    registradas.get('Alt+Shift+L')!();
    expect(alAlternar).toHaveBeenCalledOnce();
    a.sincronizar({ ...base, enPartida: true, activo: true, teclas: { azul: 'F5' } });
    expect([...registradas.keys()].sort()).toEqual(['Alt+Shift+L', 'F5']);
  });

  it('se libera al salir de la partida y al cerrar la app', () => {
    const { a, registradas } = montar();
    a.sincronizar({ ...base, enPartida: true, activo: true });
    a.sincronizar({ ...base, enPartida: false, activo: false });
    expect(registradas.size).toBe(0);
    a.sincronizar({ ...base, enPartida: true, activo: true });
    a.liberar();
    expect(registradas.size).toBe(0);
  });

  it('no choca: ni con la tecla del overlay, ni con LoL, y un campamento no puede usar la misma tecla', () => {
    const { a, registradas } = montar();
    a.sincronizar({ ...base, enPartida: true, activo: true, teclaAlternar: 'Ctrl+Shift+O' });
    expect(registradas.size).toBe(0);
    a.sincronizar({ ...base, enPartida: true, activo: true, teclaAlternar: 'Alt+Shift+Q' });
    expect(registradas.size).toBe(0);
    a.sincronizar({ ...base, enPartida: true, activo: true, teclas: { azul: 'alt+shift+l', rojo: 'F6' } });
    expect([...registradas.keys()].sort()).toEqual(['Alt+Shift+L', 'F6']);
    a.sincronizar({ ...base, enPartida: true, activo: true, teclaAlternar: '' });
    expect(registradas.size).toBe(0);
  });
});

describe('ayudas de teclas', () => {
  it('normalizarAcelerador y mismoAcelerador', async () => {
    const { normalizarAcelerador, mismoAcelerador } = await import('../src/shared/teclas');
    expect(normalizarAcelerador('CommandOrControl+Shift+O')).toBe('ctrl+shift+o');
    expect(normalizarAcelerador('Shift+CmdOrCtrl+o')).toBe('ctrl+shift+o');
    expect(mismoAcelerador('Alt+num4', 'alt+NUM4')).toBe(true);
    expect(mismoAcelerador('F5', 'Ctrl+F5')).toBe(false);
  });

  it('chocaConLol: Ctrl/Alt/Mayús con Q, W, E, R, D, F, B o 1–6', async () => {
    const { chocaConLol } = await import('../src/shared/teclas');
    for (const c of ['Ctrl+Q', 'Alt+W', 'Shift+E', 'Ctrl+R', 'Alt+D', 'Ctrl+F', 'Shift+B', 'Ctrl+1', 'Alt+6', 'CommandOrControl+Shift+R']) expect(chocaConLol(c)).toBe(true);
    for (const c of ['F5', 'num4', 'Ctrl+7', 'Alt+K', 'Ctrl+F5', 'Q']) expect(chocaConLol(c)).toBe(false);
  });
});
