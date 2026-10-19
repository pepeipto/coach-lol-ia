/**
 * Generador de la voz pregrabada de Coach LoL IA (3.1). Lo ejecuta el DUEÑO, una vez (y otra si se añaden frases),
 * con su cuenta de ElevenLabs; la app nunca se conecta a ElevenLabs: descarga el resultado como un paquete más.
 *
 *   Doble clic en «Generar voz ElevenLabs.bat» (raíz del repo), o:
 *   npx tsx app/tools/generar-voz-pack.ts --env E:\ruta\ajustes.env [--idiomas es,en,pt-BR,fr,de]
 *        [--modelo eleven_flash_v2_5|eleven_multilingual_v2] [--voz <voiceId>] [--max-creditos N]
 *        [--salida voz-pack] [--seco|--dry-run] [--si|--yes]
 *
 * - La clave (ELEVENLABS_API_KEY) se lee del .env indicado (o se pregunta la ruta); no se imprime ni se guarda en
 *   ningún sitio. La voz es «Dan Dan» (9F4C8ztpNUmXkdDDbz3J) salvo que --voz indique otra.
 * - Antes de generar: revisa la voz (categoría y restricciones de uso), lee los créditos que quedan, calcula los
 *   caracteres y el coste estimado y pide confirmación. --seco se queda ahí (no genera nada).
 * - Los segmentos salen de los textos i18n y las plantillas en el momento de ejecutarlo (vale tras fusionar frases
 *   nuevas) y de Data Dragon (campeones y objetos del idioma). Se generan por prioridad hasta el presupuesto
 *   (--max-creditos; por defecto, lo que queda menos un 5 %); lo que no cabe queda pendiente y otra ejecución
 *   lo completa, sin repetir lo hecho.
 * - Cada clip se normaliza en volumen con ffmpeg (loudnorm) y se apunta en voz-pack/<idioma>/manifest.json.
 * - Al final empaqueta cada idioma (voz-pack-<idioma>-<suma>.tar.gz), actualiza app/src/main/voz/packs.json e
 *   indica cómo subirlo a la release `voces-v1`.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { esIdioma, LOCALE_DDRAGON, textosDe, type Idioma } from '../src/shared/i18n';
import type { ManifestPack } from '../src/main/voz/segmentos';
import { escribirTar } from '../src/main/voz/tar';
import {
  archivoClip,
  creditosRestantes,
  explicarError,
  huecosDe,
  leerEnv,
  MULTIPLICADOR_POR_DEFECTO,
  multiplicadorDeModelos,
  NOMBRE_PRIORIDAD,
  nombresDdragon,
  planificar,
  plantillasDeVoz,
  recogerSegmentos,
  revisarVoz,
  valoresDeHuecos,
  type Prioridad,
  type Segmento,
} from './vozPack';

const API = 'https://api.elevenlabs.io';
const DDRAGON = 'https://ddragon.leagueoflegends.com';
const MODELOS = ['eleven_flash_v2_5', 'eleven_multilingual_v2'] as const;
const FFMPEG_POR_DEFECTO =
  'C:\\Users\\elcar\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE_RELEASE = 'https://github.com/pepeipto/coach-lol-ia/releases/download/voces-v1';
/** Voz elegida por el dueño para la voz pregrabada: «Dan Dan» (masculina). --voz la cambia. */
export const VOZ_POR_DEFECTO = '9F4C8ztpNUmXkdDDbz3J';
const IDIOMA_API: Record<Idioma, string> = { es: 'es', en: 'en', 'pt-BR': 'pt', fr: 'fr', de: 'de' };

export interface Opciones {
  env?: string;
  idiomas: Idioma[];
  modelo: (typeof MODELOS)[number];
  voz?: string;
  maxCreditos?: number;
  salida: string;
  packs: string;
  seco: boolean;
  si: boolean;
}

export type FetchGenerador = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json(): Promise<unknown>; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface Dependencias {
  fetch: FetchGenerador;
  preguntar(pregunta: string): Promise<string>;
  /** Normaliza el volumen (entrada → salida); false si no hay ffmpeg (entonces se copia tal cual). */
  normalizar(entrada: string, salida: string): Promise<boolean>;
  log(texto: string): void;
  esperar(ms: number): Promise<void>;
  textos(idioma: Idioma): Record<string, string>;
}

