// Asistente IA de la web: lógica de src/scripts/asistente.ts (fetch simulado) y el componente en el HTML.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilar } from './compilar.mjs';
import {
  preguntar,
  recortarHistorial,
  MENSAJES_ASISTENTE,
  NOTA_ASISTENTE,
  MAX_MENSAJES,
} from '../src/scripts/asistente.ts';

const API = 'http://servidor.test';
const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

test('preguntar: POST JSON a /api/asistente con el historial y devuelve la respuesta', async () => {
  const llamadas = [];
  const fetch = async (url, init) => {
    llamadas.push([url, init]);
    return respuesta(200, { respuesta: 'Pulsa «Importar».' });
  };
  const historial = [{ rol: 'usuario', texto: '¿Cómo importo?' }];
  assert.deepEqual(await preguntar(API + '/', historial, fetch), { ok: true, respuesta: 'Pulsa «Importar».' });
  assert.equal(llamadas[0][0], 'http://servidor.test/api/asistente');
  assert.equal(llamadas[0][1].method, 'POST');
  assert.equal(llamadas[0][1].headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(llamadas[0][1].body), { mensajes: historial });
});

test('preguntar: mensajes de error en español para 503, 429, 502, 400 y la red', async () => {
  const caso = async (status, error) => (await preguntar(API, [{ rol: 'usuario', texto: 'a' }], async () => respuesta(status, { error }))).error;
  assert.equal(await caso(503, 'asistente_no_configurado'), MENSAJES_ASISTENTE.noDisponible);
  assert.equal(await caso(429, 'limite_asistente'), MENSAJES_ASISTENTE.limite);
  assert.equal(await caso(502, 'asistente_no_disponible'), MENSAJES_ASISTENTE.fallo);
  assert.equal(await caso(400, 'mensajes_no_validos'), MENSAJES_ASISTENTE.noValido);
  const red = await preguntar(API, [{ rol: 'usuario', texto: 'a' }], async () => {
    throw new TypeError('Failed to fetch');
  });
  assert.equal(red.error, MENSAJES_ASISTENTE.sinConexion);
  for (const m of Object.values(MENSAJES_ASISTENTE)) assert.match(m, /[áéíóúñ¿¡]|\./);
});

test('recortarHistorial: como mucho 12 mensajes, empezando por el usuario', () => {
  const largo = Array.from({ length: 15 }, (_, i) => ({ rol: i % 2 === 0 ? 'usuario' : 'asistente', texto: String(i) }));
  const r = recortarHistorial(largo);
  assert.ok(r.length <= MAX_MENSAJES);
  assert.equal(r[0].rol, 'usuario');
  assert.equal(r.at(-1).texto, '14');
});

test('la nota avisa de que las respuestas son de IA y remite al correo para cobros', () => {
  assert.equal(
    NOTA_ASISTENTE,
    'Respuestas generadas por IA; pueden contener errores. Para problemas de cobro escribe a suport@coachlolia.com.',
  );
});

test('asistente.ts nunca usa innerHTML', () => {
  const fuente = readFileSync(new URL('../src/scripts/asistente.ts', import.meta.url), 'utf8');
  assert.ok(!fuente.includes('innerHTML'));
  assert.ok(!fuente.includes('insertAdjacentHTML'));
});

let dist;
before(() => {
  dist = compilar('asistente', { PUBLIC_ADSENSE_CLIENT: 'ca-pub-123' });
});

test('el botón «Asistente IA» y su panel están en la portada y en Premium, con la nota y sin anuncios dentro', () => {
  for (const pagina of ['index.html', 'premium/index.html', 'descargar/index.html']) {
    const html = readFileSync(join(dist, pagina), 'utf8');
    assert.match(html, /id="asistente-abrir"/, pagina);
    assert.match(html, />\s*Asistente IA\s*</, pagina);
    assert.match(html, /role="dialog"/, pagina);
    assert.match(html, /aria-modal="true"/, pagina);
    assert.match(html, /Respuestas generadas por IA; pueden contener errores\. Para problemas de cobro escribe a suport@coachlolia\.com\./, pagina);
    const panel = html.slice(html.indexOf('id="asistente-panel"'), html.indexOf('</dialog>', html.indexOf('id="asistente-panel"')));
    assert.ok(panel.length > 0, pagina);
    assert.ok(!/adsbygoogle|googlesyndication/.test(panel), pagina);
  }
});
