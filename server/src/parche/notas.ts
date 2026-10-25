import { urlNotasParche } from '@coach/shared';

/*
 * Descarga y lectura de las notas oficiales del parche (leagueoflegends.com, en inglés).
 *
 * La página es pública (robots.txt: «Allow: /») y se pide una sola vez por parche desde el ciclo del servidor, con un
 * User-Agent que identifica al servicio; nunca desde las peticiones de los usuarios. No se salta ninguna protección:
 * si Riot responde con algo que no es la página (404, 403, otra cosa), se registra y se reintenta en el siguiente
 * ciclo.
 *
 * Estructura que se lee (comprobada con las notas 26.20 y 26.21):
 *   <title>League of Legends Patch 26.21 Notes</title>
 *   <h2 id="patch-champions">Champions</h2> … <h2 id="patch-items">Items</h2> … <h2 …>(siguiente apartado)
 *   y dentro de cada apartado, un bloque por campeón u objeto:
 *   <p><a class="reference-link"><img src="…/img/champion/Azir.png"></a></p>
 *   <h3 class="change-title">Azir</h3> <blockquote class="blockquote context">…</blockquote>
 *   <h4 class="change-detail-title">Base Stats</h4> <ul><li><strong>Mana Growth</strong>: 40 ⇒ <strong>50</strong></li></ul>
 * Si falta el título del parche o el apartado de campeones y objetos no tiene ningún bloque reconocible, las notas no
 * se leen (no se inventa nada).
 */

export const USER_AGENT_NOTAS = 'CoachLoLIA/1.0 (+https://coachlolia.com; resumen de las notas del parche con enlace a la fuente)';
/** Una página de notas pesa unos 350-500 KB; más de esto no es lo esperado. */
const TAMANO_MAXIMO = 4 * 1024 * 1024;
const TIEMPO_ESPERA_MS = 20_000;
/** Texto máximo de un bloque (un campeón u objeto) que se pasa a la IA. */
const MAX_BLOQUE = 3000;

export interface CambioExtraido {
  /** Nombre tal y como sale en las notas («Lee Sin», «Bastion Breaker»). */
  nombre: string;
  /** Texto del cambio: la explicación de Riot y la lista de cambios, en líneas. */
  texto: string;
}

export interface CampeonExtraido extends CambioExtraido {
  /** Id de Data Dragon. */
  id: string;
}

export interface ObjetoExtraido extends CambioExtraido {
  /** Id de Data Dragon, si se reconoce. */
  id?: number;
}

export interface NotasExtraidas {
  parcheJuego: string;
  /** Notas en inglés de las que se leyó el texto. */
  url: string;
  campeones: CampeonExtraido[];
  objetos: ObjetoExtraido[];
}

export type ResultadoDescarga = { estado: 'ok'; html: string; url: string } | { estado: 'no_disponible'; status: number };

/** GET de las notas en inglés de un parche del juego («26.21»). Lanza un error si la red falla. */
export async function descargarNotas(hacerFetch: typeof fetch, parcheJuego: string): Promise<ResultadoDescarga> {
  const url = urlNotasParche(parcheJuego, 'en');
  const resp = await hacerFetch(url, {
    headers: { 'User-Agent': USER_AGENT_NOTAS, Accept: 'text/html' },
    signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
  });
  if (resp.status !== 200) return { estado: 'no_disponible', status: resp.status };
  const tipo = resp.headers?.get?.('content-type') ?? 'text/html';
  if (!tipo.includes('text/html')) return { estado: 'no_disponible', status: 415 };
  const html = await resp.text();
  if (html.length > TAMANO_MAXIMO) return { estado: 'no_disponible', status: 413 };
  return { estado: 'ok', html, url };
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', mdash: '—', ndash: '–', rarr: '→' };

export function decodificarEntidades(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTIDADES[e.toLowerCase()] ?? todo;
  });
}

/** HTML de un bloque → texto en líneas (títulos con «## », elementos de lista con «- »), sin etiquetas. */
export function textoDeHtml(html: string): string {
  const conSaltos = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<h4\b[^>]*>/gi, '\n## ')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|h4|li|ul|blockquote|div)>|<br\s*\/?>|<hr\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodificarEntidades(conSaltos)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && l !== '-' && l !== '##')
    .join('\n');
}

