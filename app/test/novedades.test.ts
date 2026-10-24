import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO, cargarAjustes, normalizarAjustes } from '../src/main/ajustes';
import { NOVEDADES, queMostrar, VERSION_ACTUAL } from '../src/shared/novedades';

const raiz = join(__dirname, '..', '..');

/** Lee CHANGELOG.md: «## [versión] - fecha» y los puntos «- …» de cada versión. */
function leerChangelog() {
  const entradas: { version: string; fecha: string; puntos: string[] }[] = [];
  for (const linea of readFileSync(join(raiz, 'CHANGELOG.md'), 'utf8').split(/\r?\n/)) {
    const cab = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/.exec(linea);
    if (cab) entradas.push({ version: cab[1], fecha: cab[2], puntos: [] });
    else if (linea.startsWith('- ') && entradas.length) entradas[entradas.length - 1].puntos.push(linea.slice(2));
  }
  return entradas;
}

describe('novedades', () => {
  it('la versión actual es la de app/package.json y la más reciente del historial', () => {
    const pkg = JSON.parse(readFileSync(join(raiz, 'app', 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toBe('3.8.0');
    expect(VERSION_ACTUAL).toBe(pkg.version);
  });

  it('CHANGELOG.md y el módulo de novedades coinciden, versión a versión', () => {
    expect(leerChangelog()).toEqual(NOVEDADES);
  });

  it('el historial va de la más reciente a la más antigua y cubre 1.0, 2.0, 2.1, 3.0, 3.0.1, 3.0.2, 3.1.0, 3.2.0, 3.3.0, 3.4.0, 3.5.0, 3.6.0 y 3.8.0', () => {
    expect(NOVEDADES.map((n) => n.version)).toEqual(['3.8.0', '3.6.0', '3.5.0', '3.4.0', '3.3.0', '3.2.0', '3.1.0', '3.0.2', '3.0.1', '3.0.0', '2.1.0', '2.0.1', '2.0.0', '1.0.0']);
    const fechas = NOVEDADES.map((n) => n.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    for (const n of NOVEDADES) expect(n.puntos.length).toBeGreaterThan(0);
  });

  it('la 3.8.0 anuncia «Todo LoL», el modo streamer y la barra de objetivos nueva', () => {
    expect(NOVEDADES[0]!.version).toBe('3.8.0');
    expect(NOVEDADES[0]!.puntos.join(' ')).toMatch(/Todo LoL[\s\S]*Modo streamer[\s\S]*objetivos/);
  });

  it('la 3.6.0 anuncia el arreglo del servidor, la bandeja y «Tu coach»', () => {
    expect(NOVEDADES[1]!.version).toBe('3.6.0');
    expect(NOVEDADES[1]!.puntos.join(' ')).toMatch(/servidor[\s\S]*bandeja[\s\S]*Tu coach/);
  });

  it('la 3.5.0 anuncia el Perfil, los retos y el coach personal', () => {
    expect(NOVEDADES[2]!.version).toBe('3.5.0');
    expect(NOVEDADES[2]!.puntos.join(' ')).toMatch(/Perfil[\s\S]*Retos[\s\S]*Tu coach/);
  });

  it('la 3.4.0 anuncia la tier list de aumentos de ARAM: Caos', () => {
    expect(NOVEDADES[3]!.version).toBe('3.4.0');
    expect(NOVEDADES[3]!.puntos[0]).toMatch(/aumentos de ARAM: Caos/);
  });

  it('la 3.3.0 anuncia el análisis con IA al terminar y los consejos en los momentos muertos', () => {
    expect(NOVEDADES[4]).toEqual({
      version: '3.3.0',
      fecha: '2026-10-20',
      puntos: [
        'Análisis con IA al terminar cada partida: lo que hiciste bien, qué mejorar y momentos clave.',
        'Consejos de IA en los momentos muertos (al morir o al volver a la tienda), adaptados a tu partida.',
      ],
    });
  });

  it('la 3.2.0 anuncia el cumplimiento de la política de Riot (aumentos, objetos de Arena y aviso legal)', () => {
    expect(NOVEDADES.find((n) => n.version === '3.2.0')!.puntos).toContain(
      'Cumplimiento de la política de Riot: Arena y ARAM: Caos ya no muestran % de victorias de aumentos ni de objetos de Arena; aviso legal oficial en todas las páginas.',
    );
  });

  it('la 3.1.0 anuncia la pantalla de carga a pantalla completa, Espacio para ocultarla y sus opciones', () => {
    const v = NOVEDADES.find((n) => n.version === '3.1.0')!;
    expect(v.fecha).toBe('2026-10-20');
    expect(v.puntos).toContain('Pantalla de carga a pantalla completa con tu tarjeta resaltada (se oculta con Espacio) y opción de solo tarjetas o desactivarla.');
  });

  it('la 3.0.2 anuncia la pantalla de carga, la flecha medida, el overlay en 2K/4K y más avisos del jungla enemigo', () => {
    expect(NOVEDADES.find((n) => n.version === '3.0.2')!.puntos).toEqual([
      'La pantalla de carga vuelve a salir (se quitaba antes de verse).',
      'Flecha de habilidad ajustada con medidas reales del HUD.',
      'El overlay se adapta a pantallas 2K y 4K y ya no tapa el contador de FPS.',
      'Más avisos del jungla enemigo: también cuando ayuda en una kill o se lleva un objetivo o una torre (solo con eventos oficiales del juego).',
    ]);
  });

  it('la 3.1.0 anuncia las 460 frases de voz, con nivel de detalle y categorías', () => {
    expect(NOVEDADES.find((n) => n.version === '3.1.0')!.puntos).toContain('460 frases de voz con variantes en cada idioma: objetivos, economía, farmeo, visión, peleas, fases de la partida, modos y ánimo, con nivel de detalle y categorías que puedes activar una a una.');
  });

  it('la 3.1.0 anuncia la voz natural con su descarga automática', () => {
    const puntos = NOVEDADES.find((n) => n.version === '3.1.0')!.puntos;
    expect(puntos).toContain('Voz natural (neuronal y sin conexión) en los 5 idiomas, mucho menos robótica; se descarga sola en segundo plano (unos 124 MB), nunca durante la selección, la carga ni la partida.');
  });

  it('la 3.1.0 anuncia que «Importar» puede sustituir una página de runas, con confirmación', () => {
    expect(NOVEDADES.find((n) => n.version === '3.1.0')!.puntos).toContain('Importar con todas las páginas de runas ocupadas: la app sustituye una (con tu confirmación).');
  });

  it('la 3.0.1 anuncia sin avisos emergentes, la flecha estilo Blitz, las runas seleccionables y el tema', () => {
    expect(NOVEDADES.find((n) => n.version === '3.0.1')!.puntos).toEqual([
      'Sin avisos emergentes en pantalla por defecto: la voz sigue avisando y los puedes volver a activar en la vista Overlay.',
      'Flecha pequeña estilo Blitz encima de la habilidad que toca subir, solo cuando tienes un punto por gastar, colocada según la escala del HUD de tu LoL.',
      'Runas seleccionables: varias páginas de runas por campeón y rol, con su % de victorias y partidas; la que elijas es la que se importa.',
      'Interfaz con un toque más sombrío y nuevo tema «Sombra» en Ajustes.',
    ]);
  });

  it('la 3.0.0 anuncia lo que se entrega, con los modos ARAM, ARAM: Caos y Arena', () => {
    const texto = NOVEDADES.find((n) => n.version === '3.0.0')!.puntos.join(' ');
    for (const clave of [
      'barra de objetivos',
      'flecha',
      'CS',
      'KDA',
      'aviso de compra',
      'jungla',
      'opcionales',
      'voz',
      'Pantalla de carga',
      'Datos limitados',
      'Campeones',
      'tier',
      'Bienvenida',
      'Novedades',
      'ARAM',
      'ARAM: Caos',
      'Arena',
      'aumentos',
      'jungla enemigo',
      'estimación',
      'apagada',
      'suficientes partidas nuevas',
      'minimapa',
      'Alt+Mayús+L',
      '5 idiomas',
    ]) {
      expect(texto, clave).toContain(clave);
    }
  });

  it('no hay lenguaje que ridiculice a jugadores', () => {
    const todo = NOVEDADES.flatMap((n) => n.puntos).join(' ').toLowerCase();
    for (const mala of ['troll', 'inting', 'malo']) expect(todo).not.toContain(mala);
  });
});

describe('queMostrar', () => {
  it('primera vez → bienvenida', () => {
    expect(queMostrar({})).toBe('bienvenida');
    expect(queMostrar({ bienvenidaVista: false, ultimaVersionVista: null })).toBe('bienvenida');
  });
  it('bienvenida vista y versión ya vista → nada', () => {
    expect(queMostrar({ bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL })).toBe('nada');
  });
  it('tras actualizar → novedades, una sola vez', () => {
    expect(queMostrar({ bienvenidaVista: true, ultimaVersionVista: '2.1.0' })).toBe('novedades');
    expect(queMostrar({ bienvenidaVista: true, ultimaVersionVista: null })).toBe('novedades');
    expect(queMostrar({ bienvenidaVista: true, ultimaVersionVista: '3.0.0' }, '3.0.0')).toBe('nada');
  });
});

describe('ajustes de bienvenida y novedades', () => {
  it('por defecto no se ha visto nada', () => {
    expect(AJUSTES_POR_DEFECTO.bienvenidaVista).toBe(false);
    expect(AJUSTES_POR_DEFECTO.ultimaVersionVista).toBeNull();
  });
  it('un ajustes.json antiguo (sin bienvenidaVista) cuenta como usuario veterano: verá las novedades, no la bienvenida', () => {
    const r = join(mkdtempSync(join(tmpdir(), 'coach-aj-')), 'a.json');
    writeFileSync(r, JSON.stringify({ voz: true }));
    const a = cargarAjustes(r);
    expect(a.bienvenidaVista).toBe(true);
    expect(a.ultimaVersionVista).toBeNull();
    expect(queMostrar(a)).toBe('novedades');
  });
  it('sin archivo es una instalación nueva: verá la bienvenida', () => {
    const a = cargarAjustes(join(mkdtempSync(join(tmpdir(), 'coach-aj-')), 'no.json'));
    expect(a.bienvenidaVista).toBe(false);
    expect(queMostrar(a)).toBe('bienvenida');
  });
  it('un archivo con bienvenidaVista explícita se respeta', () => {
    const r = join(mkdtempSync(join(tmpdir(), 'coach-aj-')), 'a.json');
    writeFileSync(r, JSON.stringify({ bienvenidaVista: false }));
    expect(cargarAjustes(r).bienvenidaVista).toBe(false);
  });
  it('se conservan al normalizar y los tipos incorrectos vuelven al valor por defecto', () => {
    const bien = normalizarAjustes({ bienvenidaVista: true, ultimaVersionVista: '3.0.0' });
    expect(bien.bienvenidaVista).toBe(true);
    expect(bien.ultimaVersionVista).toBe('3.0.0');
    const mal = normalizarAjustes({ bienvenidaVista: 'sí', ultimaVersionVista: 3 });
    expect(mal.bienvenidaVista).toBe(false);
    expect(mal.ultimaVersionVista).toBeNull();
  });
});
