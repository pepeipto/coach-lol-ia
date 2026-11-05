import { PLANES, formatearEuros, type IdPlan } from '@coach/shared';
import type { DatosPanel } from './datos';
import { ESTADOS, NOMBRE_PLATAFORMA, PLATAFORMAS, type EstadoPublicacion, type Publicacion } from './publicaciones';
import type { PanelTwitch } from './twitch';

/*
 * HTML del panel privado. Sin JavaScript (la CSP lo prohíbe): las gráficas son SVG y barras de CSS, y cada barra
 * lleva su cifra en un <title> (se ve al pasar el ratón) y en una tabla.
 */

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** «12.345» (el formato es-ES no agrupa los números de 4 cifras). */
const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pct = (x: number, dec: number) => x.toFixed(dec).replace('.', ',');
const nombrePlan = (p: string) => (p in PLANES ? PLANES[p as IdPlan].nombre : p);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesCorto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

const ESTILOS = `
:root{--fondo:#0a0e1a;--panel:#121a33;--borde:#26314d;--texto:#e8ecf5;--suave:#8b97b8;--oro:#c8aa6e;--ok:#2fbf71;--mal:#ef5b5b;--aviso:#e8a23a}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--fondo);color:var(--texto);font-size:14px}
main{max-width:1100px;margin:0 auto;padding:20px 16px 40px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
h1{font-size:22px;margin:0;color:var(--oro)}h2{font-size:16px;margin:28px 0 10px;color:var(--oro)}h3{font-size:13px;margin:0 0 8px;color:var(--suave);font-weight:600}
.sub{color:var(--suave);font-size:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tile{background:var(--panel);border:1px solid var(--borde);border-radius:10px;padding:12px 14px}
.tile b{display:block;font-size:24px;margin-top:4px;font-variant-numeric:tabular-nums}.tile span{color:var(--suave);font-size:12px}
.caja{background:var(--panel);border:1px solid var(--borde);border-radius:10px;padding:14px;margin-top:10px;overflow-x:auto}
.dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--borde);white-space:nowrap}
th{color:var(--suave);font-weight:600;font-size:12px}td.n,th.n{text-align:right}
.barra{display:grid;grid-template-columns:minmax(90px,170px) 1fr 60px;gap:8px;align-items:center;margin:5px 0}
.barra i{display:block;height:12px;background:var(--oro);border-radius:0 4px 4px 0;min-width:2px}.barra span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.barra em{font-style:normal;text-align:right;color:var(--texto)}
.estado-activa{color:var(--ok)}.estado-cancelada,.estado-caducada{color:var(--suave)}.estado-impagada{color:var(--mal)}
svg text{fill:var(--suave);font-size:10px}
form.fila{display:grid;grid-template-columns:2fr 1.4fr 1fr repeat(4,.8fr) auto;gap:6px;align-items:end}
@media (max-width:760px){form.fila{grid-template-columns:1fr 1fr}}
label{font-size:11px;color:var(--suave);display:block}input{width:100%;padding:8px;border-radius:6px;border:1px solid var(--borde);background:var(--fondo);color:var(--texto);font-size:14px}
button{padding:9px 14px;border:0;border-radius:6px;background:var(--oro);color:#1a1406;font-weight:700;cursor:pointer}
button.sec{background:transparent;color:var(--suave);border:1px solid var(--borde);font-weight:400;padding:4px 8px}
.vacio{color:var(--suave);font-style:italic}footer{margin-top:36px;color:var(--suave);font-size:11px;text-align:center}
a{color:var(--oro)}
textarea,select{width:100%;padding:8px;border-radius:6px;border:1px solid var(--borde);background:var(--fondo);color:var(--texto);font:inherit;font-size:14px}
.tile .directo,.directo{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;background:var(--mal);color:#fff}
.tile .apagado,.apagado{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:var(--borde);color:var(--suave)}
.clips{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.clip{background:var(--fondo);border:1px solid var(--borde);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}
.clip b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cola{display:grid;gap:10px}
.pub{background:var(--fondo);border:1px solid var(--borde);border-left:4px solid var(--borde);border-radius:8px;padding:10px 12px}
.pub.e-aprobado{border-left-color:var(--ok)}.pub.e-preparado{border-left-color:var(--aviso)}.pub.e-idea{border-left-color:var(--oro)}.pub.e-publicado,.pub.e-descartado{opacity:.6}
.pub h4{margin:0 0 4px;font-size:14px}.pub p{margin:4px 0;white-space:pre-wrap}.pub details{margin-top:4px}.pub summary{cursor:pointer;color:var(--suave);font-size:12px}
.acciones{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}.acciones form{display:flex;gap:6px;align-items:center}
.acciones input{width:220px;padding:4px 8px;font-size:12px}
.chip{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;border:1px solid var(--borde);color:var(--suave);margin-right:4px}
form.pubnueva{display:grid;grid-template-columns:1fr 1fr 1fr .7fr;gap:8px}form.pubnueva .ancho{grid-column:1/-1}
@media (max-width:760px){form.pubnueva{grid-template-columns:1fr 1fr}}
`;

