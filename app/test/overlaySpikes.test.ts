import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { crearAtajosReliquias } from '../src/main/consejos/atajosReliquias';
import { resumenOverlay } from '../src/main/consejos/motor';
import { ReguladorVoz } from '../src/main/consejos/regulador';
import { DetectorSpikes, enemigosVigilados, idBase, OBJETOS_SPIKE, SPIKE_CADA_MS, type EntradaSpikes } from '../src/main/consejos/spikes';
import { SelectorFijo, textosVariantes } from '../src/main/consejos/variantes';
import { DisparadorVoz, PRIORIDAD_VOZ } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import { IDIOMAS, t, textosDe } from '../src/shared/i18n';
import { puestosPartida } from '../src/shared/puesto';
import { estadoReliquias, marcarReliquia, RELIQUIA_RAYO_S, RELIQUIA_REAPARECE_S, RELIQUIAS, restanteReliquia } from '../src/shared/reliquias';
import type { JugadorHistorial } from '../src/shared/perfil';
import type { Ajustes, AjustesVoz, EstadoPartida, EstadoReliquias, JugadorCarga, JugadorPartida } from '../src/shared/tiposApp';
import type { ModoJuego } from '@coach/shared';
import { CATEGORIAS_NIVEL, GRUPOS_VOZ, tiposDeNivel } from '../src/shared/vozCategorias';

/*
 * 3.9 · Sector overlay: power spike del rival (mejora 3), reliquias de vida en ARAM (mejora 7) y puesto del 1.º al
 * 10.º con MVP y ACE (mejora 6).
 */

const objetos = {
  3157: { name: 'Reloj de arena de Zhonya', gold: { total: 3250 } },
  3026: { name: 'Ángel de la guarda', gold: { total: 3200 } },
  3089: { name: 'Sombrero mortal de Rabadon', gold: { total: 3500 } },
  3031: { name: 'Filo infinito', gold: { total: 3500 } },
  3165: { name: 'Morellonomicón', gold: { total: 2850 } },
  1056: { name: 'Anillo de Doran', gold: { total: 400 } },
  1001: { name: 'Botas', gold: { total: 300 } },
  6653: { name: 'Tormento de Liandry', gold: { total: 3000 } },
} as unknown as DatosEstaticos['objetos'];

const j = (campeon: string, equipo: 'ORDER' | 'CHAOS', objetosJ: number[] = [], posicion: JugadorPartida['posicion'] = null): JugadorPartida => ({
  campeon,
  nombre: campeon === 'LeeSin' ? 'Lee Sin' : campeon,
  equipo,
  posicion,
  castigo: false,
  objetos: objetosJ,
});

/** Partida de la Grieta: tú (Ahri, central) contra Zed (central, sin objetos caros) y cuatro enemigos más ricos. */
function jugadores(extra: Partial<Record<string, number[]>> = {}): JugadorPartida[] {
  return [
    j('Ahri', 'ORDER', [], 'MIDDLE'),
    j('Zed', 'CHAOS', extra.Zed ?? [1056], 'MIDDLE'),
    j('Jinx', 'CHAOS', extra.Jinx ?? [6653, 6653], 'BOTTOM'),
    j('Darius', 'CHAOS', extra.Darius ?? [6653, 6653], 'TOP'),
    j('LeeSin', 'CHAOS', extra.LeeSin ?? [6653, 6653], 'JUNGLE'),
    j('Lulu', 'CHAOS', extra.Lulu ?? [1001], 'UTILITY'),
  ];
}

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return {
    tiempo: 600, oro: 0, nivel: 9, campeon: 'Ahri', objetos: [1056], habilidades: { Q: 3, W: 2, E: 2, R: 1 }, eventos: [],
    equipo: 'ORDER', modo: 'clasificatoria', jugadores: jugadores(), muerto: false, ...p,
  };
}

