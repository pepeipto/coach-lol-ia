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
    expect(pkg.version).toBe('3.0.0');
    expect(VERSION_ACTUAL).toBe(pkg.version);
  });

  it('CHANGELOG.md y el módulo de novedades coinciden, versión a versión', () => {
    expect(leerChangelog()).toEqual(NOVEDADES);
  });

  it('el historial va de la más reciente a la más antigua y cubre 1.0, 2.0, 2.1 y 3.0', () => {
    expect(NOVEDADES.map((n) => n.version)).toEqual(['3.0.0', '2.1.0', '2.0.1', '2.0.0', '1.0.0']);
    const fechas = NOVEDADES.map((n) => n.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    for (const n of NOVEDADES) expect(n.puntos.length).toBeGreaterThan(0);
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