export function leerOpciones(args: string[]): Opciones {
  const valor = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const idiomas = (valor('idiomas') ?? 'es').split(',').map((x) => x.trim());
  const malos = idiomas.filter((i) => !esIdioma(i));
  if (malos.length) throw new Error(`Idiomas no válidos: ${malos.join(', ')} (usa es, en, pt-BR, fr, de)`);
  const modelo = (valor('modelo') ?? 'eleven_flash_v2_5') as Opciones['modelo'];
  if (!MODELOS.includes(modelo)) throw new Error(`Modelo no válido: ${modelo} (usa ${MODELOS.join(' o ')})`);
  const max = valor('max-creditos');
  return {
    env: valor('env'),
    idiomas: idiomas as Idioma[],
    modelo,
    voz: valor('voz'),
    maxCreditos: max !== undefined ? Number(max) : undefined,
    salida: resolve(valor('salida') ?? join(RAIZ, 'voz-pack')),
    packs: resolve(valor('packs') ?? join(RAIZ, 'app', 'src', 'main', 'voz', 'packs.json')),
    seco: args.includes('--seco') || args.includes('--dry-run'),
    si: args.includes('--si') || args.includes('--yes'),
  };
}

async function pedirJson(dep: Dependencias, url: string, clave?: string): Promise<unknown> {
  const r = await dep.fetch(url, clave ? { headers: { 'xi-api-key': clave } } : undefined);
  if (r.status !== 200) throw new Error(clave ? explicarError(r.status, await r.text().catch(() => '')) : `Error ${r.status} en ${url}`);
  return r.json();
}

/** Nombres de campeones y objetos del idioma en la última versión de Data Dragon (los mismos que dice la app). */
async function nombresDe(dep: Dependencias, idioma: Idioma, version: string) {
  const locale = LOCALE_DDRAGON[idioma];
  const [campeones, objetos] = await Promise.all([
    pedirJson(dep, `${DDRAGON}/cdn/${version}/data/${locale}/champion.json`),
    pedirJson(dep, `${DDRAGON}/cdn/${version}/data/${locale}/item.json`),
  ]);
  return nombresDdragon(campeones, objetos);
}

function leerManifest(dir: string, idioma: Idioma, vozId: string, modelo: string): ManifestPack {
  try {
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as ManifestPack;
    // Otra voz u otro modelo: se empieza de cero (no se mezclan voces en un paquete).
    if (m.version === 1 && m.vozId === vozId && m.modelo === modelo) {
      for (const [k, s] of Object.entries(m.segmentos)) if (!existsSync(join(dir, s.archivo))) delete m.segmentos[k];
      return m;
    }
  } catch {
    // sin manifest: paquete nuevo
  }
  return { version: 1, idioma, vozId, modelo, fecha: new Date().toISOString().slice(0, 10), segmentos: {} };
}