const entrada = (e: EstadoPartida, carga: JugadorCarga[] | null = null): EntradaSpikes => ({ estado: e, rol: 'MIDDLE', objetos, carga });

describe('3.9 · power spike del rival: lista de objetos clave', () => {
  it('una lista corta (12) con un efecto por objeto: estasis, revivir, antiheal, escudo y daño', () => {
    expect(Object.keys(OBJETOS_SPIKE)).toHaveLength(12);
    expect(OBJETOS_SPIKE[3157]).toBe('estasis');
    expect(OBJETOS_SPIKE[3026]).toBe('revivir');
    expect(OBJETOS_SPIKE[3089]).toBe('dano');
    expect(OBJETOS_SPIKE[3031]).toBe('dano');
    expect(OBJETOS_SPIKE[3165]).toBe('antiheal');
    expect(OBJETOS_SPIKE[3102]).toBe('escudo');
    expect(new Set(Object.values(OBJETOS_SPIKE))).toEqual(new Set(['estasis', 'revivir', 'antiheal', 'escudo', 'dano']));
    // Un objeto caro pero sin un efecto que cambie la pelea (Liandry) no está.
    expect(OBJETOS_SPIKE[6653]).toBeUndefined();
  });

  it('los objetos de Arena (6 cifras) se reducen al id base', () => {
    expect(idBase(223157)).toBe(3157);
    expect(idBase(3157)).toBe(3157);
  });
});

describe('3.9 · power spike del rival: a quién se vigila', () => {
  it('el rival de línea (aunque tenga poco oro) y los 3 enemigos con más oro en objetos (lo que suma el Tab)', () => {
    const vigilados = enemigosVigilados(entrada(estado())).map((x) => x.campeon);
    expect(vigilados[0]).toBe('Zed');
    expect(vigilados.sort()).toEqual(['Darius', 'Jinx', 'LeeSin', 'Zed']);
    expect(vigilados).not.toContain('Lulu');
  });

  it('el rol de la pantalla de carga manda sobre la posición del marcador', () => {
    const carga = [{ equipo: 'enemigo', campeon: 'Lulu', rol: 'MIDDLE' }, { equipo: 'enemigo', campeon: 'Zed', rol: 'UTILITY' }] as unknown as JugadorCarga[];
    const vigilados = enemigosVigilados(entrada(estado(), carga)).map((x) => x.campeon);
    expect(vigilados[0]).toBe('Lulu');
    expect(vigilados).not.toContain('Zed');
  });

  it('en ARAM no hay rival de línea: solo los 3 con más oro', () => {
    const vigilados = enemigosVigilados(entrada(estado({ modo: 'aram' }))).map((x) => x.campeon);
    expect(vigilados.sort()).toEqual(['Darius', 'Jinx', 'LeeSin']);
  });
});