/** Cada cuánto se recarga sola la página del panel (sin JavaScript: <meta http-equiv="refresh">). */
export const AUTO_REFRESCO_S = 120;

const marco = (titulo: string, cuerpo: string, refresco = '') => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refresco}
<meta name="robots" content="noindex,nofollow"><title>${esc(titulo)} · Coach LoL IA</title><style>${ESTILOS}</style></head>
<body>${cuerpo}</body></html>`;

export function paginaEntrar(mensaje = ''): string {
  return marco(
    'Panel',
    `<main style="max-width:400px;margin-top:12vh"><div class="caja">
<h1>Panel de Coach LoL IA</h1><p class="sub">Solo para el administrador. Usa la misma contraseña que en la página de la clave de Riot.</p>
<form method="post" action="/admin/panel/entrar" autocomplete="off">
<label for="token">Contraseña de administrador</label><input id="token" name="token" type="password" required autocomplete="current-password">
<p><button type="submit">Entrar</button></p></form>
${mensaje ? `<p class="estado-impagada" role="status">${esc(mensaje)}</p>` : ''}
</div><footer>Hecho con ayuda de IA</footer></main>`,
  );
}

const tile = (etiqueta: string, valor: string, nota = '') => `<div class="tile"><span>${esc(etiqueta)}</span><b>${valor}</b>${nota ? `<span>${esc(nota)}</span>` : ''}</div>`;

function barras(filas: { etiqueta: string; n: number }[], vacio: string): string {
  if (!filas.length || filas.every((f) => f.n === 0)) return `<p class="vacio">${esc(vacio)}</p>`;
  const max = Math.max(...filas.map((f) => f.n), 1);
  return filas
    .map((f) => `<div class="barra"><span>${esc(f.etiqueta)}</span><i style="width:${((f.n / max) * 100).toFixed(1)}%" title="${esc(f.etiqueta)}: ${num(f.n)}"></i><em>${num(f.n)}</em></div>`)
    .join('');
}

/** Columnas por día (una sola serie): visitantes de los últimos 30 días. */
function columnasDias(porDia: { dia: string; visitantes: number; visitas: number }[]): string {
  const an = 720, al = 160, abajo = 18, arriba = 14;
  const max = Math.max(...porDia.map((d) => d.visitantes), 1);
  const paso = an / porDia.length;
  const ancho = Math.max(2, paso - 2);
  const cols = porDia
    .map((d, i) => {
      const h = Math.round((d.visitantes / max) * (al - abajo - arriba));
      const x = (i * paso + 1).toFixed(1);
      const y = al - abajo - h;
      // Barra con la punta redondeada y la base recta, apoyada en el eje.
      const r = Math.min(4, h / 2, ancho / 2);
      const camino = h > 0 ? `M${x},${al - abajo}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${(ancho - 2 * r).toFixed(1)}a${r},${r} 0 0 1 ${r},${r}v${h - r}z` : '';
      const etiqueta = `${d.dia}: ${num(d.visitantes)} visitantes, ${num(d.visitas)} páginas vistas`;
      return `<g><title>${esc(etiqueta)}</title><rect x="${x}" y="${arriba}" width="${paso.toFixed(1)}" height="${al - abajo - arriba}" fill="transparent"/>${camino ? `<path d="${camino}" fill="#c8aa6e"/>` : ''}${(i % 7 === 0 && i < porDia.length - 4) || i === porDia.length - 1 ? `<text x="${x}" y="${al - 4}">${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}</text>` : ''}</g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${an} ${al}" width="100%" role="img" aria-label="Visitantes por día, últimos 30 días">
