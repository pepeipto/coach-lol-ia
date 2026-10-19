// Pruebas de la web de la 3.0: página de Novedades desde CHANGELOG.md, FAQ nueva y textos de la jungla.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilar } from './compilar.mjs';
import { VERSION_ACTUAL } from '../src/lib/cifras.ts';
import { fechaLarga, interpretarChangelog, leerNovedades, trozos } from '../src/lib/novedades.ts';

let base;
before(() => {
  base = compilar('v3', { PUBLIC_ADSENSE_CLIENT: undefined });
});

const leer = (ruta) => readFileSync(join(base, ruta), 'utf8');
const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');

test('interpretarChangelog lee versiones, fechas y puntos (también partidos en varias líneas)', () => {
  const v = interpretarChangelog(
    '# Novedades\n\nIntro.\n\n## [2.0.0] - 2026-10-19\n\n- Uno con `codigo`.\n- Dos\n  sigue aquí.\n\n## [1.0.0] - 2026-10-18\n\n- Primera.\n',
  );
  assert.deepEqual(v, [
    { version: '2.0.0', fecha: '2026-10-19', puntos: ['Uno con `codigo`.', 'Dos sigue aquí.'] },
    { version: '1.0.0', fecha: '2026-10-18', puntos: ['Primera.'] },
  ]);
  assert.deepEqual(trozos('Uno con `codigo`.'), [
    { codigo: false, texto: 'Uno con ' },
    { codigo: true, texto: 'codigo' },
    { codigo: false, texto: '.' },
  ]);
  assert.equal(fechaLarga('2026-10-19'), '19 de octubre de 2026');
});

test('VERSION_ACTUAL es la primera versión de CHANGELOG.md', () => {
  assert.equal(leerNovedades(fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)))[0].version, VERSION_ACTUAL);
});

test('/novedades se genera desde CHANGELOG.md con todas las versiones y sus puntos', () => {
  const html = leer('novedades/index.html');
  const versiones = interpretarChangelog(changelog);
  assert.ok(versiones.length >= 4);
  for (const v of versiones) {
    assert.ok(html.includes(`Versión ${v.version}`), `falta la versión ${v.version}`);
    assert.ok(html.includes(fechaLarga(v.fecha)), `falta la fecha de ${v.version}`);
  }
  // Un punto de la última versión, tal cual (los textos se escapan, sin HTML del CHANGELOG).
  const punto = versiones[0].puntos.find((p) => !p.includes('`') && !/[<>&"']/.test(p));
  assert.ok(html.includes(punto), 'falta un punto de la última versión');
  assert.match(html, /Última versión/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.coachlolia\.com\/novedades\/"/);
});

test('/novedades está enlazada en la cabecera y el pie', () => {
  for (const p of ['index.html', 'descargar/index.html', 'novedades/index.html']) {
    const html = leer(p);
    const cabecera = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    const pie = html.slice(html.indexOf('<footer'));
    assert.match(cabecera, /href="\/novedades"/, `${p}: falta en la cabecera`);
    assert.match(pie, /href="\/novedades"/, `${p}: falta en el pie`);
  }
});

test('la descarga muestra la versión actual y sigue enlazando a la última release', () => {
  const html = leer('descargar/index.html');
  assert.ok(html.includes(`Última versión: ${VERSION_ACTUAL}`));
  assert.ok(html.includes(`Coach LoL IA Setup ${VERSION_ACTUAL}.exe`));
  assert.ok(html.includes('https://github.com/pepeipto/coach-lol-ia/releases/latest'));
  assert.doesNotMatch(html, /releases\/download\/v?\d/, 'no se enlaza a una versión concreta');
});

test('la FAQ explica los temporizadores de jungla, la pantalla de carga, los modos y el jungla enemigo', () => {
  const html = leer('index.html');
  const faq = html.slice(html.indexOf('id="faq"'));
  for (const texto of [
    '¿Cómo funcionan los temporizadores de jungla?',
    '¿Qué enseña la pantalla de carga?',
    '¿Qué modos de juego admite?',
    '¿Qué me dice del jungla enemigo?',
    'Alt+Mayús+L',
    'nunca los campamentos del rival',
    'registro de muertes',
    'apagada por defecto',
  ]) {
    assert.ok(faq.includes(texto), `falta «${texto}» en la FAQ`);
  }
});

test('sin promesas de seguridad ni de subir de elo, y los avisos del jungla no son seguimiento', () => {
  for (const p of ['index.html', 'novedades/index.html', 'descargar/index.html']) {
    const html = leer(p);
    assert.doesNotMatch(html, /100\s?%\s*segur|no te pueden banear|sube de elo|subirás de elo|garantiza/i, p);
    assert.doesNotMatch(html, /rastrea|rastreo|seguimiento del jungla|está en (top|mid|bot|la jungla)/i, p);
    assert.ok(html.includes('no está respaldado por Riot Games'), `${p}: falta el aviso legal de Riot`);
  }
});

test('las capturas nuevas tienen su versión de 800 px y un texto alternativo largo', () => {
  const html = leer('index.html');
  for (const nombre of ['carga', 'campeones', 'jungla-minimapa', 'jungla-enemiga']) {
    assert.ok(statSync(join(base, 'capturas', `${nombre}.webp`)).size > 10000, `falta ${nombre}.webp`);
    assert.ok(statSync(join(base, 'capturas', `${nombre}-800.webp`)).isFile(), `falta ${nombre}-800.webp`);
    const img = html.match(new RegExp(`<img[^>]*capturas/${nombre}\\.webp[^>]*>`))?.[0] ?? '';
    const alt = img.match(/alt="([^"]*)"/)?.[1] ?? '';
    assert.ok(alt.length > 80, `${nombre}: el texto alternativo es demasiado corto`);
  }
});

test('la privacidad explica los datos de la pantalla de carga', () => {
  const html = leer('privacidad/index.html');
  assert.match(html, /Pantalla de carga/);
  assert.match(html, /PUUID/);
  assert.match(html, /10 minutos/);
  // La app 3.0 ya no manda el Riot ID al servidor: ninguna página puede decir que lo recibe.
  assert.match(html, /Riot ID \(nombre#etiqueta\) no se envía/);
  assert.doesNotMatch(html, /\(PUUID\), su Riot ID/);
  assert.doesNotMatch(leer('index.html'), /identificadores\s+de Riot de los diez jugadores/);
  assert.doesNotMatch(leer('index.html'), /Poca experiencia/);
});
