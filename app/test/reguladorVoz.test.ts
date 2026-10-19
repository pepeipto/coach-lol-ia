import { describe, expect, it } from 'vitest';
import { enPelea, ENFRIAMIENTO_TIPO_MS, HUECO_MS, MAX_EN_ESPERA, ReguladorVoz, type FraseRegulada } from '../src/main/consejos/regulador';
import type { EstadoPartida, TipoVoz } from '../src/shared/tiposApp';
import { CATEGORIAS_NIVEL, GRUPOS_VOZ, nivelDeTipos, TIPOS_VOZ, tiposDeNivel } from '../src/shared/vozCategorias';

let n = 0;
const frase = (tipo: TipoVoz, prioridad: number, extra: Partial<FraseRegulada> = {}): FraseRegulada => ({
  tipo,
  clave: `${tipo}:${n++}`,
  texto: `${tipo} ${n}`,
  prioridad,
  caducaMs: 20_000,
  ...extra,
});

describe('regulador de la voz (3.1)', () => {
  it('las urgentes salen en el acto, todas, y por orden de prioridad', () => {
    const r = new ReguladorVoz();
    const a = frase('combate', 1);
    const b = frase('objetivo', 0);
    expect(r.procesar([a, b], 0).map((f) => f.clave)).toEqual([b.clave, a.clave]);
  });

  it('las demás: como mucho una cada 5 s, la más urgente primero, sin perderse mientras no caduquen', () => {
    const r = new ReguladorVoz();
    const compra = frase('compra', 4);
    const cs = frase('cs', 5);
    const vision = frase('vision', 6);
    expect(r.procesar([vision, cs, compra], 0).map((f) => f.tipo)).toEqual(['compra']);
    expect(r.procesar([], HUECO_MS - 1)).toEqual([]);
    expect(r.procesar([], HUECO_MS).map((f) => f.tipo)).toEqual(['cs']);
    expect(r.procesar([], 2 * HUECO_MS).map((f) => f.tipo)).toEqual(['vision']);
    expect(r.enEspera).toEqual([]);
  });

  it('una urgente también cuenta para el hueco de las demás', () => {
    const r = new ReguladorVoz();
    expect(r.procesar([frase('objetivo', 0), frase('compra', 4)], 0).map((f) => f.tipo)).toEqual(['objetivo']);
    expect(r.procesar([], HUECO_MS).map((f) => f.tipo)).toEqual(['compra']);
  });

  it('durante una pelea tuya solo suenan las urgentes; lo demás espera a que acabe', () => {
    const r = new ReguladorVoz();
    expect(r.procesar([frase('compra', 4), frase('combate', 1)], 0, true).map((f) => f.tipo)).toEqual(['combate']);
    expect(r.procesar([], 10_000, true)).toEqual([]);
    expect(r.procesar([], 11_000, false).map((f) => f.tipo)).toEqual(['compra']);
  });

  it('las que caducan esperando no se dicen nunca', () => {
    const r = new ReguladorVoz();
    r.procesar([frase('compra', 4)], 0);
    r.procesar([frase('cs', 5, { caducaMs: 3_000 })], 1_000);
    expect(r.procesar([], HUECO_MS)).toEqual([]);
  });

  it('enfriamiento por categoría (dos frases de ánimo no van seguidas) y por grupo (una asistencia cada 30 s)', () => {
    const r = new ReguladorVoz();
    expect(r.procesar([frase('animo', 4)], 0)).toHaveLength(1);
    r.procesar([frase('animo', 4, { caducaMs: 60_000 })], 1_000);
    expect(r.procesar([], HUECO_MS)).toEqual([]);
    expect(r.procesar([], ENFRIAMIENTO_TIPO_MS.animo!)).toHaveLength(1);
    const g = new ReguladorVoz();
    const asistencia = () => frase('combate', 1, { grupo: 'asistencia', enfriamientoMs: 30_000 });
    expect(g.procesar([asistencia()], 0)).toHaveLength(1);
    expect(g.procesar([asistencia()], 10_000)).toEqual([]);
    expect(g.procesar([asistencia()], 31_000)).toHaveLength(1);
  });

  it('una frase nueva de un grupo sustituye a la que esperaba (la cuenta atrás más reciente gana)', () => {
    const r = new ReguladorVoz();
    r.procesar([frase('compra', 4)], 0);
    const a60 = frase('objetivo', 2, { grupo: 'objetivo:baron', texto: 'en un minuto' });
    const a30 = frase('objetivo', 2, { grupo: 'objetivo:baron', texto: 'en treinta segundos' });
    r.procesar([a60], 1_000);
    r.procesar([a30], 2_000);
    expect(r.enEspera.map((f) => f.texto)).toEqual(['en treinta segundos']);
  });

  it('como mucho unas pocas esperando: se descartan las menos urgentes', () => {
    const r = new ReguladorVoz();
    r.procesar([frase('compra', 4)], 0);
    r.procesar(Array.from({ length: 10 }, (_, i) => frase('fase', 7 - (i % 3))), 1);
    expect(r.enEspera).toHaveLength(MAX_EN_ESPERA);
    expect(Math.max(...r.enEspera.map((f) => f.prioridad))).toBeLessThanOrEqual(7);
  });

  it('al overlay solo llega la frase de siempre (sin los datos internos del regulador)', () => {
    const r = new ReguladorVoz();
    const [f] = r.procesar([frase('combate', 1, { grupo: 'g', enfriamientoMs: 5 })], 0);
    expect(Object.keys(f!).sort()).toEqual(['caducaMs', 'clave', 'prioridad', 'texto', 'tipo']);
  });

  it('reiniciar() vacía la espera y los enfriamientos (partida nueva)', () => {
    const r = new ReguladorVoz();
    r.procesar([frase('animo', 4), frase('cs', 5)], 0);
    r.reiniciar();
    expect(r.enEspera).toEqual([]);
    expect(r.procesar([frase('animo', 4)], 1)).toHaveLength(1);
  });

  it('pelea: una kill, muerte o asistencia tuya en los últimos 10 s de partida', () => {
    const base: EstadoPartida = { tiempo: 300, oro: 0, nivel: 1, campeon: 'Ahri', objetos: [], habilidades: { Q: 0, W: 0, E: 0, R: 0 }, eventos: [] };
    const kill = (tiempo: number, asesino: string, victima: string, asistentes: string[] = []) => ({ nombre: 'ChampionKill', tiempo, asesino, victima, asistentes });
    expect(enPelea({ ...base, eventos: [kill(295, 'Ahri', 'Zed')] })).toBe(true);
    expect(enPelea({ ...base, eventos: [kill(295, 'Zed', 'ahri')] })).toBe(true);
    expect(enPelea({ ...base, eventos: [kill(295, 'Jinx', 'Zed', ['Ahri'])] })).toBe(true);
    expect(enPelea({ ...base, eventos: [kill(280, 'Ahri', 'Zed')] })).toBe(false);
    expect(enPelea({ ...base, eventos: [kill(295, 'Jinx', 'Zed')] })).toBe(false);
  });
});

