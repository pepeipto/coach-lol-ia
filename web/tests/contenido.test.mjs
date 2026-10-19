// Pruebas de contenido: compilan la web con `astro build` y comprueban el HTML generado.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compilar } from './compilar.mjs';
import { PRUEBAS_AUTOMATICAS } from '../src/lib/cifras.ts';

const AVISO_RIOT =
  'Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.';

let base;
before(() => {
  base = compilar('base', { PUBLIC_ADSENSE_CLIENT: undefined });
});

const leer = (dir, ruta) => readFileSync(join(dir, ruta), 'utf8');

test('la portada contiene el nombre, el precio y el aviso legal de Riot', () => {
  const html = leer(base, 'index.html');
  assert.match(html, /Coach LoL IA/);
  assert.match(html, /4,99\s?€/);
  assert.ok(html.includes(AVISO_RIOT), 'falta el aviso legal de Riot completo');
});

test('la portada tiene todas las secciones', () => {
  const html = leer(base, 'index.html');
  for (const id of ['que-hace', 'como-funciona', 'arquitectura', 'seguridad', 'datos', 'tecnologias', 'calidad', 'planes', 'hoja-de-ruta', 'faq']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta la sección ${id}`);
  }
});

test('la portada explica los datos técnicos clave', () => {
  const html = leer(base, 'index.html');
  for (const texto of ['127.0.0.1:2999', 'LCU', 'Esmeralda', 'EUW', 'LAN', 'LAS', 'menos de 200 partidas', '20 partidas', '6 h', 'Vanguard']) {
    assert.ok(html.includes(texto), `falta «${texto}»`);
  }
  assert.match(html, /<svg[^>]*aria-labelledby="diagrama-titulo[^"]*"/, 'falta el diagrama SVG en línea');
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
  assert.ok(paginas.length >= 8);
  for (const f of paginas) assert.doesNotMatch(readFileSync(f, 'utf8'), /maqueta/i, `${f} no debe contener «maqueta»`);
  const html = leer(base, 'index.html');
  const capturas = [...new Set([...html.matchAll(/\/capturas\/[\w.-]+\.(?:webp|png)/g)].map((m) => m[0]))];
  for (const nombre of ['campeon-premium', 'overlay-partida', 'ayuda']) {
    assert.ok(capturas.some((c) => c.includes(nombre)), `la portada debe mostrar ${nombre}`);
  }
  for (const c of capturas) assert.ok(statSync(join(base, c)).isFile(), `falta ${c} en dist`);
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
  assert.match(leer(base, 'premium/index.html'), /<link rel="canonical" href="https:\/\/www\.coachlolia\.com\/premium\/"/);
  assert.match(leer(base, 'premium/gracias/index.html'), /<link rel="canonical" href="https:\/\/www\.coachlolia\.com\/premium\/gracias\/"/);
});

test('la sección Planes muestra el precio y no promete «para siempre»', () => {
  const html = leer(base, 'index.html');
  const inicio = html.indexOf('id="planes"');
  const planes = html.slice(inicio, html.indexOf('</section>', inicio));
  assert.match(planes, /4,99\s?€/);
  assert.ok(!html.includes('para siempre'));
});

test('premium.ts no usa innerHTML', () => {
  const fuente = readFileSync(new URL('../src/scripts/premium.ts', import.meta.url), 'utf8');
  assert.ok(!fuente.includes('innerHTML'));
});

test('el despliegue falla si falta PUBLIC_API_URL', () => {
  const wf = readFileSync(new URL('../../.github/workflows/web.yml', import.meta.url), 'utf8');
  assert.match(wf, /PUBLIC_API_URL[\s\S]*exit 1/);
});