<line x1="0" x2="${an}" y1="${al - abajo}" y2="${al - abajo}" stroke="#26314d"/><text x="0" y="10">máx. ${num(max)}</text>${cols}</svg>`;
}

export function paginaPanel(d: DatosPanel, mensaje = '', auto = true): string {
  const s = d.suscripciones;
  const u = d.uso;
  const w = d.web;
  const t = d.tiktok;
  const ultimaSeguidores = t.seguidores.at(-1);
  const ingresosPaquetes = u.paquetes.reduce((a, p) => a + p.centimos, 0);

  const cuerpo = `<main>
<header><div><h1>Panel de Coach LoL IA</h1><div class="sub">Actualizado ${esc(d.generado.slice(0, 16).replace('T', ' '))} UTC · ${auto ? `se actualiza sola cada ${AUTO_REFRESCO_S / 60} minutos · <a href="/admin/panel?auto=0">pausar</a> (para escribir sin prisas)` : 'actualización automática en pausa · <a href="/admin/panel">reanudar</a>'}</div></div>
<form method="post" action="/admin/panel/salir"><button class="sec" type="submit">Salir</button></form></header>
${mensaje ? `<div class="caja" role="status">${esc(mensaje)}</div>` : ''}

<h2>Resumen</h2>
<div class="tiles">
${tile('Suscripciones activas', num(s.activas))}
${tile('Ingresos al mes (estimado)', esc(formatearEuros(s.centimosMes)), 'precio de catálogo, sin comisiones')}
${tile('Usuarios con IA (31 días)', num(u.porPlan.reduce((a, p) => a + p.usuarios, 0)))}
${tile('Visitantes web (30 días)', num(w.visitantes30))}
${tile('Desde TikTok (30 días)', num(t.visitantesDesdeTiktok30), 'visitantes')}
${tile('Descargas de la app', d.descargasGithub === null ? '—' : num(d.descargasGithub), `${num(w.clicsDescarga30)} clics en «Descargar» en 30 días`)}
</div>

