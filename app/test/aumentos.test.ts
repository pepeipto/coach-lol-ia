import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarAumentos, interpretarAumentos } from '../src/main/datos/aumentos';

vi.mock('../src/main/log', () => ({ registrar: vi.fn() }));

const CRUDO = [
  { id: 1205, augmentNameId: 'ARAM_ADAPt', nameTRA: 'Daño Habilidoso', augmentSmallIconPath: '/lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/ADAPt_small.png', rarity: 'kSilver' },
  { id: 1327, augmentNameId: 'Adamant', nameTRA: 'Insistente', augmentSmallIconPath: '/lol-game-data/assets/ASSETS/UX/Kiwi/Augments/Icons/Adamant_small.png' },
  { id: 'x', nameTRA: 'Malo' },
  { id: 7, nameTRA: '' },
];

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coach-aumentos-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('aumentos de CommunityDragon', () => {
  it('interpreta nombre e icono y descarta las entradas no válidas', () => {
    const m = interpretarAumentos(CRUDO)!;
    expect([...m.keys()]).toEqual([1205, 1327]);
    expect(m.get(1327)).toEqual({
      nombre: 'Insistente',
      icono: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/kiwi/augments/icons/adamant_small.png',
    });
    expect(interpretarAumentos({})).toBeNull();
  });

  it('descarga de la URL es_mx, guarda copia y la usa sin red', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return new Response(JSON.stringify(CRUDO));
    }) as typeof fetch;
    expect((await cargarAumentos(dir, ok)).size).toBe(2);
    expect(urls[0]).toContain('/global/es_mx/v1/cherry-augments.json');
    const caido = (async () => {
      throw new Error('sin red');
    }) as typeof fetch;
    expect((await cargarAumentos(dir, caido)).get(1205)?.nombre).toBe('Daño Habilidoso');
  });

  it('sin red ni copia: mapa vacío', async () => {
    const caido = (async () => new Response('no', { status: 500 })) as typeof fetch;
    expect((await cargarAumentos(dir, caido)).size).toBe(0);
  });
});
