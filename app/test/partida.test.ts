import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { FiltroAvisos } from '../src/main/consejos/antispam';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import type { ModoVentana } from '../src/main/partida/modoVentana';
import { t } from '../src/shared/i18n';
import type { Ajustes, EstadoPartida } from '../src/shared/tiposApp';

const estadoPartida = (tiempo = 0): EstadoPartida => ({
  tiempo, oro: 500, nivel: 1, campeon: 'Ahri', objetos: [],
  habilidades: { Q: 0, W: 0, E: 0, R: 0 }, eventos: [],
});

function montar(o: { modo?: ModoVentana; ajustes?: Partial<Ajustes>; contexto?: unknown; forzar?: boolean } = {}) {
  const conector = Object.assign(new EventEmitter(), { iniciar: vi.fn(), detener: vi.fn() });
  const overlay = { mostrar: vi.fn(), ocultar: vi.fn(), alternar: vi.fn(), enviarPanel: vi.fn(), enviarAviso: vi.fn() };
  const avisar = vi.fn();
  let ahora = 0;
  const filtro = new FiltroAvisos();
  const reiniciar = vi.spyOn(filtro, 'reiniciar');
  const contexto = vi.fn(async () => (o.contexto === undefined ? { build: null, rol: 'MIDDLE', objetos: {} } : o.contexto) as never);
  const p = crearOrquestadorPartida({
    crearConector: () => conector,
    overlay,
    obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, ...o.ajustes }),
    contexto,
    avisar,
    leerModo: async () => o.modo ?? 'sin_bordes',
    ahora: () => ahora,
    filtro,
    forzarPartida: o.forzar,
  });
  return { p, conector, overlay, avisar, reiniciar, contexto, avanzar: (ms: number) => (ahora += ms) };
}

describe('orquestador de la partida', () => {
  it('arrancar() con la depuración forzada inicia la partida y muestra el overlay', () => {
    const { p, conector, overlay } = montar({ forzar: true });
    p.arrancar();
    expect(conector.iniciar).toHaveBeenCalledOnce();
    expect(overlay.mostrar).toHaveBeenCalled();
    expect(p.enPartida()).toBe(true);
  });

  it('arrancar() sin forzar no hace nada, aunque COACH_FORZAR_PARTIDA valga «true» o «0»', () => {
    const previo = process.env.COACH_FORZAR_PARTIDA;
    try {
      for (const valor of [undefined, 'true', '0']) {
        if (valor === undefined) delete process.env.COACH_FORZAR_PARTIDA;
        else process.env.COACH_FORZAR_PARTIDA = valor;
        const { p, conector, overlay } = montar();
        p.arrancar();
        expect(conector.iniciar).not.toHaveBeenCalled();
        expect(overlay.mostrar).not.toHaveBeenCalled();
      }
      process.env.COACH_FORZAR_PARTIDA = '1';
      const { p, conector } = montar({ forzar: false });
      p.arrancar();
      expect(conector.iniciar).not.toHaveBeenCalled();
    } finally {
      if (previo === undefined) delete process.env.COACH_FORZAR_PARTIDA;
      else process.env.COACH_FORZAR_PARTIDA = previo;
    }
  });

  it('InProgress inicia el conector y muestra el overlay', async () => {
    const { p, conector, overlay } = montar();
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(conector.iniciar).toHaveBeenCalledTimes(1);
    expect(overlay.mostrar).toHaveBeenCalledTimes(1);
  });

  it('una segunda notificación InProgress no arranca otro conector', async () => {
    const { p, conector } = montar();
    await p.fase('InProgress');
    await p.fase('InProgress');
    expect(conector.iniciar).toHaveBeenCalledTimes(1);
  });

  it('en pantalla completa avisa a la ventana principal', async () => {
    const { p, avisar } = montar({ modo: 'pantalla_completa' });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(avisar).toHaveBeenCalledWith(t('aviso.pantallaCompleta'));
  });

  it('en modo sin bordes no avisa', async () => {
    const { p, avisar } = montar({ modo: 'sin_bordes' });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(avisar).not.toHaveBeenCalled();
  });

  it('cada estado envía el panel y, si el filtro lo deja, el aviso con la voz de los ajustes', async () => {
    const { p, conector, overlay, avanzar } = montar({ ajustes: { voz: true } });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await vi.waitFor(() => expect(overlay.enviarAviso).toHaveBeenCalledTimes(1));
    expect(overlay.enviarPanel).toHaveBeenCalledTimes(1);
    expect(overlay.enviarAviso.mock.calls[0]![0]).toEqual({ texto: t('fase.MIDDLE.temprana'), voz: true });
    // Segundo estado: el panel se envía siempre, el aviso no (antispam).
    avanzar(1000);
    conector.emit('estado', estadoPartida(1));
    await vi.waitFor(() => expect(overlay.enviarPanel).toHaveBeenCalledTimes(2));
    expect(overlay.enviarAviso).toHaveBeenCalledTimes(1);
  });

  it.each(['EndOfGame', 'None', 'Lobby'])('la fase %s detiene, oculta y reinicia el filtro', async (fase) => {
    const { p, conector, overlay, reiniciar, avisar } = montar();
    await p.fase('InProgress');
    await p.fase(fase);
    expect(conector.detener).toHaveBeenCalled();
    expect(overlay.ocultar).toHaveBeenCalled();
    expect(reiniciar).toHaveBeenCalled();
    expect(avisar).toHaveBeenLastCalledWith(null);
  });

  it('desconectado detiene, oculta y reinicia el filtro', async () => {
    const { p, conector, overlay, reiniciar } = montar();
    await p.fase('InProgress');
    p.desconectado();
    expect(conector.detener).toHaveBeenCalled();
    expect(overlay.ocultar).toHaveBeenCalled();
    expect(reiniciar).toHaveBeenCalled();
  });

  it('un estado que llega tras detener no se envía', async () => {
    const { p, conector, overlay } = montar();
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await p.fase('EndOfGame');
    await new Promise((r) => setTimeout(r, 5));
    expect(overlay.enviarPanel).not.toHaveBeenCalled();
  });

  it('fuera de partida ocultar/mostrar con la tecla rápida no hace nada', () => {
    const { p, overlay } = montar();
    p.alternar();
    expect(overlay.alternar).not.toHaveBeenCalled();
  });

  it('en partida la tecla rápida alterna el overlay', async () => {
    const { p, overlay } = montar();
    await p.fase('InProgress');
    p.alternar();
    expect(overlay.alternar).toHaveBeenCalledTimes(1);
  });

  it('si el contexto se rechaza no hay rechazo sin tratar ni aviso', async () => {
    const { p, conector, overlay, contexto } = montar();
    contexto.mockRejectedValue(new Error('boom'));
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await new Promise((r) => setTimeout(r, 5));
    expect(overlay.enviarAviso).not.toHaveBeenCalled();
  });

  it('sin contexto (datos no disponibles) sigue generando consejos sin build', async () => {
    const { p, conector, overlay } = montar({ contexto: null });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await vi.waitFor(() => expect(overlay.enviarAviso).toHaveBeenCalled());
  });
});