<h2>Suscripciones</h2>
<div class="dos">
<div class="caja"><h3>Por plan</h3><table><thead><tr><th>Plan</th><th class="n">Activas</th><th class="n">Canceladas</th><th class="n">Impagadas</th><th class="n">€/mes</th></tr></thead><tbody>
${s.porPlan.map((p) => `<tr><td>${esc(nombrePlan(p.plan))} <span class="sub">${esc(formatearEuros(PLANES[p.plan].centimosMes))}</span></td><td class="n">${num(p.activas)}</td><td class="n">${num(p.canceladas)}</td><td class="n">${num(p.impagadas)}</td><td class="n">${esc(formatearEuros(p.centimosMes))}</td></tr>`).join('')}
</tbody></table>
<p class="sub">Vitalicias: ${num(s.vitalicias)} · Pruebas activas: ${num(s.pruebasActivas)} de ${num(s.pruebasTotal)} creadas<br>
Duración media de las canceladas: ${s.duracionMediaCanceladas === null ? '—' : `${num(s.duracionMediaCanceladas)} días`} · Antigüedad media de las activas: ${s.antiguedadMediaActivas === null ? '—' : `${num(s.antiguedadMediaActivas)} días`}</p></div>
<div class="caja"><h3>Por mes</h3><table><thead><tr><th>Mes</th><th class="n">Altas</th><th class="n">Bajas</th><th class="n">Pruebas</th><th class="n">Equipos nuevos (gratis)</th></tr></thead><tbody>
${s.porMes.map((m, i) => `<tr><td>${esc(mesCorto(m.mes))}</td><td class="n">${num(m.altas)}</td><td class="n">${num(m.bajas)}</td><td class="n">${num(m.pruebas)}</td><td class="n">${num(u.dispositivosNuevosPorMes[i]?.n ?? 0)}</td></tr>`).join('')}
</tbody></table><p class="sub">Equipos con la app (sin licencia) vistos alguna vez: ${num(u.dispositivosTotal)}</p></div>
</div>
<div class="caja"><h3>Licencias más recientes</h3>
${s.recientes.length ? `<table><thead><tr><th>Clave</th><th>Tipo</th><th>Plan</th><th>Estado</th><th>Alta</th><th>Renueva</th><th class="n">Días</th><th class="n">Partidas IA</th><th class="n">Preguntas</th><th>Nota</th></tr></thead><tbody>
${s.recientes.map((l) => `<tr><td><code>${esc(l.clave)}</code></td><td>${esc(l.tipo)}</td><td>${esc(nombrePlan(l.plan))}</td><td class="estado-${esc(l.estado)}">${esc(l.estado)}</td><td>${esc(l.alta)}</td><td>${esc(l.renuevaEn ?? '—')}</td><td class="n">${num(l.dias)}</td><td class="n">${num(l.partidas)}</td><td class="n">${num(l.preguntas)}</td><td>${esc(l.nota ?? '')}</td></tr>`).join('')}
</tbody></table><p class="sub">Cada usuario de pago se identifica por su clave CLIA (aquí con el centro tapado). Partidas y preguntas: uso de su cuota en los últimos 31 días.</p>` : '<p class="vacio">Todavía no hay licencias.</p>'}</div>

<h2>Uso del coach con IA</h2>
<div class="dos">
<div class="caja"><h3>Últimos 31 días, por plan</h3><table><thead><tr><th>Plan</th><th class="n">Usuarios</th><th class="n">Partidas</th><th class="n">Preguntas</th><th class="n">En el tope</th></tr></thead><tbody>
${u.porPlan.map((p) => `<tr><td>${esc(nombrePlan(p.plan))}</td><td class="n">${num(p.usuarios)}</td><td class="n">${num(p.partidas)}</td><td class="n">${num(p.preguntas)}</td><td class="n">${num(p.enElTope)}</td></tr>`).join('')}
</tbody></table><p class="sub">«En el tope»: usuarios que gastaron toda su cuota de partidas o de preguntas; buenos candidatos a subir de plan.</p></div>
<div class="caja"><h3>Paquetes de partidas</h3><table><thead><tr><th>Paquete</th><th class="n">Vendidos</th><th class="n">30 días</th><th class="n">Ingresos</th></tr></thead><tbody>
${u.paquetes.map((p) => `<tr><td>${num(p.partidas)} partidas</td><td class="n">${num(p.total)}</td><td class="n">${num(p.ultimos30)}</td><td class="n">${esc(formatearEuros(p.centimos))}</td></tr>`).join('')}
</tbody></table><p class="sub">Total en paquetes: ${esc(formatearEuros(ingresosPaquetes))} · Partidas compradas sin gastar: ${num(u.saldoPendiente)}</p>
<h3 style="margin-top:14px">Peticiones de IA, últimos 7 días</h3>${barras(u.iaPorTipo.map((f) => ({ etiqueta: f.tipo, n: f.n })), 'Sin peticiones de IA en los últimos 7 días.')}</div>
</div>

