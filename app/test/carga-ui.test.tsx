// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModoCarga } from '../src/renderer/overlay/carga/ModoCarga';
import { PantallaCarga } from '../src/renderer/overlay/carga/PantallaCarga';
import { TarjetaJugador } from '../src/renderer/overlay/carga/TarjetaJugador';
import { textoCola, textoMaestria, textoRango, textoWinrate } from '../src/renderer/overlay/carga/formato';
import type { EstadoCarga, JugadorCarga } from '../src/shared/tiposApp';
import es from '../src/shared/i18n/es.json';

afterEach(cleanup);

const jugador = (j: Partial<JugadorCarga> = {}): JugadorCarga => ({
  equipo: 'aliado',
  riotId: 'Ana#EUW',
  campeonId: 103,
  campeon: 'Ahri',
  nombre: 'Ahri',
  rol: 'MIDDLE',
  rango: { tier: 'EMERALD', division: 'II', lp: 42, victorias: 30, derrotas: 20 },
  maestria: { nivel: 12, puntos: 250_000 },
  campeonWinrate: 0.523,
  etiquetas: [
    { tipo: 'positivo', texto: 'Especialista en Ahri' },
    { tipo: 'neutro', texto: 'Daño mágico en área' },
  ],
  ...j,
});

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
const estado = (): EstadoCarga => ({
  version: '16.20.1',
  jugadores: [
    ...ROLES.map((rol, i) => jugador({ rol, riotId: `Aliado${i}#1` })),
    ...ROLES.map((rol, i) => jugador({ rol, equipo: 'enemigo', riotId: `Enemigo${i}#2`, campeon: 'MonkeyKing', nombre: 'Wukong', campeonId: 62 })),
  ],
});

describe('formato de la pantalla de carga', () => {
  it('rango oficial en español, sin división en las ligas de ápice', () => {
    expect(textoRango({ tier: 'EMERALD', division: 'II', lp: 42, victorias: 1, derrotas: 1 })).toBe('Esmeralda II · 42 LP');
    expect(textoRango({ tier: 'CHALLENGER', division: 'I', lp: 1200, victorias: 1, derrotas: 1 })).toBe('Retador · 1200 LP');
    expect(textoRango(null)).toBe('Sin clasificar');
  });

  it('maestría y winrate', () => {
    expect(textoMaestria({ nivel: 12, puntos: 250_000 })).toBe('Maestría 12 · 250 mil pts');
    expect(textoMaestria({ nivel: 4, puntos: 1500 })).toBe('Maestría 4 · 1500 pts');
    expect(textoMaestria({ nivel: 41, puntos: 1_250_000 })).toBe('Maestría 41 · 1,3 M pts');
    expect(textoMaestria(null)).toBeNull();
    expect(textoWinrate(0.523)).toBe('52,3 %');
    expect(textoWinrate(null)).toBeNull();
  });
});

