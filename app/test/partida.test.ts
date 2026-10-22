import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { FiltroAvisos } from '../src/main/consejos/antispam';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import { SelectorFijo } from '../src/main/consejos/variantes';
import type { ModoVentana } from '../src/main/partida/modoVentana';
import { t } from '../src/shared/i18n';
import type { Ajustes, EstadoCarga, EstadoJungla, EstadoPartida } from '../src/shared/tiposApp';

const estadoPartida = (tiempo = 0): EstadoPartida => ({
  tiempo, oro: 500, nivel: 1, campeon: 'Ahri', objetos: [],
  habilidades: { Q: 0, W: 0, E: 0, R: 0 }, eventos: [],
});

/** Avisos emergentes encendidos (desde la 3.0.1 salen apagados por defecto). */
const conAvisos = (extra: Partial<Ajustes> = {}): Partial<Ajustes> => {
  const base = extra.overlay ?? AJUSTES_POR_DEFECTO.overlay;
  return { ...extra, overlay: { ...base, widgets: { ...base.widgets, avisos: { ...base.widgets.avisos, activo: true } } } };
};

function montar(o: { modo?: ModoVentana; ajustes?: Partial<Ajustes>; contexto?: unknown; forzar?: boolean; premium?: boolean; carga?: EstadoCarga | null; cargaActiva?: () => boolean } = {}) {
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
    cargaActual: () => o.carga ?? null,
    cargaActiva: o.cargaActiva,
    variantes: () => new SelectorFijo(),
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
    const { p, conector, overlay, avanzar } = montar({ ajustes: conAvisos({ voz: true }) });
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

  it('con la pantalla de carga a la vista, un estado con el reloj parado (≈ 0 s) no la sustituye; con el reloj en marcha, sí', async () => {
    const { p, conector, overlay, alCambiarPartida } = montar({ cargaActiva: () => true });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida(0));
    conector.emit('estado', estadoPartida(0.4));
    conector.emit('estado', estadoPartida(1.5));
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay.mostrar).not.toHaveBeenCalled();
    expect(overlay.enviarModo).not.toHaveBeenCalled();
    expect(alCambiarPartida).not.toHaveBeenCalled();
    conector.emit('estado', estadoPartida(2));
    await vi.waitFor(() => expect(overlay.enviarModo).toHaveBeenCalledWith('partida'));
    expect(alCambiarPartida).toHaveBeenCalledWith(true);
  });

  it('sin pantalla de carga (reconexión, carga fallida) el overlay sale con el primer estado aunque marque 0 s', async () => {
    const { p, conector, overlay } = montar({ cargaActiva: () => false });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida(0));
    await vi.waitFor(() => expect(overlay.enviarModo).toHaveBeenCalledWith('partida'));
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
    expect(ultimo().rendimiento.cs.cs10).toBeNull();
    conector.emit('estado', { ...estadoPartida(601), cs: 72 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
    conector.emit('estado', { ...estadoPartida(700), cs: 85 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(3));
    expect(ultimo().rendimiento.cs).toMatchObject({ cs: 85, cs10: 72 });
    await p.fase('EndOfGame');
    await p.fase('InProgress');
    conector.emit('estado', { ...estadoPartida(30), cs: 0 });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(4));
    expect(ultimo().rendimiento.cs.cs10).toBeNull();
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
      const { p, conector, overlay, avanzar } = montar({ ajustes: conVoz(true) });
      await p.fase('InProgress');
      conector.emit('estado', estadoPartida(10));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      // La fase inicial no se dice; el cambio a la fase media sí, una vez.
      expect(overlay.enviarVoz).not.toHaveBeenCalled();
      const fases = () => overlay.enviarVoz.mock.calls.map((c) => c[0]).filter((f) => f.tipo === 'fase');
      let estados = 1;
      const siguiente = async (tiempo: number) => {
        conector.emit('estado', estadoPartida(tiempo));
        const n = ++estados;
        await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(n));
      };
      await siguiente(840);
      // 3.1: el regulador suelta como mucho una frase no urgente cada 5 s (aquí también esperan el Heraldo y el
      // guardián de control): la fase sale cuando le toca, sin perderse.
      for (let s = 841; fases().length === 0 && s < 860; s++) {
        avanzar(5_000);
        await siguiente(s);
      }
      expect(fases()).toHaveLength(1);
      expect(fases()[0]).toMatchObject({ texto: t('voz.fase.MIDDLE.media.1') });
      const enviadas = overlay.enviarVoz.mock.calls.length;
      await siguiente(861);
      expect(overlay.enviarVoz.mock.calls.slice(enviadas).map((c) => c[0].tipo)).not.toContain('fase');
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

  it('si el cliente de LoL se cierra en plena partida, el coach sigue y termina con la siguiente fase', async () => {
    const { p, conector, overlay, primerEstado } = montar();
    p.conectado('C:/Riot/LoL');
    await p.fase('InProgress');
    await primerEstado();
    p.desconectado();
    expect(conector.detener).not.toHaveBeenCalled();
    expect(overlay.ocultar).not.toHaveBeenCalled();
    expect(p.enPartida()).toBe(true);
    conector.emit('estado', estadoPartida(60));
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
    // El cliente vuelve y la partida ya terminó.
    p.conectado('C:/Riot/LoL');
    await p.fase('EndOfGame');
    expect(conector.detener).toHaveBeenCalled();
    expect(p.enPartida()).toBe(false);
  });

  it('sin cliente de LoL, la partida termina tras varios fallos seguidos de la Live Client Data API', async () => {
    const { p, conector, overlay, primerEstado } = montar();
    await p.fase('InProgress');
    await primerEstado();
    p.desconectado();
    for (let i = 0; i < 9; i++) conector.emit('fallo');
    conector.emit('estado', estadoPartida(60)); // un estado válido reinicia la cuenta
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
    for (let i = 0; i < 9; i++) conector.emit('fallo');
    expect(conector.detener).not.toHaveBeenCalled();
    conector.emit('fallo');
    expect(conector.detener).toHaveBeenCalled();
    expect(overlay.ocultar).toHaveBeenCalled();
    expect(p.enPartida()).toBe(false);
  });

  it('con el cliente de LoL conectado, los fallos de la Live Client Data API no terminan la partida', async () => {
    const { p, conector, primerEstado } = montar();
    await p.fase('InProgress');
    await primerEstado();
    for (let i = 0; i < 30; i++) conector.emit('fallo');
    expect(conector.detener).not.toHaveBeenCalled();
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
    const { p, conector, overlay } = montar({ contexto: null, ajustes: conAvisos() });
    await p.fase('InProgress');
    conector.emit('estado', estadoPartida());
    await vi.waitFor(() => expect(overlay.enviarAviso).toHaveBeenCalled());
  });

  describe('3.0.1: sin avisos emergentes', () => {
    const build = { ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R'], nucleo: [], botas: null, situacionales: [] };
    const conBuild = { build, rol: 'MIDDLE', objetos: {} };

    it('por defecto no sale ningún aviso en pantalla, pero la voz sigue (si está activa)', async () => {
      const voz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true };
      const { p, conector, overlay, avanzar } = montar({ contexto: conBuild, ajustes: { overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz } } });
      await p.fase('InProgress');
      conector.emit('estado', { ...estadoPartida(5), nivel: 1 });
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      avanzar(20_000);
      conector.emit('estado', { ...estadoPartida(900), nivel: 1 });
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
      expect(overlay.enviarAviso).not.toHaveBeenCalled();
      expect(overlay.enviarVoz).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'habilidad' }));
    });

    it('con los avisos encendidos, «Nivel X: sube la Y» nunca sale como aviso: lo sustituye la flecha', async () => {
      const voz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true };
      const ajustes = conAvisos({ overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz }, avisos: { compra: false, habilidad: true, objetivo: false, vision: false, fase: false } });
      const { p, conector, overlay } = montar({ contexto: conBuild, ajustes });
      await p.fase('InProgress');
      conector.emit('estado', { ...estadoPartida(5), nivel: 1 });
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      expect(overlay.enviarEstado.mock.calls[0]![0].proximaHabilidad).toBe('Q');
      expect(overlay.enviarVoz).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'habilidad' }));
      await new Promise((r) => setTimeout(r, 5));
      expect(overlay.enviarAviso).not.toHaveBeenCalled();
    });
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

  it('en ARAM el estado del overlay oculta objetivos y jungla, sin avisos de fase ni estado de la jungla', async () => {
    const { p, conector, overlay } = montar({ forzar: true });
    p.arrancar();
    conector.emit('estado', { ...estadoPartida(1500), modo: 'aram' });
    await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalled());
    const estado = overlay.enviarEstado.mock.calls[0]![0];
    expect(estado).toMatchObject({ modo: 'aram', objetivos: [], widgets: { objetivos: false, cs: true, jungla: false, compra: true, habilidad: true } });
    expect(overlay.enviarAviso).not.toHaveBeenCalled();
    expect(overlay.enviarJungla).not.toHaveBeenCalled();
  });

  describe('jungla enemigo (Track F)', () => {
    const jugadores: EstadoPartida['jugadores'] = [
      { campeon: 'Ahri', equipo: 'ORDER', posicion: null, castigo: false },
      { campeon: 'Jinx', equipo: 'ORDER', posicion: null, castigo: false },
      { campeon: 'LeeSin', equipo: 'CHAOS', posicion: null, castigo: true },
    ];
    const carga: EstadoCarga = {
      version: '16.20.1',
      jugadores: [
        { equipo: 'aliado', riotId: 'a#1', campeonId: 103, campeon: 'Ahri', nombre: 'Ahri', rol: 'MIDDLE', rango: null, maestria: null, campeonWinrate: null, etiquetas: [] },
        { equipo: 'aliado', riotId: 'b#1', campeonId: 222, campeon: 'Jinx', nombre: 'Jinx', rol: 'BOTTOM', rango: null, maestria: null, campeonWinrate: null, etiquetas: [] },
        { equipo: 'enemigo', riotId: 'c#1', campeonId: 64, campeon: 'LeeSin', nombre: 'Lee Sin', rol: 'JUNGLE', rango: null, maestria: null, campeonWinrate: null, etiquetas: [] },
      ],
      rutaJungla: { campeon: 'LeeSin', texto: 'Estimación: Lee Sin suele empezar por rojo y gankear bot hacia el minuto 3' },
    };
    const conVoz = (extra: Partial<Ajustes> = {}): Partial<Ajustes> => ({
      overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true } },
      ...extra,
    });
    const en = (tiempo: number, eventos: EstadoPartida['eventos'] = []): EstadoPartida => ({
      ...estadoPartida(tiempo),
      equipo: 'ORDER',
      modo: 'clasificatoria',
      jugadores,
      eventos,
    });
    const kill = { nombre: 'ChampionKill', tiempo: 180, id: 7, asesino: 'LeeSin', victima: 'Jinx', asistentes: [] };
    const TEXTO = 'El jungla enemigo acaba de aparecer en bot (kill)';

    it('una kill del jungla enemigo sale como aviso y por voz (tipo junglaEnemiga)', async () => {
      const { p, conector, overlay } = montar({ forzar: true, carga, ajustes: conAvisos(conVoz()) });
      p.arrancar();
      conector.emit('estado', en(100));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      conector.emit('estado', en(181, [kill]));
      await vi.waitFor(() => expect(overlay.enviarAviso).toHaveBeenCalledWith({ texto: TEXTO, voz: false }));
      expect(overlay.enviarVoz).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'junglaEnemiga', texto: TEXTO }));
    });

    it('3.0.1: por defecto la kill del jungla enemigo solo se dice por voz (sin aviso en pantalla)', async () => {
      const { p, conector, overlay } = montar({ forzar: true, carga, ajustes: conVoz() });
      p.arrancar();
      conector.emit('estado', en(100));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      conector.emit('estado', en(181, [kill]));
      await vi.waitFor(() => expect(overlay.enviarVoz).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'junglaEnemiga', texto: TEXTO })));
      expect(overlay.enviarAviso).not.toHaveBeenCalled();
    });

    it('3.0.2: objetivos y torres del jungla enemigo, todos por voz en el mismo estado y solo por voz', async () => {
      const { p, conector, overlay } = montar({ forzar: true, carga, ajustes: conVoz() });
      p.arrancar();
      conector.emit('estado', en(1000));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      conector.emit('estado', en(1203, [
        { nombre: 'DragonKill', tiempo: 1200, id: 20, dragon: 'Fire', asesino: 'LeeSin', asistentes: [] },
        { nombre: 'TurretKilled', tiempo: 1202, id: 21, asistentes: ['LeeSin'], estructura: 'Turret_T1_R_03_A' },
      ]));
      const delJungla = () => overlay.enviarVoz.mock.calls.map((c) => c[0]).filter((f) => f.tipo === 'junglaEnemiga').map((f) => f.texto);
      await vi.waitFor(() => expect(delJungla()).toHaveLength(2));
      expect(delJungla()).toEqual(['El jungla enemigo acaba de hacer el dragón', 'El jungla enemigo acaba de tirar la torre de bot']);
      expect(overlay.enviarAviso).not.toHaveBeenCalled();
    });

    it('con el ajuste apagado no hay avisos del jungla enemigo', async () => {
      const { p, conector, overlay } = montar({ forzar: true, carga, ajustes: conVoz({ junglaEnemiga: { avisos: false, ruta: false } }) });
      p.arrancar();
      conector.emit('estado', en(100));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(1));
      conector.emit('estado', en(181, [kill]));
      await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(2));
      expect(overlay.enviarAviso).not.toHaveBeenCalledWith(expect.objectContaining({ texto: TEXTO }));
      expect(overlay.enviarVoz).not.toHaveBeenCalledWith(expect.objectContaining({ tipo: 'junglaEnemiga' }));
    });

    it('la ruta estimada se dice una sola vez a los 0:30, solo con el ajuste encendido', async () => {
      const ruta = carga.rutaJungla!.texto;
      const { p, conector, overlay } = montar({ forzar: true, carga, ajustes: conVoz({ junglaEnemiga: { avisos: true, ruta: true } }) });
      p.arrancar();
      for (const [i, tiempo] of [20, 29, 30, 31, 45].entries()) {
        conector.emit('estado', en(tiempo));
        await vi.waitFor(() => expect(overlay.enviarEstado).toHaveBeenCalledTimes(i + 1));
      }
      const dichas = overlay.enviarVoz.mock.calls.map((c) => c[0]).filter((f) => f.texto === ruta);
      expect(dichas).toHaveLength(1);
      expect(dichas[0]).toMatchObject({ tipo: 'junglaEnemiga' });

      const aram = montar({ forzar: true, carga, ajustes: conVoz({ junglaEnemiga: { avisos: true, ruta: true } }) });
      aram.p.arrancar();
      aram.conector.emit('estado', { ...en(30), modo: 'aram' });
      await vi.waitFor(() => expect(aram.overlay.enviarEstado).toHaveBeenCalledTimes(1));
      expect(aram.overlay.enviarVoz).not.toHaveBeenCalledWith(expect.objectContaining({ texto: ruta }));

      const apagada = montar({ forzar: true, carga, ajustes: conVoz() });
      apagada.p.arrancar();
      apagada.conector.emit('estado', en(30));
      await vi.waitFor(() => expect(apagada.overlay.enviarEstado).toHaveBeenCalledTimes(1));
      expect(apagada.overlay.enviarVoz).not.toHaveBeenCalledWith(expect.objectContaining({ texto: ruta }));
    });
  });
});
