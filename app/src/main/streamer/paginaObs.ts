/*
 * 3.8: página de la fuente para OBS (Fuente de navegador, 1920×1080, fondo transparente). Sin React ni dependencias:
 * HTML, CSS y JS propios, servidos por el servidor local. El JS solo pinta con textContent (nunca HTML recibido) y se
 * actualiza en vivo por SSE (`eventos`); si el navegador no tiene EventSource, pregunta `estado` cada segundo.
 * Las rutas son relativas: la página vive en /<token>/ y todo cuelga de ahí.
 */

export const HTML_OBS = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Coach LoL IA · OBS</title>
<link rel="stylesheet" href="estilo.css">
<script src="app.js" defer></script>
</head>
<body>
<main id="raiz">
  <ul id="objetivos" class="objetivos" hidden></ul>
  <section id="aumentos" class="aumentos" hidden></section>
  <p id="subtitulo" class="subtitulo" hidden aria-live="polite"></p>
</main>
</body>
</html>
`;

export const CSS_OBS = `html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
body { width: 100vw; height: 100vh; font-family: "Segoe UI", system-ui, sans-serif; color: #f0e6d2; }
[hidden] { display: none !important; }
#raiz { position: relative; width: 100%; height: 100%; }
.objetivos { position: absolute; top: 2.2vh; left: 50%; transform: translateX(-50%); display: flex; gap: 0.6vw; list-style: none; margin: 0; padding: 0.6vh 0.8vw; background: rgba(1, 10, 19, 0.72); border: 1px solid rgba(200, 170, 110, 0.55); border-radius: 999px; }
.obj { display: flex; align-items: center; gap: 0.45vw; padding: 0.3vh 0.6vw; border-radius: 999px; font-size: 1.55vh; white-space: nowrap; }
.obj .punto { width: 1.1vh; height: 1.1vh; border-radius: 50%; background: #785a28; box-shadow: 0 0 0 2px rgba(200, 170, 110, 0.35); }
.obj .nombre { opacity: 0.85; }
.obj .tiempo { font-variant-numeric: tabular-nums; font-weight: 700; color: #f0e6d2; }
.obj.pronto .punto { background: #c8aa6e; animation: latir 1s ease-in-out infinite; }
.obj.pronto .tiempo { color: #f5d77a; }
.obj.disponible .punto { background: #0ac8b9; box-shadow: 0 0 8px #0ac8b9; }
.obj.disponible .tiempo { color: #0ac8b9; }
.obj.enemigo .punto { background: #d13639; }
.obj.aliado .punto { background: #0397ab; }
@keyframes latir { 50% { transform: scale(1.35); } }
.aumentos { position: absolute; top: 12vh; left: 1.5vw; width: 30vw; padding: 1.2vh 1vw; background: rgba(1, 10, 19, 0.82); border: 1px solid rgba(200, 170, 110, 0.55); border-radius: 10px; font-size: 1.4vh; }
.aumentos h2 { margin: 0 0 0.8vh; font-size: 1.7vh; color: #c8aa6e; }
.aumentos h3 { margin: 0 0 0.4vh; font-size: 1.3vh; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
.columnas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6vw; }
.aumentos ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4vh; }
.aum { display: flex; align-items: center; gap: 0.4vw; }
.aum img { width: 2.6vh; height: 2.6vh; border-radius: 4px; }
.tier { display: inline-grid; place-items: center; min-width: 2vh; height: 2vh; border-radius: 4px; font-weight: 800; font-size: 1.2vh; background: #3c3c41; }
.tier-S { background: #c8aa6e; color: #010a13; }
.tier-A { background: #0397ab; color: #010a13; }
.tier-B { background: #5b5a56; }
.combos { margin-top: 1vh; display: grid; gap: 0.5vh; }
.combo ol { display: flex; flex-wrap: wrap; gap: 0.3vw; }
.pie { margin: 1vh 0 0; font-size: 1.1vh; opacity: 0.65; }
.subtitulo { position: absolute; left: 50%; bottom: 7vh; transform: translateX(-50%); max-width: 70vw; margin: 0; padding: 0.8vh 1.4vw; background: rgba(1, 10, 19, 0.8); border-radius: 8px; font-size: 2.6vh; font-weight: 600; text-align: center; text-shadow: 0 1px 2px #000; }
`;

export const JS_OBS = `(() => {
  'use strict';
  const DURACION_SUBTITULO_MS = 7000;
  const $ = (id) => document.getElementById(id);
  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  };
  let ultimaFrase = 0;
  let temporizador = null;

  function aumento(a) {
    const li = crear('li', 'aum');
    if (a.icono) {
      const img = document.createElement('img');
      img.src = a.icono;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      li.append(img);
    }
    li.append(crear('b', 'tier tier-' + a.tier, a.tier), crear('span', 'nombre', a.nombre));
    return li;
  }

  function pintar(v) {
    if (!v || typeof v !== 'object') return;
    const lista = $('objetivos');
    lista.replaceChildren(...(v.objetivos || []).map((o) => {
      const li = crear('li', 'obj obj-' + o.id + (o.pronto ? ' pronto' : '') + (o.disponible ? ' disponible' : '') + (o.lado ? ' ' + o.lado : ''));
      li.append(crear('span', 'punto'), crear('span', 'nombre', o.texto), crear('span', 'tiempo', o.tiempo));
      return li;
    }));
    lista.hidden = !(v.objetivos && v.objetivos.length);
    lista.setAttribute('aria-label', (v.etiquetas && v.etiquetas.objetivos) || '');

    const panel = $('aumentos');
    const a = v.aumentos;
    if (a) {
      const columnas = crear('div', 'columnas');
      for (const c of a.columnas) {
        const col = crear('div', 'columna rareza-' + c.rareza);
        const ol = crear('ol');
        ol.append(...c.aumentos.map(aumento));
        col.append(crear('h3', '', c.titulo), ol);
        columnas.append(col);
      }
      const hijos = [crear('h2', '', a.titulo), columnas];
      if (a.combos.length) {
        const combos = crear('div', 'combos');
        for (const c of a.combos) {
          const div = crear('div', 'combo');
          const ol = crear('ol');
          ol.append(...c.aumentos.map(aumento));
          div.append(crear('h3', '', c.titulo), ol);
          combos.append(div);
        }
        hijos.push(combos);
      }
      hijos.push(crear('p', 'pie', a.pie));
      panel.replaceChildren(...hijos);
    }
    panel.hidden = !a;

    const sub = $('subtitulo');
    const s = v.subtitulo;
    if (!s) {
      sub.hidden = true;
    } else if (s.id !== ultimaFrase) {
      ultimaFrase = s.id;
      sub.textContent = s.texto;
      sub.hidden = false;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { sub.hidden = true; }, DURACION_SUBTITULO_MS);
    }
  }

  function sondear() {
    fetch('estado', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(pintar).catch(() => undefined);
  }

  if (typeof EventSource === 'function') {
    const fuente = new EventSource('eventos');
    fuente.onmessage = (e) => { try { pintar(JSON.parse(e.data)); } catch (_) { /* dato roto: se ignora */ } };
  } else {
    sondear();
    setInterval(sondear, 1000);
  }
})();
`;