/** Un clip de ElevenLabs (MP3), con reintentos ante 429 y errores del servidor. Error si no se arregla reintentando. */
async function generarClip(dep: Dependencias, clave: string, vozId: string, modelo: string, idioma: Idioma, texto: string): Promise<Buffer> {
  const cuerpo: Record<string, unknown> = { text: texto, model_id: modelo };
  if (modelo === 'eleven_flash_v2_5') cuerpo.language_code = IDIOMA_API[idioma];
  for (let intento = 0; ; intento++) {
    let r;
    try {
      r = await dep.fetch(`${API}/v1/text-to-speech/${encodeURIComponent(vozId)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': clave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(cuerpo),
      });
    } catch {
      if (intento >= 5) throw new Error('Sin conexión con ElevenLabs.');
      await dep.esperar(2000 * 2 ** intento);
      continue;
    }
    if (r.status === 200) return Buffer.from(await r.arrayBuffer());
    const detalle = await r.text().catch(() => '');
    if ((r.status === 429 || r.status >= 500) && !detalle.toLowerCase().includes('quota_exceeded') && intento < 6) {
      await dep.esperar(2000 * 2 ** intento);
      continue;
    }
    throw new Error(explicarError(r.status, detalle));
  }
}

/** Empaqueta el idioma (manifest + clips) y lo apunta en packs.json. */
function empaquetar(o: Opciones, idioma: Idioma, dir: string, m: ManifestPack, dep: Dependencias): string {
  const entradas = [
    { nombre: 'manifest.json', datos: Buffer.from(JSON.stringify(m), 'utf8') },
    ...[...new Set(Object.values(m.segmentos).map((s) => s.archivo))].sort().map((a) => ({ nombre: a, datos: readFileSync(join(dir, a)) })),
  ];
  const tgz = gzipSync(escribirTar(entradas), { level: 9 });
  const sha256 = createHash('sha256').update(tgz).digest('hex');
  const archivo = `voz-pack-${idioma}-${sha256.slice(0, 12)}.tar.gz`;
  writeFileSync(join(o.salida, archivo), tgz);
  let packs: Record<string, unknown> = {};
  try {
    packs = JSON.parse(readFileSync(o.packs, 'utf8')) as Record<string, unknown>;
  } catch {
    // packs.json nuevo
  }
  packs[idioma] = { archivo, bytes: tgz.length, sha256, modelo: m.modelo, fecha: m.fecha, segmentos: Object.keys(m.segmentos).length };
  writeFileSync(o.packs, `${JSON.stringify(packs, null, 2)}\n`);
  dep.log(`  ${idioma}: ${archivo} (${(tgz.length / 1e6).toFixed(1)} MB, ${Object.keys(m.segmentos).length} segmentos) → ${BASE_RELEASE}/${archivo}`);
  return join(o.salida, archivo);
}

/** Ejecuta el generador. Devuelve 0 si todo fue bien (o se canceló), 1 si hubo un error y 2 si la voz no se puede usar. */
export async function ejecutar(o: Opciones, dep: Dependencias): Promise<number> {
  // 1. Credenciales (nunca se imprimen).
  let rutaEnv = o.env;
  if (!rutaEnv) rutaEnv = (await dep.preguntar('Ruta del archivo .env con ELEVENLABS_API_KEY: ')).trim().replace(/^"|"$/g, '');
  let env: { clave: string | null } = { clave: null };
  try {
    env = leerEnv(readFileSync(rutaEnv, 'utf8'));
  } catch {
    dep.log(`No se pudo leer ${rutaEnv}.`);
    return 1;
  }
  const clave = env.clave ?? process.env.ELEVENLABS_API_KEY ?? null;
  const vozId = o.voz ?? VOZ_POR_DEFECTO;
  if (!clave) {
    dep.log('Falta ELEVENLABS_API_KEY en el .env.');
    return 1;
  }
  if (!vozId || !/^[A-Za-z0-9]{8,64}$/.test(vozId)) {
    dep.log('El Voice ID de --voz no es válido.');
    return 1;
  }

  try {
    // 2. La voz: categoría y restricciones de uso.
    const revision = revisarVoz(await pedirJson(dep, `${API}/v1/voices/${encodeURIComponent(vozId)}`, clave));
    dep.log(`Voz: ${revision.nombre || vozId} · categoría: ${revision.categoria}${revision.biblioteca ? ' (biblioteca de la comunidad)' : ''}`);
    for (const a of revision.avisos) dep.log(`  Aviso: ${a}`);
    if (revision.bloqueo) {
      dep.log(`No se puede usar esta voz para un paquete que se distribuye: ${revision.bloqueo}`);
      return 2;
    }

    // 3. Créditos y coste por carácter del modelo.
    const sub = creditosRestantes(await pedirJson(dep, `${API}/v1/user/subscription`, clave));
    let multiplicador = MULTIPLICADOR_POR_DEFECTO[o.modelo]!;
    let estimado = true;
    try {
      const m = multiplicadorDeModelos(await pedirJson(dep, `${API}/v1/models`, clave), o.modelo);
      if (m !== null) {
        multiplicador = m;
        estimado = false;
      }
    } catch {
      // sin /v1/models: se usa la estimación
    }
    if (sub) dep.log(`Créditos: quedan ${sub.restantes.toLocaleString('es-ES')} de ${sub.limite.toLocaleString('es-ES')} este mes.`);
    else dep.log('No se pudieron leer los créditos de la cuenta.');
    dep.log(`Modelo: ${o.modelo} · ${multiplicador} créditos por carácter${estimado ? ' (estimación: la API no lo indica)' : ''}.`);
    const presupuesto = o.maxCreditos ?? (sub ? Math.floor(sub.restantes * 0.95) : 0);
    if (!(presupuesto > 0)) {
      dep.log('Sin presupuesto: indica --max-creditos N.');
      return 1;
    }

    // 4. Segmentos de cada idioma (de los textos actuales y de Data Dragon).
    const versiones = (await pedirJson(dep, `${DDRAGON}/api/versions.json`)) as string[];
    const version = versiones[0]!;
    type Tarea = Segmento & { idioma: Idioma; id: string };
    const todas: Tarea[] = [];
    const hechas = new Set<string>();
    const manifests = new Map<Idioma, ManifestPack>();
    for (const idioma of o.idiomas) {
      const textos = dep.textos(idioma);
      const plantillas = plantillasDeVoz(textos);
      const valores = valoresDeHuecos(textos, await nombresDe(dep, idioma, version), huecosDe(plantillas));
      const { segmentos, sinValores } = recogerSegmentos(plantillas, valores);
      if (sinValores.length) dep.log(`  ${idioma}: huecos sin valores conocidos (esas frases usarán la voz natural): ${sinValores.join(', ')}`);
      const m = leerManifest(join(o.salida, idioma), idioma, vozId, o.modelo);
      manifests.set(idioma, m);
      for (const s of segmentos) {
        const id = `${idioma}|${s.clave}`;
        if (m.segmentos[s.clave]) hechas.add(id);
        todas.push({ ...s, idioma, id });
      }
    }
    // Por prioridad y, dentro de cada una, en el orden de los idiomas pedidos.
    todas.sort((a, b) => a.prioridad - b.prioridad || o.idiomas.indexOf(a.idioma) - o.idiomas.indexOf(b.idioma));
    const plan = planificar(
      todas.map((t) => ({ ...t, clave: t.id })),
      hechas,
      multiplicador,
      presupuesto,
    );
    const resumen = (lista: { prioridad: Prioridad; texto: string }[]) =>
      ([1, 2, 3, 4, 5] as Prioridad[])
        .map((p) => {
          const de = lista.filter((x) => x.prioridad === p);
          return de.length ? `    ${p}. ${NOMBRE_PRIORIDAD[p]}: ${de.length} clips, ${de.reduce((n, x) => n + x.texto.length, 0).toLocaleString('es-ES')} caracteres` : null;
        })
        .filter(Boolean)
        .join('\n');
    const totalCaracteres = todas.filter((t) => !hechas.has(t.id)).reduce((n, t) => n + t.texto.length, 0);
    dep.log(`\nPaquete (${o.idiomas.join(', ')}): ${todas.length} segmentos; ya hechos ${hechas.size}.`);
    dep.log(`Falta: ${totalCaracteres.toLocaleString('es-ES')} caracteres ≈ ${Math.ceil(totalCaracteres * multiplicador).toLocaleString('es-ES')} créditos.`);
    dep.log(`Presupuesto de esta ejecución: ${presupuesto.toLocaleString('es-ES')} créditos.`);
    dep.log(`Se generará ahora: ${plan.generar.length} clips, ${plan.caracteres.toLocaleString('es-ES')} caracteres ≈ ${Math.ceil(plan.creditos).toLocaleString('es-ES')} créditos`);
    if (plan.generar.length) dep.log(resumen(plan.generar));
    if (plan.pendientes.length) dep.log(`Quedará pendiente (otra ejecución lo completa): ${plan.pendientes.length} clips\n${resumen(plan.pendientes)}`);
    if (o.seco) {
      dep.log('\n--seco: no se ha generado nada.');
      return 0;
    }
    if (plan.generar.length === 0) dep.log('\nNada que generar.');
    else if (!o.si && !/^s/i.test((await dep.preguntar('\n¿Generar ahora? (s/N): ')).trim())) {
      dep.log('Cancelado.');
      return 0;
    }

    // 5. Generación: un clip cada vez, guardando el manifest tras cada uno (se puede cortar y reanudar).
    let generados = 0;
    let caracteres = 0;
    let fallo: string | null = null;
    for (const t of plan.generar) {
      const m = manifests.get(t.idioma)!;
      const dir = join(o.salida, t.idioma);
      mkdirSync(dir, { recursive: true });
      const clave_ = t.id.slice(t.idioma.length + 1);
      const archivo = archivoClip(t.idioma, vozId, o.modelo, clave_);
      try {
        const mp3 = await generarClip(dep, clave, vozId, o.modelo, t.idioma, t.texto);
        const crudo = join(dir, `${archivo}.crudo.mp3`);
        writeFileSync(crudo, mp3);
        if (!(await dep.normalizar(crudo, join(dir, archivo)))) renameSync(crudo, join(dir, archivo));
        rmSync(crudo, { force: true });
      } catch (e) {
        fallo = (e as Error).message;
        break;
      }
      m.segmentos[clave_] = { archivo, texto: t.texto };
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m, null, 1));
      generados++;
      caracteres += t.texto.length;
      if (generados % 25 === 0) dep.log(`  ${generados} de ${plan.generar.length}…`);
    }

    // 6. Paquetes y resumen.
    dep.log('\nPaquetes:');
    const subidos: string[] = [];
    for (const idioma of o.idiomas) {
      const m = manifests.get(idioma)!;
      if (Object.keys(m.segmentos).length) subidos.push(empaquetar(o, idioma, join(o.salida, idioma), m, dep));
    }
    let final: ReturnType<typeof creditosRestantes> = null;
    try {
      final = creditosRestantes(await pedirJson(dep, `${API}/v1/user/subscription`, clave));
    } catch {
      // sin datos: se omite
    }
    const pendientes = plan.pendientes.length + (plan.generar.length - generados);
    dep.log(`\nResumen: generados ${generados} clips (${caracteres.toLocaleString('es-ES')} caracteres), pendientes ${pendientes}.`);
    dep.log(
      `Créditos usados ≈ ${Math.ceil(caracteres * multiplicador).toLocaleString('es-ES')}` +
        (final ? `; quedan ${final.restantes.toLocaleString('es-ES')}.` : '.'),
    );
    if (fallo) dep.log(`Se paró por: ${fallo}`);
    if (subidos.length) {
      dep.log('\nPara publicarlo (y que la app lo descargue): haz commit de app/src/main/voz/packs.json y sube:');
      for (const s of subidos) dep.log(`  gh release upload voces-v1 "${s}" --repo pepeipto/coach-lol-ia --clobber`);
    }
    return fallo ? 1 : 0;
  } catch (e) {
    dep.log(`Error: ${(e as Error).message}`);
    return 1;
  }
}

/** ffmpeg loudnorm (-16 LUFS, pico -1,5 dB), mono 44,1 kHz, MP3 de 96 kbps. */
function normalizarConFfmpeg(entrada: string, salida: string): Promise<boolean> {
  const ffmpeg = process.env.FFMPEG ?? (existsSync(FFMPEG_POR_DEFECTO) ? FFMPEG_POR_DEFECTO : 'ffmpeg');
  return new Promise((ok) => {
    const p = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', entrada, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', salida], {
      stdio: 'ignore',
    });
    p.on('error', () => ok(false));
    p.on('exit', (c) => ok(c === 0 && existsSync(salida)));
  });
}

async function principal(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let avisadoFfmpeg = false;
  const codigo = await ejecutar(leerOpciones(process.argv.slice(2)), {
    fetch: (u, i) => fetch(u, i) as ReturnType<FetchGenerador>,
    preguntar: (p) => rl.question(p),
    normalizar: async (e, s) => {
      const ok = await normalizarConFfmpeg(e, s);
      if (!ok && !avisadoFfmpeg) {
        avisadoFfmpeg = true;
        console.log('  Aviso: no se encontró ffmpeg; los clips se guardan sin normalizar el volumen.');
      }
      return ok;
    },
    log: (t) => console.log(t),
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    textos: (i) => ({ ...textosDe(i) }),
  }).catch((e: Error) => {
    console.error(e.message);
    return 1;
  });
  rl.close();
  process.exitCode = codigo;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void principal();
