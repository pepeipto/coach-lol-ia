import { PAQUETES, PLANES, PLANES_DE_PAGO, esIdPaquete, type IdPlan } from '@coach/shared';
import type { Db } from '../db';
import { ORIGENES, type Origen } from './visitas';
import type { RepoTiktok, VideoTiktok } from './tiktok';

/*
 * Cifras del panel privado (/admin/panel), calculadas al pedir la página a partir de lo que ya guarda el servidor:
 * licencias, cuotas de IA, paquetes, contadores de la web y vídeos de TikTok apuntados a mano. Nada de esto sale
 * del servidor salvo en esa página, que pide la contraseña de administrador.
 */

const DIA_MS = 86_400_000;
const diaIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const mesIso = (t: number) => new Date(t).toISOString().slice(0, 7);

export interface FilaPlan {
  plan: Exclude<IdPlan, 'gratis'>;
  activas: number;
  canceladas: number;
  impagadas: number;
  /** Céntimos al mes de las activas (precio de catálogo, sin comisiones). */
  centimosMes: number;
}

export interface FilaLicencia {
  /** Clave con el centro tapado: CLIA-ABCD-…-WXYZ. */
  clave: string;
  tipo: string;
  plan: string;
  estado: string;
  alta: string;
  renuevaEn: string | null;
  dias: number;
  nota: string | null;
  partidas: number;
  preguntas: number;
}

export interface DatosPanel {
  generado: string;
  suscripciones: {
    porPlan: FilaPlan[];
    activas: number;
    centimosMes: number;
    vitalicias: number;
    pruebasActivas: number;
    pruebasTotal: number;
    /** Días de media que duró una suscripción ya cancelada; null si no hay ninguna. */
    duracionMediaCanceladas: number | null;
    /** Días de media que llevan las activas. */
    antiguedadMediaActivas: number | null;
    /** Últimos 6 meses (AAAA-MM), del más antiguo al actual. */
    porMes: { mes: string; altas: number; bajas: number; pruebas: number }[];
    recientes: FilaLicencia[];
  };
  uso: {
    /** Últimos 31 días, por plan (gratis = dispositivos sin licencia). */
    porPlan: { plan: IdPlan; usuarios: number; partidas: number; preguntas: number; enElTope: number }[];
    dispositivosNuevosPorMes: { mes: string; n: number }[];
    dispositivosTotal: number;
    paquetes: { paquete: string; partidas: number; total: number; ultimos30: number; centimos: number }[];
    saldoPendiente: number;
    /** Peticiones de IA de los últimos 7 días por tipo (análisis, consejo, personal, ficha, cruce, parche, asistente). */
    iaPorTipo: { tipo: string; n: number }[];
  };
  web: {
    /** Últimos 30 días, del más antiguo a hoy. */
    porDia: { dia: string; visitas: number; visitantes: number }[];
    visitas30: number;
    visitantes30: number;
    porOrigen: { origen: Origen; n: number }[];
    paginas: { ruta: string; n: number }[];
    clicsDescarga30: number;
    tarjetas30: number;
  };
  tiktok: {
    videos: VideoTiktok[];
    vistas: number;
    megusta: number;
    seguidores: { dia: string; n: number }[];
    visitantesDesdeTiktok30: number;
  };
  /** Descargas totales del instalador en GitHub (null si no se pudo consultar). */
  descargasGithub: number | null;
}

const tapar = (clave: string) => (/^CLIA-\w{4}-\w{4}-\w{4}-\w{4}$/.test(clave) ? `${clave.slice(0, 9)}…${clave.slice(-4)}` : '…');