/** Minúsculas y solo letras y números: «Nunu & Willump» → «nunuwillump», «Kai'Sa» → «kaisa». */
export const claveNombre = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Trozo de un apartado (de su <h2 id="patch-…"> al siguiente <h2>); null si no está. */
function apartado(html: string, id: string): string | null {
  const inicio = new RegExp(`<h2\\b[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  if (!inicio) return null;
  const desde = inicio.index + inicio[0].length;
  const fin = html.slice(desde).search(/<h2\b/i);
  return fin < 0 ? html.slice(desde) : html.slice(desde, desde + fin);
}

interface Bloque {
  nombre: string;
  /** HTML entre el <h3> anterior y este (allí va la imagen de referencia del bloque). */
  previo: string;
  cuerpo: string;
}

function bloques(seccion: string): Bloque[] {
  const re = /<h3\b[^>]*class="[^"]*\bchange-title\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi;
  const marcas: { inicio: number; fin: number; nombre: string }[] = [];
  for (let m = re.exec(seccion); m; m = re.exec(seccion)) {
    marcas.push({ inicio: m.index, fin: m.index + m[0].length, nombre: textoDeHtml(m[1]).replace(/\n/g, ' ') });
  }
  return marcas.map((m, i) => ({
    nombre: m.nombre,
    previo: seccion.slice(i === 0 ? 0 : marcas[i - 1].fin, m.inicio),
    cuerpo: seccion.slice(m.fin, i + 1 < marcas.length ? marcas[i + 1].inicio : seccion.length),
  }));
}

/** La última imagen de Data Dragon de un tipo («champion» o «item») en un trozo de HTML. */
function ultimaImagen(html: string, tipo: 'champion' | 'item'): string | null {
  const re = new RegExp(`ddragon\\.leagueoflegends\\.com/cdn/[0-9.]+/img/${tipo}/([A-Za-z0-9]+)\\.png`, 'g');
  let ultima: string | null = null;
  for (let m = re.exec(html); m; m = re.exec(html)) ultima = m[1];
  return ultima;
}

const recortar = (t: string) => (t.length > MAX_BLOQUE ? `${t.slice(0, MAX_BLOQUE)}…` : t);

export interface ListasDDragon {
  /** Campeones de Data Dragon en inglés: id y nombre. */
  campeones: { id: string; nombre: string }[];
  /** Objetos de Data Dragon en inglés: id y nombre. */
  objetos: { id: number; nombre: string }[];
}

/**
 * Lee los cambios de campeones y objetos de la página de notas. Null si la página no es la de ese parche o no tiene
 * el formato esperado (entonces no se resume nada).
 */
export function extraerNotas(html: string, parcheJuego: string, url: string, listas: ListasDDragon): NotasExtraidas | null {
  const titulo = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  const numero = parcheJuego.replace('.', '\\.');
  if (!new RegExp(`\\bpatch\\s+${numero}\\b`, 'i').test(decodificarEntidades(titulo))) return null;

  const porNombre = new Map(listas.campeones.map((c) => [claveNombre(c.nombre), c.id]));
  const porId = new Map(listas.campeones.map((c) => [c.id.toLowerCase(), c.id]));
  // Un mismo nombre puede tener copias de otros modos (Arena, ARAM: «326621», «223008»): gana el id más bajo, el de
  // la Grieta del Invocador.
  const objetosPorNombre = new Map([...listas.objetos].sort((a, b) => b.id - a.id).map((o) => [claveNombre(o.nombre), o.id]));
  const objetosPorId = new Set(listas.objetos.map((o) => o.id));

  const campeones: CampeonExtraido[] = [];
  const secCampeones = apartado(html, 'patch-champions');
  let sinReconocer = 0;
  if (secCampeones) {
    for (const b of bloques(secCampeones)) {
      const imagen = ultimaImagen(b.previo, 'champion');
      const id = porNombre.get(claveNombre(b.nombre)) ?? (imagen ? porId.get(imagen.toLowerCase()) : undefined);
      const texto = textoDeHtml(b.cuerpo);
      if (!id || !texto) {
        sinReconocer++;
        continue;
      }
      if (campeones.some((c) => c.id === id)) continue;
      campeones.push({ id, nombre: b.nombre, texto: recortar(texto) });
    }
  }

  const objetos: ObjetoExtraido[] = [];
  const secObjetos = apartado(html, 'patch-items');
  if (secObjetos) {
    for (const b of bloques(secObjetos)) {
      const texto = textoDeHtml(b.cuerpo);
      if (!b.nombre || b.nombre.length > 80 || !texto) continue;
      const imagen = ultimaImagen(b.previo, 'item');
      const id = objetosPorNombre.get(claveNombre(b.nombre)) ?? (imagen && objetosPorId.has(Number(imagen)) ? Number(imagen) : undefined);
      if (objetos.some((o) => o.nombre === b.nombre)) continue;
      objetos.push({ nombre: b.nombre, ...(id ? { id } : {}), texto: recortar(texto) });
    }
  }

  // Con un apartado de campeones del que no se reconoce ninguno, el formato ha cambiado: mejor no resumir.
  if (secCampeones && campeones.length === 0 && sinReconocer > 0) return null;
  if (campeones.length === 0 && objetos.length === 0) return null;
  return { parcheJuego, url, campeones, objetos };
}
