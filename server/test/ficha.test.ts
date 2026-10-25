import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { IdiomaIa, PaginaRunas, Rol } from '@coach/shared';
import { leerConfiguracion } from '../src/config';
import { abrirDb, type Db } from '../src/db';
import { danioDe, type Participacion } from '../src/extraer';
import type { ParticipanteRiot } from '../src/riot/riotApi';
import { crearServidor } from '../src/http';
import type { CrearMensajeIa } from '../src/coachIa/rutas';
import { IDIOMA_IA } from '../src/coachIa/prompts';
import { calcularDanio, fracciones, leerDanio } from '../src/ficha/danio';
import { datosDeDDragon, textoPlano, type CampeonLista, type DatosCampeonFicha, type FuenteDDragonFicha } from '../src/ficha/ddragon';
import { fraseProhibida, leerFicha, paramsFicha } from '../src/ficha/generar';
import { SISTEMA_FICHA } from '../src/ficha/prompts';

type Params = Parameters<CrearMensajeIa>[0];

const respuesta = (texto: string, stop_reason = 'end_turn') =>
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

const LISTA: CampeonLista[] = [
  { id: 'Ahri', nombre: 'Ahri', tags: ['Mage', 'Assassin'] },
  { id: 'Lux', nombre: 'Lux', tags: ['Mage', 'Support'] },
  { id: 'Syndra', nombre: 'Syndra', tags: ['Mage'] },
  { id: 'Orianna', nombre: 'Orianna', tags: ['Mage'] },
  { id: 'Zoe', nombre: 'Zoe', tags: ['Mage'] },
  { id: 'MonkeyKing', nombre: 'Wukong', tags: ['Fighter'] },
  { id: 'LeBlanc', nombre: 'LeBlanc', tags: ['Assassin', 'Mage'] },
];
const CAMPEONES = new Map(LISTA.map((c) => [c.id.toLowerCase(), c]));

const DATOS_AHRI: DatosCampeonFicha = {
  id: 'Ahri',
  nombre: 'Ahri',
  titulo: 'la zorra de nueve colas',
  tags: ['Mage', 'Assassin'],
  recurso: 'Maná',
  info: { ataque: 3, defensa: 4, magia: 8, dificultad: 5 },
  pasiva: { nombre: 'Robo de esencia', descripcion: 'Al asesinar, Ahri se cura.' },
  habilidades: [
    { tecla: 'Q', nombre: 'Orbe del engaño', descripcion: 'Lanza y recupera su orbe.' },
    { tecla: 'W', nombre: 'Fuego zorruno', descripcion: 'Tres fuegos.' },
    { tecla: 'E', nombre: 'Encanto', descripcion: 'Encanta al primer enemigo.' },
    { tecla: 'R', nombre: 'Impulso espiritual', descripcion: 'Tres desplazamientos.' },
  ],
  consejosAliado: ['Usa el encanto para empezar combos.'],
  consejosRival: ['Esquiva el encanto.'],
};

const SALIDA = {
  claves: ['Maga de ráfaga con mucha movilidad.', 'Su definitiva le da tres desplazamientos.', 'El encanto define sus combos.'],
  fortalezas: ['Mucha movilidad', 'Daño de ráfaga a distancia', 'Buena para rematar'],
  debilidades: ['Frágil si la atrapan', 'Depende de acertar el encanto', 'Sufre contra rivales de mucho alcance'],
  parecidos: ['lux', 'Syndra', 'Wukong', 'Orianna', 'Zoe', 'Ahri', 'LeBlanc'],
};

