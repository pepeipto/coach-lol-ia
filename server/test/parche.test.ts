import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  normalizarNotasParche,
  parcheDDragonDe,
  parcheJuegoDeDDragon,
  RUTAS_PARCHE,
  URL_VERSIONES,
  urlNotasParche,
  type IdiomaIa,
} from '@coach/shared';
import { leerConfiguracion } from '../src/config';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import type { CrearMensajeIa } from '../src/coachIa/rutas';
import { IDIOMA_IA } from '../src/coachIa/prompts';
import { ejecutarCiclo } from '../src/programacion';
import { copiaDeLaFuente, leerResumen, paramsParche, secuenciasFuente } from '../src/parche/generar';
import { decodificarEntidades, extraerNotas, textoDeHtml, USER_AGENT_NOTAS, type ListasDDragon, type NotasExtraidas } from '../src/parche/notas';
import { SISTEMA_PARCHE } from '../src/parche/prompts';
import { consumirTopeParche, crearServicioParche } from '../src/parche/rutas';
import type { RiotApi } from '../src/riot/riotApi';

type Params = Parameters<CrearMensajeIa>[0];

const respuestaIa = (texto: string, stop_reason = 'end_turn') =>
  ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text: texto, citations: null }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  }) as unknown as Awaited<ReturnType<CrearMensajeIa>>;

const LISTAS: ListasDDragon = {
  campeones: [
    { id: 'Azir', nombre: 'Azir' },
    { id: 'LeeSin', nombre: 'Lee Sin' },
    { id: 'MonkeyKing', nombre: 'Wukong' },
    { id: 'Nunu', nombre: 'Nunu & Willump' },
  ],
  objetos: [
    { id: 6621, nombre: 'Dawncore' },
    { id: 326621, nombre: 'Dawncore' },
    { id: 3008, nombre: 'Gluttonous Greaves' },
  ],
};

const img = (tipo: string, id: string) => `<p><a class="reference-link" href="#"><img src="https://am-a.akamaihd.net/image?f=https://ddragon.leagueoflegends.com/cdn/16.20.1/img/${tipo}/${id}.png"></a></p>`;
const bloque = (nombre: string, contexto: string, cambios: string) =>
  `<h3 class="change-title" id="patch-x"><a href="#">${nombre}</a></h3><blockquote class="blockquote context"><p>${contexto}</p></blockquote><hr class="divider"><h4 class="change-detail-title">Base Stats</h4><ul><li><strong>Stat</strong>: ${cambios}</li></ul>`;

/** Página de prueba con la estructura de las notas de Riot (textos inventados para la prueba). */
function pagina(o: { titulo?: string; campeones?: string; objetos?: string } = {}): string {
  const campeones =
    o.campeones ??
    [
      img('champion', 'Azir'),
      bloque('Azir', 'The emperor gets a little more mana so lanes feel better.', '40 &rArr; <strong>50</strong>'),
      img('champion', 'LeeSin'),
      bloque('Lee Sin', 'The blind monk is a bit too strong &amp; popular right now.', '7s ⇒ <strong>8s</strong>'),
      img('champion', 'MonkeyKing'),
      bloque('Wukong', 'Small fix for the monkey.', 'bug fixed'),
      img('champion', 'Nunu'),
      bloque('Nunu &amp; Willump', 'Snowball adjustments.', '10 ⇒ 12'),
      img('champion', 'Nadie'),
      bloque('Campeón Desconocido', 'Nobody knows.', '1 ⇒ 2'),
    ].join('');
  const objetos =
    o.objetos ??
    [
      img('item', '6621'),
      bloque('Dawncore', 'More ability power for enchanters.', '10 ⇒ 15'),
      bloque('Gluttonous Greaves', 'Costs a bit more.', '1000g ⇒ 1100g'),
    ].join('');
  return `<html><head><title data-next-head="">${o.titulo ?? 'League of Legends Patch 26.20 Notes'}</title></head><body>
<h2 id="patch-patch-highlights">Patch Highlights</h2><p>Highlights</p>
<header class="header-primary"><h2 id="patch-champions">Champions</h2></header>${campeones}
<header class="header-primary"><h2 id="patch-items">Items</h2></header>${objetos}
<header class="header-primary"><h2 id="patch-arena">Arena</h2></header>${bloque('Augment', 'Arena only.', '1 ⇒ 2')}
</body></html>`;
}

const URL_EN = urlNotasParche('26.20', 'en');

function extraidasPrueba(): NotasExtraidas {
  return extraerNotas(pagina(), '26.20', URL_EN, LISTAS)!;
}

