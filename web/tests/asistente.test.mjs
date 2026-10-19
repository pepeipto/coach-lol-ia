// Asistente IA de la web: lógica de src/scripts/asistente.ts (fetch simulado) y el componente en el HTML.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilar } from './compilar.mjs';
import {
  preguntar,
  normalizarHistorial,
  paraEnviar,
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

test('normalizarHistorial: alterna roles, quita la pregunta final sin respuesta, recorta respuestas a 8000 y deja como mucho 11', () => {
  const u = (texto) => ({ rol: 'usuario', texto });
  const a = (texto) => ({ rol: 'asistente', texto });
  // Pregunta sin respuesta al final (se navegó mientras esperaba): se quita.
  assert.deepEqual(normalizarHistorial([u('1'), a('2'), u('3')]), [u('1'), a('2')]);
  // Roles que no alternan o que empiezan por el asistente: se quitan las entradas sobrantes.
  assert.deepEqual(normalizarHistorial([a('x'), u('1'), u('1b'), a('2'), a('2b')]), [u('1'), a('2')]);
  // Respuestas larguísimas recortadas a 8000.
  assert.equal(normalizarHistorial([u('1'), a('y'.repeat(9000))])[1].texto.length, 8000);
  // Como mucho 11, empezando por el usuario.
  const largo = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? u(String(i)) : a(String(i))));
  const r = normalizarHistorial(largo);
  assert.ok(r.length <= 11);
  assert.equal(r[0].rol, 'usuario');
  assert.equal(r.at(-1).texto, '29');
  // Basura de sessionStorage.
  assert.deepEqual(normalizarHistorial([null, { rol: 'x' }, u(''), u('1'), a('2')]), [u('1'), a('2')]);
});

test('paraEnviar: historial normalizado + la pregunta nueva (≤ 12, alterno, termina en usuario)', () => {
  const u = (texto) => ({ rol: 'usuario', texto });
  const a = (texto) => ({ rol: 'asistente', texto });
  const largo = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? u(String(i)) : a('y'.repeat(9000))));
  const m = paraEnviar(largo, 'nueva');
  assert.ok(m.length <= MAX_MENSAJES);
  assert.equal(m[0].rol, 'usuario');
  assert.deepEqual(m.at(-1), u('nueva'));
  for (let i = 1; i < m.length; i++) assert.notEqual(m[i].rol, m[i - 1].rol);
  assert.ok(m.every((x) => x.rol === 'usuario' || x.texto.length <= 8000));
  // Un historial atascado con la pregunta anterior sin respuesta no bloquea la siguiente.
  assert.deepEqual(paraEnviar([u('1'), a('2'), u('perdida')], 'otra'), [u('1'), a('2'), u('otra')]);
});

test('una respuesta larga seguida de otra pregunta se envía sin bloquear la conversación', async () => {
  const llamadas = [];
  const fetch = async (url, init) => {
    llamadas.push(JSON.parse(init.body));
    return respuesta(200, { respuesta: 'ok' });
  };
  const historial = [{ rol: 'usuario', texto: 'a' }, { rol: 'asistente', texto: 'y'.repeat(5000) }];
  const r = await preguntar(API, paraEnviar(historial, '¿Y Premium?'), fetch);
  assert.equal(r.ok, true);
  assert.equal(llamadas[0].mensajes.length, 3);
});

test('la nota avisa de que las respuestas son de IA y remite al correo para cobros', () => {
  assert.equal(
    NOTA_ASISTENTE,
    'Respuestas generadas por IA; pueden contener errores. Para problemas de cobro escribe a support@coachlolia.com.',
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
    assert.match(html, /Respuestas generadas por IA; pueden contener errores\. Para problemas de cobro escribe a support@coachlolia.com\./, pagina);
    const panel = html.slice(html.indexOf('id="asistente-panel"'), html.indexOf('</dialog>', html.indexOf('id="asistente-panel"')));
    assert.ok(panel.length > 0, pagina);
    assert.ok(!/adsbygoogle|googlesyndication/.test(panel), pagina);
  }
});
