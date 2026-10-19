import { describe, expect, it, vi } from 'vitest';
import { crearControlOverlay, type VentanaOverlay } from '../src/main/ventanas/overlayControl';

function montar() {
  let visible = false;
  const ventana: VentanaOverlay = {
    isDestroyed: () => false,
    isVisible: () => visible,
    showInactive: vi.fn(() => { visible = true; }),
    hide: vi.fn(() => { visible = false; }),
    setIgnoreMouseEvents: vi.fn(),
    webContents: { send: vi.fn() },
  };
  const persistir = vi.fn();
  const alMover = vi.fn();
  const c = crearControlOverlay(() => ventana, persistir, alMover);
  return { c, ventana, persistir, alMover };
}

describe('control del overlay: modo mover', () => {
  it('mover(true) nunca captura el ratón de toda la pantalla: sigue dejando pasar los clics', () => {
    const { c, ventana, alMover } = montar();
    c.mover(true);
    expect(ventana.setIgnoreMouseEvents).not.toHaveBeenCalledWith(false);
    expect(c.estaMoviendo()).toBe(true);
    expect(ventana.showInactive).toHaveBeenCalled();
    expect(ventana.webContents.send).toHaveBeenCalledWith('overlay:mover', true);
    expect(alMover).toHaveBeenLastCalledWith(true);
  });

  it('en modo mover, capturarRaton(true/false) solo captura mientras el ratón está sobre un widget', () => {
    const { c, ventana } = montar();
    c.mover(true);
    c.capturarRaton(true);
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    c.capturarRaton(false);
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
  });

  it('fuera del modo mover, capturarRaton se ignora', () => {
    const { c, ventana } = montar();
    c.capturarRaton(true);
    expect(ventana.setIgnoreMouseEvents).not.toHaveBeenCalled();
  });

  it('salir del modo mover con el ratón capturado vuelve a dejar pasar los clics y avisa', () => {
    const { c, ventana, alMover } = montar();
    c.mover(true);
    c.capturarRaton(true);
    c.mover(false);
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    expect(c.estaMoviendo()).toBe(false);
    expect(alMover).toHaveBeenLastCalledWith(false);
    // Un mensaje tardío del panel tras salir no vuelve a capturar.
    c.capturarRaton(true);
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
  });

  it('3.0.1: la flecha se guarda con el tamaño de la pantalla y la escala del HUD llega por overlay:hud', () => {
    const { c, ventana, persistir } = montar();
    c.mover(true);
    c.guardarWidget('habilidad', 700, 900, { ancho: 2560, alto: 1440 });
    c.mover(false);
    expect(persistir).toHaveBeenCalledWith({ habilidad: { x: 700, y: 900, pantalla: { ancho: 2560, alto: 1440 } } });
    const hud = { global: 0.25, minimapa: 0.35, minimapaIzquierda: false };
    c.enviarHud(hud);
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:hud', hud);
  });

  it('mostrar() para una partida restaura el click-through y guarda la posición', () => {
    const { c, ventana, persistir } = montar();
    c.mover(true);
    c.guardarWidget('cs', 10, 20);
    c.mostrar();
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    expect(c.estaMoviendo()).toBe(false);
    expect(persistir).toHaveBeenCalledWith({ cs: { x: 10, y: 20 } });
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:mover', false);
    expect(ventana.showInactive).toHaveBeenCalled();
  });

  it('ocultar() también sale del modo mover y guarda la posición', () => {
    const { c, ventana, persistir } = montar();
    c.mover(true);
    c.guardarWidget('objetivos', 1, 2);
    c.ocultar();
    expect(c.estaMoviendo()).toBe(false);
    expect(persistir).toHaveBeenCalledWith({ objetivos: { x: 1, y: 2 } });
    expect(ventana.hide).toHaveBeenCalled();
  });

  it('la posición se guarda una sola vez y sin arrastre no se guarda nada', () => {
    const { c, persistir } = montar();
    c.mover(true);
    c.mover(false);
    expect(persistir).not.toHaveBeenCalled();
    c.mover(true);
    c.guardarWidget('habilidad', 5, 6);
    c.guardarWidget('cs', 7, 8);
    c.guardarWidget('habilidad', 9, 10);
    c.mover(false);
    c.mover(false);
    expect(persistir).toHaveBeenCalledTimes(1);
    // Todas las posiciones del mismo modo mover juntas; la última de cada widget manda.
    expect(persistir).toHaveBeenCalledWith({ habilidad: { x: 9, y: 10 }, cs: { x: 7, y: 8 } });
  });

  it('mostrar/ocultar fuera del modo mover no tocan el ratón', () => {
    const { c, ventana } = montar();
    c.mostrar();
    c.ocultar();
    expect(ventana.setIgnoreMouseEvents).not.toHaveBeenCalled();
  });

  it('la jungla puede pedir el ratón fuera del modo mover solo si su widget está activo y el overlay se ve', async () => {
    const { AJUSTES_POR_DEFECTO } = await import('../src/main/ajustes');
    const { c, ventana } = montar();
    const config = (activo: boolean) => ({
      ...AJUSTES_POR_DEFECTO.overlay,
      widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, jungla: { ...AJUSTES_POR_DEFECTO.overlay.widgets.jungla, activo } },
    });
    c.mostrar();
    c.capturarRaton(true, 'jungla');
    expect(ventana.setIgnoreMouseEvents).not.toHaveBeenCalled();
    c.enviarConfig(config(true));
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:config', config(true));
    // Otro widget no puede pedirlo fuera del modo mover.
    c.capturarRaton(true);
    expect(ventana.setIgnoreMouseEvents).not.toHaveBeenCalled();
    c.capturarRaton(true, 'jungla');
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    c.capturarRaton(false, 'jungla');
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    // Apagar el widget con el ratón capturado lo suelta.
    c.capturarRaton(true, 'jungla');
    c.enviarConfig(config(false));
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    // Ocultar el overlay también lo suelta.
    c.enviarConfig(config(true));
    c.capturarRaton(true, 'jungla');
    c.ocultar();
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    c.capturarRaton(true, 'jungla');
    expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
  });

  it('envía cada contrato por su canal', () => {
    const { c, ventana } = montar();
    c.enviarModo?.('carga');
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:modo', 'carga');
    c.enviarCarga({ jugadores: [], version: '16.20.1' });
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:carga', { jugadores: [], version: '16.20.1' });
  });

  describe('el ratón nunca se queda capturado', () => {
    const config = async (activo: boolean) => {
      const { AJUSTES_POR_DEFECTO } = await import('../src/main/ajustes');
      return { ...AJUSTES_POR_DEFECTO.overlay, widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, jungla: { activo, x: null, y: null, escala: 1 } } };
    };

    it.each(['carga', 'oculto'] as const)('pasar al modo %s con la jungla bajo el cursor suelta el ratón', async (modo) => {
      const { c, ventana } = montar();
      c.mostrar();
      c.enviarConfig(await config(true));
      c.capturarRaton(true, 'jungla');
      expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
      c.enviarModo!(modo);
      expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
      expect(ventana.webContents.send).toHaveBeenLastCalledWith('overlay:modo', modo);
    });

    it('pasar a «partida» no suelta nada, y en modo mover el modo no toca el ratón', async () => {
      const { c, ventana } = montar();
      c.mostrar();
      c.enviarConfig(await config(true));
      c.capturarRaton(true, 'jungla');
      c.enviarModo!('partida');
      expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
      c.mover(true);
      c.capturarRaton(true);
      c.enviarModo!('oculto');
      expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    });

    it('soltarRaton() (recarga o caída del renderizador) deja pasar los clics siempre', async () => {
      const { c, ventana } = montar();
      c.mostrar();
      c.enviarConfig(await config(true));
      c.capturarRaton(true, 'jungla');
      c.soltarRaton();
      expect(ventana.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
      // Un «soltar» tardío del widget después ya no hace nada raro.
      c.capturarRaton(false, 'jungla');
      expect(ventana.setIgnoreMouseEvents).toHaveBeenCalledTimes(2);
    });
  });
});