export function datosPanel(db: Db, tiktok: RepoTiktok, ahora: number, descargasGithub: number | null = null): DatosPanel {
  const sql = db.sql;
  const hoyIso = new Date(ahora).toISOString();
  const hace31 = new Date(ahora - 31 * DIA_MS).toISOString();
  const hace30Dia = diaIso(ahora - 29 * DIA_MS);

  // --- Suscripciones -------------------------------------------------------------------------------------------
  type L = { clave: string; tipo: string; estado: string; plan: string | null; alta: string | null; actualizada: string; renueva_en: string | null; caduca_en: string | null; nota: string | null };
  const licencias = sql.prepare('SELECT clave, tipo, estado, plan, alta, actualizada, renueva_en, caduca_en, nota FROM licencias').all() as L[];
  const altaDe = (l: L) => l.alta ?? l.actualizada;
  const subs = licencias.filter((l) => l.tipo === 'suscripcion');
  const porPlan: FilaPlan[] = PLANES_DE_PAGO.map((plan) => {
    const delPlan = subs.filter((l) => (l.plan ?? 'estratega') === plan);
    const activas = delPlan.filter((l) => l.estado === 'activa').length;
    return {
      plan,
      activas,
      canceladas: delPlan.filter((l) => l.estado === 'cancelada').length,
      impagadas: delPlan.filter((l) => l.estado === 'impagada').length,
      centimosMes: activas * PLANES[plan].centimosMes,
    };
  });
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const dias = (desde: string, hasta: number) => Math.max(0, Math.floor((hasta - Date.parse(desde)) / DIA_MS));
  const canceladas = subs.filter((l) => l.estado === 'cancelada');
  const activas = subs.filter((l) => l.estado === 'activa');
  const pruebas = licencias.filter((l) => l.tipo === 'prueba');

  const meses: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ahora);
    meses.push(mesIso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)));
  }
  const porMes = meses.map((mes) => ({
    mes,
    altas: subs.filter((l) => altaDe(l).startsWith(mes)).length,
    bajas: canceladas.filter((l) => l.actualizada.startsWith(mes)).length,
    pruebas: pruebas.filter((l) => altaDe(l).startsWith(mes)).length,
  }));

  // Uso de cuota de los últimos 31 días por sujeto (un periodo mensual empieza como mucho hace 31 días).
  const usoFilas = sql.prepare('SELECT sujeto, tipo, SUM(n) AS n FROM cuotas_uso WHERE periodo >= ? GROUP BY sujeto, tipo').all(hace31) as { sujeto: string; tipo: string; n: number }[];
  const usoPorSujeto = new Map<string, { partida: number; pregunta: number }>();
  for (const f of usoFilas) {
    const u = usoPorSujeto.get(f.sujeto) ?? { partida: 0, pregunta: 0 };
    if (f.tipo === 'partida' || f.tipo === 'pregunta') u[f.tipo] += f.n;
    usoPorSujeto.set(f.sujeto, u);
  }

  const estadoDe = (l: L) => {
    if (l.tipo === 'vitalicia') return 'activa';
    if (l.caduca_en && ahora >= Date.parse(l.caduca_en)) return 'caducada';
    return l.estado;
  };
  const recientes: FilaLicencia[] = [...licencias]
    .sort((a, b) => altaDe(b).localeCompare(altaDe(a)))
    .slice(0, 25)
    .map((l) => {
      const u = usoPorSujeto.get(`l:${l.clave}`);
      return {
        clave: tapar(l.clave),
        tipo: l.tipo,
        plan: l.plan ?? 'estratega',
        estado: estadoDe(l),
        alta: altaDe(l).slice(0, 10),
        renuevaEn: l.renueva_en ? l.renueva_en.slice(0, 10) : null,
        dias: dias(altaDe(l), l.estado === 'cancelada' ? Date.parse(l.actualizada) : ahora),
        nota: l.nota,
        partidas: u?.partida ?? 0,
        preguntas: u?.pregunta ?? 0,
      };
    });

  // --- Uso de IA -------------------------------------------------------------------------------------------------
  const planDeClave = new Map(licencias.map((l) => [l.clave, (l.plan ?? 'estratega') as IdPlan]));
  const usoPlan = new Map<IdPlan, { usuarios: number; partidas: number; preguntas: number; enElTope: number }>();
  for (const [sujeto, u] of usoPorSujeto) {
    const plan: IdPlan = sujeto.startsWith('l:') ? planDeClave.get(sujeto.slice(2)) ?? 'estratega' : 'gratis';
    const fila = usoPlan.get(plan) ?? { usuarios: 0, partidas: 0, preguntas: 0, enElTope: 0 };
    fila.usuarios++;
    fila.partidas += u.partida;
    fila.preguntas += u.pregunta;
    if (u.partida >= PLANES[plan].cuota.partida || u.pregunta >= PLANES[plan].cuota.pregunta) fila.enElTope++;
    usoPlan.set(plan, fila);
  }
  const altas = sql.prepare('SELECT substr(alta, 1, 7) AS mes, COUNT(*) AS n FROM cuotas_altas GROUP BY mes').all() as { mes: string; n: number }[];
  const compras = sql.prepare('SELECT paquete, comprado FROM paquetes_comprados').all() as { paquete: string; comprado: string }[];
  const iaFilas = sql.prepare("SELECT cubo, n FROM coach_ia_uso WHERE cubo LIKE '%:d:%' UNION ALL SELECT 'asistente:' || cubo, n FROM asistente_uso WHERE cubo LIKE 'd:%'").all() as { cubo: string; n: number }[];
  const desde7 = diaIso(ahora - 6 * DIA_MS);
  const iaPorTipo = new Map<string, number>();
  for (const { cubo, n } of iaFilas) {
    const m = /^([a-z]+):d:(\d{4}-\d{2}-\d{2})$/.exec(cubo);
    if (m && m[2]! >= desde7) iaPorTipo.set(m[1]!, (iaPorTipo.get(m[1]!) ?? 0) + n);
  }

  // --- Web --------------------------------------------------------------------------------------------------------
  const metricas = sql.prepare('SELECT dia, evento, n FROM metricas_dia WHERE dia >= ?').all(hace30Dia) as { dia: string; evento: string; n: number }[];
  const porDia = Array.from({ length: 30 }, (_, i) => ({ dia: diaIso(ahora - (29 - i) * DIA_MS), visitas: 0, visitantes: 0 }));
  const indiceDia = new Map(porDia.map((d, i) => [d.dia, i]));
  const origenes = new Map<Origen, number>();
  const paginas = new Map<string, number>();
  let clicsDescarga30 = 0;
  let tarjetas30 = 0;
  for (const { dia, evento, n } of metricas) {
    const i = indiceDia.get(dia);
    if (evento === 'visita' && i !== undefined) porDia[i]!.visitas += n;
    else if (evento === 'visitante' && i !== undefined) porDia[i]!.visitantes += n;
    else if (evento.startsWith('visitante:o:')) {
      const o = evento.slice(12) as Origen;
      if ((ORIGENES as readonly string[]).includes(o)) origenes.set(o, (origenes.get(o) ?? 0) + n);
    } else if (evento.startsWith('visita:p:')) paginas.set(evento.slice(9), (paginas.get(evento.slice(9)) ?? 0) + n);
    else if (evento === 'descarga') clicsDescarga30 += n;
    else if (evento === 'tarjeta') tarjetas30 += n;
  }

  // --- TikTok -----------------------------------------------------------------------------------------------------
  const videos = tiktok.lista();

  return {
    generado: hoyIso,
    suscripciones: {
      porPlan,
      activas: activas.length,
      centimosMes: porPlan.reduce((a, f) => a + f.centimosMes, 0),
      vitalicias: licencias.filter((l) => l.tipo === 'vitalicia').length,
      pruebasActivas: pruebas.filter((l) => estadoDe(l) === 'activa').length,
      pruebasTotal: pruebas.length,
      duracionMediaCanceladas: media(canceladas.map((l) => dias(altaDe(l), Date.parse(l.actualizada)))),
      antiguedadMediaActivas: media(activas.map((l) => dias(altaDe(l), ahora))),
      porMes,
      recientes,
    },
    uso: {
      porPlan: (['gratis', ...PLANES_DE_PAGO] as IdPlan[]).map((plan) => ({ plan, ...(usoPlan.get(plan) ?? { usuarios: 0, partidas: 0, preguntas: 0, enElTope: 0 }) })),
      dispositivosNuevosPorMes: meses.map((mes) => ({ mes, n: altas.find((a) => a.mes === mes)?.n ?? 0 })),
      dispositivosTotal: altas.reduce((a, f) => a + f.n, 0),
      paquetes: Object.values(PAQUETES).map((p) => {
        const delPaquete = compras.filter((c) => esIdPaquete(c.paquete) && c.paquete === p.id);
        return {
          paquete: p.id,
          partidas: p.partidas,
          total: delPaquete.length,
          ultimos30: delPaquete.filter((c) => c.comprado >= new Date(ahora - 30 * DIA_MS).toISOString()).length,
          centimos: delPaquete.length * p.centimos,
        };
      }),
      saldoPendiente: (sql.prepare('SELECT COALESCE(SUM(partidas), 0) AS n FROM saldo_partidas').get() as { n: number }).n,
      iaPorTipo: [...iaPorTipo].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
    },
    web: {
      porDia,
      visitas30: porDia.reduce((a, d) => a + d.visitas, 0),
      visitantes30: porDia.reduce((a, d) => a + d.visitantes, 0),
      porOrigen: [...origenes].map(([origen, n]) => ({ origen, n })).sort((a, b) => b.n - a.n),
      paginas: [...paginas].map(([ruta, n]) => ({ ruta, n })).sort((a, b) => b.n - a.n).slice(0, 12),
      clicsDescarga30,
      tarjetas30,
    },
    tiktok: {
      videos,
      vistas: videos.reduce((a, v) => a + v.vistas, 0),
      megusta: videos.reduce((a, v) => a + v.megusta, 0),
      seguidores: tiktok.seguidores(),
      visitantesDesdeTiktok30: origenes.get('tiktok') ?? 0,
    },
    descargasGithub,
  };
}

/** Descargas de los instaladores (.exe) de todas las versiones publicadas en GitHub. */
export async function contarDescargasGithub(repo = 'pepeipto/coach-lol-ia', f: typeof fetch = fetch): Promise<number | null> {
  try {
    let total = 0;
    for (let pagina = 1; pagina <= 5; pagina++) {
      const r = await f(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${pagina}`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'coachlolia-panel' },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return null;
      const releases = (await r.json()) as { assets?: { name: string; download_count: number }[] }[];
      for (const rel of releases) for (const a of rel.assets ?? []) if (a.name.toLowerCase().endsWith('.exe')) total += a.download_count;
      if (releases.length < 100) break;
    }
    return total;
  } catch {
    return null;
  }
}