describe('desglose de daño', () => {
  const p = (extra: Partial<ParticipanteRiot>) => ({ participantId: 1, ...extra }) as ParticipanteRiot;

  it('lee el daño por tipo de Match-v5 solo si vienen las tres cifras', () => {
    expect(danioDe(p({ physicalDamageDealtToChampions: 20000.4, magicDamageDealtToChampions: 1000, trueDamageDealtToChampions: 500 }))).toEqual({
      danio: { fisico: 20000, magico: 1000, verdadero: 500 },
    });
    expect(danioDe(p({ physicalDamageDealtToChampions: 20000, magicDamageDealtToChampions: 1000 }))).toEqual({});
    expect(danioDe(p({ physicalDamageDealtToChampions: -1, magicDamageDealtToChampions: 1, trueDamageDealtToChampions: 1 }))).toEqual({});
  });

  it('las fracciones suman 1', () => {
    const f = fracciones(880, 90, 30)!;
    expect(f).toEqual({ fisico: 0.88, magico: 0.09, verdadero: 0.03 });
    expect(fracciones(0, 0, 0)).toBeNull();
  });

  const RUNAS: PaginaRunas = { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [] };
  const part = (id: string, campeon: string, parche: string, danio?: Participacion['danio']): Participacion => ({
    matchId: id,
    campeon,
    rol: 'MIDDLE' as Rol,
    modo: 'clasificatoria',
    victoria: true,
    parche,
    runas: RUNAS,
    hechizos: [4, 14],
    iniciales: [],
    compras: [],
    habilidades: [],
    ...(danio ? { danio } : {}),
  });

  it('con 30 partidas o más con el dato calcula el desglose medio; si no, no hay desglose', () => {
    const db = abrirDb(':memory:');
    for (let i = 0; i < 30; i++) db.guardarParticipaciones('EUW', [part(`A${i}`, 'Ahri', '15.21', { fisico: 100, magico: 800, verdadero: 100 })]);
    for (let i = 0; i < 29; i++) db.guardarParticipaciones('EUW', [part(`Z${i}`, 'Zed', '15.21', { fisico: 900, magico: 0, verdadero: 100 })]);
    // Partidas antiguas sin el dato: no cuentan.
    for (let i = 0; i < 50; i++) db.guardarParticipaciones('EUW', [part(`G${i}`, 'Garen', '15.21')]);
    expect(calcularDanio(db.sql, '15.21', '15.20')).toBe(1);
    expect(leerDanio(db.sql, 'AHRI')).toEqual({ fisico: 0.1, magico: 0.8, verdadero: 0.1 });
    expect(leerDanio(db.sql, 'Zed')).toBeNull();
    expect(leerDanio(db.sql, 'Garen')).toBeNull();
    // Con el parche anterior, Zed llega al mínimo.
    db.guardarParticipaciones('EUW', [part('Zold', 'Zed', '15.20', { fisico: 900, magico: 0, verdadero: 100 })]);
    expect(calcularDanio(db.sql, '15.21', '15.20')).toBe(2);
    expect(leerDanio(db.sql, 'Zed')).toEqual({ fisico: 0.9, magico: 0, verdadero: 0.1 });
    db.cerrar();
  });
});

describe('Data Dragon de la ficha', () => {
  it('quita las etiquetas de las descripciones', () => {
    expect(textoPlano('Inflige <magicDamage>daño mágico</magicDamage>.<br>Luego {{ e1 }} más.')).toBe('Inflige daño mágico. Luego ? más.');
  });

  it('convierte el JSON del campeón en lo que lee el modelo', () => {
    const d = datosDeDDragon({
      id: 'Ahri',
      name: 'Ahri',
      title: 'la zorra de nueve colas',
      tags: ['Mage'],
      partype: 'Maná',
      info: { attack: 3, defense: 4, magic: 8, difficulty: 5 },
      passive: { name: 'Robo de esencia', description: 'Se <b>cura</b>.' },
      spells: [{ name: 'Q', description: 'a' }, { name: 'W', description: 'b' }, { name: 'E', description: 'c' }, { name: 'R', description: 'd' }],
      allytips: ['uno'],
      enemytips: ['dos'],
    });
    expect(d?.pasiva.descripcion).toBe('Se cura.');
    expect(d?.habilidades.map((h) => h.tecla)).toEqual(['Q', 'W', 'E', 'R']);
    expect(d?.consejosRival).toEqual(['dos']);
  });
});

