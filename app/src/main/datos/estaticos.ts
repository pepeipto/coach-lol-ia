import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { URL_VERSIONES, parcheDeVersion, urlDatosDDragon } from '@coach/shared';
import type { ItemDDragonCrudo } from '@coach/shared';

export interface DatosEstaticos {
  version: string;
  parche: string;
  campeones: Map<number, { id: string; nombre: string }>;
  objetos: Record<number, ItemDDragonCrudo & { name: string }>;
  runas: Map<number, { nombre: string; icono: string }>;
  hechizos: Map<number, { nombre: string; imagen: string }>;
}

// Forma serializable de DatosEstaticos (las Map se guardan como pares).
interface DatosEstaticosJson {
  version: string;
  campeones: [number, { id: string; nombre: string }][];
  objetos: Record<number, ItemDDragonCrudo & { name: string }>;
  runas: [number, { nombre: string; icono: string }][];
  hechizos: [number, { nombre: string; imagen: string }][];
}

const ARCHIVO_CACHE = 'estaticos.json';
const TIEMPO_ESPERA_MS = 10_000;
const REGEX_VERSION = /^\d+(\.\d+)*$/;

async function pedirJson<T>(fetchFn: typeof fetch, url: string): Promise<T> {
  const respuesta = await fetchFn(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  if (!respuesta.ok) throw new Error(`Data Dragon respondió ${respuesta.status} en ${url}`);
  return (await respuesta.json()) as T;
}

function aDatos(j: DatosEstaticosJson): DatosEstaticos {
  return {
    version: j.version,
    parche: parcheDeVersion(j.version),
    campeones: new Map(j.campeones),
    objetos: j.objetos,
    runas: new Map(j.runas),
    hechizos: new Map(j.hechizos),
  };
}

interface EstiloRunas {
  id: number;
  name: string;
  icon: string;
  slots: { runes: { id: number; name: string; icon: string }[] }[];
}

async function descargar(version: string, fetchFn: typeof fetch): Promise<DatosEstaticosJson> {
  const [champion, item, runes, summoner] = await Promise.all([
    pedirJson<{ data: Record<string, { key: string; id: string; name: string }> }>(fetchFn, urlDatosDDragon(version, 'champion')),
    pedirJson<{ data: Record<string, ItemDDragonCrudo & { name: string }> }>(fetchFn, urlDatosDDragon(version, 'item')),
    pedirJson<EstiloRunas[]>(fetchFn, urlDatosDDragon(version, 'runesReforged')),
    pedirJson<{ data: Record<string, { key: string; name: string; image: { full: string } }> }>(fetchFn, urlDatosDDragon(version, 'summoner')),
  ]);

  const campeones: DatosEstaticosJson['campeones'] = Object.values(champion.data).map((c) => [
    Number(c.key),
    { id: c.id, nombre: c.name },
  ]);
  const objetos: DatosEstaticosJson['objetos'] = {};
  for (const [id, valor] of Object.entries(item.data)) objetos[Number(id)] = valor;
  const runas: DatosEstaticosJson['runas'] = [];
  for (const estilo of runes) {
    runas.push([estilo.id, { nombre: estilo.name, icono: estilo.icon }]);
    for (const slot of estilo.slots) {
      for (const runa of slot.runes) runas.push([runa.id, { nombre: runa.name, icono: runa.icon }]);
    }
  }
  const hechizos: DatosEstaticosJson['hechizos'] = Object.values(summoner.data).map((h) => [
    Number(h.key),
    { nombre: h.name, imagen: h.image.full },
  ]);
  return { version, campeones, objetos, runas, hechizos };
}

function compararVersiones(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function leerUltimaCache(dirCache: string): Promise<DatosEstaticos | null> {
  let entradas: string[];
  try {
    entradas = await readdir(dirCache);
  } catch {
    return null;
  }
  const versiones = entradas.filter((e) => REGEX_VERSION.test(e)).sort((a, b) => compararVersiones(b, a));
  for (const version of versiones) {
    try {
      const texto = await readFile(join(dirCache, version, ARCHIVO_CACHE), 'utf8');
      return aDatos(JSON.parse(texto) as DatosEstaticosJson);
    } catch {
      // caché corrupta o incompleta: probar la versión anterior
    }
  }
  return null;
}

export async function cargarDatosEstaticos(dirCache: string, fetchFn: typeof fetch = fetch): Promise<DatosEstaticos> {
  try {
    const versiones = await pedirJson<string[]>(fetchFn, URL_VERSIONES);
    const version = versiones[0];
    if (!version) throw new Error('Data Dragon no devolvió versiones');
    const json = await descargar(version, fetchFn);
    try {
      await mkdir(join(dirCache, version), { recursive: true });
      await writeFile(join(dirCache, version, ARCHIVO_CACHE), JSON.stringify(json), 'utf8');
    } catch {
      // no poder guardar la caché no impide usar los datos descargados
    }
    return aDatos(json);
  } catch (error) {
    const cache = await leerUltimaCache(dirCache);
    if (cache) return cache;
    throw error;
  }
}