describe('3.9 · power spike del rival: detector', () => {
  it('el primer estado solo aprende; luego avisa una vez cuando el rival de línea termina Zhonya', () => {
    const d = new DetectorSpikes();
    expect(d.procesar(entrada(estado({ jugadores: jugadores({ Zed: [3026] }) })), true)).toEqual([]);
    expect(d.procesar(entrada(estado({ tiempo: 601, jugadores: jugadores({ Zed: [3026, 3157] }) })), false)).toEqual([
      { campeon: 'Zed', nombreCampeon: 'Zed', objeto: 3157, nombreObjeto: 'Reloj de arena de Zhonya', efecto: 'estasis' },
    ]);
    // El mismo objeto no se repite (aunque lo venda y lo vuelva a comprar).
    expect(d.procesar(entrada(estado({ tiempo: 602, jugadores: jugadores({ Zed: [3026] }) })), false)).toEqual([]);
    expect(d.procesar(entrada(estado({ tiempo: 603, jugadores: jugadores({ Zed: [3026, 3157] }) })), false)).toEqual([]);
  });

  it('no avisa de un enemigo que no es tu rival ni está entre los 3 con más oro, ni de objetos que no son clave', () => {
    const d = new DetectorSpikes();
    d.procesar(entrada(estado()), true);
    expect(d.procesar(entrada(estado({ tiempo: 601, jugadores: jugadores({ Lulu: [3165] }) })), false)).toEqual([]);
    expect(d.procesar(entrada(estado({ tiempo: 602, jugadores: jugadores({ Jinx: [6653, 6653, 1001] }) })), false)).toEqual([]);
    // Lo que Lulu ya tenía no sale si después entra en el top 3.
    const rica = jugadores({ Lulu: [3165, 3089, 3031], Jinx: [1001], Darius: [1001] });
    expect(d.procesar(entrada(estado({ tiempo: 603, jugadores: rica })), false).map((s) => s.objeto)).toEqual([3089, 3031]);
  });

  it('el rival de línea va primero si varios terminan a la vez; nada en Arena ni sin equipo', () => {
    const d = new DetectorSpikes();
    d.procesar(entrada(estado()), true);
    const r = d.procesar(entrada(estado({ tiempo: 601, jugadores: jugadores({ Jinx: [6653, 6653, 3031], Zed: [3089] }) })), false);
    expect(r.map((s) => s.campeon)).toEqual(['Zed', 'Jinx']);
    const arena = new DetectorSpikes();
    arena.procesar(entrada(estado({ modo: 'arena' })), true);
    expect(arena.procesar(entrada(estado({ modo: 'arena', jugadores: jugadores({ Zed: [3157] }) })), false)).toEqual([]);
    expect(new DetectorSpikes().procesar(entrada(estado({ equipo: undefined })), false)).toEqual([]);
  });

  it('solo usa los objetos del marcador (allgamedata): sin objetos no hay aviso, y reiniciar olvida la partida', () => {
    const d = new DetectorSpikes();
    const sinObjetos = jugadores().map((x) => ({ ...x, objetos: undefined }));
    expect(d.procesar(entrada(estado({ jugadores: sinObjetos })), false)).toEqual([]);
    d.procesar(entrada(estado({ jugadores: jugadores({ Zed: [3157] }) })), true);
    d.reiniciar();
    expect(d.procesar(entrada(estado({ jugadores: jugadores({ Zed: [3157] }) })), false)).toHaveLength(1);
  });
});

