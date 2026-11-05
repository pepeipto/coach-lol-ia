#!/usr/bin/env node
// Reels automáticos para el TikTok de Coach LoL IA. Convierte un vídeo (grabación de OBS, clip de Twitch…) en un
// vídeo vertical 1080x1920 listo para subir: fondo desenfocado, vídeo en el centro, gancho arriba, coachlolia.com
// abajo y subtítulos automáticos si está instalado Whisper. Al lado deja un .txt con la caption para pegar.
// Nunca publica nada: subirlo a TikTok lo hace Carlos. Hecho con ayuda de IA.
//
// Uso:
//   node reels.mjs <vídeo> [--gancho "texto"] [--credito "Vídeo de @autor"] [--inicio 1:20] [--duracion 30] [--sin-subtitulos]
//   node reels.mjs --entrada        todo lo que haya en <carpeta>\entrada (el gancho, en un .txt con el mismo nombre)
//   node reels.mjs --cola           los reels aprobados en el panel con un clip de Twitch como material
// Opciones comunes: --carpeta <ruta> (por defecto %USERPROFILE%\Videos\coach-tiktok o REELS_CARPETA).

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  argsAudio,
  argsReel,
  DURACION_MAX,
  envolverTexto,
  EXTENSIONES_VIDEO,
  FUENTES,
  ganchoDeNombre,
  leerTiempo,
  nombreArchivo,
  pendientesDeCola,
  textoPublicacion,
} from './receta.mjs';

const PANEL = process.env.COACH_PANEL_URL || 'https://api.coachlolia.com';
const ARCHIVO_TOKEN = join(homedir(), '.coachlolia', 'panel.txt');

function leerArgs(argv) {
  const o = { archivos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => argv[++i];
    if (a === '--gancho') o.gancho = valor();
    else if (a === '--inicio') o.inicio = valor();
    else if (a === '--credito') o.credito = valor();
    else if (a === '--duracion') o.duracion = valor();
    else if (a === '--carpeta') o.carpeta = valor();
    else if (a === '--sin-subtitulos') o.sinSubtitulos = true;
    else if (a === '--entrada') o.modo = 'entrada';
    else if (a === '--cola') o.modo = 'cola';
    else if (a === '--ayuda' || a === '-h') o.modo = 'ayuda';
    else o.archivos.push(a);
  }
  return o;
}

const existe = (cmd, args = ['-version']) => {
  try {
    return spawnSync(cmd, args, { stdio: 'ignore', shell: false }).status === 0;
  } catch {
    return false;
  }
};

function ejecutar(cmd, args, opciones = {}) {
  return new Promise((ok, mal) => {
    const p = spawn(cmd, args, { stdio: opciones.silencio ? 'ignore' : ['ignore', 'inherit', 'inherit'], cwd: opciones.cwd });
    p.on('error', mal);
    p.on('close', (c) => (c === 0 ? ok() : mal(new Error(`${cmd} terminó con el código ${c}`))));
  });
}

function buscarFuente() {
  const propia = process.env.REELS_FUENTE;
  if (propia && existsSync(propia)) return { archivo: propia, familia: process.env.REELS_FUENTE_FAMILIA || 'Arial' };
  return FUENTES.find((f) => existsSync(f.archivo)) ?? null;
}

/** Programa de Whisper que haya: whisper-ctranslate2 (rápido) o whisper (el de OpenAI). */
function buscarWhisper() {
  for (const cmd of ['whisper-ctranslate2', 'whisper']) if (existe(cmd, ['--help'])) return cmd;
  return null;
}

async function duracionDe(archivo) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', archivo], { encoding: 'utf8' });
  const n = Number(String(r.stdout).trim());
  return Number.isFinite(n) ? n : null;
}

