// Web multilenguaje (3.1): rutas traducidas, hreflang, <html lang>, metadatos, sitemaps, JSON-LD, clips y textos.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { compilar } from './compilar.mjs';
import { IDIOMAS, INFO, PAGINAS, SLUGS, SITIO, alternativas, canonica, ruta } from '../src/i18n/idiomas.ts';
import { md } from '../src/i18n/md.ts';
import { es } from '../src/i18n/textos/es.ts';
import { en } from '../src/i18n/textos/en.ts';
import { ptBr } from '../src/i18n/textos/pt-br.ts';
import { fr } from '../src/i18n/textos/fr.ts';
import { de } from '../src/i18n/textos/de.ts';
import { NOTAS_TRADUCIDAS } from '../src/i18n/changelog.ts';
import { interpretarChangelog } from '../src/lib/novedades.ts';

const TEXTOS = { es, en, 'pt-br': ptBr, fr, de };
const AVISO_RIOT = 'Coach LoL IA no está respaldado por Riot Games';

let dist;
before(() => {
  dist = compilar('i18n', { PUBLIC_ADSENSE_CLIENT: undefined });
});

/** Ruta del HTML generado para una página e idioma. */
function archivo(lang, pagina) {
  const r = ruta(lang, pagina).replace(/^\//, '').replace(/\/$/, '');
  return join(dist, r, 'index.html');
}
const leer = (lang, pagina) => readFileSync(archivo(lang, pagina), 'utf8');
const todos = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? todos(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );
const jsonld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];

/** Estructura de claves (y longitud de las listas) de un objeto de textos. */
function forma(v) {
  if (Array.isArray(v)) return v.map(forma);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, forma(v[k])]));
  return typeof v;
}

test('los cinco idiomas tienen exactamente las mismas claves y listas que el español', () => {
  const ref = forma(es);
  for (const [lang, tx] of Object.entries(TEXTOS)) assert.deepEqual(forma(tx), ref, `textos de ${lang}`);
});

test('ningún texto traducido está vacío salvo las notas que solo existen fuera del español', () => {
  const opcionalesEs = new Set(['textosVideo', 'notaIdioma', 'traduccion']);
  const puedenIrVacios = new Set(['clase']);
  function revisar(v, ruta, lang) {
    if (typeof v === 'string') {
      const clave = ruta.at(-1);
      if (puedenIrVacios.has(clave)) return;
      if (lang === 'es' && opcionalesEs.has(clave)) return assert.equal(v, '', `${lang}:${ruta.join('.')}`);
      assert.ok(v.trim().length > 0, `${lang}:${ruta.join('.')} está vacío`);
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) revisar(x, [...ruta, k], lang);
  }
  for (const [lang, tx] of Object.entries(TEXTOS)) revisar(tx, [], lang);
});

test('md escapa el HTML y resuelve los enlaces internos al idioma', () => {
  assert.equal(md('<b>x</b> & "y"', 'es'), '&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;');
  assert.equal(md('**a** y *b* con `c<d>`', 'es'), '<strong>a</strong> y <em>b</em> con <code>c&lt;d&gt;</code>');
  assert.equal(md('[Bajar](@descargar)', 'en'), '<a href="/en/download">Bajar</a>');
  assert.equal(md('[x](@inicio#seguridad)', 'de'), '<a href="/de/#seguridad">x</a>');
  assert.equal(md('[G](https://github.com)', 'es'), '<a href="https://github.com" rel="noopener">G</a>');
  assert.throws(() => md('[x](@noexiste)', 'es'));
});

test('cada página existe en cada idioma, con su ruta traducida', () => {
  assert.equal(ruta('es', 'descargar'), '/descargar');
  assert.equal(ruta('en', 'descargar'), '/en/download');
  assert.equal(ruta('pt-br', 'inicio'), '/pt-br/');
  assert.equal(canonica('fr', 'novedades'), 'https://www.coachlolia.com/fr/nouveautes/');
  for (const lang of IDIOMAS) for (const p of PAGINAS) assert.ok(existsSync(archivo(lang, p)), `falta ${lang} ${p}`);
  assert.equal(PAGINAS.length * IDIOMAS.length, 60);
});

