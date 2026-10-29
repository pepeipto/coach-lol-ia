import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_VERSIONES } from '@coach/shared';

// La recolección se sustituye: EUW y LAS traen partidas nuevas y LAN ninguna.
const orden: string[] = [];
vi.mock('../src/recolector', () => ({
  recolectarModos: vi.fn(async (_api: unknown, _db: unknown, _o: unknown, op: { region: string }) => {
    orden.push(`recoger ${op.region}`);
    return { clasificatoria: op.region === 'LAN' ? 0 : 5, aram: 0, caos: 0, arena: 0 };
  }),
}));
vi.mock('../src/agregador', () => ({ calcularBuilds: vi.fn(() => (orden.push('builds'), 1)) }));
vi.mock('../src/enfrentamientos', () => ({ calcularEnfrentamientos: vi.fn(() => 0) }));
vi.mock('../src/sinergias', () => ({ calcularSinergias: vi.fn(() => 0) }));

const { ejecutarCiclo } = await import('../src/programacion');
const { abrirDb } = await import('../src/db');

const respuesta = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo }) as Response;
const fetchDDragon = (async (url: string) =>
  url === URL_VERSIONES ? respuesta(['15.20.1', '15.19.1']) : respuesta({ data: {} })) as unknown as typeof fetch;

describe('ejecutarCiclo: recálculo por región', () => {
  beforeEach(() => {
    orden.length = 0;
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('recalcula al terminar cada región con partidas nuevas (no espera al final del ciclo) y no repite al final', async () => {
    const db = abrirDb(':memory:');
    await ejecutarCiclo({ api: {} as never, db, fetch: fetchDDragon, rotativos: null });
    expect(orden).toEqual(['recoger EUW', 'builds', 'recoger LAN', 'recoger LAS', 'builds']);
    db.cerrar();
  });
});
