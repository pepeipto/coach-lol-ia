// Proceso principal de capturas (solo herramienta de desarrollo, lo lanza tools/capturas.ts).
// Carga el renderizador compilado en ventanas ocultas de 1280×800 a escala 2 y guarda PNG y WebP.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

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
.marca-captura svg { display: block; }
.marca-captura b { color: #c8aa6e; font-weight: 700; }
.captura-fondo { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: #05070d; }
.captura-fondo img { width: 100%; height: 100%; object-fit: cover; object-position: center 25%; filter: blur(2px) brightness(0.5) saturate(1.1); transform: scale(1.04); }
.captura-velo { position: absolute; inset: 0;
  background: radial-gradient(120% 90% at 50% 45%, transparent 35%, rgba(3, 5, 10, 0.75) 100%),
              linear-gradient(0deg, rgba(3, 5, 10, 0.7) 0%, transparent 30%); }
`;

const INDICE_VISTA = { campeon: 0, overlay: 1, ajustes: 2, premium: 3 };

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

async function aWebp(ventanaConversion, imagen) {
  const pequena = imagen.resize({ width: ANCHO_WEBP, quality: 'best' });
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
  const ventana = new BrowserWindow({
    width: ANCHO,
    height: ALTO,
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
      offscreen: { deviceScaleFactor: ESCALA },
      additionalArguments: [`--coach-escena=${rutaEscena}`, `--coach-pagina=${c.pagina}`],
    },
  });
  // Sin marco, Windows puede quitar un píxel al ancho pedido: se fija el contenido exacto.
  ventana.setContentSize(ANCHO, ALTO);
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
  if (c.pagina === 'overlay') {
    await wc.executeJavaScript(`(() => {
      const f = document.createElement('div');
      f.className = 'captura-fondo';
      const im = document.createElement('img');
      im.src = ${JSON.stringify(c.escena.fondo)};
      const v = document.createElement('div');
      v.className = 'captura-velo';
      f.append(im, v);
      document.body.prepend(f);
    })()`);
  }
  await espera(300);
  await esperarImagenes(wc);
  // Deja terminar las animaciones de entrada (splash, tarjetas, aviso), sin llegar al desvanecido del aviso.
  await espera(1200);
  await wc.executeJavaScript(`(() => {
    const m = document.createElement('div');
    m.className = ${JSON.stringify(c.pagina === 'principal' ? 'marca-captura en-titulo' : 'marca-captura')};
    m.innerHTML = ${JSON.stringify(LOGO)} + '<span>Captura real · <b>Coach LoL IA</b></span>';
    document.body.append(m);
  })()`);
  // Una ventana oculta solo repinta si se le pide: se fuerza antes de capturar.
  wc.invalidate();
  await espera(600);

  const imagen = await wc.capturePage(undefined, { stayHidden: true });
  const { width, height } = imagen.getSize();
  const png = path.join(plan.salida, `${c.nombre}.png`);
  fs.writeFileSync(png, imagen.toPNG());
  let extra = '';
  const webp = await aWebp(ventanaConversion, imagen);
  if (webp) {
    fs.writeFileSync(path.join(plan.salida, `${c.nombre}.webp`), webp);
    extra = ' + .webp';
  }
  console.log(`[capturas] ${c.nombre}.png (${width}×${height})${extra}`);
  ventana.destroy();
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
