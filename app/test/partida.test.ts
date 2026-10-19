import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { FiltroAvisos } from '../src/main/consejos/antispam';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import type { ModoVentana } from '../src/main/partida/modoVentana';
import { t } from '../src/shared/i18n';
import type { Ajustes, EstadoJungla, EstadoPartida } from '../src/shared/tiposApp';

const estadoPartida = (tiempo = 0): EstadoPartida => ({
  tiempo, oro: 500, nivel: 1, campeon: 'Ahri', objetos: [],
  habilidades: { Q: 0, W: 0, E: 0, R: 0 }, eventos: [],
});

function montar(o: { modo?: ModoVentana; ajustes?: Partial<Ajustes>; contexto?: unknown; forzar?: boolean; premium?: boolean } = {}) {
  let premium = o.premium ?? true;
  const conector = Object.assign(new EventEmitter(), { iniciar: vi.fn(), detener: vi.fn() });
  const overlay = { mostrar: vi.fn(), ocultar: vi.fn(), alternar: vi.fn(), enviarEstado: vi.fn(), enviarAviso: vi.fn(), enviarModo: vi.fn(), enviarJungla: vi.fn(), enviarVoz: vi.fn() };
  const avisar = vi.fn();
  const alCambiarPartida = vi.fn();
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
    alCambiarPartida,
    esPremium: () => premium,
  });
  /** Simula el primer estado válido de la Live Client Data API y espera a que se procese. */
  const primerEstado = async () => {
    conector.emit('estado', estadoPartida());
    await vi.waitFor(() => expect(overlay.mostrar).toHaveBeenCalled());
  };
  return {
    p, conector, overlay, avisar, reiniciar, contexto, alCambiarPartida, primerEstado,
    avanzar: (ms: number) => (ahora += ms),
    hacerPremium: (v: boolean) => void (premium = v),
  };
}