describe('3.9 · power spike del rival: voz', () => {
  const COMPLETA: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, tipos: tiposDeNivel('completo') };
  const solo = (...tipos: string[]): AjustesVoz => ({
    ...COMPLETA,
    tipos: Object.fromEntries(Object.keys(COMPLETA.tipos).map((k) => [k, tipos.includes(k)])) as AjustesVoz['tipos'],
  });
  const procesar = (d: DisparadorVoz, e: EstadoPartida, voz: AjustesVoz) =>
    d.procesar({ estado: e, overlay: resumenOverlay(e, null, 'MIDDLE', objetos, ''), rol: 'MIDDLE', marcas: {}, jungla: false, objetos }, voz);

  it('«{campeón} ha terminado {objeto}» con su implicación, prioridad media, grupo «spike» y 20 s de enfriamiento', () => {
    const d = new DisparadorVoz({ selector: new SelectorFijo() });
    procesar(d, estado(), solo('spike'));
    const [f] = procesar(d, estado({ tiempo: 601, jugadores: jugadores({ Zed: [3026] }) }), solo('spike'));
    expect(f).toMatchObject({ tipo: 'spike', prioridad: PRIORIDAD_VOZ.spike, grupo: 'spike', enfriamientoMs: SPIKE_CADA_MS });
    expect(f!.texto).toBe(textosVariantes('voz.spike.revivir', { campeon: 'Zed', objeto: 'Ángel de la guarda' })[0]);
    expect(f!.texto).toBe('Zed ha terminado Ángel de la guarda: hay que matarlo dos veces');
    // Prioridad media: ni urgente (objetivos, peleas) ni de relleno.
    expect(PRIORIDAD_VOZ.spike).toBeGreaterThan(PRIORIDAD_VOZ.objetivo30);
    expect(PRIORIDAD_VOZ.spike).toBeLessThan(PRIORIDAD_VOZ.fase);
    expect(d.ultimosSpikes.map((s) => s.objeto)).toEqual([3026]);
  });

  it('con la categoría apagada no se dice (pero sí se detecta para el aviso escrito)', () => {
    const d = new DisparadorVoz({ selector: new SelectorFijo() });
    procesar(d, estado(), solo('combate'));
    expect(procesar(d, estado({ tiempo: 601, jugadores: jugadores({ Zed: [3157] }) }), solo('combate'))).toEqual([]);
    expect(d.ultimosSpikes).toHaveLength(1);
  });

  it('el regulador deja como mucho uno cada 20 s', () => {
    const r = new ReguladorVoz();
    const frase = (clave: string) => ({ tipo: 'spike' as const, clave, texto: clave, prioridad: PRIORIDAD_VOZ.spike, caducaMs: 60_000, grupo: 'spike', enfriamientoMs: SPIKE_CADA_MS });
    expect(r.procesar([frase('a')], 0).map((f) => f.clave)).toEqual(['a']);
    expect(r.procesar([frase('b')], 10_000)).toEqual([]);
    expect(r.procesar([], 19_000)).toEqual([]);
    expect(r.procesar([], 20_000).map((f) => f.clave)).toEqual(['b']);
  });

  it('categoría nueva «spike», encendida por defecto (nivel Normal) y en el grupo de peleas; unos ajustes anteriores la estrenan encendida', () => {
    expect(CATEGORIAS_NIVEL.normal).toContain('spike');
    expect(CATEGORIAS_NIVEL.basico).not.toContain('spike');
    expect(GRUPOS_VOZ.peleas).toContain('spike');
    expect(AJUSTES_POR_DEFECTO.overlay.voz.tipos.spike).toBe(true);
    const antiguos = { overlay: { voz: { activa: true, tipos: { combate: false } } } };
    expect(normalizarAjustes(antiguos, 'es').overlay.voz.tipos.spike).toBe(true);
    expect(t('overlay.config.tipo.spike')).not.toBe('overlay.config.tipo.spike');
  });
});

// ---------------------------------------------------------------- orquestador

function montar(ajustes: Partial<Ajustes>) {
  const conector = Object.assign(new EventEmitter(), { iniciar: vi.fn(), detener: vi.fn() });
  const overlay = {
    mostrar: vi.fn(), ocultar: vi.fn(), alternar: vi.fn(), enviarEstado: vi.fn(), enviarAviso: vi.fn(), enviarModo: vi.fn(),
    enviarJungla: vi.fn(), enviarVoz: vi.fn(), enviarReliquias: vi.fn(),
  };
  let ahora = 0;
  const p = crearOrquestadorPartida({
    crearConector: () => conector,
    overlay,
    obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, ...ajustes }),
    contexto: async () => ({ build: null, rol: 'MIDDLE', objetos }),
    avisar: vi.fn(),
    leerModo: async () => 'sin_bordes',
    ahora: () => ahora,
    esPremium: () => true,
    variantes: () => new SelectorFijo(),
  });
  const emitir = async (e: EstadoPartida, llamadas: () => number) => {
    const antes = llamadas();
    conector.emit('estado', e);
    await vi.waitFor(() => expect(llamadas()).toBeGreaterThan(antes));
  };
  return { p, overlay, emitir, avanzar: (ms: number) => (ahora += ms) };
}

const conWidgets = (widgets: Partial<Record<'avisos' | 'reliquias', boolean>>): Partial<Ajustes> => {
  const base = AJUSTES_POR_DEFECTO.overlay;
  const w = { ...base.widgets };
  for (const [id, activo] of Object.entries(widgets)) w[id as 'avisos'] = { ...w[id as 'avisos'], activo };
  return { overlay: { ...base, widgets: w } };
};

