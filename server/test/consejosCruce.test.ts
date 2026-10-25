import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { IdiomaIa } from '@coach/shared';
import { leerConfiguracion } from '../src/config';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import type { CrearMensajeIa } from '../src/coachIa/rutas';
import { IDIOMA_IA } from '../src/coachIa/prompts';
import type { CampeonLista, DatosCampeonFicha, FuenteDDragonFicha } from '../src/ficha/ddragon';
import { asegurarTablaEnfrentamientos } from '../src/enfrentamientos';
import { consejoProhibido, leerConsejosCruce, paramsConsejosCruce } from '../src/consejosCruce/generar';
import { mensajeConsejosCruce, SISTEMA_CONSEJOS_CRUCE, valoracionCruce } from '../src/consejosCruce/prompts';

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
  { id: 'Darius', nombre: 'Darius', tags: ['Fighter'] },
  { id: 'Teemo', nombre: 'Teemo', tags: ['Marksman'] },
  { id: 'Garen', nombre: 'Garen', tags: ['Fighter'] },
];
const CAMPEONES = new Map(LISTA.map((c) => [c.id.toLowerCase(), c]));

const datos = (id: string, e: string): DatosCampeonFicha => ({
  id,
  nombre: id,
  titulo: 'título',
  tags: ['Fighter'],
  recurso: 'Maná',
  info: { ataque: 8, defensa: 5, magia: 1, dificultad: 2 },
  pasiva: { nombre: `Pasiva de ${id}`, descripcion: 'Algo pasivo.' },
  habilidades: [
    { tecla: 'Q', nombre: `Q de ${id}`, descripcion: 'a' },
    { tecla: 'W', nombre: `W de ${id}`, descripcion: 'b' },
    { tecla: 'E', nombre: e, descripcion: 'c' },
    { tecla: 'R', nombre: `R de ${id}`, descripcion: 'd' },
  ],
  consejosAliado: [`Juega bien con ${id}.`],
  consejosRival: [`Cuidado con ${id}.`],
});
const DARIUS = datos('Darius', 'Aprehender');
const TEEMO = datos('Teemo', 'Disparo venenoso');

const SALIDA = {
  consejos: [
    'Su ceguera anula tus golpes básicos: intercambia cuando la haya usado.',
    'A nivel 2 tu E te permite atraparlo si se acerca a la oleada.',
    'Su ventana de poder llega con las setas a nivel 6.',
  ],
  combos: ['E → AA → W → Q', 'Q → R'],
};

describe('validación de los consejos del cruce', () => {
  it('descarta órdenes en tiempo real, enlaces y cualquier cifra de rendimiento', () => {
    expect(consejoProhibido('Ve a top a gankear ahora mismo')).toBe(true);
    expect(consejoProhibido('Este cruce tiene un 54% de victorias')).toBe(true);
    expect(consejoProhibido('Your win rate here is high')).toBe(true);
    expect(consejoProhibido('Sa taux de victoire est faible')).toBe(true);
    expect(consejoProhibido('Mira www.ejemplo.com')).toBe(true);
    expect(consejoProhibido('Cuidado con su E a nivel 2')).toBe(false);
    expect(consejoProhibido('Su ventana de poder es el nivel 6')).toBe(false);
  });

  it('lee la salida, quita los consejos prohibidos y los combos sin habilidades; null si se queda corta', () => {
    const conMalos = {
      consejos: [...SALIDA.consejos, 'Ganas el 60% de las veces'],
      combos: ['E → AA → W → Q', 'Pégale fuerte', 'Q → R', 'W → Q'],
    };
    const c = leerConsejosCruce(JSON.stringify(conMalos), 'Darius', 'Teemo', 'TOP', 'es', 'x')!;
    expect(c.consejos).toEqual(SALIDA.consejos);
    expect(c.combos).toEqual(['E → AA → W → Q', 'Q → R']);
    expect(leerConsejosCruce(JSON.stringify({ consejos: SALIDA.consejos.slice(0, 2), combos: [] }), 'Darius', 'Teemo', 'TOP', 'es', 'x')).toBeNull();
    const sinCombos = leerConsejosCruce(JSON.stringify({ consejos: SALIDA.consejos, combos: [] }), 'Darius', 'Teemo', 'TOP', 'es', 'x')!;
    expect(sinCombos).not.toHaveProperty('combos');
    expect(leerConsejosCruce('no es json', 'Darius', 'Teemo', 'TOP', 'es', 'x')).toBeNull();
  });

  it('el prompt lleva los dos kits y, de las cifras, solo una valoración en palabras (ningún %)', () => {
    const m = mensajeConsejosCruce(DARIUS, TEEMO, 'TOP', { partidas: 300, tasaVictoria: 0.44, tasaFaseLineas: 0.55 });
    expect(m).toContain("Player's champion: Darius");
    expect(m).toContain('Enemy laner: Teemo');
    expect(m).toContain('E — Disparo venenoso');
    expect(m).toContain('hard for the player; the player usually wins the laning phase');
    expect(m).not.toMatch(/\d+(\.\d+)?%|0\.44|44/);
    expect(mensajeConsejosCruce(DARIUS, TEEMO, 'TOP', null)).toContain('No aggregated data');
    expect(valoracionCruce({ partidas: 50, tasaVictoria: 0.5 })).toBe('roughly even');
    expect(SISTEMA_CONSEJOS_CRUCE).toMatch(/Never dictate precise real-time actions/);
    expect(SISTEMA_CONSEJOS_CRUCE).toMatch(/hidden information/);
    expect(SISTEMA_CONSEJOS_CRUCE).toMatch(/Never write win rates, percentages/);
  });

  it('pide JSON con esquema, el prompt de sistema en caché y la instrucción de idioma', () => {
    const p = paramsConsejosCruce('claude-sonnet-5-5', DARIUS, TEEMO, 'TOP', 'pt-BR', null);
    expect(p.model).toBe('claude-sonnet-5-5');
    expect(p.output_config?.format?.type).toBe('json_schema');
    const system = p.system as { text: string; cache_control?: unknown }[];
    expect(system[0]).toMatchObject({ text: SISTEMA_CONSEJOS_CRUCE, cache_control: { type: 'ephemeral' } });
    expect(system[1]!.text).toBe(IDIOMA_IA['pt-BR']);
    expect(p.fallbacks).toBe('default');
  });
});