<h2>Web</h2>
<div class="tiles">
${tile('Visitantes (30 días)', num(w.visitantes30))}
${tile('Páginas vistas (30 días)', num(w.visitas30))}
${tile('Clics en «Descargar»', num(w.clicsDescarga30), '30 días')}
${tile('Tarjetas compartidas', num(w.tarjetas30), '30 días, desde la app')}
</div>
<div class="caja"><h3>Visitantes por día</h3>${w.visitas30 ? columnasDias(w.porDia) : '<p class="vacio">Aún no hay visitas contadas. El contador empieza cuando se publique la web con esta versión.</p>'}</div>
<div class="dos">
<div class="caja"><h3>De dónde llegan (visitantes, 30 días)</h3>${barras(w.porOrigen.map((o) => ({ etiqueta: o.origen, n: o.n })), 'Sin datos todavía.')}
<p class="sub">«directo»: sin página de procedencia (enlace escrito o desde una app). Pon <code>?utm_source=tiktok</code> en el enlace de la bio para que las visitas desde la app de TikTok cuenten como TikTok.</p></div>
<div class="caja"><h3>Páginas más vistas (30 días)</h3>${barras(w.paginas.map((p) => ({ etiqueta: p.ruta, n: p.n })), 'Sin datos todavía.')}</div>
</div>

<h2>TikTok</h2>
<div class="tiles">
${tile('Vídeos apuntados', num(t.videos.length))}
${tile('Vistas totales', num(t.vistas))}
${tile('Me gusta', num(t.megusta))}
${tile('Seguidores', ultimaSeguidores ? num(ultimaSeguidores.n) : '—', ultimaSeguidores ? `a ${ultimaSeguidores.dia}` : 'apúntalos abajo')}
${tile('Visitantes web desde TikTok', num(t.visitantesDesdeTiktok30), t.vistas ? `${pct((t.visitantesDesdeTiktok30 / Math.max(t.vistas, 1)) * 100, 2)} % de las vistas` : '30 días')}
</div>
<div class="caja"><h3>Apuntar o actualizar un vídeo</h3>
<form class="fila" method="post" action="/admin/panel/tiktok" autocomplete="off">
<div><label for="url">Enlace del vídeo</label><input id="url" name="url" required placeholder="https://www.tiktok.com/@…/video/…"></div>
<div><label for="titulo">Título</label><input id="titulo" name="titulo" maxlength="120"></div>
<div><label for="publicado">Publicado</label><input id="publicado" name="publicado" type="date" required></div>
<div><label for="vistas">Vistas</label><input id="vistas" name="vistas" inputmode="numeric" required></div>
<div><label for="megusta">Me gusta</label><input id="megusta" name="megusta" inputmode="numeric"></div>
<div><label for="comentarios">Coment.</label><input id="comentarios" name="comentarios" inputmode="numeric"></div>
<div><label for="compartidos">Compart.</label><input id="compartidos" name="compartidos" inputmode="numeric"></div>
<div><button type="submit">Guardar</button></div>
</form><p class="sub">Si el enlace ya está, se actualizan sus cifras. Vale «12,3 mil», «1,2K» o «12.345», como lo muestra TikTok.</p>
<form class="fila" style="grid-template-columns:1fr 1fr auto;max-width:460px" method="post" action="/admin/panel/seguidores">
<div><label for="dia">Día</label><input id="dia" name="dia" type="date" required value="${esc(d.generado.slice(0, 10))}"></div>
<div><label for="seguidores">Seguidores</label><input id="seguidores" name="seguidores" inputmode="numeric" required></div>
<div><button type="submit">Guardar</button></div></form></div>
<div class="caja">${t.videos.length ? `<table><thead><tr><th>Publicado</th><th>Vídeo</th><th class="n">Vistas</th><th class="n">Me gusta</th><th class="n">Coment.</th><th class="n">Compart.</th><th class="n">Interacción</th><th>Actualizado</th><th></th></tr></thead><tbody>
${t.videos.map((v) => `<tr><td>${esc(v.publicado)}</td><td><a href="${esc(v.url)}" rel="noreferrer" target="_blank">${esc(v.titulo || v.url.split('/').pop())}</a></td><td class="n">${num(v.vistas)}</td><td class="n">${num(v.megusta)}</td><td class="n">${num(v.comentarios)}</td><td class="n">${num(v.compartidos)}</td><td class="n">${v.vistas ? pct(((v.megusta + v.comentarios + v.compartidos) / v.vistas) * 100, 1) : '0'} %</td><td class="sub">${esc(v.actualizado.slice(0, 10))}</td><td><form method="post" action="/admin/panel/tiktok/borrar"><input type="hidden" name="url" value="${esc(v.url)}"><button class="sec" type="submit" title="Quitar del panel">Quitar</button></form></td></tr>`).join('')}
</tbody></table><p class="sub">Interacción: (me gusta + comentarios + compartidos) / vistas.</p>` : '<p class="vacio">Todavía no hay vídeos apuntados.</p>'}</div>

