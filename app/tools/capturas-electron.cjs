// Proceso principal de capturas (solo herramienta de desarrollo, lo lanza tools/capturas.ts).
// Carga el renderizador compilado en ventanas ocultas de 1280×800 a escala 2 y guarda PNG y WebP.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ANCHO = 1280;
const ALTO = 800;
const ANCHO_WEBP = 1600;
const ESCALA = 2;

const argPlan = process.argv.find((a) => a.startsWith('--coach-plan='));
if (!argPlan) {
  console.error('[capturas] Falta --coach-plan');
  process.exit(1);
}
const rutaPlan = argPlan.slice('--coach-plan='.length);
const plan = JSON.parse(fs.readFileSync(rutaPlan, 'utf8'));

app.commandLine.appendSwitch('force-device-scale-factor', String(ESCALA));
app.commandLine.appendSwitch('high-dpi-support', '1');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Sello «Captura real»: solo existe aquí, se inyecta en la página justo antes de capturar.
const LOGO = `<svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="mc-oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d9a6"/><stop offset=".55" stop-color="#c8aa6e"/><stop offset="1" stop-color="#8a6d3b"/></linearGradient></defs><path d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z" fill="#0a0e1a" stroke="url(#mc-oro)" stroke-width="1.8"/><path d="M21.2 11.6a6.4 6.4 0 1 0 0 8.8" fill="none" stroke="url(#mc-oro)" stroke-width="2.8" stroke-linecap="round"/><path d="M22.6 14.2l1.1 1.8 1.8 1.1-1.8 1.1-1.1 1.8-1.1-1.8-1.8-1.1 1.8-1.1Z" fill="#4f7cff"/></svg>`;
const CSS_CAPTURA = `
.marca-captura {
  position: fixed; right: 14px; bottom: 12px; z-index: 2147483647; pointer-events: none;
  display: flex; align-items: center; gap: 7px; height: 28px; padding: 0 11px 0 6px; border-radius: 999px;
  background: rgba(10, 14, 26, 0.82); border: 1px solid rgba(200, 170, 110, 0.5);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); backdrop-filter: blur(6px);
  font: 600 11.5px Inter, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif; letter-spacing: 0.02em; color: #e8ecf5;
}
.marca-captura.en-titulo { top: 6px; bottom: auto; right: 156px; }
/* En el overlay, abajo a la izquierda: abajo a la derecha está el minimapa (y sus temporizadores). */
.marca-captura.izquierda { right: auto; left: 14px; }
.marca-captura svg { display: block; }
.marca-captura b { color: #c8aa6e; font-weight: 700; }
.captura-fondo { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: #05070d; }
.captura-fondo img { width: 100%; height: 100%; object-fit: cover; object-position: center 25%; filter: blur(2px) brightness(0.5) saturate(1.1); transform: scale(1.04); }
.captura-capa { position: fixed; z-index: -1; display: block; }
.captura-velo { position: absolute; inset: 0;
  background: radial-gradient(120% 90% at 50% 45%, transparent 35%, rgba(3, 5, 10, 0.75) 100%),
              linear-gradient(0deg, rgba(3, 5, 10, 0.7) 0%, transparent 30%); }
`;

// Orden de la barra lateral (BarraLateral.tsx): la quinta entrada es «Premium» o, sin Premium, «Apoya el proyecto».
const INDICE_VISTA = { campeon: 0, campeones: 1, analisis: 2, overlay: 3, ajustes: 4, premium: 5, apoyar: 5, novedades: 6, ayuda: 7 };
/** Clips: 30 fps a 1920 px de ancho, en H.264 sin audio (ffmpeg en FFMPEG o en el PATH). */
const FPS = 30;
const ANCHO_VIDEO = 1920;

/** Espera a que estén cargadas las imágenes visibles y las fuentes. */
async function esperarImagenes(wc) {
  for (let i = 0; i < 60; i++) {
    const listo = await wc.executeJavaScript(`(() => {
      const visibles = Array.from(document.images).filter((im) => {
        const r = im.getBoundingClientRect();
        return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
      });
      return document.fonts.status === 'loaded' && visibles.every((im) => im.complete);
    })()`);
    if (listo) return;
    await espera(250);
  }
  console.warn('[capturas] Aviso: algunas imágenes no terminaron de cargar.');
}