/** Hace un reel. Devuelve la ruta del .mp4. */
async function hacerReel({ entrada, carpetaSalida, gancho = '', credito = '', inicio = 0, duracion, conSubtitulos = true, nombre, caption }) {
  const fuente = buscarFuente();
  if (!fuente) throw new Error('No encuentro una fuente en negrita (Arial). Pon la ruta de un .ttf en REELS_FUENTE.');
  const total = await duracionDe(entrada);
  const dur = Math.max(1, Math.min(duracion ?? DURACION_MAX, total ? total - inicio : DURACION_MAX));
  const tmp = mkdtempSync(join(tmpdir(), 'reel-'));
  try {
    copyFileSync(fuente.archivo, join(tmp, 'fuente.ttf'));
    const lineas = envolverTexto(gancho);
    if (lineas.length) writeFileSync(join(tmp, 'gancho.txt'), lineas.join('\n'), 'utf8');
    if (credito) writeFileSync(join(tmp, 'credito.txt'), credito.trim().slice(0, 40), 'utf8');

    let subtitulos = false;
    const whisper = conSubtitulos ? buscarWhisper() : null;
    if (conSubtitulos && !whisper) console.log('  (sin subtítulos: Whisper no está instalado; ver «Instalar herramientas de reels.bat»)');
    if (whisper) {
      console.log(`  Transcribiendo el audio con ${whisper}…`);
      await ejecutar('ffmpeg', argsAudio({ entrada, salida: join(tmp, 'audio.wav'), inicio, duracion: dur }));
      try {
        await ejecutar(whisper, ['audio.wav', '--language', 'es', '--model', process.env.REELS_WHISPER_MODELO || 'small', '--output_format', 'srt', '--output_dir', '.'], { cwd: tmp, silencio: true });
        if (existsSync(join(tmp, 'audio.srt')) && readFileSync(join(tmp, 'audio.srt'), 'utf8').trim()) {
          renameSync(join(tmp, 'audio.srt'), join(tmp, 'subs.srt'));
          subtitulos = true;
        } else console.log('  (no se oye voz: sin subtítulos)');
      } catch (e) {
        console.log(`  (Whisper falló: ${e.message}; sigo sin subtítulos)`);
      }
    }

    mkdirSync(carpetaSalida, { recursive: true });
    const base = nombre ?? `${new Date().toISOString().slice(0, 10)}-${nombreArchivo(gancho || basename(entrada, extname(entrada)))}`;
    let salida = join(carpetaSalida, `${base}.mp4`);
    for (let n = 2; existsSync(salida); n++) salida = join(carpetaSalida, `${base}-${n}.mp4`);
    console.log(`  Montando el vídeo vertical (${Math.round(dur)} s)…`);
    await ejecutar('ffmpeg', argsReel({ entrada, salida, inicio, duracion: dur, conGancho: lineas.length > 0, conSubtitulos: subtitulos, conCredito: !!credito, familia: fuente.familia }), { cwd: tmp });
    writeFileSync(salida.replace(/\.mp4$/, '.txt'), textoPublicacion({ ...(caption ?? { gancho }), credito }), 'utf8');
    return salida;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function tokenPanel() {
  if (process.env.COACH_PANEL_TOKEN) return process.env.COACH_PANEL_TOKEN.trim();
  if (existsSync(ARCHIVO_TOKEN)) return readFileSync(ARCHIVO_TOKEN, 'utf8').trim();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const t = (await rl.question('Contraseña del panel (la de «Crear clave panel.bat»; se guarda en tu usuario): ')).trim();
  rl.close();
  if (!t) throw new Error('Sin contraseña no puedo leer la cola del panel.');
  mkdirSync(join(homedir(), '.coachlolia'), { recursive: true });
  writeFileSync(ARCHIVO_TOKEN, t, { encoding: 'utf8', mode: 0o600 });
  return t;
}

async function modoCola(carpeta, conSubtitulos) {
  if (!existe('yt-dlp', ['--version'])) throw new Error('Falta yt-dlp para bajar los clips de Twitch. Ejecuta «Instalar herramientas de reels.bat».');
  const token = await tokenPanel();
  const r = await fetch(`${PANEL}/admin/panel/api/publicaciones?estado=aprobado`, { headers: { authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new Error(`El panel no acepta la contraseña. Borra ${ARCHIVO_TOKEN} y vuelve a probar.`);
  if (!r.ok) throw new Error(`El panel respondió ${r.status}.`);
  const pendientes = pendientesDeCola((await r.json()).publicaciones);
  if (!pendientes.length) return console.log('No hay reels aprobados con clip de Twitch pendientes. Apruébalos en el panel.');
  for (const p of pendientes) {
    console.log(`\n▶ #${p.id} · ${p.gancho}`);
    const tmp = mkdtempSync(join(tmpdir(), 'clip-'));
    try {
      await ejecutar('yt-dlp', ['-q', '--no-warnings', '-f', 'best[ext=mp4]/best', '-o', join(tmp, 'clip.%(ext)s'), p.origen]);
      const clip = readdirSync(tmp).find((f) => f.startsWith('clip.'));
      if (!clip) throw new Error('yt-dlp no bajó el clip.');
      const salida = await hacerReel({
        entrada: join(tmp, clip),
        carpetaSalida: join(carpeta, 'listos'),
        gancho: p.gancho,
        conSubtitulos,
        nombre: `${p.fecha ?? new Date().toISOString().slice(0, 10)}-${p.id}-${nombreArchivo(p.gancho)}`,
        caption: { gancho: p.gancho, texto: p.texto, hashtags: p.hashtags },
      });
      await fetch(`${PANEL}/admin/panel/api/publicaciones/preparado`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id: p.id, archivo: basename(salida) }),
      });
      console.log(`  ✓ ${salida}`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}

async function modoEntrada(carpeta, conSubtitulos) {
  const entrada = join(carpeta, 'entrada');
  mkdirSync(entrada, { recursive: true });
  mkdirSync(join(carpeta, 'hechos'), { recursive: true });
  const videos = readdirSync(entrada).filter((f) => EXTENSIONES_VIDEO.includes(extname(f).toLowerCase()));
  if (!videos.length) return console.log(`No hay vídeos en ${entrada}. Deja ahí tus grabaciones (y, si quieres, un .txt con el mismo nombre con el gancho en la primera línea).`);
  for (const v of videos) {
    const ruta = join(entrada, v);
    const txt = ruta.replace(/\.[^.]+$/, '.txt');
    const lineas = existsSync(txt) ? readFileSync(txt, 'utf8').split(/\r?\n/) : [];
    // .txt: 1.ª línea gancho; líneas «inicio: 1:20» y «duracion: 30» opcionales; el resto, caption.
    const gancho = lineas[0]?.trim() || ganchoDeNombre(v);
    const inicio = leerTiempo(lineas.find((l) => /^inicio\s*:/i.test(l))?.split(':').slice(1).join(':')) ?? 0;
    const duracion = leerTiempo(lineas.find((l) => /^duraci[oó]n\s*:/i.test(l))?.split(':').slice(1).join(':')) ?? undefined;
    const texto = lineas.slice(1).filter((l) => !/^(inicio|duraci[oó]n)\s*:/i.test(l)).join('\n').trim();
    console.log(`\n▶ ${v}${gancho ? ` · ${gancho}` : ''}`);
    try {
      const salida = await hacerReel({ entrada: ruta, carpetaSalida: join(carpeta, 'listos'), gancho, inicio, duracion, conSubtitulos, caption: { gancho, texto } });
      renameSync(ruta, join(carpeta, 'hechos', v));
      if (existsSync(txt)) renameSync(txt, join(carpeta, 'hechos', basename(txt)));
      console.log(`  ✓ ${salida}`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }
}

async function main() {
  const o = leerArgs(process.argv.slice(2));
  if (o.modo === 'ayuda' || (!o.modo && !o.archivos.length)) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  if (!existe('ffmpeg')) throw new Error('Falta ffmpeg. Ejecuta «Instalar herramientas de reels.bat» y vuelve a probar.');
  const carpeta = resolve(o.carpeta || process.env.REELS_CARPETA || join(homedir(), 'Videos', 'coach-tiktok'));
  const conSubtitulos = !o.sinSubtitulos;
  if (o.modo === 'cola') return modoCola(carpeta, conSubtitulos);
  if (o.modo === 'entrada') return modoEntrada(carpeta, conSubtitulos);
  const inicio = leerTiempo(o.inicio) ?? 0;
  const duracion = leerTiempo(o.duracion) ?? undefined;
  for (const a of o.archivos) {
    const ruta = resolve(a);
    if (!existsSync(ruta)) {
      console.error(`✗ No existe: ${ruta}`);
      continue;
    }
    const gancho = o.gancho ?? ganchoDeNombre(basename(ruta));
    console.log(`\n▶ ${basename(ruta)}${gancho ? ` · ${gancho}` : ''}`);
    const salida = await hacerReel({ entrada: ruta, carpetaSalida: join(carpeta, 'listos'), gancho, credito: o.credito, inicio, duracion, conSubtitulos });
    console.log(`  ✓ ${salida}`);
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exitCode = 1;
});
