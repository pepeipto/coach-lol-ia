// Pruebas de contenido: compilan la web con `astro build` y comprueban el HTML generado.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compilar } from './compilar.mjs';

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
  for (const texto of ['127.0.0.1:2999', 'LCU', 'Esmeralda', 'EUW', 'LAN', 'LAS', '200', '20 partidas', '6 h', '229', 'Vanguard']) {
    assert.ok(html.includes(texto), `falta «${texto}»`);
  }
  assert.match(html, /<svg[^>]*aria-labelledby="diagrama-titulo[^"]*"/, 'falta el diagrama SVG en línea');
  assert.match(html, /maqueta/i, 'las capturas deben marcarse como maqueta');
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
  assert.ok(pie.includes('href="mailto:suport@coachlolia.com"'), 'falta el enlace mailto en el pie');
  assert.ok(pie.includes('suport@coachlolia.com'));
  assert.match(html, /¿Necesitas ayuda\?/);
});

test('arte oficial: splash en WebP local y crédito de imágenes en el pie', () => {
  const html = leer(base, 'index.html');
  assert.match(html, /src="\/img\/splash-ahri\.webp"[^>]*fetchpriority="high"|fetchpriority="high"[^>]*src="\/img\/splash-ahri\.webp"/);
  assert.ok(!html.includes('ddragon.leagueoflegends.com'), 'las imágenes no se enlazan en caliente');
  assert.ok(!html.includes('capturas/'), 'no quedan las maquetas SVG');
  assert.ok(html.includes('Imágenes de League of Legends © Riot Games, Inc.'));
  assert.ok(statSync(join(base, 'img', 'splash-ahri.webp')).size > 10000);
});
