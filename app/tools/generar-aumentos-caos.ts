/**
 * Genera app/src/main/datos/aumentosCaos.json: los aumentos de ARAM: Caos (KIWI) con su rareza, sus etiquetas (qué
 * hacen) y su familia. Se ejecuta a mano cuando Riot cambia los aumentos (cada pocos parches):
 *
 *   npx tsx app/tools/generar-aumentos-caos.ts
 *
 * Fuentes (CommunityDragon, datos públicos del juego):
 * - plugins/…/augment-lists.json: qué aumentos hay en el modo KIWI.
 * - plugins/…/es_mx/v1/cherry-augments.json: id (el de Match-v5), rareza, nombre e icono.
 * - game/maps/modespecificdata/kiwi.bin.json: la clave de texto de la descripción de cada aumento.
 * - game/es_mx/data/menu/en_us/lol.stringtable.json: el texto de esas claves en español.
 * Los aumentos más nuevos a veces no tienen descripción pública: se guardan como neutros (`sinDescripcion`).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { etiquetarAumento, familiaDe, rarezaDe, type AumentoCaos } from '../src/main/datos/etiquetasAumentos';

const BASE = 'https://raw.communitydragon.org/latest';
const PLUGIN = `${BASE}/plugins/rcp-be-lol-game-data/global`;

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

const limpiar = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function main(): Promise<void> {
  console.log('Descargando datos de CommunityDragon (≈ 50 MB)...');
  const [listas, cherry, kiwi, tabla] = await Promise.all([
    json<{ modeName: string; augmentList: string[] }[]>(`${PLUGIN}/default/v1/augment-lists.json`),
    json<{ id: number; augmentNameId: string; rarity: string }[]>(`${PLUGIN}/es_mx/v1/cherry-augments.json`),
    json<Record<string, { __type?: string; DescriptionTra?: string; AugmentTooltipTra?: string }>>(
      `${BASE}/game/maps/modespecificdata/kiwi.bin.json`,
    ),
    json<{ entries: Record<string, string> }>(`${BASE}/game/es_mx/data/menu/en_us/lol.stringtable.json`),
  ]);
  const textos = new Map(Object.entries(tabla.entries).map(([k, v]) => [k.toLowerCase(), v]));
  const lista = listas.find((l) => l.modeName === 'KIWI')?.augmentList;
  if (!lista?.length) throw new Error('augment-lists.json no trae la lista KIWI');
  const porClave = new Map(cherry.map((c) => [c.augmentNameId.toLowerCase(), c]));

  const aumentos: AumentoCaos[] = [];
  let sinDescripcion = 0;
  for (const ruta of lista) {
    const clave = ruta.split('/').pop()!;
    const c = porClave.get(clave.toLowerCase());
    const rareza = c && rarezaDe(c.rarity);
    if (!c || !rareza) {
      console.warn(`  ${clave}: no está en cherry-augments.json o sin rareza; se omite`);
      continue;
    }
    const def = kiwi[ruta];
    const claveTexto = (def?.DescriptionTra ?? def?.AugmentTooltipTra ?? '').toLowerCase();
    const descripcion = limpiar(textos.get(claveTexto) ?? '');
    const a: AumentoCaos = { id: c.id, clave: c.augmentNameId, rareza, etiquetas: etiquetarAumento(c.augmentNameId, descripcion), familia: familiaDe(c.augmentNameId) };
    if (!descripcion) {
      a.sinDescripcion = true;
      sinDescripcion++;
    }
    aumentos.push(a);
  }
  aumentos.sort((a, b) => a.id - b.id);
  const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main', 'datos', 'aumentosCaos.json');
  writeFileSync(destino, JSON.stringify({ generado: new Date().toISOString().slice(0, 10), aumentos }, null, 1) + '\n', 'utf8');
  console.log(`${aumentos.length} aumentos (${sinDescripcion} sin descripción) → ${destino}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
