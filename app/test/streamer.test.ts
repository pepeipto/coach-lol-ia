import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes, OVERLAY_POR_DEFECTO } from '../src/main/ajustes';
import { anonimizarCarga, anonimizarPerfil } from '../src/main/streamer/anonimizar';
import { crearFuenteObs } from '../src/main/streamer/fuenteObs';
import { ColaVoz } from '../src/renderer/overlay/voz';
import { establecerIdioma } from '../src/shared/i18n';
import type { Perfil } from '../src/shared/perfil';
import { normalizarStreamer, PUERTO_OBS_POR_DEFECTO, puertoValido, STREAMER_POR_DEFECTO, textoSubtitulo } from '../src/shared/streamer';
import type { EstadoCarga, EstadoOverlay, FraseVoz, JugadorCarga, PanelAumentos } from '../src/shared/tiposApp';

const jugador = (j: Partial<JugadorCarga>): JugadorCarga => ({
  equipo: 'aliado',
  riotId: 'Ana#EUW',
  campeonId: 103,
  campeon: 'Ahri',
  nombre: 'Ahri',
  rol: 'MIDDLE',
  rango: null,
  maestria: null,
  campeonWinrate: null,
  etiquetas: [],
  ...j,
});
const carga = (): EstadoCarga => ({
  version: '16.20.1',
  jugadores: [
    jugador({ riotId: 'Yo#EUW', propio: true, campeon: 'Ahri', nombre: 'Ahri' }),
    jugador({ riotId: 'Aliado#1', campeon: 'MonkeyKing', nombre: 'Wukong', campeonId: 62 }),
    jugador({ riotId: 'Rival#2', equipo: 'enemigo', campeon: 'Zed', nombre: 'Zed', campeonId: 238 }),
    jugador({ riotId: '', anonimo: true, equipo: 'enemigo', campeon: 'Lux', nombre: '', campeonId: 99 }),
  ],
});

describe('ajustes del modo streamer', () => {
  it('todo apagado por defecto, con un puerto alto que no es el 8080', () => {
    expect(AJUSTES_POR_DEFECTO.streamer).toEqual({ activo: false, ocultarPropio: false, tecla: '', obs: { activa: false, puerto: PUERTO_OBS_POR_DEFECTO } });
    expect(PUERTO_OBS_POR_DEFECTO).toBeGreaterThan(10_000);
    expect(PUERTO_OBS_POR_DEFECTO).not.toBe(8080);
  });
  it('unos ajustes anteriores (sin la sección) quedan con todo apagado', () => {
    expect(normalizarAjustes({ voz: true }).streamer).toEqual(STREAMER_POR_DEFECTO);
  });
  it('se normalizan los valores raros', () => {
    expect(normalizarStreamer({ activo: 'sí', ocultarPropio: 1, tecla: '  F9 ', obs: { activa: true, puerto: 8080 } })).toEqual({
      activo: false,
      ocultarPropio: false,
      tecla: 'F9',
      obs: { activa: true, puerto: PUERTO_OBS_POR_DEFECTO },
    });
    expect(normalizarAjustes({ streamer: { activo: true, ocultarPropio: true, obs: { activa: true, puerto: 50000 } } }).streamer).toEqual({
      activo: true,
      ocultarPropio: true,
      tecla: '',
      obs: { activa: true, puerto: 50000 },
    });
  });
  it('puertos válidos: 1024-65535 enteros, nunca el 8080', () => {
    expect(puertoValido(47615)).toBe(true);
    expect(puertoValido(80)).toBe(false);
    expect(puertoValido(8080)).toBe(false);
    expect(puertoValido(70000)).toBe(false);
    expect(puertoValido(5000.5)).toBe(false);
    expect(puertoValido('5000')).toBe(false);
  });
  it('subtítulos: una línea, sin espacios de más y como mucho 300 caracteres', () => {
    expect(textoSubtitulo('  Dragón\n en  30 s ')).toBe('Dragón en 30 s');
    expect(textoSubtitulo('x'.repeat(500))).toHaveLength(300);
    expect(textoSubtitulo('   ')).toBeNull();
    expect(textoSubtitulo(42)).toBeNull();
  });
});