describe('validación de la salida del modelo', () => {
  it('normaliza los ids de los parecidos, quita los que no existen y el propio campeón', () => {
    const f = leerFicha(JSON.stringify(SALIDA), 'Ahri', 'es', CAMPEONES, '2026-10-25T00:00:00.000Z')!;
    // «Wukong» no es un id de Data Dragon (es «MonkeyKing»): fuera.
    expect(f.parecidos).toEqual(['Lux', 'Syndra', 'Orianna', 'Zoe', 'LeBlanc']);
    expect(f.claves).toHaveLength(3);
    expect(f).not.toHaveProperty('danio');
  });

  it('descarta las frases que dan órdenes en tiempo real y rechaza la ficha si se queda corta', () => {
    expect(fraseProhibida('Ve a top a gankear ahora mismo')).toBe(true);
    expect(fraseProhibida('Su encanto tiene poco enfriamiento')).toBe(false);
    const conOrden = { ...SALIDA, fortalezas: [...SALIDA.fortalezas, 'Invade la jungla rival al empezar'] };
    expect(leerFicha(JSON.stringify(conOrden), 'Ahri', 'es', CAMPEONES, 'x')?.fortalezas).toEqual(SALIDA.fortalezas);
    const corta = { ...SALIDA, fortalezas: ['Mucha movilidad', 'Gankea mucho'] };
    expect(leerFicha(JSON.stringify(corta), 'Ahri', 'es', CAMPEONES, 'x')).toBeNull();
    expect(leerFicha(JSON.stringify({ ...SALIDA, parecidos: ['Lux', 'Inventado', 'Otro'] }), 'Ahri', 'es', CAMPEONES, 'x')).toBeNull();
    expect(leerFicha('no es json', 'Ahri', 'es', CAMPEONES, 'x')).toBeNull();
  });

  it('pide JSON con esquema, el prompt de sistema en caché, la instrucción de idioma y la lista de ids válidos', () => {
    const p = paramsFicha('claude-sonnet-5-5', DATOS_AHRI, 'fr', CAMPEONES);
    expect(p.model).toBe('claude-sonnet-5-5');
    expect(p.output_config?.format?.type).toBe('json_schema');
    const system = p.system as { text: string; cache_control?: unknown }[];
    expect(system[0]).toMatchObject({ text: SISTEMA_FICHA, cache_control: { type: 'ephemeral' } });
    expect(system[1]!.text).toBe(IDIOMA_IA.fr);
    const mensaje = (p.messages[0]!.content as string);
    expect(mensaje).toContain('MonkeyKing: Fighter');
    expect(mensaje).toContain('E — Encanto');
    expect(mensaje).not.toMatch(/Valid champion ids[^\n]*\bAhri:/);
    expect(SISTEMA_FICHA).toMatch(/Never dictate precise real-time actions/);
    expect(SISTEMA_FICHA).toMatch(/hidden information/);
  });
});