test('<html lang> localizado y canonical propio en cada página', () => {
  for (const lang of IDIOMAS)
    for (const p of PAGINAS) {
      const html = leer(lang, p);
      assert.match(html, new RegExp(`<html lang="${INFO[lang].html}"`), `${lang} ${p}`);
      assert.ok(html.includes(`<link rel="canonical" href="${canonica(lang, p)}"`), `${lang} ${p}: canonical`);
      assert.ok(html.includes(`<meta property="og:locale" content="${INFO[lang].og}"`), `${lang} ${p}: og:locale`);
    }
});

test('hreflang: las cinco versiones más x-default, absolutas, recíprocas y con barra final', () => {
  for (const p of PAGINAS) {
    const esperadas = alternativas(p);
    assert.equal(esperadas.length, 6);
    assert.deepEqual(
      esperadas.map((a) => a.hreflang),
      ['es', 'en', 'pt-BR', 'fr', 'de', 'x-default'],
    );
    assert.equal(esperadas.at(-1).href, canonica('es', p));
    for (const lang of IDIOMAS) {
      const html = leer(lang, p);
      const enlaces = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ hreflang: m[1], href: m[2] }));
      assert.deepEqual(enlaces, esperadas, `${lang} ${p}`);
      for (const e of enlaces) {
        assert.ok(e.href.startsWith(`${SITIO}/`) && e.href.endsWith('/'), e.href);
        // Recíproco: la página enlazada existe y apunta de vuelta a esta.
        const otra = IDIOMAS.find((l) => canonica(l, p) === e.href);
        assert.ok(otra, e.href);
        assert.ok(leer(otra, p).includes(`hreflang="${INFO[lang].hreflang}" href="${canonica(lang, p)}"`));
      }
    }
  }
});

test('título y descripción únicos por página e idioma, con una longitud razonable', () => {
  const titulos = new Set();
  const descripciones = new Set();
  for (const lang of IDIOMAS)
    for (const p of PAGINAS) {
      const html = leer(lang, p);
      const titulo = html.match(/<title>([^<]*)<\/title>/)[1];
      const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
      assert.ok(titulo.length >= 25 && titulo.length <= 70, `${lang} ${p}: título de ${titulo.length} (${titulo})`);
      assert.ok(desc.length >= 80 && desc.length <= 170, `${lang} ${p}: descripción de ${desc.length}`);
      assert.ok(!titulos.has(titulo), `título repetido: ${titulo}`);
      assert.ok(!descripciones.has(desc), `descripción repetida: ${desc}`);
      titulos.add(titulo);
      descripciones.add(desc);
    }
});

test('Open Graph y Twitter con imagen 1200×630 propia de cada idioma', async () => {
  for (const lang of IDIOMAS) {
    const html = leer(lang, 'inicio');
    assert.ok(html.includes(`<meta property="og:image" content="${SITIO}/og/og-${lang}.jpg"`), lang);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    const { width, height } = await sharp(join(dist, 'og', `og-${lang}.jpg`)).metadata();
    assert.deepEqual([width, height], [1200, 630], lang);
  }
});

test('el selector de idioma de la cabecera lleva a la misma página en cada idioma', () => {
  for (const lang of IDIOMAS) {
    const html = leer(lang, 'builds');
    const cab = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    for (const otro of IDIOMAS) assert.ok(cab.includes(`href="${ruta(otro, 'builds')}"`), `${lang} → ${otro}`);
    assert.match(cab, /<details class="idiomas"/);
  }
});

test('la línea legal de Riot está en todas las páginas de todos los idiomas', () => {
  const paginas = todos(dist);
  assert.ok(paginas.length >= 61);
  for (const f of paginas) assert.ok(readFileSync(f, 'utf8').includes(AVISO_RIOT), f);
});