describe('TarjetaJugador', () => {
  it('muestra icono, Riot ID, rango oficial, maestría, winrate del campeón y etiquetas', () => {
    render(<TarjetaJugador jugador={jugador()} version="16.20.1" />);
    // El nombre accesible de la tarjeta es el Riot ID (aria-labelledby).
    const tarjeta = screen.getByRole('listitem', { name: 'Ana#EUW' });
    const icono = within(tarjeta).getByRole('img', { name: 'Ahri' }) as HTMLImageElement;
    expect(icono.src).toBe('https://ddragon.leagueoflegends.com/cdn/16.20.1/img/champion/Ahri.png');
    expect(within(tarjeta).getByText('Ana')).toBeTruthy();
    expect(within(tarjeta).getByText('#EUW')).toBeTruthy();
    expect(within(tarjeta).getByText('Esmeralda II · 42 LP')).toBeTruthy();
    expect(within(tarjeta).getByText('60 % · 30 V 20 D')).toBeTruthy();
    expect(within(tarjeta).getByText('Maestría 12 · 250 mil pts')).toBeTruthy();
    expect(within(tarjeta).getByText('52,3 %')).toBeTruthy();
    expect(within(tarjeta).getByText('Central')).toBeTruthy();
    expect(within(tarjeta).getByText('Especialista en Ahri').closest('li')!.className).toContain('positivo');
    expect(within(tarjeta).getByText('Daño mágico en área').closest('li')!.className).toContain('neutro');
  });

  it('sin datos del servidor muestra solo lo local, sin huecos rotos', () => {
    render(
      <TarjetaJugador
        jugador={jugador({ riotId: '', rango: null, maestria: null, campeonWinrate: null, etiquetas: [], rol: null })}
        version="16.20.1"
      />,
    );
    const tarjeta = screen.getByRole('listitem', { name: es['carga.sinNombre'] });
    expect(within(tarjeta).getByText(es['carga.sinNombre'])).toBeTruthy();
    expect(within(tarjeta).getByText('Sin clasificar')).toBeTruthy();
    expect(within(tarjeta).queryByText(/Maestría/)).toBeNull();
    expect(within(tarjeta).queryByRole('list', { name: es['carga.etiquetas'] })).toBeNull();
  });

  it('el borde de la tarjeta indica el equipo', () => {
    render(<TarjetaJugador jugador={jugador({ equipo: 'enemigo' })} version="" />);
    expect(screen.getByRole('listitem', { name: 'Ana#EUW' }).className).toContain('enemigo');
  });

  it('usa el nombre visible de Data Dragon y, si falta, el id', () => {
    render(
      <ul>
        <TarjetaJugador jugador={jugador({ campeon: 'MonkeyKing', nombre: 'Wukong', riotId: 'A#1' })} version="16.20.1" />
        <TarjetaJugador jugador={jugador({ campeon: 'Khazix', nombre: '', riotId: 'B#2' })} version="16.20.1" />
      </ul>,
    );
    expect(within(screen.getByRole('listitem', { name: 'A#1' })).getByText('Wukong')).toBeTruthy();
    expect(within(screen.getByRole('listitem', { name: 'A#1' })).getByRole('img', { name: 'Wukong' }).getAttribute('src')).toContain(
      '/img/champion/MonkeyKing.png',
    );
    expect(within(screen.getByRole('listitem', { name: 'B#2' })).getByText('Khazix')).toBeTruthy();
  });
});

describe('PantallaCarga', () => {
  it('3.0.2: crece con el alto de la pantalla (zoom alto / 1080: × 2 a 4K, sin zoom a 1080p)', () => {
    const previo = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
    try {
      Object.assign(window, { innerWidth: 3840, innerHeight: 2160 });
      const { container, unmount } = render(<PantallaCarga estado={estado()} />);
      expect((container.querySelector('.cg-capa') as HTMLElement).style.zoom).toBe('2');
      unmount();
      Object.assign(window, { innerWidth: 1920, innerHeight: 1080 });
      const r = render(<PantallaCarga estado={estado()} />);
      expect((r.container.querySelector('.cg-capa') as HTMLElement).style.zoom).toBe('');
    } finally {
      Object.assign(window, previo);
    }
  });

  it('dos filas de 5: enemigos arriba y aliados abajo, como en el juego', () => {
    const { container } = render(<PantallaCarga estado={estado()} />);
    const filas = screen.getAllByRole('list', { name: /equipo/i });
    expect(filas.map((f) => f.getAttribute('aria-label'))).toEqual([es['carga.enemigos'], es['carga.aliados']]);
    expect(within(filas[0]!).getAllByRole('listitem', { name: /Enemigo/ })).toHaveLength(5);
    expect(within(filas[1]!).getAllByRole('listitem', { name: /Aliado/ })).toHaveLength(5);
    // La fila de enemigos va antes en el DOM (arriba).
    const orden = Array.from(container.querySelectorAll('.cg-fila')).map((f) => f.className);
    expect(orden[0]).toContain('enemigo');
    expect(orden[1]).toContain('aliado');
  });

  it('sin estado no pinta nada', () => {
    const { container } = render(<PantallaCarga estado={null} />);
    expect(container.textContent).toBe('');
  });

  it('políticas de Riot: no hay textos de vergüenza ni MMR en la interfaz', () => {
    const { container } = render(<PantallaCarga estado={estado()} />);
    const texto = container.textContent!.toLowerCase();
    for (const p of ['malo', 'troll', 'inting', 'noob', 'manco', 'feeder', 'peor', 'mmr', 'elo ']) expect(texto).not.toContain(p);
    const claves = Object.entries(es).filter(([k]) => k.startsWith('carga.'));
    expect(claves.length).toBeGreaterThan(0);
    for (const [, v] of claves) {
      const palabras = v.toLowerCase().split(/[^a-záéíóúüñ]+/);
      for (const p of ['malo', 'troll', 'inting', 'noob', 'manco', 'feeder', 'peor', 'mmr', 'elo']) expect(palabras).not.toContain(p);
    }
  });
});