describe('GET /ficha/:campeon', () => {
  let db: Db;
  let app: FastifyInstance;
  let reloj: number;
  let version: string;
  let crear: ReturnType<typeof vi.fn<CrearMensajeIa>>;
  const detalle = vi.fn(async (_v: string, id: string, _i: IdiomaIa) => (id === 'Ahri' ? DATOS_AHRI : { ...DATOS_AHRI, id, nombre: id }));
  const fuente: FuenteDDragonFicha = {
    version: async () => version,
    campeones: async () => CAMPEONES,
    detalle,
  };

  function montar(extra: { maxDia?: number; ipDia?: number; sinIa?: boolean } = {}) {
    app = crearServidor(db, {
      ficha: extra.sinIa ? null : { crear, modelo: 'claude-sonnet-5-5', fuente, ahora: () => reloj, maxDia: extra.maxDia, ipDia: extra.ipDia },
    });
  }

  beforeEach(() => {
    db = abrirDb(':memory:');
    reloj = Date.parse('2026-10-25T12:00:00Z');
    version = '15.21.1';
    crear = vi.fn<CrearMensajeIa>(async () => respuesta(JSON.stringify(SALIDA)));
    detalle.mockClear();
    montar();
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  const pedir = (url: string) => app.inject({ method: 'GET', url });

  it('503 sin ANTHROPIC_API_KEY', async () => {
    await app.close();
    montar({ sinIa: true });
    const r = await pedir('/ficha/Ahri?idioma=es');
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: 'ia_no_configurada' });
  });

  it('400 con un idioma o un campeón no válidos y 404 con un campeón que Data Dragon no conoce', async () => {
    expect((await pedir('/ficha/Ahri?idioma=it')).statusCode).toBe(400);
    expect((await pedir('/ficha/Ah%20ri?idioma=es')).statusCode).toBe(400);
    expect((await pedir('/ficha/Inventado?idioma=es')).statusCode).toBe(404);
    expect(crear).not.toHaveBeenCalled();
  });

  it('genera la ficha una vez por campeón, idioma y versión de Data Dragon, y la guarda', async () => {
    const r = await pedir('/ficha/ahri?idioma=es');
    expect(r.statusCode).toBe(200);
    const f = r.json();
    expect(f).toMatchObject({ campeon: 'Ahri', idioma: 'es', parecidos: ['Lux', 'Syndra', 'Orianna', 'Zoe', 'LeBlanc'], generadoEn: '2026-10-25T12:00:00.000Z' });
    expect(f.danio).toBeUndefined();
    expect(detalle).toHaveBeenCalledWith('15.21.1', 'Ahri', 'es');
    // Otra vez (y aunque se reinicie el servidor): de la base, sin llamar al modelo.
    await app.close();
    montar();
    expect((await pedir('/ficha/Ahri?idioma=es')).json()).toEqual(f);
    expect(crear).toHaveBeenCalledTimes(1);
    // Otro idioma: otra ficha.
    expect((await pedir('/ficha/Ahri?idioma=de')).statusCode).toBe(200);
    expect(crear).toHaveBeenCalledTimes(2);
    expect((crear.mock.calls[1]![0] as Params).system).toEqual(expect.arrayContaining([expect.objectContaining({ text: IDIOMA_IA.de })]));
    // Nuevo parche: se regenera y la vieja se borra.
    version = '15.22.1';
    expect((await pedir('/ficha/Ahri?idioma=es')).statusCode).toBe(200);
    expect(crear).toHaveBeenCalledTimes(3);
    const filas = db.sql.prepare("SELECT version FROM fichas_campeon WHERE campeon = 'ahri' AND idioma = 'es'").all();
    expect(filas).toEqual([{ version: '15.22.1' }]);
  });

  it('dos peticiones a la vez generan una sola ficha', async () => {
    const [a, b] = await Promise.all([pedir('/ficha/Ahri?idioma=es'), pedir('/ficha/Ahri?idioma=es')]);
    expect(a.statusCode).toBe(200);
    expect(b.json()).toEqual(a.json());
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('añade el desglose de daño cuando existe', async () => {
    db.sql.exec("INSERT INTO danio_campeon VALUES ('ahri', '15.21', 120, 0.05, 0.9, 0.05)");
    const f = (await pedir('/ficha/Ahri?idioma=es')).json();
    expect(f.danio).toEqual({ fisico: 0.05, magico: 0.9, verdadero: 0.05 });
  });

  it('respeta el tope global diario (las fichas ya guardadas se siguen sirviendo) y el de cada IP', async () => {
    await app.close();
    montar({ maxDia: 1 });
    expect((await pedir('/ficha/Ahri?idioma=es')).statusCode).toBe(200);
    const r = await pedir('/ficha/Lux?idioma=es');
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'limite_global' });
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    expect((await pedir('/ficha/Ahri?idioma=es')).statusCode).toBe(200);
    // Al día siguiente vuelve a haber cupo.
    reloj += 86_400_000;
    expect((await pedir('/ficha/Lux?idioma=es')).statusCode).toBe(200);

    await app.close();
    montar({ ipDia: 1 });
    expect((await pedir('/ficha/Zoe?idioma=es')).statusCode).toBe(200);
    expect((await pedir('/ficha/Syndra?idioma=es')).json()).toEqual({ error: 'limite_diario' });
  });

  it('502 si el modelo la rechaza o devuelve algo no válido (y no se guarda)', async () => {
    crear.mockResolvedValueOnce(respuesta('', 'refusal'));
    expect((await pedir('/ficha/Ahri?idioma=es')).statusCode).toBe(502);
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({ ...SALIDA, claves: [] })));
    expect((await pedir('/ficha/Ahri?idioma=es')).statusCode).toBe(502);
    crear.mockRejectedValueOnce(new Error('caída'));
    expect((await pedir('/ficha/Ahri?idioma=es')).statusCode).toBe(502);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM fichas_campeon').get()).toEqual({ n: 0 });
  });
});

describe('configuración de la ficha', () => {
  it('sin clave de Anthropic no hay ficha; con ella, el modelo del análisis y 400 al día por defecto', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'x' }).ficha).toBeNull();
    expect(leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k' }).ficha).toEqual({ modelo: 'claude-sonnet-5-5', maxDia: 400, ipDia: 30 });
    expect(
      leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k', FICHA_MODELO: 'claude-haiku-5-5', FICHA_MAX_DIA: '50' }).ficha,
    ).toMatchObject({ modelo: 'claude-haiku-5-5', maxDia: 50 });
  });
});