test('sin promesas de seguridad total ni de subir de elo en ningún idioma', () => {
  for (const f of todos(dist)) {
    const html = readFileSync(f, 'utf8');
    assert.doesNotMatch(html, /100\s?%\s*(segur|safe|sicher|sûr)/i, f);
    assert.doesNotMatch(html, /no te pueden banear|can(?:no|')t get banned|subirás de elo|guaranteed to climb/i, f);
  }
});

test('JSON-LD: Organization, WebSite, SoftwareApplication gratis, FAQPage y BreadcrumbList', () => {
  for (const lang of IDIOMAS) {
    const grafo = jsonld(leer(lang, 'inicio'));
    const tipos = grafo.map((n) => n['@type']);
    for (const t of ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']) assert.ok(tipos.includes(t), `${lang}: falta ${t}`);
    const app = grafo.find((n) => n['@type'] === 'SoftwareApplication');
    assert.equal(app.offers.price, '0');
    assert.equal(app.operatingSystem, 'Windows 10, Windows 11');
    const faq = grafo.find((n) => n['@type'] === 'FAQPage');
    assert.equal(faq.mainEntity.length, TEXTOS[lang].inicio.faq.preguntas.length);
    const migas = jsonld(leer(lang, 'guiaRunas')).find((n) => n['@type'] === 'BreadcrumbList');
    assert.equal(migas.itemListElement.length, 3, `${lang}: migas de la guía`);
    assert.equal(migas.itemListElement.at(-1).item, canonica(lang, 'guiaRunas'));
  }
});

test('sitemap índice, un sitemap por idioma con alternativas y robots.txt', () => {
  const indice = readFileSync(join(dist, 'sitemap-index.xml'), 'utf8');
  for (const lang of IDIOMAS) {
    assert.ok(indice.includes(`<loc>${SITIO}/sitemap-${lang}.xml</loc>`));
    const sm = readFileSync(join(dist, `sitemap-${lang}.xml`), 'utf8');
    for (const p of PAGINAS) assert.ok(sm.includes(`<loc>${canonica(lang, p)}</loc>`), `${lang} ${p}`);
    assert.equal((sm.match(/<xhtml:link /g) || []).length, PAGINAS.length * 6);
  }
  const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/www\.coachlolia\.com\/sitemap-index\.xml/);
});

test('404 propia, sin indexar y con enlaces a las cinco portadas', () => {
  const html = readFileSync(join(dist, '404.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex"/);
  for (const lang of IDIOMAS) assert.ok(html.includes(`href="${ruta(lang, 'inicio')}"`));
});

test('favicons y manifest', () => {
  for (const f of ['favicon.ico', 'favicon.svg', 'manifest.webmanifest', 'iconos/apple-touch-icon.png', 'iconos/icono-192.png', 'iconos/icono-512.png'])
    assert.ok(existsSync(join(dist, f)), `falta ${f}`);
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Coach LoL IA');
  assert.match(leer('es', 'inicio'), /<link rel="manifest" href="\/manifest\.webmanifest"/);
});

test('«Míralo en acción»: clips ligeros, diferidos, sin sonido y con subtítulos', () => {
  for (const lang of IDIOMAS) {
    const html = leer(lang, 'inicio');
    const seccion = html.slice(html.indexOf('id="en-accion"'), html.indexOf('id="novedades-3"'));
    const videos = [...seccion.matchAll(/<video\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(videos.length, 2, lang);
    for (const v of videos) {
      for (const attr of ['muted', 'playsinline', 'loop', 'preload="none"', 'data-poster="/video/', 'aria-label="']) assert.ok(v.includes(attr), `${lang}: ${attr}`);
      assert.doesNotMatch(v, /autoplay/);
      // El póster no se pide al cargar la página: lo pone el script al acercarse (y <noscript> sin JavaScript).
      assert.doesNotMatch(v, / poster=/);
    }
    assert.equal((seccion.match(/<track /g) || []).length, 10, lang);
    assert.equal((seccion.match(/<img class="clip-poster" data-src="\/video\//g) || []).length, 2, lang);
    // Fuera del español, los subtítulos del idioma de la página se activan por defecto.
    const porDefecto = [...seccion.matchAll(/<track [^>]*default[^>]*>/g)].map((m) => m[0]);
    assert.equal(porDefecto.length, lang === 'es' ? 0 : 2, lang);
    for (const d of porDefecto) assert.ok(d.includes(`srclang="${INFO[lang].html}"`));
  }
  for (const nombre of ['coach-en-partida', 'coach-lol-ia-3-tour']) {
    for (const ext of ['mp4', 'webm']) {
      const tam = statSync(join(dist, 'video', `${nombre}.${ext}`)).size;
      assert.ok(tam > 200_000 && tam < 6_000_000, `${nombre}.${ext}: ${tam} bytes`);
    }
    assert.ok(statSync(join(dist, 'video', `${nombre}-poster.webp`)).size < 150_000);
    for (const lang of IDIOMAS) assert.match(readFileSync(join(dist, 'video', 'subs', `${nombre}.${lang}.vtt`), 'utf8'), /^WEBVTT/);
  }
});

test('las capturas de partida real tienen texto alternativo largo y su versión de 800 px', () => {
  const html = leer('es', 'inicio');
  for (const nombre of ['partida-objetivos', 'partida-dragon']) {
    assert.ok(existsSync(join(dist, 'capturas', `${nombre}-800.webp`)));
    const img = html.match(new RegExp(`<img[^>]*capturas/${nombre}\\.webp[^>]*>`))?.[0] ?? '';
    assert.ok((img.match(/alt="([^"]*)"/)?.[1] ?? '').length > 100, nombre);
    assert.match(img, /loading="lazy"/);
  }
});

test('las notas 3.x traducidas tienen los mismos puntos que el CHANGELOG', () => {
  const versiones = interpretarChangelog(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'));
  for (const [lang, notas] of Object.entries(NOTAS_TRADUCIDAS))
    for (const [version, puntos] of Object.entries(notas)) {
      const v = versiones.find((x) => x.version === version);
      assert.ok(v, `${lang}: ${version} no está en el CHANGELOG`);
      assert.equal(puntos.length, v.puntos.length, `${lang} ${version}`);
    }
  // En inglés, la 3.0.2 sale traducida y la 1.0.0, en español con lang="es".
  const html = leer('en', 'novedades');
  assert.ok(html.includes(NOTAS_TRADUCIDAS.en['3.0.2'][0]));
  assert.match(html, /<ul class="lista-check" lang="es"/);
});

test('las rutas de SLUGS no se repiten dentro de un idioma', () => {
  for (const lang of IDIOMAS) {
    const slugs = PAGINAS.map((p) => SLUGS[p][lang]);
    assert.equal(new Set(slugs).size, slugs.length, lang);
  }
});

test('3.1 publicada: la hoja de ruta y Novedades la dan por disponible, sin voz pregrabada ni ElevenLabs', () => {
  for (const lang of IDIOMAS) {
    const tx = TEXTOS[lang];
    const v31 = tx.inicio.hojaDeRuta.items.find((i) => i.version === '3.1');
    assert.ok(v31 && v31.hecho, `${lang}: 3.1 en la hoja de ruta`);
    assert.equal(v31.puntos.length, 3);
    assert.match(v31.puntos.join(' '), /460/);
    assert.doesNotMatch(tx.novedades.proxima.titulo, /Próximamente|Coming soon|Bientôt|Demnächst|Em breve/);
  }
  for (const f of todos(dist)) assert.doesNotMatch(readFileSync(f, 'utf8'), /ElevenLabs|pregrabad|pre-recorded|préenregistr|vorab aufgenommen|pré-gravad/i, f);
  // 3.1: «Importar» puede sustituir una página del jugador (con confirmación): ya no se promete que nunca borra.
  for (const f of todos(dist)) assert.doesNotMatch(readFileSync(f, 'utf8'), /nunca borra las tuyas|never deletes yours|n’efface jamais les tiennes|löscht nie deine eigenen|nunca apaga as suas/i, f);
});

test('la privacidad cuenta que el modelo de la voz natural (~124 MB) se descarga de GitHub', () => {
  for (const lang of IDIOMAS) {
    const html = leer(lang, 'privacidad');
    assert.match(html, /124 M[Bo]/, lang);
    assert.match(html, /GitHub/, lang);
  }
});