describe('ModoCarga', () => {
  it('se muestra solo en modo carga y con los datos de overlay:carga', () => {
    let alModo!: (m: 'carga' | 'partida' | 'oculto') => void;
    let alCarga!: (e: EstadoCarga) => void;
    render(<ModoCarga alModo={(cb) => (alModo = cb)} alCarga={(cb) => (alCarga = cb)} />);
    expect(screen.queryByRole('region')).toBeNull();
    act(() => alCarga(estado()));
    expect(screen.queryByRole('region')).toBeNull();
    act(() => alModo('carga'));
    expect(screen.getByRole('region', { name: es['carga.titulo'] })).toBeTruthy();
    act(() => alModo('partida'));
    expect(screen.queryByRole('region')).toBeNull();
    // Siguiente partida: el modo carga sin datos nuevos no enseña las tarjetas de la anterior.
    act(() => alModo('carga'));
    expect(screen.queryByRole('region')).toBeNull();
    act(() => alCarga(estado()));
    expect(screen.getByRole('region', { name: es['carga.titulo'] })).toBeTruthy();
  });
});

describe('ruta estimada del jungla enemigo (Track F2)', () => {
  it('sale bajo el título con la etiqueta «Estimación», sin repetirla en el texto', () => {
    render(<PantallaCarga estado={{ ...estado(), rutaJungla: { campeon: 'LeeSin', texto: 'Estimación: Lee Sin suele empezar por rojo y gankear bot hacia el minuto 3' } }} />);
    const nota = screen.getByRole('note');
    expect(within(nota).getByText('Estimación')).toBeTruthy();
    expect(within(nota).getByText('Lee Sin suele empezar por rojo y gankear bot hacia el minuto 3')).toBeTruthy();
  });

  it('sin ruta no hay nota', () => {
    render(<PantallaCarga estado={estado()} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('tarjetas que aún esperan datos', () => {
  it('enseñan «Cargando datos…» en vez de «Sin clasificar», y nunca una tarjeta vacía', () => {
    render(<TarjetaJugador jugador={jugador({ rango: null, maestria: null, campeonWinrate: null, etiquetas: [], campeon: '', nombre: '', cargando: true })} version="" />);
    expect(screen.getByText(es['carga.cargandoDatos'])).toBeTruthy();
    expect(screen.queryByText('Sin clasificar')).toBeNull();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('cuando terminan de llegar, se ve lo que haya (sin rango: «Sin clasificar»)', () => {
    render(<TarjetaJugador jugador={jugador({ rango: null, cargando: false })} version="" />);
    expect(screen.queryByText(es['carga.cargandoDatos'])).toBeNull();
    expect(screen.getByText('Sin clasificar')).toBeTruthy();
  });
});

describe('3.1: pantalla completa y solo tarjetas', () => {
  const conPropio = (): EstadoCarga => {
    const e = estado();
    e.jugadores[2] = { ...e.jugadores[2]!, propio: true, campeon: 'Ahri' };
    return { ...e, cola: 420 };
  };

  it('pantalla completa (por defecto): opaca, con fondo, cabecera (marca, cola y mapa) y tarjetas grandes con el arte', () => {
    const { container } = render(<PantallaCarga estado={conPropio()} pistaEspacio />);
    const capa = container.querySelector('.cg-capa') as HTMLElement;
    expect(capa.classList.contains('completa')).toBe(true);
    // Fondo: el splash del campeón del jugador.
    const splash = container.querySelector('.cg-fondo-splash') as HTMLImageElement;
    expect(splash.src).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg');
    expect(screen.getByText('Coach LoL IA')).toBeTruthy();
    expect(screen.getByText(es['carga.cola.soloDuo'])).toBeTruthy();
    expect(screen.getByText(es['carga.mapa.grieta'])).toBeTruthy();
    expect(screen.getByText(es['carga.ocultarEspacio'])).toBeTruthy();
    // 10 tarjetas grandes con el arte vertical del campeón; la del jugador, marcada.
    expect(container.querySelectorAll('.cg-tarjeta.grande')).toHaveLength(10);
    const artes = Array.from(container.querySelectorAll('.cg-arte')) as HTMLImageElement[];
    expect(artes).toHaveLength(10);
    expect(artes[0]!.src).toContain('/cdn/img/champion/loading/MonkeyKing_0.jpg');
    expect(container.querySelectorAll('.cg-tarjeta.propia')).toHaveLength(1);
    expect(within(container.querySelector('.cg-tarjeta.propia') as HTMLElement).getByText(es['carga.tu'])).toBeTruthy();
    // Enemigos arriba y tu equipo abajo, como en el juego.
    const orden = Array.from(container.querySelectorAll('.cg-fila')).map((f) => f.className);
    expect(orden).toEqual(['cg-fila enemigo', 'cg-fila aliado']);
  });

  it('sin la cola (o una desconocida) solo se nombra el mapa; sin jugador local, el fondo es del primer aliado', () => {
    const { container } = render(<PantallaCarga estado={{ ...estado(), cola: 9999 }} />);
    expect(container.querySelector('.cg-partida-cola')).toBeNull();
    expect(screen.getByText(es['carga.mapa.grieta'])).toBeTruthy();
    expect((container.querySelector('.cg-fondo-splash') as HTMLImageElement).src).toContain('/splash/Ahri_0.jpg');
  });

  it('sin «Ocultar con Espacio» no hay pista', () => {
    render(<PantallaCarga estado={conPropio()} pistaEspacio={false} />);
    expect(screen.queryByText(es['carga.ocultarEspacio'])).toBeNull();
  });

  it('solo tarjetas: las de antes, translúcidas, sin fondo ni arte; con la pista bajo el título', () => {
    const { container } = render(<PantallaCarga estado={conPropio()} presentacion="tarjetas" pistaEspacio />);
    const capa = container.querySelector('.cg-capa') as HTMLElement;
    expect(capa.classList.contains('tarjetas')).toBe(true);
    expect(capa.classList.contains('completa')).toBe(false);
    expect(container.querySelector('.cg-fondo')).toBeNull();
    expect(container.querySelector('.cg-arte')).toBeNull();
    expect(container.querySelectorAll('.cg-tarjeta.grande')).toHaveLength(0);
    expect(container.querySelectorAll('.cg-retrato')).toHaveLength(10);
    expect(within(container.querySelector('.cg-centro') as HTMLElement).getByText(es['carga.ocultarEspacio'])).toBeTruthy();
    // Tu tarjeta también resalta aquí, con la insignia «Tú» y el destello.
    const propia = container.querySelector('.cg-tarjeta.propia') as HTMLElement;
    expect(within(propia).getByText(es['carga.tu'])).toBeTruthy();
    expect(propia.querySelector('.cg-brillo')).toBeTruthy();
    expect(container.querySelectorAll('.cg-tarjeta.propia')).toHaveLength(1);
  });

  it('las dos crecen con el alto de la pantalla (× 2 a 4K)', () => {
    const previo = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
    try {
      Object.assign(window, { innerWidth: 3840, innerHeight: 2160 });
      for (const presentacion of ['completa', 'tarjetas'] as const) {
        const { container, unmount } = render(<PantallaCarga estado={estado()} presentacion={presentacion} />);
        expect((container.querySelector('.cg-capa') as HTMLElement).style.zoom).toBe('2');
        unmount();
      }
      Object.assign(window, { innerWidth: 2560, innerHeight: 1440 });
      const { container } = render(<PantallaCarga estado={estado()} />);
      expect((container.querySelector('.cg-capa') as HTMLElement).style.zoom).toBe('1.333');
    } finally {
      Object.assign(window, previo);
    }
  });

  it('ModoCarga sigue los ajustes: completa por defecto, tarjetas, y desactivada no pinta nada', () => {
    let alModo!: (m: 'carga' | 'partida' | 'oculto') => void;
    let alCarga!: (e: EstadoCarga) => void;
    const props = { alModo: (cb: typeof alModo) => (alModo = cb), alCarga: (cb: typeof alCarga) => (alCarga = cb) };
    const r = render(<ModoCarga {...props} />);
    act(() => {
      alCarga(estado());
      alModo('carga');
    });
    expect(r.container.querySelector('.cg-capa.completa')).toBeTruthy();
    expect(screen.getByText(es['carga.ocultarEspacio'])).toBeTruthy();
    r.rerender(<ModoCarga {...props} config={{ modo: 'tarjetas', ocultarConEspacio: false }} />);
    expect(r.container.querySelector('.cg-capa.tarjetas')).toBeTruthy();
    expect(screen.queryByText(es['carga.ocultarEspacio'])).toBeNull();
    r.rerender(<ModoCarga {...props} config={{ modo: 'desactivada', ocultarConEspacio: true }} />);
    expect(r.container.querySelector('.cg-capa')).toBeNull();
  });

  it('Espacio (overlay:carga-ocultar): se desvanece; la siguiente carga vuelve a verse entera', () => {
    let alModo!: (m: 'carga' | 'partida' | 'oculto') => void;
    let alCarga!: (e: EstadoCarga) => void;
    let alOcultar!: () => void;
    const { container } = render(<ModoCarga alModo={(cb) => (alModo = cb)} alCarga={(cb) => (alCarga = cb)} alOcultar={(cb) => (alOcultar = cb)} />);
    act(() => {
      alCarga(estado());
      alModo('carga');
    });
    expect(container.querySelector('.cg-capa.saliendo')).toBeNull();
    act(() => alOcultar());
    expect(container.querySelector('.cg-capa.saliendo')).toBeTruthy();
    // Llegan más datos del servidor: sigue saliendo (no vuelve a aparecer).
    act(() => alCarga(estado()));
    expect(container.querySelector('.cg-capa.saliendo')).toBeTruthy();
    act(() => alModo('partida'));
    act(() => {
      alModo('carga');
      alCarga(estado());
    });
    expect(container.querySelector('.cg-capa')).toBeTruthy();
    expect(container.querySelector('.cg-capa.saliendo')).toBeNull();
  });

  it('nombres de las colas conocidas en los 5 idiomas; una desconocida, nada', () => {
    expect(textoCola(420)).toBe(es['carga.cola.soloDuo']);
    expect(textoCola(440)).toBe(es['carga.cola.flexible']);
    expect(textoCola(0)).toBe(es['carga.cola.personalizada']);
    expect(textoCola(850)).toBe(es['carga.cola.ia']);
    expect(textoCola(1700)).toBeNull();
    expect(textoCola(null)).toBeNull();
    expect(textoCola(undefined)).toBeNull();
  });
});