describe('categorías y nivel de detalle (3.1)', () => {
  it('cada categoría está en un grupo de la vista, una sola vez', () => {
    const agrupadas = Object.values(GRUPOS_VOZ).flat();
    expect([...agrupadas].sort()).toEqual([...TIPOS_VOZ].sort());
    expect(new Set(agrupadas).size).toBe(agrupadas.length);
  });

  it('Básico ⊂ Normal ⊂ Completo, y Completo es todo', () => {
    const basico = new Set(CATEGORIAS_NIVEL.basico);
    const normal = new Set(CATEGORIAS_NIVEL.normal);
    for (const t of basico) expect(normal.has(t)).toBe(true);
    expect([...CATEGORIAS_NIVEL.completo].sort()).toEqual([...TIPOS_VOZ].sort());
    expect(basico.has('objetivo') && basico.has('habilidad') && basico.has('compra')).toBe(true);
    expect(normal.has('muerte')).toBe(false);
  });

  it('el nivel se deduce de los interruptores; si no coincide con ninguno, es personalizado', () => {
    for (const nivel of ['basico', 'normal', 'completo'] as const) expect(nivelDeTipos(tiposDeNivel(nivel))).toBe(nivel);
    expect(nivelDeTipos({ ...tiposDeNivel('normal'), cs: false })).toBe('personalizado');
  });
});