describe('GET /enfrentamiento-consejos/:campeon/:rival/:rol', () => {
  let db: Db;
  let app: FastifyInstance;
  let reloj: number;
  let version: string;
  let crear: ReturnType<typeof vi.fn<CrearMensajeIa>>;
  const detalle = vi.fn(async (_v: string, id: string, _i: IdiomaIa) => (id === 'Darius' ? DARIUS : id === 'Teemo' ? TEEMO : datos(id, 'E')));
  const fuente: FuenteDDragonFicha = { version: async () => version, campeones: async () => CAMPEONES, detalle };

  function montar(extra: { maxDia?: number; ipDia?: number; sinIa?: boolean } = {}) {
    app = crearServidor(db, {
      consejosCruce: extra.sinIa ? null : { crear, modelo: 'claude-sonnet-5-5', fuente, ahora: () => reloj, maxDia: extra.maxDia, ipDia: extra.ipDia },
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
    const r = await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es');
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: 'ia_no_configurada' });
  });

  it('400 con idioma, rol o campeones no válidos (o el mismo campeón) y 404 si Data Dragon no los conoce', async () => {
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=it')).statusCode).toBe(400);
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/MID?idioma=es')).statusCode).toBe(400);
    expect((await pedir('/enfrentamiento-consejos/Dar%20ius/Teemo/TOP?idioma=es')).statusCode).toBe(400);
    expect((await pedir('/enfrentamiento-consejos/Darius/darius/TOP?idioma=es')).statusCode).toBe(400);
    expect((await pedir('/enfrentamiento-consejos/Darius/Inventado/TOP?idioma=es')).statusCode).toBe(404);
    expect(crear).not.toHaveBeenCalled();
  });

  it('genera una vez por campeón, rival, rol, idioma y versión de Data Dragon, y lo guarda', async () => {
    const r = await pedir('/enfrentamiento-consejos/darius/teemo/TOP?idioma=es');
    expect(r.statusCode).toBe(200);
    const c = r.json();
    expect(c).toEqual({ campeon: 'Darius', rival: 'Teemo', idioma: 'es', rol: 'TOP', ...SALIDA, generadoEn: '2026-10-25T12:00:00.000Z' });
    expect(detalle).toHaveBeenCalledWith('15.21.1', 'Darius', 'es');
    expect(detalle).toHaveBeenCalledWith('15.21.1', 'Teemo', 'es');
    // Otra vez (aunque se reinicie el servidor): de la base, sin llamar al modelo.
    await app.close();
    montar();
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).json()).toEqual(c);
    expect(crear).toHaveBeenCalledTimes(1);
    // Otro idioma, otro rol o el cruce al revés: otros consejos.
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=de')).statusCode).toBe(200);
    expect((crear.mock.calls[1]![0] as Params).system).toEqual(expect.arrayContaining([expect.objectContaining({ text: IDIOMA_IA.de })]));
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/MIDDLE?idioma=es')).statusCode).toBe(200);
    expect((await pedir('/enfrentamiento-consejos/Teemo/Darius/TOP?idioma=es')).statusCode).toBe(200);
    expect(crear).toHaveBeenCalledTimes(4);
    // Nuevo parche: se regenera y el viejo se borra.
    version = '15.22.1';
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(200);
    expect(crear).toHaveBeenCalledTimes(5);
    const filas = db.sql.prepare("SELECT version FROM consejos_cruce WHERE campeon = 'darius' AND rival = 'teemo' AND rol = 'TOP' AND idioma = 'es'").all();
    expect(filas).toEqual([{ version: '15.22.1' }]);
  });

  it('pasa la valoración del cruce solo con datos fiables (30 partidas o más)', async () => {
    asegurarTablaEnfrentamientos(db.sql);
    const insertar = db.sql.prepare(
      "INSERT INTO enfrentamientos (campeon, rol, rival, parche, campeon_id, rival_id, partidas, victorias, partidas_fase, victorias_fase) VALUES (?, 'TOP', ?, '15.21', ?, ?, ?, ?, 0, 0)",
    );
    insertar.run('darius', 'teemo', 'Darius', 'Teemo', 100, 40);
    insertar.run('darius', 'garen', 'Darius', 'Garen', 12, 2);
    await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es');
    await pedir('/enfrentamiento-consejos/Darius/Garen/TOP?idioma=es');
    const texto = (i: number) => (crear.mock.calls[i]![0] as Params).messages[0]!.content as string;
    expect(texto(0)).toContain('hard for the player');
    expect(texto(1)).toContain('No aggregated data');
  });

  it('dos peticiones a la vez generan una sola vez', async () => {
    const [a, b] = await Promise.all([
      pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es'),
      pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es'),
    ]);
    expect(a.statusCode).toBe(200);
    expect(b.json()).toEqual(a.json());
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('respeta el tope global diario (lo guardado se sigue sirviendo) y el de cada IP', async () => {
    await app.close();
    montar({ maxDia: 1 });
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(200);
    const r = await pedir('/enfrentamiento-consejos/Darius/Garen/TOP?idioma=es');
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'limite_global' });
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(200);
    reloj += 86_400_000;
    expect((await pedir('/enfrentamiento-consejos/Darius/Garen/TOP?idioma=es')).statusCode).toBe(200);

    await app.close();
    montar({ ipDia: 1 });
    expect((await pedir('/enfrentamiento-consejos/Garen/Teemo/TOP?idioma=es')).statusCode).toBe(200);
    expect((await pedir('/enfrentamiento-consejos/Teemo/Garen/TOP?idioma=es')).json()).toEqual({ error: 'limite_diario' });
  });

  it('el tope de los consejos no gasta el de la ficha', async () => {
    await app.close();
    montar({ maxDia: 1 });
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(200);
    const cubos = db.sql.prepare('SELECT cubo FROM coach_ia_uso').all();
    expect(cubos).toEqual([{ cubo: 'cruce:d:2026-10-25' }]);
  });

  it('502 si el modelo los rechaza o devuelve algo no válido (y no se guarda)', async () => {
    crear.mockResolvedValueOnce(respuesta('', 'refusal'));
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(502);
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({ consejos: ['Ganas el 70%', 'Invade al empezar'], combos: [] })));
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(502);
    crear.mockRejectedValueOnce(new Error('caída'));
    expect((await pedir('/enfrentamiento-consejos/Darius/Teemo/TOP?idioma=es')).statusCode).toBe(502);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM consejos_cruce').get()).toEqual({ n: 0 });
  });
});

describe('configuración de los consejos del cruce', () => {
  it('sin clave de Anthropic no hay consejos; con ella, el modelo de la ficha, 600 al día y 40 por IP', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'x' }).consejosCruce).toBeNull();
    expect(leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k' }).consejosCruce).toEqual({ modelo: 'claude-sonnet-5-5', maxDia: 600, ipDia: 40 });
    expect(leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k', FICHA_MODELO: 'claude-haiku-5-5' }).consejosCruce?.modelo).toBe('claude-haiku-5-5');
    expect(
      leerConfiguracion({ RIOT_API_KEY: 'x', ANTHROPIC_API_KEY: 'k', CRUCE_CONSEJOS_MODELO: 'claude-opus-5-5', CRUCE_CONSEJOS_MAX_DIA: '50', CRUCE_CONSEJOS_IP_DIA: '5' }).consejosCruce,
    ).toEqual({ modelo: 'claude-opus-5-5', maxDia: 50, ipDia: 5 });
  });
});