${seccionTwitch(d.twitch)}

${seccionPublicaciones(d)}

<footer>Panel privado de Coach LoL IA · Hecho con ayuda de IA</footer>
</main>`;
  return marco('Panel', cuerpo, auto ? `<meta http-equiv="refresh" content="${AUTO_REFRESCO_S};url=/admin/panel">` : '');
}

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function seccionTwitch(tw: PanelTwitch): string {
  if (tw.estado === 'sin_configurar') {
    return `<h2>Twitch</h2><div class="caja"><p class="vacio">Twitch no está conectado todavía.</p>
<p class="sub">Crea una aplicación en <a href="https://dev.twitch.tv/console/apps" rel="noreferrer" target="_blank">dev.twitch.tv</a> (URL de redirección: <code>http://localhost</code>, categoría «Website Integration») y guarda en el servidor <code>TWITCH_CLIENT_ID</code>, <code>TWITCH_CLIENT_SECRET</code> y, si no es crazylovers, <code>TWITCH_CANAL</code>. Solo lee datos públicos del canal: no puede cambiar nada en él.</p></div>`;
  }
  if (tw.estado === 'error') return `<h2>Twitch</h2><div class="caja"><p class="estado-impagada">${esc(tw.mensaje)}</p></div>`;
  const minutos = tw.desde ? Math.max(0, Math.round((Date.parse(tw.consultado) - Date.parse(tw.desde)) / 60_000)) : 0;
  const vistasClips = tw.clips.reduce((a, c) => a + c.vistas, 0);
  return `<h2>Twitch · <a href="https://www.twitch.tv/${esc(tw.canal)}" rel="noreferrer" target="_blank">${esc(tw.nombre)}</a></h2>
<div class="tiles">
${tile('Ahora', tw.enDirecto ? '<span class="directo">EN DIRECTO</span>' : '<span class="apagado">Sin directo</span>', tw.enDirecto ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : '')}
${tile('Espectadores', tw.enDirecto ? num(tw.espectadores) : '—')}
${tile('Clips (30 días)', num(tw.clips.length), `${num(vistasClips)} vistas`)}
${tile('Últimos directos', num(tw.videos.length), tw.videos[0] ? `el último, ${fechaCorta(tw.videos[0].creado)}` : '')}
</div>
<div class="caja"><h3>Título y categoría</h3><p>${esc(tw.titulo) || '<span class="vacio">Sin título</span>'} <span class="chip">${esc(tw.juego || 'sin categoría')}</span></p>
<p class="sub">Se cambian en el gestor de directos de Twitch. Datos de hace como mucho 2 minutos.</p></div>
<div class="caja"><h3>Clips más vistos (30 días) · material para reels</h3>
${tw.clips.length ? `<div class="clips">${tw.clips
    .map(
      (c) => `<div class="clip"><b title="${esc(c.titulo)}"><a href="${esc(c.url)}" rel="noreferrer" target="_blank">${esc(c.titulo || 'Clip')}</a></b>
<span class="sub">${num(c.vistas)} vistas · ${c.segundos} s · ${fechaCorta(c.creado)}</span>
<form method="post" action="/admin/panel/publicaciones"><input type="hidden" name="plataforma" value="tiktok"><input type="hidden" name="estado" value="idea">
<input type="hidden" name="gancho" value="${esc(c.titulo || 'Clip de Twitch')}"><input type="hidden" name="origen" value="${esc(c.url)}"><input type="hidden" name="hashtags" value="#leagueoflegends #lol #coachlol">
<button class="sec" type="submit">Hacer reel</button></form></div>`,
    )
    .join('')}</div><p class="sub">«Hacer reel» lo deja en la cola como idea de TikTok con este clip como material.</p>` : '<p class="vacio">No hay clips de los últimos 30 días. Crea clips durante el directo (o pide a tus espectadores que los hagan) y aparecerán aquí.</p>'}</div>
${tw.videos.length ? `<div class="caja"><h3>Últimos directos guardados</h3><table><thead><tr><th>Día</th><th>Título</th><th>Duración</th><th class="n">Vistas</th></tr></thead><tbody>
${tw.videos.map((v) => `<tr><td>${esc(fechaCorta(v.creado))}</td><td><a href="${esc(v.url)}" rel="noreferrer" target="_blank">${esc(v.titulo)}</a></td><td>${esc(v.duracion)}</td><td class="n">${num(v.vistas)}</td></tr>`).join('')}
</tbody></table></div>` : ''}`;
}

