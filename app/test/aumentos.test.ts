import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarAumentos, crearCargadorAumentos, interpretarAumentos, REINTENTO_RED_MS } from '../src/main/datos/aumentos';

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

  it('en el idioma de la app: carpeta de CommunityDragon del locale (el inglés es «default») y copia aparte', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return new Response(JSON.stringify(CRUDO));
    }) as typeof fetch;
    let locale = 'en_US';
    const cargar = crearCargadorAumentos(dir, { fetch: ok, locale: () => locale });
    await cargar();
    expect(urls.at(-1)).toContain('/global/default/v1/cherry-augments.json');
    await cargar();
    expect(urls).toHaveLength(1);
    locale = 'de_DE';
    await cargar();
    expect(urls.at(-1)).toContain('/global/de_de/v1/cherry-augments.json');
    expect(urls).toHaveLength(2);
  });

  it('sin red ni copia: mapa vacío', async () => {
    const caido = (async () => new Response('no', { status: 500 })) as typeof fetch;
    expect((await cargarAumentos(dir, caido)).size).toBe(0);
  });
});

describe('cargador memorizado de aumentos', () => {
  it('desde la red no vuelve a pedir; desde la copia en disco reintenta la red a los 30 min', async () => {
    let red = true;
    let peticiones = 0;
    const f = (async () => {
      peticiones++;
      if (!red) throw new Error('sin red');
      return new Response(JSON.stringify(CRUDO));
    }) as typeof fetch;
    // Deja una copia en disco.
    await cargarAumentos(dir, f);
    peticiones = 0;
    red = false;
    let reloj = 0;
    const cargar = crearCargadorAumentos(dir, { fetch: f, ahora: () => reloj });
    expect((await cargar()).size).toBe(2); // desde la copia
    expect(peticiones).toBe(1);
    reloj += REINTENTO_RED_MS - 1;
    await cargar();
    expect(peticiones).toBe(1);
    red = true;
    reloj += 1;
    expect((await cargar()).size).toBe(2); // vuelve a la red
    expect(peticiones).toBe(2);
    reloj += 10 * REINTENTO_RED_MS;
    await cargar();
    expect(peticiones).toBe(2); // ya es de la red: no se repite
  });
});