describe('3.9 · power spike del rival: aviso escrito en el overlay', () => {
  it('con el widget de avisos encendido sale «Zed ha terminado …: …», como mucho uno cada 20 s', async () => {
    const { p, overlay, emitir, avanzar } = montar(conWidgets({ avisos: true }));
    await p.fase('InProgress');
    const estados = () => overlay.enviarEstado.mock.calls.length;
    await emitir(estado(), estados);
    avanzar(1000);
    await emitir(estado({ tiempo: 601, jugadores: jugadores({ Zed: [3157] }) }), estados);
    const textos = () => overlay.enviarAviso.mock.calls.map((c) => c[0].texto as string).filter((x) => x.includes('ha terminado'));
    expect(textos()).toEqual(['Zed ha terminado Reloj de arena de Zhonya: puede volverse intocable unos segundos']);
    avanzar(5000);
    await emitir(estado({ tiempo: 606, jugadores: jugadores({ Zed: [3157], Jinx: [6653, 6653, 3031] }) }), estados);
    expect(textos()).toHaveLength(1);
    avanzar(20_000);
    await emitir(estado({ tiempo: 626, jugadores: jugadores({ Zed: [3157], Jinx: [6653, 6653, 3031], Darius: [6653, 6653, 3026] }) }), estados);
    expect(textos()).toEqual(['Zed ha terminado Reloj de arena de Zhonya: puede volverse intocable unos segundos', 'Darius ha terminado Ángel de la guarda: hay que matarlo dos veces']);
  });

  it('con los avisos emergentes apagados (por defecto) no sale nada escrito', async () => {
    const { p, overlay, emitir } = montar({});
    await p.fase('InProgress');
    const estados = () => overlay.enviarEstado.mock.calls.length;
    await emitir(estado(), estados);
    await emitir(estado({ tiempo: 601, jugadores: jugadores({ Zed: [3157] }) }), estados);
    expect(overlay.enviarAviso).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- reliquias

describe('3.9 · reliquias de vida (ARAM)', () => {
  it('cuatro reliquias: las exteriores a la 1:45 y las interiores a las 2:30 (wiki oficial, V8.11)', () => {
    expect(RELIQUIAS.map((r) => [r.id, r.aparece])).toEqual([
      ['propiaExterior', 105],
      ['propiaInterior', 150],
      ['rivalExterior', 105],
      ['rivalInterior', 150],
    ]);
    const e = estadoReliquias({}, 100);
    expect(e.reliquias.map((r) => r.aparece)).toEqual([5, 50, 5, 50]);
    expect(estadoReliquias({}, 150).reliquias.every((r) => r.disponible && r.aparece === null)).toBe(true);
    expect(e.reliquias[0]!.nombre).toBe(t('reliquias.propiaExterior'));
  });

  it('reaparecen 90 s después del rayo, que cae 2,5 s después de recogerla: 92,5 s desde la marca', () => {
    expect(RELIQUIA_REAPARECE_S).toBe(90);
    expect(RELIQUIA_RAYO_S).toBe(2.5);
    const marcas = marcarReliquia({}, 'propiaExterior', 200);
    expect(restanteReliquia(marcas, 'propiaExterior', 200)).toBe(92.5);
    const r = estadoReliquias(marcas, 200).reliquias[0]!;
    expect(r).toMatchObject({ marcado: true, disponible: false, aparece: 93 });
    expect(estadoReliquias(marcas, 293).reliquias[0]).toMatchObject({ marcado: false, disponible: true, aparece: null });
  });

  it('marcar otra vez una reliquia en cuenta atrás la quita (clic por error); ya reaparecida, vuelve a empezar', () => {
    const una = marcarReliquia({}, 'rivalInterior', 300);
    expect(marcarReliquia(una, 'rivalInterior', 310)).toEqual({});
    expect(marcarReliquia(una, 'rivalInterior', 400)).toEqual({ rivalInterior: 400 });
  });

  it('el widget está apagado por defecto, en la lista de widgets y solo tiene sentido en el Abismo', () => {
    expect(AJUSTES_POR_DEFECTO.overlay.widgets.reliquias).toEqual({ activo: false, x: null, y: null, escala: 1 });
    expect(AJUSTES_POR_DEFECTO.teclasReliquias).toEqual({});
    const a = normalizarAjustes({ teclasReliquias: { propiaExterior: ' Alt+Shift+1 ', otra: 'Alt+K', rivalInterior: 3 } }, 'es');
    expect(a.teclasReliquias).toEqual({ propiaExterior: 'Alt+Shift+1' });
  });
});

describe('3.9 · reliquias en el orquestador', () => {
  const aram = (tiempo: number, modo: ModoJuego = 'aram') => estado({ tiempo, modo });
  const ultimo = (overlay: { enviarReliquias: ReturnType<typeof vi.fn> }) => overlay.enviarReliquias.mock.calls.at(-1)![0] as EstadoReliquias;

  it('en ARAM con el widget encendido se envían y se marcan con el tiempo de partida', async () => {
    const { p, overlay, emitir, avanzar } = montar(conWidgets({ reliquias: true }));
    await p.fase('InProgress');
    await emitir(aram(200), () => overlay.enviarReliquias.mock.calls.length);
    expect(ultimo(overlay).reliquias.every((r) => r.disponible)).toBe(true);
    avanzar(500);
    p.marcarReliquia('propiaInterior');
    expect(ultimo(overlay).reliquias[1]).toMatchObject({ id: 'propiaInterior', marcado: true, aparece: 93 });
    // Un id que no es de la lista se ignora.
    const llamadas = overlay.enviarReliquias.mock.calls.length;
    p.marcarReliquia('baron' as never);
    expect(overlay.enviarReliquias.mock.calls.length).toBe(llamadas);
  });

  it('en ARAM: Caos también; en la Grieta, nada', async () => {
    const caos = montar(conWidgets({ reliquias: true }));
    await caos.p.fase('InProgress');
    await caos.emitir(aram(200, 'caos'), () => caos.overlay.enviarReliquias.mock.calls.length);
    const grieta = montar(conWidgets({ reliquias: true }));
    await grieta.p.fase('InProgress');
    await grieta.emitir(estado({ tiempo: 200 }), () => grieta.overlay.enviarEstado.mock.calls.length);
    grieta.p.marcarReliquia('propiaExterior');
    expect(grieta.overlay.enviarReliquias).not.toHaveBeenCalled();
  });

  it('apagado (por defecto) no envía nada; las marcas se borran al terminar la partida', async () => {
    const apagado = montar({});
    await apagado.p.fase('InProgress');
    await apagado.emitir(aram(200), () => apagado.overlay.enviarEstado.mock.calls.length);
    apagado.p.marcarReliquia('propiaExterior');
    expect(apagado.overlay.enviarReliquias).not.toHaveBeenCalled();

    const { p, overlay, emitir } = montar(conWidgets({ reliquias: true }));
    await p.fase('InProgress');
    await emitir(aram(200), () => overlay.enviarReliquias.mock.calls.length);
    p.marcarReliquia('rivalExterior');
    await p.fase('EndOfGame');
    await p.fase('InProgress');
    await emitir(aram(210), () => overlay.enviarReliquias.mock.calls.length);
    expect(ultimo(overlay).reliquias.some((r) => r.marcado)).toBe(false);
  });
});

describe('3.9 · teclas de las reliquias', () => {
  function atajos() {
    const registradas = new Map<string, () => void>();
    const gs = {
      register: vi.fn((tecla: string, cb: () => void) => (registradas.set(tecla, cb), true)),
      unregister: vi.fn((tecla: string) => void registradas.delete(tecla)),
    };
    const pulsadas: string[] = [];
    return { a: crearAtajosReliquias(gs, (id) => pulsadas.push(id)), registradas, pulsadas };
  }

  it('solo se registran activas, sin repetir teclas ocupadas ni combinaciones de LoL', () => {
    const { a, registradas, pulsadas } = atajos();
    const teclas = { propiaExterior: 'Alt+Shift+7', propiaInterior: 'Ctrl+Q', rivalExterior: 'Alt+Shift+L', rivalInterior: 'Alt+Shift+K' };
    a.sincronizar({ activo: false, teclas, ocupadas: [] });
    expect(registradas.size).toBe(0);
    a.sincronizar({ activo: true, teclas, ocupadas: ['CommandOrControl+Shift+O', 'Alt+Shift+L'] });
    expect([...registradas.keys()].sort()).toEqual(['Alt+Shift+7', 'Alt+Shift+K']);
    registradas.get('Alt+Shift+K')!();
    expect(pulsadas).toEqual(['rivalInterior']);
    a.liberar();
    expect(registradas.size).toBe(0);
  });
});

// ---------------------------------------------------------------- puesto

const jugadorH = (participante: number, equipo: 100 | 200, total: number, victoria: boolean, combate = 50): JugadorHistorial =>
  ({ participante, equipo, victoria, puntuaciones: { combate, farmeo: 50, vision: 50, total } }) as unknown as JugadorHistorial;

describe('3.9 · puesto del 1.º al 10.º con MVP y ACE', () => {
  const diez = [
    jugadorH(1, 100, 70, true),
    jugadorH(2, 100, 55, true),
    jugadorH(3, 100, 81, true),
    jugadorH(4, 100, 40, true),
    jugadorH(5, 100, 62, true),
    jugadorH(6, 200, 90, false),
    jugadorH(7, 200, 30, false),
    jugadorH(8, 200, 62, false, 70),
    jugadorH(9, 200, 45, false),
    jugadorH(10, 200, 50, false),
  ];

  it('ordena a los 10 por su nota total (empate: la nota de combate) y marca MVP (ganador) y ACE (perdedor)', () => {
    const r = puestosPartida({ jugadores: diez });
    expect(r.total).toBe(10);
    const orden = [...r.porJugador.entries()].sort((a, b) => a[1].puesto - b[1].puesto).map(([id]) => id);
    expect(orden).toEqual([6, 3, 1, 8, 5, 2, 10, 9, 4, 7]);
    expect(r.porJugador.get(3)).toEqual({ puesto: 2, insignia: 'mvp' });
    expect(r.porJugador.get(6)).toEqual({ puesto: 1, insignia: 'ace' });
    expect([...r.porJugador.values()].filter((x) => x.insignia)).toHaveLength(2);
  });

  it('sin dos equipos y un ganador (Arena, partida rara) solo hay puesto, sin MVP ni ACE', () => {
    const r = puestosPartida({ jugadores: diez.map((x) => ({ ...x, victoria: true })) });
    expect([...r.porJugador.values()].every((x) => x.insignia === null)).toBe(true);
    expect(r.porJugador.get(6)!.puesto).toBe(1);
  });

  it('no hay ningún ranking acumulado ni número tipo MMR (norma de Riot): solo el puesto de una partida', () => {
    for (const idioma of IDIOMAS) {
      const textos = textosDe(idioma);
      for (const clave of Object.keys(textos).filter((k) => k.startsWith('perfil.puesto.') || k.startsWith('perfil.insignia.'))) {
        expect(textos[clave], `${idioma}: ${clave}`).not.toMatch(/\b(mmr|elo|liga|league|ranking)\b/i);
      }
    }
    expect(t('perfil.puesto.yo', { puesto: 3, total: 10 })).toBe('Has sido 3.º de 10');
  });
});