async function aWebp(ventanaConversion, imagen, ancho = ANCHO_WEBP) {
  const pequena = imagen.resize({ width: ancho, quality: 'best' });
  const datos = pequena.toDataURL();
  const webp = await ventanaConversion.webContents.executeJavaScript(`(async () => {
    const im = new Image();
    im.src = ${JSON.stringify(datos)};
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0);
    return c.toDataURL('image/webp', 0.9);
  })()`);
  if (!webp.startsWith('data:image/webp')) return null;
  return Buffer.from(webp.slice(webp.indexOf(',') + 1), 'base64');
}

async function capturar(c, ventanaConversion) {
  const rutaEscena = path.join(path.dirname(rutaPlan), `${c.nombre}.json`);
  fs.writeFileSync(rutaEscena, JSON.stringify(c.escena));
  // Escenas de verificación a otra resolución (p. ej. 1920×1080 o 2560×1440, escala 1).
  const ancho = c.escena.tamano?.ancho ?? ANCHO;
  const alto = c.escena.tamano?.alto ?? ALTO;
  const escala = c.escena.tamano?.escala ?? ESCALA;
  const ventana = new BrowserWindow({
    width: ancho,
    height: alto,
    useContentSize: true,
    show: false,
    frame: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: c.pagina === 'overlay' ? '#05070d' : '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'capturas-preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Renderizado fuera de pantalla: la página pinta y anima de verdad aunque no haya ventana visible.
      offscreen: { deviceScaleFactor: escala },
      additionalArguments: [`--coach-escena=${rutaEscena}`, `--coach-pagina=${c.pagina}`],
    },
  });
  // Sin marco, Windows puede quitar un píxel al ancho pedido: se fija el contenido exacto.
  ventana.setContentSize(ancho, alto);
  ventana.webContents.on('console-message', (e) => {
    if (e.level === 'error') console.error(`[capturas] Consola (${c.nombre}): ${e.message}`);
  });
  await ventana.loadFile(path.join(plan.dirRenderer, c.pagina, 'index.html'));
  const wc = ventana.webContents;
  wc.setFrameRate(30);
  await wc.insertCSS(CSS_CAPTURA);
  await espera(400);

  if (c.pagina === 'principal' && c.vista && c.vista !== 'campeon') {
    await wc.executeJavaScript(`document.querySelectorAll('.nav-entrada')[${INDICE_VISTA[c.vista]}].click()`);
  }
  // Acciones de la escena (p. ej. pulsar la pestaña ARAM), con una pausa para que se pinte cada una.
  for (const accion of c.acciones ?? []) {
    await espera(500);
    await wc.executeJavaScript(accion);
  }
  if (c.pagina === 'overlay') {
    await wc.executeJavaScript(`(() => {
      const f = document.createElement('div');
      f.className = 'captura-fondo';
      const im = document.createElement('img');
      im.src = ${JSON.stringify(c.escena.fondo)};
      const v = document.createElement('div');
      v.className = 'captura-velo';
      f.append(im, v);
      // Fotograma real del juego (verificación 3.0.2): sin desenfoque ni velo, a tamaño exacto.
      if (${JSON.stringify(!!c.escena.fondoNitido)}) {
        Object.assign(im.style, { filter: 'none', transform: 'none', objectFit: 'fill', objectPosition: 'center' });
        v.style.display = 'none';
      }
      document.body.prepend(f);
      const capa = ${JSON.stringify(c.escena.capa ?? null)};
      if (capa) {
        // SVG en línea: la CSP del overlay no deja cargar imágenes data:.
        const m = document.createElement('div');
        m.className = 'captura-capa';
        m.innerHTML = capa.svg;
        Object.assign(m.style, { left: capa.x + 'px', top: capa.y + 'px', width: capa.lado + 'px', height: capa.lado + 'px' });
        const svg = m.querySelector('svg');
        if (svg) Object.assign(svg.style, { width: '100%', height: '100%', display: 'block' });
        f.after(m);
      }
      // Guías de verificación: casillas del HUD (rectángulos discontinuos) donde debería caer la flecha.
      for (const g of ${JSON.stringify(c.escena.guias ?? [])}) {
        const r = document.createElement('div');
        Object.assign(r.style, {
          position: 'fixed', left: g.x + 'px', top: g.y + 'px', width: g.ancho + 'px', height: g.alto + 'px', zIndex: 1,
          border: '1px dashed rgba(120, 200, 255, 0.9)', color: 'rgba(120, 200, 255, 0.95)', font: '700 12px sans-serif',
          display: 'grid', placeItems: 'center', boxSizing: 'border-box', background: 'rgba(20, 40, 70, 0.35)',
        });
        r.textContent = g.texto ?? '';
        f.after(r);
      }
    })()`);
  }
  await espera(300);
  await esperarImagenes(wc);
  // Deja terminar las animaciones de entrada (splash, tarjetas, aviso), sin llegar al desvanecido del aviso.
  await espera(1200);
  await wc.executeJavaScript(`(() => {
    const m = document.createElement('div');
    m.className = ${JSON.stringify(c.pagina === 'principal' ? 'marca-captura en-titulo' : 'marca-captura izquierda')};
    m.innerHTML = ${JSON.stringify(LOGO)} + '<span>Captura real · <b>Coach LoL IA</b></span>';
    document.body.append(m);
  })()`);
  // Una ventana oculta solo repinta si se le pide: se fuerza antes de capturar.
  wc.invalidate();
  await espera(600);

  if (c.video) {
    await grabar(c, wc);
    ventana.destroy();
    return;
  }

  const imagen = await wc.capturePage(undefined, { stayHidden: true });
  const { width, height } = imagen.getSize();
  const png = path.join(plan.salida, `${c.nombre}.png`);
  fs.writeFileSync(png, imagen.toPNG());
  let extra = '';
  const webp = plan.soloPng ? null : await aWebp(ventanaConversion, imagen);
  if (webp) {
    fs.writeFileSync(path.join(plan.salida, `${c.nombre}.webp`), webp);
    extra = ' + .webp';
    // Variante de 800 px para móviles (la web usa srcset con las dos).
    const webp800 = await aWebp(ventanaConversion, imagen, 800);
    if (webp800) {
      fs.writeFileSync(path.join(plan.salida, `${c.nombre}-800.webp`), webp800);
      extra += ' + -800.webp';
    }
  }
  console.log(`[capturas] ${c.nombre}.png (${width}×${height})${extra}`);
  ventana.destroy();
}