const SALIDA = {
  general: 'Parche de ajustes pequeños para varios campeones y dos objetos.',
  campeones: [
    { campeon: 'azir', tipo: 'mejora', resumen: 'Gana más maná por nivel para usar sus habilidades en línea.' },
    { campeon: 'LeeSin', tipo: 'empeora', resumen: 'Su protección tarda un poco más en recargarse.' },
    { campeon: 'MonkeyKing', tipo: 'ajuste', resumen: 'Corrección de un error.' },
    { campeon: 'Nunu', tipo: 'ajuste', resumen: 'Ajustes en su bola de nieve.' },
    { campeon: 'Teemo', tipo: 'mejora', resumen: 'No está en las notas.' },
  ],
  objetos: [
    { objeto: 'dawncore', tipo: 'mejora', resumen: 'Da más poder de habilidad.' },
    { objeto: 'Gluttonous Greaves', tipo: 'empeora', resumen: 'Cuesta 100 de oro más.' },
    { objeto: 'Infinity Edge', tipo: 'mejora', resumen: 'Inventado.' },
  ],
};

describe('contrato del parche', () => {
  it('convierte entre el parche de Data Dragon y el del juego', () => {
    expect(parcheJuegoDeDDragon('16.21')).toBe('26.21');
    expect(parcheJuegoDeDDragon('15.4')).toBe('25.4');
    expect(parcheJuegoDeDDragon('14.23')).toBeNull();
    expect(parcheJuegoDeDDragon('actual')).toBeNull();
    expect(parcheDDragonDe('26.21')).toBe('16.21');
    expect(parcheDDragonDe('16.21')).toBe('16.21');
    expect(parcheDDragonDe('3.1')).toBeNull();
  });

  it('enlaza a las notas oficiales en el idioma de la app', () => {
    expect(urlNotasParche('26.21', 'es')).toBe('https://www.leagueoflegends.com/es-es/news/game-updates/league-of-legends-patch-26-21-notes/');
    expect(urlNotasParche('26.21', 'pt-BR')).toContain('/pt-br/');
    expect(urlNotasParche('26.21', 'en')).toContain('/en-us/');
    expect(RUTAS_PARCHE.notas('actual', 'de')).toBe('/parche/actual?idioma=de');
  });

  it('normaliza: descarta entradas mal formadas y repetidas', () => {
    const n = normalizarNotasParche({
      parche: '16.20',
      parcheJuego: '26.20',
      idioma: 'es',
      url: urlNotasParche('26.20', 'es'),
      generadoEn: '2026-10-25T00:00:00.000Z',
      campeones: [
        { campeon: 'Azir', tipo: 'mejora', resumen: 'Más maná.' },
        { campeon: 'azir', tipo: 'mejora', resumen: 'Repetido.' },
        { campeon: 'Lee Sin', tipo: 'mejora', resumen: 'Id con espacio.' },
        { campeon: 'Ahri', tipo: 'genial', resumen: 'Tipo raro.' },
        { campeon: 'Zed', tipo: 'ajuste', resumen: 'x'.repeat(500) },
      ],
      objetos: [{ objeto: 'Dawncore', id: 6621, tipo: 'mejora', resumen: 'Más poder.' }, { objeto: '', tipo: 'mejora', resumen: 'x' }],
    })!;
    expect(n.campeones.map((c) => c.campeon)).toEqual(['Azir']);
    expect(n.objetos).toEqual([{ objeto: 'Dawncore', id: 6621, tipo: 'mejora', resumen: 'Más poder.' }]);
    expect(normalizarNotasParche({ ...n, url: 'https://example.com' })).toBeNull();
    expect(normalizarNotasParche({ ...n, parcheJuego: '26.21' })).toBeNull();
  });
});

