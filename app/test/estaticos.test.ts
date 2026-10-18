import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cargarDatosEstaticos } from '../src/main/datos/estaticos';

const RESPUESTAS: Record<string, unknown> = {
  'api/versions.json': ['15.20.1', '15.19.1'],
  'champion.json': { data: { Ahri: { key: '103', id: 'Ahri', name: 'Ahri' } } },
  'item.json': { data: { '3157': { name: 'Reloj de Arena de Zhonya', gold: { total: 3250, purchasable: true } } } },
  'runesReforged.json': [
    {
      id: 8100,
      name: 'Dominación',
      icon: 'perk-images/Styles/7200_Domination.png',
      slots: [{ runes: [{ id: 8112, name: 'Electrocutar', icon: 'perk-images/Styles/Domination/Electrocute/Electrocute.png' }] }],
    },
  ],
  'summoner.json': { data: { SummonerFlash: { key: '4', name: 'Destello', image: { full: 'SummonerFlash.png' } } } },
};

function fetchFalso(urls: string[] = []): typeof fetch {
  return (async (entrada: RequestInfo | URL) => {
    const url = String(entrada);
    urls.push(url);
    const clave = Object.keys(RESPUESTAS).find((k) => url.endsWith(k));
    if (!clave) return new Response('no', { status: 404 });
    return new Response(JSON.stringify(RESPUESTAS[clave]), { status: 200 });
  }) as typeof fetch;
}

const fetchCaido = (async () => {
  throw new Error('sin red');
}) as typeof fetch;

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coach-estaticos-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('datos estáticos', () => {
  it('mapea championId 103 → {id:"Ahri", nombre:"Ahri"} y usa es_MX', async () => {
    const urls: string[] = [];
    const d = await cargarDatosEstaticos(dir, fetchFalso(urls));
    expect(d.version).toBe('15.20.1');
    expect(d.parche).toBe('15.20');
    expect(d.campeones.get(103)).toEqual({ id: 'Ahri', nombre: 'Ahri' });
    expect(d.objetos[3157].name).toBe('Reloj de Arena de Zhonya');
    expect(d.runas.get(8100)).toEqual({ nombre: 'Dominación', icono: 'perk-images/Styles/7200_Domination.png' });
    expect(d.runas.get(8112)?.nombre).toBe('Electrocutar');
    expect(d.hechizos.get(4)).toEqual({ nombre: 'Destello', imagen: 'SummonerFlash.png' });
    const cdn = urls.filter((u) => u.includes('/cdn/'));
    expect(cdn).toHaveLength(4);
    expect(cdn.every((u) => u.includes('/es_MX/'))).toBe(true);
  });

  it('sin red usa la última versión en caché', async () => {
    await cargarDatosEstaticos(dir, fetchFalso());
    const d = await cargarDatosEstaticos(dir, fetchCaido);
    expect(d.version).toBe('15.20.1');
    expect(d.campeones.get(103)?.id).toBe('Ahri');
    expect(d.hechizos.get(4)?.nombre).toBe('Destello');
  });

  it('sin red ni caché lanza', async () => {
    await expect(cargarDatosEstaticos(dir, fetchCaido)).rejects.toThrow();
  });
});
