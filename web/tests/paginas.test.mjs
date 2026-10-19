// Páginas de Premium, descarga y legales, y reglas de AdSense.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compilar } from './compilar.mjs';

const PAGINAS = [
  'premium/index.html',
  'premium/gracias/index.html',
  'premium/gestionar/index.html',
  'descargar/index.html',
  'privacidad/index.html',
  'terminos/index.html',
  'cookies/index.html',
];

function htmls(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...htmls(ruta));
    else if (nombre.endsWith('.html')) salida.push(ruta);
  }
  return salida;
}
const rel = (dir, f) => relative(dir, f).split(sep).join('/');
const leer = (dir, ruta) => readFileSync(join(dir, ruta), 'utf8');

let sinAds;
let conAds;
before(() => {
  sinAds = compilar('sin-anuncios', { PUBLIC_ADSENSE_CLIENT: undefined });
  conAds = compilar('con-anuncios', { PUBLIC_ADSENSE_CLIENT: 'ca-pub-123' });
});

test('existen todas las páginas', () => {
  for (const p of PAGINAS) assert.ok(statSync(join(sinAds, p)).isFile(), `falta ${p}`);
});

test('las páginas premium nunca contienen adsbygoogle (con o sin AdSense configurado)', () => {
  for (const dir of [sinAds, conAds]) {
    const premium = htmls(dir).filter((f) => rel(dir, f).startsWith('premium/'));
    assert.equal(premium.length, 3);
    for (const f of premium) {
      const html = readFileSync(f, 'utf8');
      assert.ok(!html.includes('adsbygoogle'), `${rel(dir, f)} contiene adsbygoogle`);
      assert.ok(!html.includes('googlesyndication'), `${rel(dir, f)} contiene googlesyndication`);
    }
  }
});

test('sin PUBLIC_ADSENSE_CLIENT ninguna página carga AdSense', () => {
  for (const f of htmls(sinAds)) {
    assert.ok(!readFileSync(f, 'utf8').includes('pagead2.googlesyndication.com'), `${rel(sinAds, f)} carga AdSense`);
  }
});

test('con PUBLIC_ADSENSE_CLIENT la portada carga AdSense solo tras el consentimiento', () => {
  const html = leer(conAds, 'index.html');
  assert.ok(html.includes('pagead2.googlesyndication.com'));
  assert.ok(html.includes('ca-pub-123'));
  // Nunca como <script src="…googlesyndication…"> directo: se inyecta desde un script inline.
  assert.doesNotMatch(html, /<script[^>]+src="[^"]*googlesyndication/);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const cargador = scripts.find((s) => s.includes('pagead2.googlesyndication.com'));
  assert.ok(cargador, 'el script de AdSense debe ser inline');
  assert.match(cargador, /localStorage/);
  assert.match(cargador, /aceptadas/);
  assert.match(html, /id="banner-cookies"/);
  assert.match(html, /Rechazar/);
  assert.match(leer(conAds, 'descargar/index.html'), /class="adsbygoogle"/);
});

test('la página de descarga enlaza a la última release y explica los requisitos', () => {
  const html = leer(sinAds, 'descargar/index.html');
  assert.ok(html.includes('https://github.com/pepeipto/coach-lol-ia/releases/latest'));
  assert.match(html, /Windows 10/);
  assert.match(html, /Sin bordes/);
});

test('las páginas premium apuntan al servidor configurado', () => {
  const html = leer(sinAds, 'premium/index.html');
  assert.match(html, /data-api="http:\/\/localhost:8080"/);
  assert.match(html, /Suscribirme/);
  assert.match(html, /4,99\s?€/);
  const gracias = leer(sinAds, 'premium/gracias/index.html');
  assert.match(gracias, /Copiar/);
  assert.match(gracias, /noindex/);
  const gestionar = leer(sinAds, 'premium/gestionar/index.html');
  assert.match(gestionar, /CLIA-/);
});

test('las páginas legales están marcadas como plantilla', () => {
  for (const p of ['privacidad/index.html', 'terminos/index.html', 'cookies/index.html']) {
    assert.match(leer(sinAds, p), /[Pp]lantilla/, `${p} debe indicar que es una plantilla`);
  }
});

test('el correo de soporte aparece en las páginas premium y legales', () => {
  for (const p of ['premium/index.html', 'premium/gracias/index.html', 'premium/gestionar/index.html', 'privacidad/index.html', 'terminos/index.html', 'cookies/index.html']) {
    assert.ok(leer(sinAds, p).includes('mailto:suport@coachlolia.com'), `${p} debe enlazar suport@coachlolia.com`);
  }
});

test('/premium ofrece la prueba de 24 h con su clave, el botón de copiar, las instrucciones y la caducidad', () => {
  const html = leer(sinAds, 'premium/index.html');
  assert.match(html, /Probar Premium 24 h gratis/);
  assert.match(html, /id="pedir-prueba"/);
  assert.match(html, /id="prueba-copiar"/);
  assert.match(html, /Pégala en la app: Premium → Clave de licencia/);
  assert.match(html, /Caduca:/);
});

test('la prueba gratuita aparece en Planes y en la FAQ de la portada', () => {
  const html = leer(sinAds, 'index.html');
  const planes = html.slice(html.indexOf('id="planes"'), html.indexOf('id="hoja-de-ruta"'));
  assert.match(planes, /Prueba Premium 24 h gratis/);
  const faq = html.slice(html.indexOf('id="faq"'));
  assert.match(faq, /¿Puedo probar Premium antes de pagar\?/);
});

test('la privacidad explica el id anónimo del dispositivo y el hash de la IP de las pruebas', () => {
  const html = leer(sinAds, 'privacidad/index.html');
  assert.match(html, /identificador anónimo del dispositivo/);
  assert.match(html, /hash/);
  assert.match(html, /solo para limitar las pruebas/);
});

test('la privacidad explica el asistente IA: los mensajes van al servidor y a Anthropic y no se guardan', () => {
  const html = leer(sinAds, 'privacidad/index.html');
  assert.match(html, /Asistente IA/);
  assert.match(html, /Anthropic/);
  assert.match(html, /no los guarda más allá de ese procesamiento/);
  assert.match(html, /No escribas datos personales/);
});
