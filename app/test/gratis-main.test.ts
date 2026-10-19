// Coach LoL IA gratis (PREMIUM_HABILITADO apagado): el coach en partida no depende de ninguna licencia.
import { EventEmitter } from 'node:events';
import { PREMIUM_HABILITADO } from '@coach/shared';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import { crearPlan } from '../src/main/plan';
import { abrirWeb, registrarIpcWeb, RUTAS_WEB, rutasWeb, urlWeb } from '../src/main/web';
import { t } from '../src/shared/i18n';

describe('plan con Premium desactivado', () => {
  it('la constante de compilación está apagada por defecto', () => {
    expect(PREMIUM_HABILITADO).toBe(false);
  });

  it('apagado: no se crea el gestor de licencias y esPremium es siempre true', () => {
    const crearLicencia = vi.fn(() => {
      throw new Error('no debería crearse');
    });
    const plan = crearPlan({ premiumHabilitado: false, crearLicencia });
    expect(plan.licencia).toBeNull();
    expect(plan.esPremium()).toBe(true);
    expect(crearLicencia).not.toHaveBeenCalled();
  });

  it('encendido: se crea el gestor y esPremium consulta su plan', () => {
    let p: 'gratis' | 'premium' = 'gratis';
    const gestor = { estado: vi.fn(() => ({ plan: p })) };
    const plan = crearPlan({ premiumHabilitado: true, crearLicencia: () => gestor });
    expect(plan.licencia).toBe(gestor);
    expect(plan.esPremium()).toBe(false);
    p = 'premium';
    expect(plan.esPremium()).toBe(true);
  });

  it('apagado: el overlay arranca en partida sin licencia y sin el aviso «es Premium»', async () => {
    const crearLicencia = vi.fn();
    const { esPremium } = crearPlan({ premiumHabilitado: false, crearLicencia });
    const conector = Object.assign(new EventEmitter(), { iniciar: vi.fn(), detener: vi.fn() });
    const overlay = { mostrar: vi.fn(), ocultar: vi.fn(), alternar: vi.fn(), enviarEstado: vi.fn(), enviarAviso: vi.fn() };
    const avisar = vi.fn();
    const p = crearOrquestadorPartida({
      crearConector: () => conector,
      overlay,
      obtenerAjustes: () => AJUSTES_POR_DEFECTO,
      contexto: async () => ({ build: null, rol: 'MIDDLE', objetos: {} }) as never,
      avisar,
      leerModo: async () => 'sin_bordes',
      esPremium,
    });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(conector.iniciar).toHaveBeenCalledOnce();
    conector.emit('estado', { tiempo: 0, oro: 500, nivel: 1, campeon: 'Ahri', objetos: [], habilidades: { Q: 0, W: 0, E: 0, R: 0 }, eventos: [] });
    await vi.waitFor(() => expect(overlay.mostrar).toHaveBeenCalled());
    expect(p.enPartida()).toBe(true);
    expect(avisar).not.toHaveBeenCalledWith(t('premium.coachBloqueado'));
    expect(crearLicencia).not.toHaveBeenCalled();
  });
});

describe('lista blanca de la web según el interruptor', () => {
  it('apagado: incluye /apoyar y ninguna ruta /premium', () => {
    expect(rutasWeb(false)).toEqual(['/', '/apoyar', '/descargar']);
    expect(RUTAS_WEB).toEqual(rutasWeb(false));
    expect(urlWeb('/apoyar')).toBe('https://www.coachlolia.com/apoyar');
    expect(() => urlWeb('/premium')).toThrow('Ruta web no permitida');
    expect(() => urlWeb('/premium/gestionar')).toThrow('Ruta web no permitida');
  });

  it('encendido: vuelven /premium y /premium/gestionar', () => {
    expect(rutasWeb(true)).toEqual(['/', '/premium', '/premium/gestionar', '/descargar']);
    expect(urlWeb('/premium/gestionar', rutasWeb(true))).toBe('https://www.coachlolia.com/premium/gestionar');
  });

  it('abrirWeb abre /apoyar y rechaza /premium con el interruptor apagado', async () => {
    const abrir = vi.fn(async () => undefined);
    await abrirWeb('/apoyar', abrir);
    expect(abrir).toHaveBeenCalledWith('https://www.coachlolia.com/apoyar');
    await expect(abrirWeb('/premium', abrir)).rejects.toThrow('Ruta web no permitida');
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('el canal coach:abrir-web existe sin gestor de licencias y solo atiende a la ventana principal', async () => {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ipc = { handle: vi.fn((c: string, f: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(c, f)) };
    const abrir = vi.fn(async () => undefined);
    const principal = {};
    registrarIpcWeb(ipc, { abrir, esPrincipal: (s) => s === principal });
    expect(ipc.handle.mock.calls.map((c) => c[0])).toEqual(['coach:abrir-web']);
    await manejadores.get('coach:abrir-web')!({ sender: principal }, '/apoyar');
    expect(abrir).toHaveBeenCalledWith('https://www.coachlolia.com/apoyar');
    await expect(Promise.resolve().then(() => manejadores.get('coach:abrir-web')!({ sender: {} }, '/apoyar'))).rejects.toThrow();
    await expect(Promise.resolve().then(() => manejadores.get('coach:abrir-web')!({ sender: principal }, '/premium'))).rejects.toThrow();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});