/**
 * Clip de vídeo: muestrea lo que pinta la ventana fuera de pantalla a 30 fps durante `c.video.segundos` y lo
 * pasa a ffmpeg (H.264, yuv420p, sin audio). El guion de la escena empieza a la vez que la grabación.
 */
async function grabar(c, wc) {
  let ultimo = null;
  wc.on('paint', (_e, _sucio, imagen) => {
    ultimo = imagen;
  });
  wc.setFrameRate(FPS);
  wc.invalidate();
  await espera(300);
  if (!ultimo) ultimo = await wc.capturePage(undefined, { stayHidden: true });
  const { width, height } = ultimo.getSize();
  const ancho = Math.min(ANCHO_VIDEO, width);
  const alto = Math.round((height * ancho) / width / 2) * 2;
  const salida = path.join(plan.salida, `${c.nombre}.mp4`);
  const ffmpeg = spawn(
    process.env.FFMPEG || 'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${ancho}x${alto}`, '-r', String(FPS), '-i', '-',
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', salida],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const terminado = new Promise((r) => ffmpeg.on('exit', (codigo) => r(codigo)));
  await wc.executeJavaScript('window.coachCaptura && window.coachCaptura.iniciar()');
  const total = Math.round(c.video.segundos * FPS);
  const inicio = Date.now();
  for (let i = 0; i < total; i++) {
    // Un fotograma cada 1/30 s de reloj: si la página no repinta, se repite el último.
    const objetivo = inicio + (i * 1000) / FPS;
    const falta = objetivo - Date.now();
    if (falta > 0) await espera(falta);
    const cuadro = ultimo.resize({ width: ancho, height: alto, quality: 'good' }).toBitmap();
    if (!ffmpeg.stdin.write(cuadro)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  }
  ffmpeg.stdin.end();
  const codigo = await terminado;
  if (codigo !== 0) throw new Error(`ffmpeg terminó con código ${codigo} en ${c.nombre}`);
  console.log(`[capturas] ${c.nombre}.mp4 (${ancho}×${alto}, ${c.video.segundos} s a ${FPS} fps)`);
}

app.whenReady().then(async () => {
  try {
    const conversion = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    await conversion.loadURL('about:blank');
    for (const c of plan.capturas) await capturar(c, conversion);
    conversion.destroy();
    app.exit(0);
  } catch (e) {
    console.error('[capturas] ERROR:', e);
    app.exit(1);
  }
});
