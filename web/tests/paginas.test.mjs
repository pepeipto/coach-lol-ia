// Páginas de apoyo, descarga y legales, y reglas de AdSense. Coach LoL IA es gratis: /premium no se construye.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compilar } from './compilar.mjs';

const PAGINAS = [
  'apoyar/index.html',
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

const DONACION = 'https://ko-fi.com/coachlolia-prueba';
const DISCORD = 'https://discord.gg/coachprueba';

let sinAds;
let conAds;
let conDonacion;
before(() => {
  sinAds = compilar('sin-anuncios', { PUBLIC_ADSENSE_CLIENT: undefined, PUBLIC_DONACION_URL: undefined, PUBLIC_DISCORD_URL: undefined });
  conAds = compilar('con-anuncios', { PUBLIC_ADSENSE_CLIENT: 'ca-pub-123', PUBLIC_DONACION_URL: undefined });
  conDonacion = compilar('con-donacion', { PUBLIC_ADSENSE_CLIENT: undefined, PUBLIC_DONACION_URL: DONACION, PUBLIC_DISCORD_URL: DISCORD });
});

test('existen todas las páginas', () => {
  for (const p of PAGINAS) assert.ok(statSync(join(sinAds, p)).isFile(), `falta ${p}`);
});

test('las páginas de los planes se construyen (con o sin AdSense)', () => {
  for (const dir of [sinAds, conAds, conDonacion]) {
    assert.equal(htmls(dir).filter((f) => rel(dir, f).startsWith('premium')).length, 3);
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

test('/apoyar admite AdSense, también solo tras el consentimiento', () => {
  const html = leer(conAds, 'apoyar/index.html');
  assert.match(html, /class="adsbygoogle"/);
  assert.doesNotMatch(html, /<script[^>]+src="[^"]*googlesyndication/);
  assert.match(html, /id="banner-cookies"/);
});

test('/apoyar explica por qué apoyar y qué pagan las donaciones', () => {
  const html = leer(sinAds, 'apoyar/index.html');
  assert.match(html, /gratis/i);
  for (const texto of ['servidor', 'datos', 'desarrollo']) assert.ok(html.includes(texto), `falta «${texto}»`);
  assert.match(html, /anuncios en la web/);
  assert.match(html, /donaciones voluntarias/);
});

test('sin PUBLIC_DONACION_URL no hay botón Donar: «Pronto podrás…» y el correo de soporte', () => {
  const html = leer(sinAds, 'apoyar/index.html');
  assert.doesNotMatch(html, />\s*Donar\s*</);
  assert.doesNotMatch(html, /id="donar"/);
  assert.match(html, /Pronto podrás apoyar el proyecto con una donación\./);
  assert.ok(html.includes('mailto:support@coachlolia.com'));
});

test('con PUBLIC_DONACION_URL el botón Donar enlaza a esa URL', () => {
  const html = leer(conDonacion, 'apoyar/index.html');
  const enlace = html.match(/<a\b[^>]*id="donar"[^>]*>/);
  assert.ok(enlace, 'falta el enlace id="donar"');
  assert.ok(enlace[0].includes(`href="${DONACION}"`), enlace[0]);
  assert.match(html, />\s*Donar\s*</);
  assert.doesNotMatch(html, /Pronto podrás apoyar el proyecto/);
});

test('/apoyar está enlazada desde la portada, la cabecera y el pie', () => {
  const html = leer(sinAds, 'index.html');
  assert.match(html, /href="\/apoyar"/);
  const pie = html.slice(html.indexOf('<footer'));
  assert.match(pie, /href="\/apoyar"/);
  const cabecera = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(cabecera, /href="\/apoyar"/);
});

test('la página de descarga enlaza a la última release y explica los requisitos', () => {
  const html = leer(sinAds, 'descargar/index.html');
  assert.ok(html.includes('https://github.com/pepeipto/coach-lol-ia/releases/latest'));
  assert.match(html, /Windows 10/);
  assert.match(html, /Sin bordes/);
});

test('las páginas legales están marcadas como plantilla', () => {
  for (const p of ['privacidad/index.html', 'terminos/index.html', 'cookies/index.html']) {
    assert.match(leer(sinAds, p), /[Pp]lantilla/, `${p} debe indicar que es una plantilla`);
  }
});

test('el correo de soporte aparece en /apoyar y en las páginas legales', () => {
  for (const p of ['apoyar/index.html', 'privacidad/index.html', 'terminos/index.html', 'cookies/index.html']) {
    assert.ok(leer(sinAds, p).includes('mailto:support@coachlolia.com'), `${p} debe enlazar support@coachlolia.com`);
  }
});

test('la privacidad cuenta las cuotas y los planes: id seudónimo del dispositivo, contadores y Stripe, sin prueba gratuita', () => {
  const html = leer(sinAds, 'privacidad/index.html');
  assert.match(html, /identificador seudónimo y persistente del dispositivo/);
  // Fly.io como alojamiento del servidor y el coach personal, sin campos de plantilla para ellos.
  assert.match(html, /Fly\.io/);
  assert.match(html, /Coach personal \(app\)/);
  assert.doesNotMatch(html, /Proveedor de alojamiento del servidor/);
  // Responsable con sus datos reales, sin huecos de plantilla.
  assert.match(html, /ESTRADA GLOBAL GESTIO, S\.L\./);
  assert.match(html, /B72985229/);
  assert.match(html, /como máximo 30 días/);
  assert.doesNotMatch(html, /\[NIF\]|\[indicar plazo\]/);
  assert.match(html, /Solo se guardan contadores/);
  assert.match(html, /Stripe/);
  assert.match(html, /no vemos los datos de tu tarjeta/);
  assert.doesNotMatch(html, /HMAC-SHA256/);
  assert.doesNotMatch(html, /[Pp]rueba gratuita/);
  // Se mantienen AdSense y las cookies.
  assert.match(html, /AdSense/);
});

test('los términos explican la cuota del coach con IA y los planes, y lo de la partida sigue gratis', () => {
  const html = leer(sinAds, 'terminos/index.html');
  assert.match(html, /gratis para todos/);
  assert.match(html, /cuota mensual/);
  assert.match(html, /Aliado, Estratega, Mariscal y Leyenda/);
  assert.match(html, /Gestionar suscripción/);
  assert.doesNotMatch(html, /Plan Premium|4,99/);
});

test('la privacidad explica el asistente IA: los mensajes van al servidor y a Anthropic y no se guardan', () => {
  const html = leer(sinAds, 'privacidad/index.html');
  assert.match(html, /Asistente IA/);
  assert.match(html, /Anthropic/);
  assert.match(html, /no los guarda más allá de ese procesamiento/);
  assert.match(html, /No escribas datos personales/);
});

test('las redes oficiales salen en el pie de todas las páginas y en la sección de comunidad de la portada', () => {
  const redes = [
    'https://www.youtube.com/@coachlolia',
    'https://www.tiktok.com/@coachlolia',
    'https://www.instagram.com/coachlolia/',
    'https://x.com/coachlolia',
    'https://kick.com/coachlolia',
  ];
  for (const p of ['index.html', 'en/index.html', 'apoyar/index.html', 'descargar/index.html']) {
    const html = leer(sinAds, p);
    for (const r of redes) assert.ok(html.includes(`href="${r}"`), `${p}: falta ${r}`);
    assert.match(html, /aria-label="Coach LoL IA (en|on) YouTube"/);
  }
  const portada = leer(sinAds, 'index.html');
  assert.ok(portada.split('href="https://kick.com/coachlolia"').length - 1 >= 3, 'la portada debe enlazar Kick en pie, menú y comunidad');
  assert.match(portada, /Hecho con ayuda de IA/);
});

test('el enlace de Discord sale en el pie, la FAQ y la tarjeta de ayuda, y PUBLIC_DISCORD_URL lo sustituye', () => {
  for (const p of ['index.html', 'en/index.html', 'apoyar/index.html']) {
    assert.ok(leer(sinAds, p).split('https://discord.gg/wNrW7tREPJ').length - 1 >= 2, `${p}: falta la invitación oficial`);
    const html = leer(conDonacion, p);
    assert.ok(html.split(DISCORD).length - 1 >= 2, `${p}: falta el enlace de Discord sustituido`);
    assert.ok(!html.includes('wNrW7tREPJ'), `${p}: PUBLIC_DISCORD_URL no sustituye la invitación`);
  }
});

test('/discord es un enlace corto a la invitación de Discord, sin indexar', () => {
  const html = leer(sinAds, 'discord/index.html');
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.ok(html.includes('https://discord.gg/wNrW7tREPJ'), 'falta la invitación oficial');
  assert.match(html, /location\.replace/);
  assert.ok(leer(conDonacion, 'discord/index.html').includes(DISCORD), 'PUBLIC_DISCORD_URL no la sustituye');
});

test('/telegram es un enlace corto al asistente de Telegram, sin indexar', () => {
  const html = leer(sinAds, 'telegram/index.html');
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.ok(html.includes('https://t.me/coachlolia_bot'), 'falta el enlace al bot');
  assert.match(html, /location\.replace/);
});

test('el asistente de Telegram se recomienda en la FAQ, el pie y la privacidad, en los 5 idiomas', () => {
  for (const p of ['index.html', 'en/index.html', 'pt-br/index.html', 'fr/index.html', 'de/index.html']) {
    const html = leer(sinAds, p);
    assert.ok((html.match(/https:\/\/t\.me\/coachlolia_bot/g) ?? []).length >= 2, `${p}: falta Telegram en la FAQ o el pie`);
    assert.ok(html.includes('@coachlolia_bot'), `${p}: la FAQ no recomienda Telegram`);
  }
  assert.ok(leer(sinAds, 'privacidad/index.html').includes('@coachlolia_bot'), 'la privacidad no menciona Telegram');
});

test('vídeos de la portada: datos estructurados completos y con zona horaria (Search Console)', () => {
  for (const ruta of ['index.html', 'en/index.html']) {
    const html = leer(sinAds, ruta);
    const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const todo = bloques.flatMap((b) => (b['@graph'] ? b['@graph'] : Array.isArray(b) ? b : [b]));
    const videos = todo.filter((x) => x['@type'] === 'VideoObject');
    assert.equal(videos.length, 2, ruta);
    for (const v of videos) {
      for (const campo of ['name', 'description', 'thumbnailUrl', 'contentUrl', 'uploadDate', 'duration']) assert.ok(v[campo], `${ruta}: falta ${campo}`);
      assert.match(v.uploadDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/, `${ruta}: uploadDate sin zona horaria`);
      assert.match(v.thumbnailUrl, /^https:\/\/www\.coachlolia\.com\//);
    }
  }
});
