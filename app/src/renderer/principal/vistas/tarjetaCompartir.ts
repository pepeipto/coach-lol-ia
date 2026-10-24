import { t } from '../../../shared/i18n';
import type { Etiqueta, PartidaHistorial, Perfil } from '../../../shared/perfil';
import { mmss } from './VistaAnalisis';

/*
 * 3.7: tarjeta vertical (1080 × 1920, el tamaño de las historias de Instagram y TikTok) con el resumen de una partida,
 * para compartirla. Solo lleva datos del propio jugador: ni nombres ni Riot ID de nadie (tampoco el suyo).
 */

export const ANCHO_TARJETA = 1080;
export const ALTO_TARJETA = 1920;

export interface DatosTarjeta {
  campeon: string;
  /** Id de Data Dragon del campeón (para el icono); '' si no se sabe. */
  campeonDD: string;
  victoria: boolean;
  /** «ARAM · 24:13» (modo, rol y duración). */
  subtitulo: string;
  nota: number;
  notas: { etiqueta: string; valor: number }[];
  kda: string;
  /** «7/2/11». */
  kdaDetalle: string;
  stats: { etiqueta: string; valor: string }[];
  etiquetas: string[];
  /** Reto activo con su progreso («Farmea bien · 3/5»); null si no hay. */
  reto: string | null;
}

const redondear = (n: number) => Math.round(n * 10) / 10;

/** Datos de la tarjeta de una partida (todo texto ya traducido). */
export function datosTarjeta(p: PartidaHistorial, perfil: Perfil): DatosTarjeta {
  const yo = p.jugadores.find((j) => j.participante === p.yo)!;
  const equipo = p.jugadores.filter((j) => j.equipo === yo.equipo);
  const asesinatosEquipo = equipo.reduce((s, j) => s + j.asesinatos, 0);
  const danoEquipo = equipo.reduce((s, j) => s + j.dano, 0);
  const minutos = Math.max(1, p.duracion / 60);
  const dd = perfil.campeonesDD[yo.campeonId];
  const modo = p.modo === 'otro' ? t('perfil.modoOtro') : t(`modo.${p.modo}`);
  const notas = [
    { etiqueta: t('perfil.nota.combate'), valor: Math.round(yo.puntuaciones.combate) },
    { etiqueta: t('perfil.nota.farmeo'), valor: Math.round(yo.puntuaciones.farmeo) },
    ...(p.modo === 'clasificatoria' ? [{ etiqueta: t('perfil.nota.vision'), valor: Math.round(yo.puntuaciones.vision) }] : []),
  ];
  const stats = [
    { etiqueta: t('tarjeta.csMin'), valor: String(redondear(yo.cs / minutos)) },
    ...(asesinatosEquipo > 0
      ? [{ etiqueta: t('tarjeta.kp'), valor: t('formato.porcentaje', { n: Math.round(((yo.asesinatos + yo.asistencias) / asesinatosEquipo) * 100) }) }]
      : []),
    ...(danoEquipo > 0 ? [{ etiqueta: t('tarjeta.dano'), valor: t('formato.porcentaje', { n: Math.round((yo.dano / danoEquipo) * 100) }) }] : []),
  ];
  const reto = perfil.reto ? `${t(`perfil.reto.${perfil.reto.id}.nombre`)} · ${perfil.reto.hechas}/${perfil.reto.objetivo}` : null;
  return {
    campeon: dd?.nombre ?? String(yo.campeonId),
    campeonDD: dd?.id ?? '',
    victoria: p.victoria,
    subtitulo: [modo, yo.rol ? t(`rol.${yo.rol}`) : null, mmss(p.duracion)].filter(Boolean).join(' · '),
    nota: Math.round(yo.puntuaciones.total),
    notas,
    kda: String(redondear((yo.asesinatos + yo.asistencias) / Math.max(1, yo.muertes))),
    kdaDetalle: `${yo.asesinatos}/${yo.muertes}/${yo.asistencias}`,
    stats,
    etiquetas: yo.etiquetas.slice(0, 3).map((e: Etiqueta) => t(`perfil.etiqueta.${e}`)),
    reto,
  };
}

const C = {
  fondoArriba: '#121a33',
  fondoAbajo: '#0a0e1a',
  superficie: 'rgba(255,255,255,0.05)',
  borde: 'rgba(255,255,255,0.10)',
  texto: '#e8ecf5',
  texto2: '#8b97b8',
  oro: '#c8aa6e',
  exito: '#2fbf71',
  error: '#ef5b5b',
  primario: '#4f7cff',
};
const FUENTE = '"Segoe UI", system-ui, sans-serif';

/** Color de una nota (igual que en la app: verde ≥ 70, dorado ≥ 50 y, por debajo, neutro; nunca rojo). */
const colorNota = (n: number) => (n >= 70 ? C.exito : n >= 50 ? C.oro : C.texto2);

function rectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Dibuja la tarjeta en un lienzo de 1080 × 1920. `icono` es el retrato del campeón (si se pudo cargar). */
export function dibujarTarjeta(ctx: CanvasRenderingContext2D, d: DatosTarjeta, icono: CanvasImageSource | null): void {
  const W = ANCHO_TARJETA;
  const centro = W / 2;
  const acento = d.victoria ? C.exito : C.error;

  const fondo = ctx.createLinearGradient(0, 0, 0, ALTO_TARJETA);
  fondo.addColorStop(0, C.fondoArriba);
  fondo.addColorStop(1, C.fondoAbajo);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, ALTO_TARJETA);
  // Halo del resultado detrás del campeón.
  const halo = ctx.createRadialGradient(centro, 470, 40, centro, 470, 520);
  halo.addColorStop(0, d.victoria ? 'rgba(47,191,113,0.30)' : 'rgba(239,91,91,0.24)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, 1000);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.oro;
  ctx.font = `700 40px ${FUENTE}`;
  ctx.fillText('COACH LOL IA', centro, 130);

  // Retrato del campeón en un círculo con el borde del resultado.
  const r = 190;
  const cy = 450;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centro, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = C.superficie;
  ctx.fill();
  if (icono) {
    ctx.clip();
    ctx.drawImage(icono, centro - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centro, cy, r + 6, 0, Math.PI * 2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = acento;
  ctx.stroke();

  ctx.fillStyle = C.texto;
  ctx.font = `700 92px ${FUENTE}`;
  ctx.fillText(d.campeon, centro, 760);
  ctx.fillStyle = C.texto2;
  ctx.font = `400 40px ${FUENTE}`;
  ctx.fillText(d.subtitulo, centro, 822);

  // Resultado.
  const resultado = (d.victoria ? t('analisis.victoria') : t('analisis.derrota')).toUpperCase();
  ctx.font = `800 44px ${FUENTE}`;
  const anchoRes = ctx.measureText(resultado).width + 80;
  rectRedondo(ctx, centro - anchoRes / 2, 860, anchoRes, 76, 38);
  ctx.fillStyle = d.victoria ? 'rgba(47,191,113,0.18)' : 'rgba(239,91,91,0.18)';
  ctx.fill();
  ctx.fillStyle = acento;
  ctx.fillText(resultado, centro, 914);

  // Nota grande.
  ctx.fillStyle = C.texto2;
  ctx.font = `600 34px ${FUENTE}`;
  ctx.fillText(t('tarjeta.nota').toUpperCase(), centro, 1030);
  ctx.fillStyle = colorNota(d.nota);
  ctx.font = `800 200px ${FUENTE}`;
  ctx.fillText(String(d.nota), centro, 1210);
  ctx.fillStyle = C.texto2;
  ctx.font = `400 34px ${FUENTE}`;
  ctx.fillText(t('tarjeta.sobre100'), centro, 1260);

  // Notas parciales en columnas.
  const columnas = d.notas.length;
  const anchoCol = 880 / columnas;
  d.notas.forEach((n, i) => {
    const x = 100 + anchoCol * i + anchoCol / 2;
    ctx.fillStyle = colorNota(n.valor);
    ctx.font = `700 72px ${FUENTE}`;
    ctx.fillText(String(n.valor), x, 1380);
    ctx.fillStyle = C.texto2;
    ctx.font = `400 32px ${FUENTE}`;
    ctx.fillText(n.etiqueta, x, 1426);
  });

  // Estadísticas: KDA y las demás en una franja.
  rectRedondo(ctx, 80, 1480, 920, 170, 28);
  ctx.fillStyle = C.superficie;
  ctx.fill();
  ctx.strokeStyle = C.borde;
  ctx.lineWidth = 2;
  ctx.stroke();
  const celdas = [{ etiqueta: `KDA ${d.kdaDetalle}`, valor: d.kda }, ...d.stats];
  const anchoCelda = 920 / celdas.length;
  celdas.forEach((c, i) => {
    const x = 80 + anchoCelda * i + anchoCelda / 2;
    ctx.fillStyle = C.texto;
    ctx.font = `700 60px ${FUENTE}`;
    ctx.fillText(c.valor, x, 1570);
    ctx.fillStyle = C.texto2;
    ctx.font = `400 28px ${FUENTE}`;
    ctx.fillText(c.etiqueta, x, 1616);
  });

  // Etiquetas (solo positivas) y reto.
  let y = 1720;
  if (d.etiquetas.length > 0) {
    ctx.font = `700 32px ${FUENTE}`;
    const anchos = d.etiquetas.map((e) => ctx.measureText(e).width + 56);
    const total = anchos.reduce((s, a) => s + a, 0) + 20 * (anchos.length - 1);
    let x = centro - total / 2;
    d.etiquetas.forEach((e, i) => {
      rectRedondo(ctx, x, y - 44, anchos[i]!, 60, 30);
      ctx.fillStyle = 'rgba(200,170,110,0.16)';
      ctx.fill();
      ctx.fillStyle = C.oro;
      ctx.fillText(e, x + anchos[i]! / 2, y - 2);
      x += anchos[i]! + 20;
    });
    y += 90;
  }
  if (d.reto) {
    ctx.fillStyle = C.texto;
    ctx.font = `600 32px ${FUENTE}`;
    ctx.fillText(t('tarjeta.reto', { reto: d.reto }), centro, y - 10);
  }

  // Pie: la web, para que quien la vea sepa de dónde sale.
  ctx.fillStyle = C.primario;
  ctx.font = `700 40px ${FUENTE}`;
  ctx.fillText('coachlolia.com', centro, 1868);
}

/** Carga el retrato del campeón para dibujarlo en el lienzo (Data Dragon permite CORS); null si falla. */
export function cargarIcono(version: string, idDD: string): Promise<HTMLImageElement | null> {
  if (!version || !idDD) return Promise.resolve(null);
  return new Promise((resolver) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${encodeURIComponent(idDD)}.png`;
  });
}

/** PNG (data URL) de la tarjeta de una partida. */
export async function tarjetaPng(p: PartidaHistorial, perfil: Perfil): Promise<string> {
  const d = datosTarjeta(p, perfil);
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO_TARJETA;
  lienzo.height = ALTO_TARJETA;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Sin lienzo 2D');
  await document.fonts?.ready;
  dibujarTarjeta(ctx, d, await cargarIcono(perfil.version, d.campeonDD));
  return lienzo.toDataURL('image/png');
}