describe('lectura de las notas', () => {
  it('decodifica entidades y pasa el HTML a líneas', () => {
    expect(decodificarEntidades('a &amp; b &rsquo; &#8658; &#x21D2; &nbsp;')).toBe("a & b ’ ⇒ ⇒  ");
    expect(textoDeHtml('<p>Hola</p><h4>Q - Bola</h4><ul><li><strong>Daño</strong>: 1 ⇒ 2</li></ul>')).toBe('Hola\n## Q - Bola\n- Daño: 1 ⇒ 2');
  });

  it('lee los campeones y objetos de sus apartados, con sus ids de Data Dragon', () => {
    const n = extraidasPrueba();
    expect(n.parcheJuego).toBe('26.20');
    expect(n.url).toBe(URL_EN);
    // «Campeón Desconocido» no está en Data Dragon: se descarta, no se inventa.
    expect(n.campeones.map((c) => c.id)).toEqual(['Azir', 'LeeSin', 'MonkeyKing', 'Nunu']);
    expect(n.campeones[1].nombre).toBe('Lee Sin');
    expect(n.campeones[1].texto).toBe('The blind monk is a bit too strong & popular right now.\n## Base Stats\n- Stat: 7s ⇒ 8s');
    // Gana el id de la Grieta (6621), no la copia de Arena (326621); sin imagen, por el nombre.
    expect(n.objetos).toEqual([
      { nombre: 'Dawncore', id: 6621, texto: expect.stringContaining('More ability power') },
      { nombre: 'Gluttonous Greaves', id: 3008, texto: expect.stringContaining('1000g ⇒ 1100g') },
    ]);
    // El apartado de Arena no se lee.
    expect(JSON.stringify(n)).not.toContain('Augment');
  });

  it('reconoce por la imagen de Data Dragon un campeón cuyo nombre no coincide', () => {
    const n = extraerNotas(pagina({ campeones: img('champion', 'MonkeyKing') + bloque('The Monkey King', 'x', '1 ⇒ 2') }), '26.20', URL_EN, LISTAS)!;
    expect(n.campeones.map((c) => c.id)).toEqual(['MonkeyKing']);
  });

  it('no lee una página de otro parche o sin el formato esperado', () => {
    expect(extraerNotas(pagina({ titulo: 'League of Legends Patch 26.19 Notes' }), '26.20', URL_EN, LISTAS)).toBeNull();
    expect(extraerNotas('<html><title>League of Legends Patch 26.20 Notes</title><body><p>Nada</p></body></html>', '26.20', URL_EN, LISTAS)).toBeNull();
    // Hay apartado de campeones, pero ninguno se reconoce: el formato cambió.
    expect(extraerNotas(pagina({ campeones: bloque('Raro', 'x', '1 ⇒ 2') }), '26.20', URL_EN, LISTAS)).toBeNull();
  });
});

describe('resumen con IA', () => {
  const extraidas = extraidasPrueba();

  it('solo acepta campeones y objetos de las notas, con su id', () => {
    const n = leerResumen(JSON.stringify(SALIDA), extraidas, '16.20', 'es', '2026-10-25T00:00:00.000Z')!;
    expect(n.parcheJuego).toBe('26.20');
    expect(n.url).toBe(urlNotasParche('26.20', 'es'));
    expect(n.general).toBe(SALIDA.general);
    expect(n.campeones.map((c) => [c.campeon, c.tipo])).toEqual([
      ['Azir', 'mejora'],
      ['LeeSin', 'empeora'],
      ['MonkeyKing', 'ajuste'],
      ['Nunu', 'ajuste'],
    ]);
    expect(n.objetos).toEqual([
      { objeto: 'Dawncore', id: 6621, tipo: 'mejora', resumen: 'Da más poder de habilidad.' },
      { objeto: 'Gluttonous Greaves', id: 3008, tipo: 'empeora', resumen: 'Cuesta 100 de oro más.' },
    ]);
  });

  it('descarta frases copiadas de las notas, prohibidas o con un tipo raro', () => {
    const fuente = secuenciasFuente(extraidas);
    expect(copiaDeLaFuente('The blind monk is a bit too strong & popular right now.', fuente)).toBe(true);
    expect(copiaDeLaFuente('Lee Sin pierde algo de fuerza.', fuente)).toBe(false);
    const salida = {
      ...SALIDA,
      campeones: [
        { campeon: 'LeeSin', tipo: 'empeora', resumen: 'The blind monk is a bit too strong & popular right now.' },
        { campeon: 'Azir', tipo: 'mejora', resumen: 'Ve a gankear ahora con él.' },
        { campeon: 'MonkeyKing', tipo: 'genial', resumen: 'Bien.' },
        { campeon: 'Nunu', tipo: 'ajuste', resumen: 'Ajustes en su bola de nieve.' },
      ],
    };
    // Queda 1 de 4: menos de la mitad, el resumen no sirve.
    expect(leerResumen(JSON.stringify(salida), extraidas, '16.20', 'es', 'x')).toBeNull();
    expect(leerResumen('no es json', extraidas, '16.20', 'es', 'x')).toBeNull();
  });

  it('pide salida estructurada con el prompt fijo en caché y el idioma detrás', () => {
    const p = paramsParche('claude-sonnet-5-5', extraidas, 'fr');
    expect(p.model).toBe('claude-sonnet-5-5');
    expect(p.output_config?.format?.type).toBe('json_schema');
    expect(p.system).toEqual([
      { type: 'text', text: SISTEMA_PARCHE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: IDIOMA_IA.fr },
    ]);
    const mensaje = p.messages[0].content as string;
    expect(mensaje).toContain('champion id: LeeSin (Lee Sin)');
    expect(mensaje).toContain('item name: Dawncore');
    expect(p.fallbacks).toBe('default');
    expect(paramsParche('claude-haiku-5-5', extraidas, 'es').fallbacks).toBeUndefined();
  });
});