const NOMBRE_ESTADO: Record<EstadoPublicacion, string> = { idea: 'Idea', preparado: 'Preparado', aprobado: 'Aprobado', publicado: 'Publicado', descartado: 'Descartado' };
/** Siguiente paso natural de cada estado (el botón principal). */
const SIGUIENTE: Partial<Record<EstadoPublicacion, EstadoPublicacion>> = { idea: 'preparado', preparado: 'aprobado' };

function tarjetaPublicacion(p: Publicacion): string {
  const cuando = p.fecha ? `${fechaCorta(p.fecha)}${p.hora ? ` ${p.hora}` : ''}` : 'sin día';
  const boton = (estado: EstadoPublicacion, texto: string, sec = true) =>
    `<form method="post" action="/admin/panel/publicaciones/estado"><input type="hidden" name="id" value="${p.id}"><input type="hidden" name="estado" value="${estado}"><button${sec ? ' class="sec"' : ''} type="submit">${esc(texto)}</button></form>`;
  const siguiente = SIGUIENTE[p.estado];
  return `<div class="pub e-${p.estado}">
<h4>${esc(p.gancho)}</h4>
<div><span class="chip">${esc(NOMBRE_PLATAFORMA[p.plataforma])}</span><span class="chip">${esc(NOMBRE_ESTADO[p.estado])}</span><span class="chip">${esc(cuando)}</span>${p.autor === 'ia' ? '<span class="chip">propuesta por la IA</span>' : p.autor === 'api' ? '<span class="chip">desde Claude</span>' : ''}</div>
${p.texto ? `<p>${esc(p.texto)}</p>` : ''}${p.hashtags ? `<p class="sub">${esc(p.hashtags)}</p>` : ''}
${p.guion ? `<details><summary>Guion</summary><p>${esc(p.guion)}</p></details>` : ''}
${p.origen ? `<p class="sub">Material: <a href="${esc(p.origen)}" rel="noreferrer" target="_blank">${esc(p.origen)}</a></p>` : ''}
${p.enlace ? `<p class="sub">Publicado en: <a href="${esc(p.enlace)}" rel="noreferrer" target="_blank">${esc(p.enlace)}</a></p>` : ''}
${p.nota ? `<p class="sub">${esc(p.nota)}</p>` : ''}
<div class="acciones">
${siguiente ? boton(siguiente, siguiente === 'aprobado' ? 'Aprobar' : 'Marcar preparado', false) : ''}
${p.estado === 'aprobado' ? `<form method="post" action="/admin/panel/publicaciones/estado"><input type="hidden" name="id" value="${p.id}"><input type="hidden" name="estado" value="publicado"><input name="enlace" placeholder="Enlace del post publicado" aria-label="Enlace del post publicado"><button type="submit">Marcar publicado</button></form>` : ''}
${p.estado === 'aprobado' ? boton('preparado', 'Quitar aprobación') : ''}
${p.estado !== 'descartado' && p.estado !== 'publicado' ? boton('descartado', 'Descartar') : boton('idea', 'Recuperar')}
<form method="post" action="/admin/panel/publicaciones/borrar"><input type="hidden" name="id" value="${p.id}"><button class="sec" type="submit">Borrar</button></form>
</div></div>`;
}

