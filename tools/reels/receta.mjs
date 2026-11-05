// Receta de los reels de TikTok de Coach LoL IA: funciones puras (sin tocar disco ni lanzar programas) para que
// se puedan probar. reels.mjs las usa para llamar a ffmpeg. Hecho con ayuda de IA.

export const ANCHO = 1080;
export const ALTO = 1920;
/** TikTok premia los vídeos cortos: si no se dice otra cosa, como mucho 59 s. */
export const DURACION_MAX = 59;
export const ORO = '0xc8aa6e';
export const MARCA = 'coachlolia.com';
export const HASHTAGS_POR_DEFECTO = '#leagueoflegends #lol #coachlol #ia';
export const EXTENSIONES_VIDEO = ['.mp4', '.mkv', '.mov', '.webm', '.flv', '.avi'];

/** Fuentes en negrita que suele haber: la primera que exista se usa para el gancho y los subtítulos. */
export const FUENTES = [
  { archivo: 'C:\\Windows\\Fonts\\arialbd.ttf', familia: 'Arial' },
  { archivo: 'C:\\Windows\\Fonts\\segoeuib.ttf', familia: 'Segoe UI' },
  { archivo: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', familia: 'DejaVu Sans' },
  { archivo: '/System/Library/Fonts/Supplemental/Arial Bold.ttf', familia: 'Arial' },
];

/** Parte el gancho en líneas de como mucho `max` caracteres (3 líneas como mucho; si sobra, se corta con «…»). */
export function envolverTexto(texto, max = 20, maxLineas = 3) {
  const palabras = String(texto ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if (!actual) actual = p;
    else if ((actual + ' ' + p).length <= max) actual += ' ' + p;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const recorte = lineas.slice(0, maxLineas);
    recorte[maxLineas - 1] = recorte[maxLineas - 1].replace(/[\s.,;:!?¿¡]*$/, '') + '…';
    return recorte;
  }
  return lineas;
}

/** «1:20», «01:02:03», «80» o «80.5» → segundos; null si no se entiende. */
export function leerTiempo(v) {
  if (v === undefined || v === null || v === '') return null;
  const t = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Nombre de archivo seguro a partir de un texto: «¡Pentakill de Jinx!» → «pentakill-de-jinx». */
export function nombreArchivo(texto, max = 50) {
  const t = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return t || 'reel';
}

/** Gancho a partir del nombre del archivo, si no se da otro: «Replay 2026-11-05 20-31-07.mp4» no sirve → ''. */
export function ganchoDeNombre(nombre) {
  const base = String(nombre).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  // Los nombres automáticos de OBS («2026-11-05 20 31 07», «Replay 2026…») no son un gancho.
  if (/\d{4} \d{2} \d{2}/.test(base) || /^(replay|grabaci[oó]n|recording|clip)\b/i.test(base)) return '';
  return base;
}

/**
 * Filtro de ffmpeg: fondo con el propio vídeo ampliado y desenfocado, el vídeo entero en el centro, el gancho arriba,
 * la marca abajo y, si hay, los subtítulos quemados encima de la marca. Usa nombres relativos (gancho.txt, fuente.ttf,
 * subs.srt) porque ffmpeg se lanza dentro de la carpeta temporal: así no hay que escapar rutas de Windows.
 */
export function filtroReel({ conGancho, conSubtitulos, conCredito = false, familia }) {
  const pasos = [
    '[0:v]split=2[a][b]',
    `[a]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},boxblur=24:2,eq=brightness=-0.22:saturation=1.15[fondo]`,
    `[b]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=decrease[frente]`,
    '[fondo][frente]overlay=(W-w)/2:(H-h)/2,setsar=1[v0]',
  ];
  let ultimo = 'v0';
  const sig = (n) => {
    const nuevo = `v${n}`;
    const anterior = ultimo;
    ultimo = nuevo;
    return [anterior, nuevo];
  };
  if (conGancho) {
    const [a, b] = sig(1);
    pasos.push(
      `[${a}]drawtext=fontfile=fuente.ttf:textfile=gancho.txt:text_align=C:fontsize=78:fontcolor=white:line_spacing=14:borderw=7:bordercolor=black@0.9:x=(w-text_w)/2:y=230[${b}]`,
    );
  }
  {
    const [a, b] = sig(2);
    pasos.push(`[${a}]drawtext=fontfile=fuente.ttf:text=${MARCA}:fontsize=42:fontcolor=${ORO}:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=h-190[${b}]`);
  }
  if (conCredito) {
    // Mención al autor del vídeo original (p. ej. «Vídeo de @streamer»), encima de la marca.
    const [a, b] = sig(4);
    pasos.push(`[${a}]drawtext=fontfile=fuente.ttf:textfile=credito.txt:fontsize=36:fontcolor=white:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=h-250[${b}]`);
  }
  if (conSubtitulos) {
    const [a, b] = sig(3);
    // En los SRT, libass usa una pantalla de 288 de alto: 15 ≈ 100 px en 1920. MarginV deja sitio a la marca.
    const estilo = `FontName=${familia},FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.6,Shadow=0,Alignment=2,MarginV=${conCredito ? 58 : 48}`;
    pasos.push(`[${a}]subtitles=subs.srt:fontsdir=.:force_style='${estilo}'[${b}]`);
  }
  return { filtro: pasos.join(';'), salida: ultimo };
}

/** Argumentos de ffmpeg para hacer el reel. `entrada` y `salida` son rutas absolutas. */
export function argsReel({ entrada, salida, inicio = 0, duracion = DURACION_MAX, conGancho, conSubtitulos, conCredito = false, familia }) {
  const { filtro, salida: etiqueta } = filtroReel({ conGancho, conSubtitulos, conCredito, familia });
  return [
    '-hide_banner', '-loglevel', 'error', '-stats', '-y',
    ...(inicio > 0 ? ['-ss', String(inicio)] : []),
    '-i', entrada,
    '-t', String(duracion),
    '-filter_complex', filtro,
    '-map', `[${etiqueta}]`, '-map', '0:a?',
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart',
    salida,
  ];
}

/** Argumentos de ffmpeg para sacar el audio del tramo (mono, 16 kHz) que se pasa a Whisper. */
export function argsAudio({ entrada, salida, inicio = 0, duracion = DURACION_MAX }) {
  return ['-hide_banner', '-loglevel', 'error', '-y', ...(inicio > 0 ? ['-ss', String(inicio)] : []), '-i', entrada, '-t', String(duracion), '-vn', '-ac', '1', '-ar', '16000', salida];
}

/** Texto para pegar en TikTok: caption y hashtags. */
export function textoPublicacion({ gancho, texto, hashtags, credito }) {
  const partes = [];
  if (texto) partes.push(texto.trim());
  else if (gancho) partes.push(gancho.trim());
  if (credito) partes.push(`🎥 ${credito.trim()}`);
  partes.push((hashtags || HASHTAGS_POR_DEFECTO).trim());
  return partes.join('\n\n') + '\n';
}

/** De la cola del panel, las que hay que hacer: aprobadas, con un clip de Twitch como material y sin vídeo hecho. */
export function pendientesDeCola(publicaciones) {
  return (publicaciones ?? []).filter(
    (p) => p.estado === 'aprobado' && typeof p.origen === 'string' && /^https:\/\/(clips\.twitch\.tv|www\.twitch\.tv\/[^/]+\/clip)\//.test(p.origen) && !String(p.nota ?? '').startsWith('Vídeo listo'),
  );
}