describe('orquestador de la partida', () => {
  it('arrancar() con la depuración forzada inicia el conector y el overlay sale con el primer estado', async () => {
    const { p, conector, overlay, primerEstado } = montar({ forzar: true });
    p.arrancar();
    expect(conector.iniciar).toHaveBeenCalledOnce();
    expect(overlay.mostrar).not.toHaveBeenCalled();
    await primerEstado();
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

  it('InProgress inicia el conector pero no muestra el overlay hasta el primer estado válido', async () => {
    const { p, conector, overlay, alCambiarPartida, primerEstado } = montar();
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(conector.iniciar).toHaveBeenCalledTimes(1);
    // TFT, ARAM, Arena o espectador: la Live Client Data API no da un estado válido y el overlay no sale.
    expect(overlay.mostrar).not.toHaveBeenCalled();
    expect(p.enPartida()).toBe(false);
    expect(alCambiarPartida).not.toHaveBeenCalled();
    await primerEstado();
    expect(overlay.mostrar).toHaveBeenCalledTimes(1);
    expect(alCambiarPartida).toHaveBeenCalledWith(true);
    expect(p.enPartida()).toBe(true);
    conector.emit('estado', estadoPartida(1));
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
    expect(overlay.mostrar).toHaveBeenCalledTimes(1);
    expect(alCambiarPartida).toHaveBeenCalledTimes(1);
  });

  it('Reconnect no detiene la partida', async () => {
    const { p, conector, primerEstado } = montar();
    await p.fase('InProgress');
    await primerEstado();
    await p.fase('Reconnect');
    expect(conector.detener).not.toHaveBeenCalled();
    expect(p.enPartida()).toBe(true);
  });

  it('una segunda notificación InProgress no arranca otro conector', async () => {
    const { p, conector } = montar();
    await p.fase('InProgress');
    await p.fase('InProgress');
    expect(conector.iniciar).toHaveBeenCalledTimes(1);
  });

  it('en pantalla completa avisa a la ventana principal al empezar la partida', async () => {
    const { p, avisar, primerEstado } = montar({ modo: 'pantalla_completa' });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(avisar).not.toHaveBeenCalled();
    await primerEstado();
    await vi.waitFor(() => expect(avisar).toHaveBeenCalledWith(t('aviso.pantallaCompleta')));
  });

  it('en modo sin bordes no avisa', async () => {
    const { p, avisar, primerEstado } = montar({ modo: 'sin_bordes' });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    await primerEstado();
    await new Promise((r) => setTimeout(r, 5));
    expect(avisar).not.toHaveBeenCalled();
  });

  it('cada estado envía el estado del overlay y, si el filtro lo deja, el aviso (solo visual: la voz va aparte)', async () => {
    const { p, conector, overlay, avanzar } = montar({ ajustes: { voz: true } });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await vi.waitFor(() => expect(overlay.enviarAviso).toHaveBeenCalledTimes(1));
    expect(overlay.enviarEstado).toHaveBeenCalledTimes(1);
    expect(overlay.enviarAviso.mock.calls[0]![0]).toEqual({ texto: t('fase.MIDDLE.temprana'), voz: false, tipo: 'fase' });
    // Segundo estado: el estado se envía siempre, el aviso no (antispam).
    avanzar(1000);
    conector.emit('estado', estadoPartida(1));
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
    expect(overlay.enviarAviso).toHaveBeenCalledTimes(1);
  });

  it('modo del overlay: «partida» con el primer estado válido y «oculto» al terminar', async () => {
    const { p, overlay, primerEstado } = montar();
    await p.fase('InProgress');
    expect(overlay.enviarModo).not.toHaveBeenCalled();
    await primerEstado();
    expect(overlay.enviarModo).toHaveBeenCalledWith('partida');
    await p.fase('EndOfGame');
    expect(overlay.enviarModo).toHaveBeenLastCalledWith('oculto');
  });

  it('recuerda el CS@10 del primer estado a partir de las 10:00 y lo olvida al terminar la partida', async () => {
    const { p, conector, overlay } = montar();
    await p.fase('InProgress');
    const ultimo = () => overlay.enviarEstado.mock.calls.at(-1)![0];
    conector.emit('estado', { ...estadoPartida(599), cs: 70 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
    expect(ultimo().cs.cs10).toBeNull();
    conector.emit('estado', { ...estadoPartida(601), cs: 72 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
    conector.emit('estado', { ...estadoPartida(700), cs: 85 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(3));
    expect(ultimo().cs).toMatchObject({ cs: 85, cs10: 72 });
    await p.fase('EndOfGame');
    await p.fase('InProgress');
    conector.emit('estado', { ...estadoPartida(30), cs: 0 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(4));
    expect(ultimo().cs.cs10).toBeNull();
  });

  it('con el widget de avisos apagado no se envían avisos', async () => {
    const { p, conector, overlay } = montar({
      ajustes: { overlay: { ...AJUSTES_POR_DEFECTO.overlay, widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, avisos: { activo: false, x: null, y: null, escala: 1 } } } },
    });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 5));
    expect(overlay.enviarAviso).not.toHaveBeenCalled();
  });

  describe('voz', () => {
    const conVoz = (activa: boolean) => ({ overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, activa } } });

    it('con la voz activa envía las frases nuevas al overlay (una vez cada una)', async () => {
      const { p, conector, overlay } = montar({ ajustes: conVoz(true) });
      await p.fase('InProgress');
      conector.emit('estado', estadoPartida(10));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      // La fase inicial no se dice; el cambio a la fase media sí, una vez.
      expect(overlay.enviarVoz).not.toHaveBeenCalled();
      const fases = () => overlay.enviarVoz.mock.calls.map((c) => c[0]).filter((f) => f.tipo === 'fase');
      conector.emit('estado', estadoPartida(840));
      await vi.waitFor(() => expect(fases()).toHaveLength(1));
      expect(fases()[0]).toMatchObject({ texto: t('fase.MIDDLE.media') });
      const enviadas = overlay.enviarVoz.mock.calls.length;
      conector.emit('estado', estadoPartida(841));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(3));
      expect(overlay.enviarVoz).toHaveBeenCalledTimes(enviadas);
    });

    it('apagada (por defecto) no envía nada', async () => {
      const { p, conector, overlay } = montar();
      await p.fase('InProgress');
      conector.emit('estado', estadoPartida(10));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalled());
      expect(overlay.enviarVoz).not.toHaveBeenCalled();
    });
  });

  describe('temporizadores de la jungla', () => {
    const conJungla = (activo: boolean) => ({
      overlay: { ...AJUSTES_POR_DEFECTO.overlay, widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, jungla: { activo, x: null, y: null, escala: 1 } } },
    });
    const campamento = (j: EstadoJungla, id: string) => j.campamentos.find((c) => c.id === id)!;

    it('con el widget activo envía el estado de la jungla con cada estado y al marcar un campamento', async () => {
      const { p, conector, overlay } = montar({ ajustes: conJungla(true) });
      await p.fase('InProgress');
      conector.emit('estado', { ...estadoPartida(100), equipo: 'CHAOS' });
      await vi.waitFor(() => expect(overlay.enviarJungla).toHaveBeenCalledTimes(1));
      expect(overlay.enviarJungla.mock.calls[0]![0].lado).toBe('rojo');
      p.marcarJungla('azul');
      expect(overlay.enviarJungla).toHaveBeenCalledTimes(2);
      expect(campamento(overlay.enviarJungla.mock.calls[1]![0], 'azul')).toMatchObject({ marcado: true, aparece: 300 });
      // Un id que no es de la lista se ignora.
      p.marcarJungla('enemigoAzul' as never);
      expect(overlay.enviarJungla).toHaveBeenCalledTimes(2);
    });

    it('apagado (por defecto) no envía nada y no se puede marcar', async () => {
      const { p, conector, overlay } = montar();
      await p.fase('InProgress');
      conector.emit('estado', estadoPartida(100));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalled());
      p.marcarJungla('azul');
      expect(overlay.enviarJungla).not.toHaveBeenCalled();
    });

    it('fuera de partida no se marca nada y las marcas se borran al terminar', async () => {
      const { p, conector, overlay } = montar({ ajustes: conJungla(true) });
      p.marcarJungla('azul');
      expect(overlay.enviarJungla).not.toHaveBeenCalled();
      await p.fase('InProgress');
      conector.emit('estado', estadoPartida(100));
      await vi.waitFor(() => expect(overlay.enviarJungla).toHaveBeenCalled());
      p.marcarJungla('rojo');
      await p.fase('EndOfGame');
      await p.fase('InProgress');
      conector.emit('estado', estadoPartida(110));
      await vi.waitFor(() => expect(overlay.enviarJungla).toHaveBeenCalledTimes(3));
      expect(campamento(overlay.enviarJungla.mock.calls[2]![0], 'rojo').marcado).toBe(false);
    });
  });

  it.each(['EndOfGame', 'None', 'Lobby', 'PreEndOfGame', 'WaitingForStats', 'ChampSelect', 'GameStart', 'Matchmaking'])(
    'la fase %s detiene, oculta, reinicia el filtro y libera la tecla rápida',
    async (fase) => {
      const { p, conector, overlay, reiniciar, avisar, alCambiarPartida, primerEstado } = montar();
      await p.fase('InProgress');
      await primerEstado();
      await p.fase(fase);
      expect(conector.detener).toHaveBeenCalled();
      expect(overlay.ocultar).toHaveBeenCalled();
      expect(reiniciar).toHaveBeenCalled();
      expect(avisar).toHaveBeenLastCalledWith(null);
      expect(alCambiarPartida).toHaveBeenLastCalledWith(false);
      expect(p.enPartida()).toBe(false);
    },
  );

  it('fuera de partida, un cambio de fase no oculta el overlay (p. ej. en modo mover)', async () => {
    const { p, overlay, alCambiarPartida } = montar();
    await p.fase('Lobby');
    await p.fase('Matchmaking');
    expect(overlay.ocultar).not.toHaveBeenCalled();
    expect(alCambiarPartida).not.toHaveBeenCalled();
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
    expect(overlay.enviarEstado).not.toHaveBeenCalled();
  });

  it('fuera de partida ocultar/mostrar con la tecla rápida no hace nada', () => {
    const { p, overlay } = montar();
    p.alternar();
    expect(overlay.alternar).not.toHaveBeenCalled();
  });

  it('en partida la tecla rápida alterna el overlay, pero no antes del primer estado válido', async () => {
    const { p, overlay, primerEstado } = montar();
    await p.fase('InProgress');
    p.alternar();
    expect(overlay.alternar).not.toHaveBeenCalled();
    await primerEstado();
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

describe('restricciones del plan (el coach en partida es Premium)', () => {
  const BLOQUEADO = 'El coach en partida es Premium. Actívalo en la sección Premium.';

  it('el texto del aviso está en español', () => {
    expect(t('premium.coachBloqueado')).toBe(BLOQUEADO);
  });

  it('plan gratuito: InProgress no inicia el conector ni el overlay y avisa a la ventana principal', async () => {
    const { p, conector, overlay, avisar } = montar({ premium: false });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(conector.iniciar).not.toHaveBeenCalled();
    expect(overlay.mostrar).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(BLOQUEADO);
    expect(p.enPartida()).toBe(false);
    // Reconnect sigue siendo la misma partida: no repite el aviso ni inicia nada.
    await p.fase('Reconnect');
    expect(conector.iniciar).not.toHaveBeenCalled();
    // Al terminar la partida, el aviso se borra.
    await p.fase('EndOfGame');
    expect(avisar).toHaveBeenLastCalledWith(null);
  });

  it('plan gratuito: COACH_FORZAR_PARTIDA tampoco salta la restricción', () => {
    const { p, conector, avisar } = montar({ premium: false, forzar: true });
    p.arrancar();
    expect(conector.iniciar).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(BLOQUEADO);
  });

  it('plan premium: se comporta como en v1', async () => {
    const { p, conector, avisar, primerEstado } = montar({ premium: true });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(conector.iniciar).toHaveBeenCalledOnce();
    await primerEstado();
    expect(p.enPartida()).toBe(true);
    expect(avisar).not.toHaveBeenCalledWith(BLOQUEADO);
  });

  it('pasar a premium a mitad de partida activa el overlay con el siguiente estado', async () => {
    const { p, conector, overlay, avisar, hacerPremium, primerEstado } = montar({ premium: false });
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    expect(conector.iniciar).not.toHaveBeenCalled();
    hacerPremium(true);
    p.planCambiado();
    expect(conector.iniciar).toHaveBeenCalledOnce();
    expect(avisar).toHaveBeenLastCalledWith(null);
    await primerEstado();
    expect(overlay.mostrar).toHaveBeenCalled();
    // Otro aviso de cambio con la partida ya en marcha no crea un segundo conector.
    p.planCambiado();
    expect(conector.iniciar).toHaveBeenCalledOnce();
  });

  it('un cambio de plan fuera de partida no inicia nada', () => {
    const { p, conector, hacerPremium } = montar({ premium: false });
    hacerPremium(true);
    p.planCambiado();
    expect(conector.iniciar).not.toHaveBeenCalled();
  });

  it('perder premium a mitad de partida no corta la partida en curso', async () => {
    const { p, conector, hacerPremium, primerEstado } = montar({ premium: true });
    await p.fase('InProgress');
    await primerEstado();
    hacerPremium(false);
    p.planCambiado();
    expect(conector.detener).not.toHaveBeenCalled();
    expect(p.enPartida()).toBe(true);
  });
});
