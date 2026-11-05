// Pruebas de contenido: compilan la web con `astro build` y comprueban el HTML generado.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compilar } from './compilar.mjs';
import { PRUEBAS_AUTOMATICAS } from '../src/lib/cifras.ts';

const AVISO_RIOT =
  'Coach LoL IA no está respaldado por Riot Games y no refleja los puntos de vista ni las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de las propiedades de Riot Games. Riot Games y todas sus propiedades asociadas son marcas comerciales o marcas registradas de Riot Games, Inc.';

let base;
before(() => {
  base = compilar('base', { PUBLIC_ADSENSE_CLIENT: undefined });
});

const leer = (dir, ruta) => readFileSync(join(dir, ruta), 'utf8');

test('la portada contiene el nombre, que es gratis y el aviso legal de Riot', () => {
  const html = leer(base, 'index.html');
  assert.match(html, /Coach LoL IA/);
  assert.match(html, /Gratis · Windows 10\/11 · Solo API oficiales de Riot/);
  assert.ok(html.includes(AVISO_RIOT), 'falta el aviso legal de Riot completo');
});

test('la portada tiene todas las secciones', () => {
  const html = leer(base, 'index.html');
  for (const id of ['que-hace', 'novedades-3', 'como-funciona', 'arquitectura', 'seguridad', 'datos', 'tecnologias', 'calidad', 'planes', 'hoja-de-ruta', 'faq']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta la sección ${id}`);
  }
});

test('la portada explica los datos técnicos clave', () => {
  const html = leer(base, 'index.html');
  for (const texto of ['127.0.0.1:2999', 'LCU', 'Esmeralda', 'EUW', 'LAN', 'LAS', 'menos de 200 partidas', '10 partidas', 'Datos limitados', '6 h', 'Vanguard']) {
    assert.ok(html.includes(texto), `falta «${texto}»`);
  }
  assert.match(html, /<svg[^>]*aria-labelledby="diagrama-titulo[^"]*"/, 'falta el diagrama SVG en línea');
});

test('la portada menciona los modos de juego admitidos', () => {
  const html = leer(base, 'index.html');
  for (const texto of ['ARAM', 'ARAM: Caos', 'Arena', 'aumentos', '¿Qué modos de juego admite?', 'miles de partidas nuevas por región']) {
    assert.ok(html.includes(texto), `falta «${texto}»`);
  }
});

test('dominio propio: CNAME, canonical y rutas sin prefijo', () => {
  assert.equal(readFileSync(join(base, 'CNAME'), 'utf8').trim(), 'www.coachlolia.com');
  const html = leer(base, 'index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.coachlolia\.com\/"/);
  assert.ok(!html.includes('/coach-lol-ia/'), 'no debe quedar el prefijo /coach-lol-ia/');
  assert.ok(!html.includes('pepeipto.github.io'), 'no debe quedar la URL de github.io');
  assert.match(html, /href="\/favicon\.svg"/);
  assert.match(html, /href="\/descargar"/);
});

test('el correo de soporte aparece en el pie de la portada', () => {
  const html = leer(base, 'index.html');
  const pie = html.slice(html.indexOf('<footer'));
  assert.ok(pie.includes('href="mailto:support@coachlolia.com"'), 'falta el enlace mailto en el pie');
  assert.ok(pie.includes('support@coachlolia.com'));
  assert.match(html, /¿Necesitas ayuda\?/);
});

test('arte oficial: splash en WebP local y crédito de imágenes en el pie', () => {
  const html = leer(base, 'index.html');
  assert.match(html, /src="\/img\/splash-ahri\.webp"[^>]*fetchpriority="high"|fetchpriority="high"[^>]*src="\/img\/splash-ahri\.webp"/);
  assert.ok(!html.includes('ddragon.leagueoflegends.com'), 'las imágenes no se enlazan en caliente');
  assert.ok(!/capturas\/[\w-]+\.svg/.test(html), 'no quedan las maquetas SVG');
  assert.ok(html.includes('Imágenes de League of Legends © Riot Games, Inc.'));
  assert.ok(statSync(join(base, 'img', 'splash-ahri.webp')).size > 10000);
});

test('capturas reales: sin maquetas y con las imágenes de /capturas/ presentes en dist', () => {
  const todas = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? todas(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
    );
  const paginas = todas(base);
  assert.ok(paginas.length >= 6); // portada, apoyar, descargar y las tres legales
  for (const f of paginas) assert.doesNotMatch(readFileSync(f, 'utf8'), /maqueta/i, `${f} no debe contener «maqueta»`);
  const html = leer(base, 'index.html');
  const capturas = [...new Set([...html.matchAll(/\/capturas\/[\w.-]+\.(?:webp|png)/g)].map((m) => m[0]))];
  for (const nombre of ['campeon', 'overlay-partida', 'overlay-estilo-hextech', 'overlay-estilo-neon', 'overlay-estilo-cristal', 'ayuda', 'carga', 'campeones', 'jungla-minimapa']) {
    assert.ok(capturas.some((c) => c.includes(nombre)), `la portada debe mostrar ${nombre}`);
  }
  for (const c of capturas) assert.ok(statSync(join(base, c)).isFile(), `falta ${c} en dist`);
  // Ninguna captura enseña la interfaz de Premium (banner promocional ni vista Premium).
  for (const c of capturas) assert.doesNotMatch(c, /premium|gratis/, `${c} muestra la interfaz de Premium`);
  assert.match(html, /Captura real/);
});

test('la cifra de pruebas automáticas sale de una única constante', () => {
  const html = leer(base, 'index.html');
  assert.equal(typeof PRUEBAS_AUTOMATICAS, 'number');
  const apariciones = html.split(`>${PRUEBAS_AUTOMATICAS}<`).length - 1;
  assert.ok(apariciones >= 2, `la cifra ${PRUEBAS_AUTOMATICAS} debe aparecer en las cifras y en Calidad`);
});

test('sin promesas sobre Vanguard en ninguna página', () => {
  const todas = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? todas(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
    );
  for (const f of todas(base)) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /Compatible con Vanguard|Segura con Vanguard|no se ve afectado/, f);
  }
});

test('canonical con barra final también en las subpáginas', () => {
  assert.match(leer(base, 'apoyar/index.html'), /<link rel="canonical" href="https:\/\/www\.coachlolia\.com\/apoyar\/"/);
  assert.match(leer(base, 'descargar/index.html'), /<link rel="canonical" href="https:\/\/www\.coachlolia\.com\/descargar\/"/);
});

test('«Planes»: todo lo de la partida gratis, anuncios solo en la web y donaciones (y la tabla de planes al final, en español)', () => {
  const html = leer(base, 'index.html');
  const inicio = html.indexOf('id="planes"');
  // Hasta la tabla de planes de pago (solo en español), que va al final de la sección.
  const fin = Math.min(...['</section>', 'class="planes"'].map((m) => html.indexOf(m, inicio)).filter((i) => i > 0));
  const planes = html.slice(inicio, fin);
  assert.match(planes, /Gratis para jugar/);
  assert.match(planes, /gratis para todos/);
  assert.match(planes, /anuncios en la web/);
  assert.match(planes, /donaciones voluntarias/);
  assert.match(planes, /sin anuncios dentro de la app|no tiene anuncios/);
  assert.match(planes, /href="\/apoyar"/);
  assert.doesNotMatch(planes, /Premium|24 h|€/);
  assert.ok(!html.includes('para siempre'));
});

test('planes lanzados: se construyen /premium, la portada en español los enlaza y el resto de idiomas no habla de precios', () => {
  const todas = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? todas(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
    );
  for (const p of ['premium/index.html', 'premium/gracias/index.html', 'premium/gestionar/index.html']) {
    assert.ok(statSync(join(base, p)).isFile(), `${p} debe construirse`);
  }
  const planes = leer(base, 'premium/index.html');
  for (const plan of ['Gratis', 'Aliado', 'Estratega', 'Mariscal', 'Leyenda']) assert.match(planes, new RegExp(`>${plan}<`));
  assert.match(leer(base, 'index.html'), /href="\/premium\/?"/);
  for (const f of todas(base)) {
    if (f.includes('/premium/') || f === join(base, 'index.html')) continue;
    assert.ok(!readFileSync(f, 'utf8').includes('4,99'), `${f} menciona 4,99`);
  }
});

test('la FAQ dice que es gratis y ya no habla de Premium, pruebas ni licencias', () => {
  const html = leer(base, 'index.html');
  const faq = html.slice(html.indexOf('id="faq"'));
  assert.match(faq, /¿Es gratis\?/);
  assert.match(faq, /anuncios en la web y donaciones/);
  assert.doesNotMatch(faq, /Premium|licencia|prueba gratuita|Probar/);
});

test('premium.ts no usa innerHTML', () => {
  const fuente = readFileSync(new URL('../src/scripts/premium.ts', import.meta.url), 'utf8');
  assert.ok(!fuente.includes('innerHTML'));
});

test('el despliegue falla si falta PUBLIC_API_URL', () => {
  const wf = readFileSync(new URL('../../.github/workflows/web.yml', import.meta.url), 'utf8');
  assert.match(wf, /PUBLIC_API_URL[\s\S]*exit 1/);
});

test('el despliegue pasa PUBLIC_DONACION_URL (opcional) desde las variables del repositorio', () => {
  const wf = readFileSync(new URL('../../.github/workflows/web.yml', import.meta.url), 'utf8');
  assert.match(wf, /PUBLIC_DONACION_URL: \$\{\{ vars\.PUBLIC_DONACION_URL \}\}/);
});