describe('anonimizarCarga', () => {
  it('apagado: la pantalla de carga sale igual', () => {
    const c = carga();
    expect(anonimizarCarga(c, { activo: false, ocultarPropio: true })).toBe(c);
  });
  it('encendido: los demás salen con el nombre de su campeón; tú, con tu Riot ID', () => {
    const r = anonimizarCarga(carga(), { activo: true, ocultarPropio: false });
    expect(r.jugadores.map((j) => j.riotId)).toEqual(['Yo#EUW', 'Wukong', 'Zed', 'Lux']);
    expect(r.jugadores.map((j) => !!j.streamer)).toEqual([false, true, true, true]);
    expect(JSON.stringify(r)).not.toMatch(/Aliado#1|Rival#2/);
  });
  it('con «ocultar también el mío», tampoco sale el tuyo', () => {
    const r = anonimizarCarga(carga(), { activo: true, ocultarPropio: true });
    expect(r.jugadores[0]!.riotId).toBe('Ahri');
    expect(JSON.stringify(r)).not.toMatch(/#/);
  });
  it('no cambia el estado original (se vuelve a aplicar al cambiar el modo)', () => {
    const c = carga();
    anonimizarCarga(c, { activo: true, ocultarPropio: true });
    expect(c.jugadores[1]!.riotId).toBe('Aliado#1');
  });
});

describe('anonimizarPerfil', () => {
  const j = (participante: number, campeonId: number, nombre: string) => ({ participante, campeonId, nombre }) as Perfil['partidas'][number]['jugadores'][number];
  const perfil = (): Perfil =>
    ({
      invocador: { nombre: 'Carlos', tag: 'EUW', nivel: 300, icono: 1 },
      partidas: [{ id: 1, yo: 1, jugadores: [j(1, 103, 'Carlos'), j(2, 238, 'Rival'), j(3, 999, 'SinDatos')] }],
      campeonesDD: { 103: { id: 'Ahri', nombre: 'Ahri' }, 238: { id: 'Zed', nombre: 'Zed' } },
    }) as unknown as Perfil;

  it('apagado: igual', () => {
    const p = perfil();
    expect(anonimizarPerfil(p, { activo: false, ocultarPropio: false }, 'Invocador')).toBe(p);
  });
  it('encendido: los nombres de los demás pasan a ser su campeón (o nada, y la tabla pinta el campeón)', () => {
    const r = anonimizarPerfil(perfil(), { activo: true, ocultarPropio: false }, 'Invocador');
    expect(r.partidas[0]!.jugadores.map((x) => x.nombre)).toEqual(['Carlos', 'Zed', '']);
    expect(r.invocador?.nombre).toBe('Carlos');
  });
  it('con «ocultar también el mío», tu nombre y tu etiqueta tampoco', () => {
    const r = anonimizarPerfil(perfil(), { activo: true, ocultarPropio: true }, 'Invocador');
    expect(r.partidas[0]!.jugadores[0]!.nombre).toBe('Ahri');
    expect(r.invocador).toMatchObject({ nombre: 'Invocador', tag: '', nivel: 300 });
    expect(JSON.stringify(r)).not.toMatch(/Carlos|Rival|SinDatos|EUW/);
  });
});

describe('fuente para OBS: qué enseña', () => {
  afterEach(() => establecerIdioma('es'));
  const estado = (e: Partial<EstadoOverlay> = {}): EstadoOverlay =>
    ({
      tiempo: 600,
      objetivos: [
        { id: 'dragon', nombre: 'Dragón', subtipo: 'Infernal', aparece: 42, disponible: false },
        { id: 'baron', nombre: 'Barón', subtipo: null, aparece: null, disponible: true },
      ],
      proximaHabilidad: null,
      rendimiento: null,
      compra: null,
      version: '16.20.1',
      modo: 'clasificatoria',
      widgets: { objetivos: true, aumentos: false },
      ...e,
    }) as EstadoOverlay;
  const panel: PanelAumentos = {
    campeon: 'Zed',
    columnas: [{ rareza: 'oro', aumentos: [{ id: 1, nombre: 'Golpe', icono: 'https://raw.communitydragon.org/latest/a.png', tier: 'S' }, { id: 2, nombre: 'Raro', icono: 'https://malo.example/x.png', tier: 'A' }] }],
    combos: [],
  };

  it('fuera de la partida no enseña nada', () => {
    const f = crearFuenteObs();
    f.config(OVERLAY_POR_DEFECTO);
    f.estado(estado());
    expect(f.vista()).toMatchObject({ objetivos: [], aumentos: null, subtitulo: null });
  });

  it('en la partida, la barra de objetivos como en el overlay', () => {
    const f = crearFuenteObs();
    f.config(OVERLAY_POR_DEFECTO);
    f.modo('partida');
    f.estado(estado());
    expect(f.vista().objetivos).toEqual([
      { id: 'dragon', texto: 'Dragón Infernal', tiempo: '0:42', pronto: true, disponible: false, lado: null },
      expect.objectContaining({ id: 'baron', disponible: true }),
    ]);
  });

  it('si el widget de objetivos está apagado en el overlay, tampoco sale en OBS', () => {
    const f = crearFuenteObs();
    f.config({ ...OVERLAY_POR_DEFECTO, widgets: { ...OVERLAY_POR_DEFECTO.widgets, objetivos: { ...OVERLAY_POR_DEFECTO.widgets.objetivos, activo: false } } });
    f.modo('partida');
    f.estado(estado());
    expect(f.vista().objetivos).toEqual([]);
  });

  it('aumentos solo cuando el overlay los enseña (ARAM: Caos y panel visible), sin % de victorias e iconos solo de CommunityDragon', () => {
    const f = crearFuenteObs();
    f.config(OVERLAY_POR_DEFECTO);
    f.modo('partida');
    f.estado(estado());
    f.aumentos(panel);
    expect(f.vista().aumentos).toBeNull();
    f.estado(estado({ modo: 'caos', widgets: { objetivos: false, aumentos: true } as EstadoOverlay['widgets'] }));
    const a = f.vista().aumentos!;
    expect(a.columnas[0]!.aumentos).toEqual([
      { nombre: 'Golpe', tier: 'S', icono: 'https://raw.communitydragon.org/latest/a.png' },
      { nombre: 'Raro', tier: 'A', icono: null },
    ]);
    // Solo nombre, tier e icono: ningún dato de victorias.
    for (const x of [...a.columnas.flatMap((c) => c.aumentos), ...a.combos.flatMap((c) => c.aumentos)]) expect(Object.keys(x).sort()).toEqual(['icono', 'nombre', 'tier']);
    expect(a.pie).not.toMatch(/Alt\+Shift/);
    f.aumentos(null);
    expect(f.vista().aumentos).toBeNull();
  });

  it('subtítulos: la última frase, solo con la voz encendida y en la partida; al salir se borra', () => {
    const f = crearFuenteObs();
    const vistas: number[] = [];
    f.alCambiar((v) => vistas.push(v.n));
    f.config({ ...OVERLAY_POR_DEFECTO, voz: { ...OVERLAY_POR_DEFECTO.voz, activa: true } });
    f.frase('antes de la partida');
    f.modo('partida');
    expect(f.vista().subtitulo).toBeNull();
    f.frase('El dragón sale en 30 segundos');
    expect(f.vista().subtitulo).toEqual({ id: 1, texto: 'El dragón sale en 30 segundos' });
    f.frase('Compra ya');
    expect(f.vista().subtitulo).toEqual({ id: 2, texto: 'Compra ya' });
    f.modo('oculto');
    expect(f.vista().subtitulo).toBeNull();
    expect(vistas.length).toBeGreaterThan(3);
  });

  it('los textos salen en el idioma de la app', () => {
    establecerIdioma('en');
    const f = crearFuenteObs();
    f.config(OVERLAY_POR_DEFECTO);
    f.modo('partida');
    f.estado(estado({ objetivos: [{ id: 'baron', nombre: 'Baron', subtipo: null, aparece: null, disponible: true }] }));
    expect(f.vista().objetivos[0]!.tiempo).toBe('Up');
  });
});

describe('cola de voz: aviso de la frase que suena (subtítulos)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('avisa una vez por frase, justo al empezar a decirla', async () => {
    class Frase {
      voice: unknown;
      lang = '';
      volume = 1;
      onend: (() => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Frase);
    const voz = { lang: 'es-MX', name: 'Sabina', voiceURI: 'Sabina' } as SpeechSynthesisVoice;
    const sint = { getVoices: () => [voz], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis;
    const cola = new ColaVoz(sint);
    const dichas: string[] = [];
    cola.alDecir = (t) => dichas.push(t);
    const f: FraseVoz = { tipo: 'objetivo', clave: 'a', texto: 'Dragón en 30', prioridad: 1, caducaMs: 10_000 };
    cola.encolar(f);
    await new Promise((r) => setTimeout(r, 0));
    expect(dichas).toEqual(['Dragón en 30']);
    expect(sint.speak).toHaveBeenCalledTimes(1);
  });
});