function seccionPublicaciones(d: DatosPanel): string {
  const lista = d.publicaciones;
  const cuenta = (e: EstadoPublicacion) => lista.filter((p) => p.estado === e).length;
  const activas = lista.filter((p) => p.estado !== 'publicado' && p.estado !== 'descartado');
  const archivo = lista.filter((p) => p.estado === 'publicado' || p.estado === 'descartado');
  const hoy = d.generado.slice(0, 10);
  return `<h2>Reels y publicaciones</h2>
<div class="tiles">
${tile('Ideas', num(cuenta('idea')))}
${tile('Preparados', num(cuenta('preparado')), 'esperan tu aprobación')}
${tile('Aprobados', num(cuenta('aprobado')), 'listos para subir')}
${tile('Publicados', num(cuenta('publicado')))}
</div>
<div class="caja"><h3>Ideas virales con IA</h3>
${d.ideas.disponible ? `<form method="post" action="/admin/panel/ideas"><button type="submit"${d.ideas.quedanHoy ? '' : ' disabled'}>Proponer ideas</button> <span class="sub">Usa tus clips de Twitch y los vídeos de TikTok que mejor han ido. Tarda unos 30 segundos. Quedan ${num(d.ideas.quedanHoy)} tandas hoy.</span></form>` : '<p class="vacio">Necesita la IA del servidor (ANTHROPIC_API_KEY).</p>'}
<p class="sub">Nada se publica solo: las ideas entran en la cola y tú decides qué se aprueba. El script de reels del PC recoge las aprobadas con un clip como material y deja el vídeo vertical en tu carpeta coach-tiktok.</p></div>
<div class="caja"><h3>En la cola</h3>${activas.length ? `<div class="cola">${activas.map(tarjetaPublicacion).join('')}</div>` : '<p class="vacio">La cola está vacía. Pulsa «Proponer ideas», «Hacer reel» en un clip o añade una a mano.</p>'}</div>
<div class="caja"><h3>Añadir a mano</h3>
<form class="pubnueva" method="post" action="/admin/panel/publicaciones" autocomplete="off">
<div><label for="p-plataforma">Plataforma</label><select id="p-plataforma" name="plataforma">${PLATAFORMAS.map((x) => `<option value="${x}">${esc(NOMBRE_PLATAFORMA[x])}</option>`).join('')}</select></div>
<div><label for="p-estado">Estado</label><select id="p-estado" name="estado">${ESTADOS.filter((e) => e !== 'publicado' && e !== 'descartado').map((e) => `<option value="${e}">${esc(NOMBRE_ESTADO[e])}</option>`).join('')}</select></div>
<div><label for="p-fecha">Día</label><input id="p-fecha" name="fecha" type="date" min="${esc(hoy)}"></div>
<div><label for="p-hora">Hora</label><input id="p-hora" name="hora" type="time" value="19:30"></div>
<div class="ancho"><label for="p-gancho">Gancho (primer segundo)</label><input id="p-gancho" name="gancho" maxlength="150" required placeholder="Tu rival acaba de comprar su legendario. ¿Lo has visto?"></div>
<div class="ancho"><label for="p-texto">Texto o caption</label><textarea id="p-texto" name="texto" rows="3" maxlength="2200"></textarea></div>
<div class="ancho"><label for="p-guion">Guion (opcional)</label><textarea id="p-guion" name="guion" rows="3" maxlength="3000"></textarea></div>
<div><label for="p-hashtags">Hashtags</label><input id="p-hashtags" name="hashtags" value="#leagueoflegends #lol #coachlol"></div>
<div style="grid-column:span 2"><label for="p-origen">Material (enlace de un clip, opcional)</label><input id="p-origen" name="origen" placeholder="https://clips.twitch.tv/…"></div>
<div style="align-self:end"><button type="submit">Añadir</button></div>
</form></div>
${archivo.length ? `<div class="caja"><details><summary>Publicadas y descartadas (${num(archivo.length)})</summary><div class="cola" style="margin-top:10px">${archivo.map(tarjetaPublicacion).join('')}</div></details></div>` : ''}`;
}