const CAMPEON_JSON = { data: Object.fromEntries(LISTAS.campeones.map((c) => [c.id, { id: c.id, name: c.nombre }])) };
const ITEM_JSON = { data: Object.fromEntries(LISTAS.objetos.map((o) => [String(o.id), { name: o.nombre }])) };

function crearFetch(o: { notas?: number | string } = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    if (url === URL_VERSIONES) return new Response(JSON.stringify(['16.20.1', '16.19.1']), { status: 200 });
    if (url.includes('/en_US/champion.json')) return new Response(JSON.stringify(CAMPEON_JSON), { status: 200 });
    if (url.includes('/en_US/item.json')) return new Response(JSON.stringify(ITEM_JSON), { status: 200 });
    if (url === URL_EN) {
      if (typeof o.notas === 'number') return new Response('no', { status: o.notas });
      return new Response(o.notas ?? pagina(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, llamadas, deNotas: () => llamadas.filter((l) => l.url === URL_EN) };
}

describe('servicio y ruta /parche', () => {
  let db: Db;
  let app: FastifyInstance | null = null;
  beforeEach(() => {
    db = abrirDb(':memory:');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(async () => {
    await app?.close();
    app = null;
    db.cerrar();
    vi.restoreAllMocks();
  });

  const crearIa = () => vi.fn<CrearMensajeIa>(async () => respuestaIa(JSON.stringify(SALIDA)));

  it('el ciclo descarga las notas una vez y escribe el resumen en los 5 idiomas', async () => {
    const red = crearFetch();
    const crear = crearIa();
    const servicio = crearServicioParche(db, { crear, modelo: 'claude-sonnet-5-5' }, { fetch: red.f });
    await servicio.actualizar('16.20.1');
    expect(red.deNotas()).toHaveLength(1);
    expect((red.deNotas()[0].init?.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT_NOTAS);
    expect(crear).toHaveBeenCalledTimes(5);
    const idiomas = crear.mock.calls.map(([p]) => ((p as Params).system as { text: string }[])[1].text);
    expect(idiomas).toEqual(Object.values(IDIOMA_IA));
    // El siguiente ciclo no vuelve a descargar ni a generar.
    await servicio.actualizar('16.20.1');
    expect(red.deNotas()).toHaveLength(1);
    expect(crear).toHaveBeenCalledTimes(5);

    app = crearServidor(db, { parche: servicio });
    const r = await app.inject({ method: 'GET', url: RUTAS_PARCHE.notas('actual', 'es') });
    expect(r.statusCode).toBe(200);
    const n = normalizarNotasParche(r.json())!;
    expect(n.parche).toBe('16.20');
    expect(n.campeones).toHaveLength(4);
    // Por número de parche del juego o de Data Dragon, lo mismo.
    expect((await app.inject({ method: 'GET', url: '/parche/26.20?idioma=de' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/parche/16.20?idioma=fr' })).statusCode).toBe(200);
    expect(crear).toHaveBeenCalledTimes(5);
  });

  it('notas aún no publicadas o ilegibles: no se inventa nada y se reintenta en el siguiente ciclo', async () => {
    for (const notas of [404, 403, '<html><title>League of Legends Patch 26.20 Notes</title><p>otra cosa</p></html>']) {
      const red = crearFetch({ notas });
      const crear = crearIa();
      const servicio = crearServicioParche(db, { crear, modelo: 'm' }, { fetch: red.f });
      await servicio.actualizar('16.20.1');
      await servicio.actualizar('16.20.1');
      expect(red.deNotas()).toHaveLength(2);
      expect(crear).not.toHaveBeenCalled();
      expect(await servicio.notas('actual', 'es')).toEqual({ estado: 'sin_notas' });
    }
  });

  it('503 sin clave de IA, 404 sin notas, 400 con argumentos raros', async () => {
    const sinIa = crearServicioParche(db, null, { fetch: crearFetch().f });
    await sinIa.actualizar('16.20.1');
    app = crearServidor(db, { parche: sinIa });
    expect((await app.inject({ method: 'GET', url: '/parche/actual?idioma=es' })).json()).toEqual({ error: 'ia_no_configurada' });
    await app.close();

    app = crearServidor(db); // sin servicio: se crea uno sin IA
    expect((await app.inject({ method: 'GET', url: '/parche/actual?idioma=es' })).statusCode).toBe(503);
    await app.close();

    const servicio = crearServicioParche(db, { crear: crearIa(), modelo: 'm' }, { fetch: crearFetch().f });
    app = crearServidor(db, { parche: servicio });
    expect((await app.inject({ method: 'GET', url: '/parche/16.19?idioma=es' })).json()).toEqual({ error: 'sin_notas' });
    expect((await app.inject({ method: 'GET', url: '/parche/actual?idioma=xx' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/parche/..%2Fadmin?idioma=es' })).statusCode).toBe(400);
  });

  it('genera en el momento el idioma que falte, una sola vez aunque lo pidan a la vez, y respeta el tope diario', async () => {
    const red = crearFetch();
    const sinIa = crearServicioParche(db, null, { fetch: red.f });
    await sinIa.actualizar('16.20.1'); // solo lee las notas

    let soltar: () => void = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    const crear = vi.fn<CrearMensajeIa>(async () => {
      await espera;
      return respuestaIa(JSON.stringify(SALIDA));
    });
    const servicio = crearServicioParche(db, { crear, modelo: 'm', maxDia: 2 }, { fetch: red.f });
    app = crearServidor(db, { parche: servicio });
    const a = app.inject({ method: 'GET', url: '/parche/actual?idioma=es' });
    const b = app.inject({ method: 'GET', url: '/parche/actual?idioma=es' });
    await new Promise((r) => setTimeout(r, 10));
    soltar();
    expect((await a).statusCode).toBe(200);
    expect((await b).statusCode).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);

    expect((await app.inject({ method: 'GET', url: '/parche/actual?idioma=en' })).statusCode).toBe(200);
    const r = await app.inject({ method: 'GET', url: '/parche/actual?idioma=de' });
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'limite_global' });
  });

  it('502 si la IA devuelve algo que no pasa la validación (y no se guarda)', async () => {
    const red = crearFetch();
    const crear = vi.fn<CrearMensajeIa>(async () => respuestaIa('{"general":"x","campeones":[],"objetos":[]}'));
    const servicio = crearServicioParche(db, { crear, modelo: 'm' }, { fetch: red.f });
    await servicio.actualizar('16.20.1');
    app = crearServidor(db, { parche: servicio });
    const r = await app.inject({ method: 'GET', url: '/parche/actual?idioma=es' });
    expect(r.statusCode).toBe(502);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM notas_parche').get()).toEqual({ n: 0 });
  });

  it('el tope diario cuenta por día', () => {
    const dia = Date.UTC(2026, 9, 25, 12);
    expect(consumirTopeParche(db, dia, 1)).toBe(true);
    expect(consumirTopeParche(db, dia, 1)).toBe(false);
    expect(consumirTopeParche(db, dia + 86_400_000, 1)).toBe(true);
  });

  it('la configuración lee el modelo y el tope (y no hay nada sin clave)', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'x' }).parche).toBeNull();
    expect(leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k' }).parche).toEqual({ modelo: 'claude-sonnet-5-5', maxDia: 10 });
    expect(leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k', PARCHE_MODELO: 'claude-haiku-5-5', PARCHE_MAX_DIA: '7' }).parche).toEqual({
      modelo: 'claude-haiku-5-5',
      maxDia: 7,
    });
  });

  it('el ciclo llama al servicio con la versión de Data Dragon y sigue si falla', async () => {
    const api = {
      ligaApex: async () => [],
      entradasLiga: async () => [],
      idsPartidas: async () => [],
      partida: async () => null,
      lineaTiempo: async () => null,
    } as unknown as RiotApi;
    const actualizar = vi.fn(async () => {
      throw new Error('caída');
    });
    const borrar = vi.spyOn(db, 'borrarParchesAntiguos');
    await ejecutarCiclo({ api, db, fetch: crearFetch().f, regiones: [], rotativos: null, parche: { actualizar } });
    expect(actualizar).toHaveBeenCalledWith('16.20.1');
    expect(borrar).toHaveBeenCalled();
  });
});

// Para que TypeScript compruebe el tipo de los idiomas usados arriba.
const _idiomas: IdiomaIa[] = ['es', 'en', 'pt-BR', 'fr', 'de'];
void _idiomas;
