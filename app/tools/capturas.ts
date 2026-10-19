/**
 * Capturas reales de la app para la web del producto.
 *
 *   npm run capturas -w app
 *
 * 1. Pide al servidor de builds (COACH_SERVIDOR, por defecto http://127.0.0.1:8080) builds reales y
 *    a Data Dragon (es_MX) los nombres e iconos. Si el servidor no responde, se detiene: nunca usa datos inventados.
 * 2. Lanza Electron sin mostrar ventanas con el renderizador ya compilado (out/renderer) y un preload
 *    simulado (capturas-preload.cjs) que sirve ese estado como si viniera del proceso principal.
 * 3. Guarda PNG a 1280×800 (escala 2) y WebP de 1600 px en CAPTURAS_SALIDA (por defecto ../capturas
 *    respecto a la raíz del repositorio).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREMIUM_HABILITADO, ROLES, URL_VERSIONES, urlDatosDDragon, type Build, type Rol, type RolesCampeon } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { resumenOverlay } from '../src/main/consejos/motor';
import { cargaDeMuestra } from '../src/main/orquestador/cargaSimulada';
import { textoRutaJungla } from '../src/main/consejos/junglaEnemiga';
import { estadoJungla } from '../src/shared/jungla';
import { svgMinimapaEsquema } from './minimapaEsquema';
import { VERSION_ACTUAL } from '../src/shared/novedades';
import { establecerIdioma, esIdioma, LOCALE_DDRAGON, t, type Idioma } from '../src/shared/i18n';
import type { ListaCampeones } from '@coach/shared';
import type { Ajustes, AvisoOverlay, EstadoLicencia, EstadoOverlay, EstadoPartida, EstadoPrincipal, RecursosBuild } from '../src/shared/tiposApp';

const DIR_APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVIDOR = (process.env.COACH_SERVIDOR ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const SALIDA = resolve(process.env.CAPTURAS_SALIDA ?? join(DIR_APP, '..', '..', 'capturas'));
/**
 * CAPTURAS_VERIFICACION=1 añade escenas solo para comprobar a mano (no para la web): la nota de la ruta estimada
 * en la carga, el aviso del jungla enemigo y los temporizadores del minimapa de los dos lados sobre un esquema.
 */
const VERIFICACION = process.env.CAPTURAS_VERIFICACION === '1';
/**
 * CAPTURAS_TIKTOK=1: en vez de las capturas de la web, el material para los vídeos (PNG a resolución completa,
 * numerados en el orden de la historia, y clips MP4 con ffmpeg). Mismos datos reales y jugadores ficticios.
 */
const TIKTOK = process.env.CAPTURAS_TIKTOK === '1';
/**
 * CAPTURAS_IDIOMA=en|pt-BR|fr|de: capturas en otro idioma de la app (textos, nombres de Data Dragon y escenas);
 * por defecto, español.
 */
const IDIOMA_CAPTURAS: Idioma = esIdioma(process.env.CAPTURAS_IDIOMA) ? process.env.CAPTURAS_IDIOMA : 'es';
establecerIdioma(IDIOMA_CAPTURAS);
const LOCALE = LOCALE_DDRAGON[IDIOMA_CAPTURAS];
/** Candidatos para la segunda build (la del fondo y el panel del overlay en partida). */
const SEGUNDOS = ['Jinx', 'Caitlyn', 'Ezreal', 'Lux', 'Yasuo', 'LeeSin', 'Darius', 'Thresh'];

function fallar(mensaje: string): never {
  console.error(`\n[capturas] ERROR: ${mensaje}\n`);
  process.exit(1);
}

async function pedir<T>(url: string, quien: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (e) {
    throw new Error(`${quien} no responde (${url}): ${(e as Error).message}`);
  }
  if (!r.ok) throw new Error(`${quien} respondió ${r.status} a ${url}`);
  return (await r.json()) as T;
}

async function buildDe(campeon: string, rol: Rol): Promise<Build | null> {
  const r = await fetch(`${SERVIDOR}/builds/${encodeURIComponent(campeon)}/${rol}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`El servidor de builds respondió ${r.status} a /builds/${campeon}/${rol}`);
  return (await r.json()) as Build;
}

async function rolesDe(campeon: string): Promise<Rol[]> {
  const r = await pedir<RolesCampeon>(`${SERVIDOR}/roles/${encodeURIComponent(campeon)}`, 'El servidor de builds');
  return [...r.roles].sort((a, b) => b.partidas - a.partidas).map((x) => x.rol).filter((x) => ROLES.includes(x));
}

interface DatosDDragon {
  version: string;
  campeones: Record<string, { id: string; nombre: string; key: number }>;
  objetos: Record<string, string>;
  runas: Map<number, { nombre: string; icono: string }>;
  hechizos: Map<number, { nombre: string; imagen: string }>;
}

async function cargarDDragon(): Promise<DatosDDragon> {
  const [version] = await pedir<string[]>(URL_VERSIONES, 'Data Dragon');
  const [campeones, objetos, runas, hechizos] = await Promise.all([
    pedir<{ data: Record<string, { key: string; id: string; name: string }> }>(urlDatosDDragon(version, 'champion', LOCALE), 'Data Dragon'),
    pedir<{ data: Record<string, { name: string }> }>(urlDatosDDragon(version, 'item', LOCALE), 'Data Dragon'),
    pedir<{ id: number; name: string; icon: string; slots: { runes: { id: number; name: string; icon: string }[] }[] }[]>(
      urlDatosDDragon(version, 'runesReforged', LOCALE),
      'Data Dragon',
    ),
    pedir<{ data: Record<string, { key: string; name: string; image: { full: string } }> }>(urlDatosDDragon(version, 'summoner', LOCALE), 'Data Dragon'),
  ]);
  const datos: DatosDDragon = { version, campeones: {}, objetos: {}, runas: new Map(), hechizos: new Map() };
  for (const c of Object.values(campeones.data)) datos.campeones[c.id.toLowerCase()] = { id: c.id, nombre: c.name, key: Number(c.key) };
  for (const [id, o] of Object.entries(objetos.data)) datos.objetos[id] = o.name;
  for (const estilo of runas) {
    datos.runas.set(estilo.id, { nombre: estilo.name, icono: estilo.icon });
    for (const s of estilo.slots) for (const r of s.runes) datos.runas.set(r.id, { nombre: r.name, icono: r.icon });
  }
  for (const h of Object.values(hechizos.data)) datos.hechizos.set(Number(h.key), { nombre: h.name, imagen: h.image.full });
  return datos;
}

/** Igual que recursosDe del orquestador de selección: solo lo que aparece en la build. */
function recursos(build: Build, d: DatosDDragon): RecursosBuild {
  const r: RecursosBuild = { objetos: {}, runas: {}, hechizos: {} };
  const ids = [...build.objetosIniciales, ...build.nucleo, ...build.situacionales, ...(build.botas !== null ? [build.botas] : [])];
  for (const id of ids) r.objetos[id] = d.objetos[id] ?? String(id);
  for (const id of [build.runas.estiloPrincipal, build.runas.estiloSecundario, ...build.runas.runas]) {
    const x = d.runas.get(id);
    if (x) r.runas[id] = x;
  }
  for (const id of build.hechizos) {
    const x = d.hechizos.get(id);
    if (x) r.hechizos[id] = x;
  }
  return r;
}

function estadoPrincipal(build: Build, rol: Rol, roles: Rol[], d: DatosDDragon): EstadoPrincipal {
  const c = d.campeones[build.campeon.toLowerCase()];
  if (!c) fallar(`Data Dragon no conoce al campeón «${build.campeon}».`);
  return {
    cliente: 'conectado',
    version: d.version,
    error: null,
    importacion: null,
    aviso: null,
    recursos: recursos(build, d),
    seleccion: {
      campeon: c,
      rol,
      rolesDisponibles: roles.length > 0 ? roles : [rol],
      resultado: { estado: 'ok', build },
      opcion: 0,
    },
  };
}

const GRATIS: EstadoLicencia = { plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null };
const PREMIUM: EstadoLicencia = {
  plan: 'premium',
  estado: 'activa',
  renuevaEn: new Date(Date.now() + 24 * 24 * 3600 * 1000).toISOString(),
  claveVisible: 'CLIA-••••-••••-••••-7K2P',
};
const AJUSTES: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: false },
  voz: true,
  importacionAutomatica: true,
  teclaOverlay: AJUSTES_POR_DEFECTO.teclaOverlay,
  posicionOverlay: null,
  overlay: {
    ...AJUSTES_POR_DEFECTO.overlay,
    voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true },
    widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, jungla: { ...AJUSTES_POR_DEFECTO.overlay.widgets.jungla, activo: true } },
  },
  teclasJungla: {},
  teclaJungla: 'Alt+Shift+L',
  junglaEnemiga: { avisos: true, ruta: false },
  idioma: IDIOMA_CAPTURAS,
  // Sin bienvenida ni novedades encima de las capturas.
  bienvenidaVista: true,
  ultimaVersionVista: VERSION_ACTUAL,
};

/** Puntos de habilidad tras subir las `n` primeras del orden de la build. */
function puntosHasta(orden: Build['ordenHabilidades'], n: number): EstadoPartida['habilidades'] {
  const p = { Q: 0, W: 0, E: 0, R: 0 };
  for (const h of orden.slice(0, n)) p[h]++;
  return p;
}

async function main(): Promise<void> {
  const renderer = join(DIR_APP, 'out', 'renderer', 'principal', 'index.html');
  if (!existsSync(renderer)) fallar('No hay renderizador compilado. Ejecuta antes `npm run build -w app`.');

  try {
    await pedir(`${SERVIDOR}/salud`, 'El servidor de builds');
  } catch (e) {
    fallar(
      `${(e as Error).message}\nArranca el servidor de builds (o define COACH_SERVIDOR) y vuelve a intentarlo. ` +
        'Las capturas solo se hacen con datos reales.',
    );
  }

  console.log('[capturas] Cargando builds reales y Data Dragon…');
  const d = await cargarDDragon().catch((e: Error) => fallar(e.message));
  const ahri = await buildDe('Ahri', 'MIDDLE');
  if (!ahri) fallar('El servidor no tiene build de Ahri en MIDDLE (/builds/Ahri/MIDDLE devolvió 404).');
  const rolesAhri = await rolesDe('Ahri');

  let segunda: { build: Build; rol: Rol } | null = null;
  for (const campeon of SEGUNDOS) {
    const roles = await rolesDe(campeon);
    for (const rol of roles) {
      const b = await buildDe(campeon, rol);
      if (b) {
        segunda = { build: b, rol };
        break;
      }
    }
    if (segunda) break;
  }
  if (!segunda) fallar(`El servidor no tiene builds de ninguno de: ${SEGUNDOS.join(', ')}.`);
  const c2 = d.campeones[segunda.build.campeon.toLowerCase()];
  if (!c2) fallar(`Data Dragon no conoce al campeón «${segunda.build.campeon}».`);
  console.log(`[capturas] Ahri MIDDLE (parche ${ahri.parche}) y ${c2.nombre} ${segunda.rol}; Data Dragon ${d.version}.`);

  // Estado del overlay calculado por el motor real con una partida coherente: minuto 9:22, nivel 6
  // con 5 puntos (toca la R si la build lo dice) y un dragón ya muerto en el minuto 5:00.
  // Así los tiempos de los objetivos son los que daría la app (dragón 10:00, larvas hasta 14:45,
  // Heraldo 15:00, Barón 20:00), no números puestos a mano.
  const compraId = segunda.build.nucleo[1] ?? segunda.build.nucleo[0] ?? 0;
  const partida: EstadoPartida = {
    tiempo: 562,
    oro: 2600,
    nivel: 6,
    campeon: segunda.build.campeon,
    objetos: [],
    habilidades: puntosHasta(segunda.build.ordenHabilidades, 5),
    eventos: [{ nombre: 'DragonKill', tiempo: 300, dragon: 'Fire' }],
  };
  const calculado = resumenOverlay({ ...partida, cs: 61, equipo: 'ORDER' }, segunda.build, segunda.rol, {}, d.version, null);
  const habilidad = calculado.proximaHabilidad ?? segunda.build.ordenHabilidades[5] ?? 'R';
  const estadoOverlay: EstadoOverlay = {
    ...calculado,
    proximaHabilidad: habilidad,
    // Sin los datos completos de objetos de Data Dragon, la próxima compra se toma del núcleo real.
    compra: { id: compraId, nombre: d.objetos[compraId] ?? String(compraId), coste: 2600, puedeComprar: true },
  };
  const aviso: AvisoOverlay = { texto: t('aviso.habilidad', { nivel: 6, habilidad }), voz: false, tipo: 'habilidad' };

  const estadoAhri = estadoPrincipal(ahri, 'MIDDLE', rolesAhri, d);
  // Con Premium desactivado (Coach LoL IA gratis) no hay banner ni vista Premium: la vista Campeón es
  // una sola y la barra lateral ofrece «Apoya el proyecto».
  const vistasPlan = PREMIUM_HABILITADO
    ? [
        { nombre: 'campeon-gratis', pagina: 'principal', vista: 'campeon', escena: { estado: estadoAhri, licencia: GRATIS, ajustes: AJUSTES } },
        { nombre: 'campeon-premium', pagina: 'principal', vista: 'campeon', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
        { nombre: 'premium', pagina: 'principal', vista: 'premium', escena: { estado: estadoAhri, licencia: GRATIS, ajustes: AJUSTES } },
      ]
    : [
        { nombre: 'campeon', pagina: 'principal', vista: 'campeon', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
        { nombre: 'apoyar', pagina: 'principal', vista: 'apoyar', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
      ];
  const capturas: { nombre: string; pagina: string; vista?: string; escena: unknown }[] = [
    ...vistasPlan,
    { nombre: 'overlay-ajustes', pagina: 'principal', vista: 'overlay', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
    { nombre: 'ayuda', pagina: 'principal', vista: 'ayuda', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
    {
      nombre: 'overlay-partida',
      pagina: 'overlay',
      escena: { estado: estadoOverlay, aviso, config: AJUSTES.overlay, fondo: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c2.id}_0.jpg` },
    },
    {
      // Pantalla de carga con los jugadores de muestra de COACH_FORZAR_PARTIDA (ficticios) e iconos reales.
      nombre: 'overlay-carga',
      pagina: 'overlay',
      escena: {
        modo: 'carga',
        carga: cargaDeMuestra({ version: d.version, campeones: new Map(Object.values(d.campeones).map((c) => [c.key, { id: c.id, nombre: c.nombre }])) }),
        config: AJUSTES.overlay,
        fondo: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg',
      },
    },
  ];

  if (VERIFICACION) {
    const cargaBase = cargaDeMuestra({ version: d.version, campeones: new Map(Object.values(d.campeones).map((c) => [c.key, { id: c.id, nombre: c.nombre }])) });
    const ruta = textoRutaJungla('Graves', { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 }, partidas: 120 });
    // Marco del minimapa en la ventana de 1280×800: un lado de 176 px, pegado abajo a la derecha.
    const lado = 176;
    const marco = { x: (1280 - lado) / 1280, y: (800 - lado) / 800, lado: lado / 800 };
    const capa = { svg: svgMinimapaEsquema(), x: 1280 - lado, y: 800 - lado, lado };
    const configJungla = { ...AJUSTES.overlay, jungla: { presentacion: 'minimapa' as const, minimapa: marco } };
    // Azul limpiado hace 200 s (quedan 100), Gromp hace 120 s (quedan 15: dorado), Krugs y Escarabajo de abajo marcados.
    const marcas = { azul: 362, gromp: 442, krugs: 500, escarabajoAbajo: 480 };
    const avisoJungla: AvisoOverlay = { texto: t('junglaEnemiga.aviso', { zona: t('junglaEnemiga.zona.bot') }), voz: false };
    capturas.push(
      {
        nombre: 'verif-carga-ruta',
        pagina: 'overlay',
        escena: { modo: 'carga', carga: { ...cargaBase, rutaJungla: { campeon: 'Graves', texto: ruta } }, config: AJUSTES.overlay, fondo: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg' },
      },
      ...(['ORDER', 'CHAOS'] as const).map((equipo) => ({
        nombre: `verif-minimapa-${equipo === 'ORDER' ? 'azul' : 'rojo'}`,
        pagina: 'overlay',
        escena: {
          estado: estadoOverlay,
          aviso: avisoJungla,
          config: configJungla,
          jungla: estadoJungla(marcas, 562, equipo),
          capa,
          fondo: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c2.id}_0.jpg`,
        },
      })),
    );
  }

  /** Escenas del material para TikTok (ver CAPTURAS_TIKTOK). */
  async function escenasTiktok(): Promise<typeof capturas> {
    const seg = segunda!;
    const fondo = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c2.id}_0.jpg`;
    const fondoCarga = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg';
    const mapaDD = new Map(Object.values(d.campeones).map((c) => [c.key, { id: c.id, nombre: c.nombre }]));
    const cargaBase = cargaDeMuestra({ version: d.version, campeones: mapaDD });
    const listaDD = Object.values(d.campeones).map((c) => ({ id: c.id, nombre: c.nombre, key: c.key }));
    const campeones: Record<string, unknown> = {};
    for (const modo of ['clasificatoria', 'aram', 'caos', 'arena']) {
      const lista = await pedir<ListaCampeones>(`${SERVIDOR}/campeones?modo=${modo}`, 'El servidor de builds');
      campeones[modo] = { ok: true, modo, version: d.version, campeones: listaDD, resultado: { estado: 'ok', lista } };
    }
    const ajustesCampeones = { ...AJUSTES };
    const principal = (nombre: string, vista: string, escena: Record<string, unknown>, acciones?: string[]) => ({
      nombre,
      pagina: 'principal',
      vista,
      acciones,
      escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: ajustesCampeones, campeones, ...escena },
    });
    const pulsarPestana = (texto: string) =>
      `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => b.textContent.trim() === ${JSON.stringify(texto)})?.click()`;

    // «Datos limitados»: el primer campeón y rol de la lista con pocas partidas (dato real del servidor).
    const listaClasif = (campeones.clasificatoria as { resultado: { lista: ListaCampeones } }).resultado.lista;
    const limitado = listaClasif.campeones.find((c) => c.datosLimitados && c.rol && d.campeones[c.campeon.toLowerCase()]);
    let estadoLimitado: EstadoPrincipal | null = null;
    if (limitado?.rol) {
      const b = await buildDe(limitado.campeon, limitado.rol);
      if (b) estadoLimitado = estadoPrincipal(b, limitado.rol, await rolesDe(limitado.campeon), d);
    }
    // «Build no disponible»: Ahri en la jungla, si el servidor no la tiene (se comprueba, no se supone).
    const sinBuild = (await buildDe('Ahri', 'JUNGLE')) === null;
    const estadoSinBuild: EstadoPrincipal | null = sinBuild
      ? { ...estadoAhri, seleccion: { ...estadoAhri.seleccion!, rol: 'JUNGLE', resultado: { estado: 'no_disponible' }, opcion: 0 } }
      : null;

    // Overlay: partida con KDA, y los modos ARAM y Arena calculados por el motor real.
    const conKda = { ...partida, cs: 61, equipo: 'ORDER' as const, kda: { k: 4, d: 2, a: 7 } };
    const overlayPartida: EstadoOverlay = { ...resumenOverlay(conKda, seg.build, seg.rol, {}, d.version, null), proximaHabilidad: habilidad, compra: estadoOverlay.compra };
    const overlayModo = (modo: 'aram' | 'arena') => ({
      ...resumenOverlay({ ...conKda, modo }, seg.build, seg.rol, {}, d.version, null),
      compra: estadoOverlay.compra,
    });
    const avisoVoz: AvisoOverlay = { texto: t('aviso.habilidad', { nivel: 6, habilidad }), voz: false, tipo: 'habilidad' };
    const avisoJungla: AvisoOverlay = { texto: t('junglaEnemiga.aviso', { zona: t('junglaEnemiga.zona.bot') }), voz: false };
    const lado = 176;
    const marco = { x: (1280 - lado) / 1280, y: (800 - lado) / 800, lado: lado / 800 };
    const capa = { svg: svgMinimapaEsquema(), x: 1280 - lado, y: 800 - lado, lado };
    const configJungla = { ...AJUSTES.overlay, jungla: { presentacion: 'minimapa' as const, minimapa: marco } };
    const marcas = { azul: 362, gromp: 442, krugs: 500, escarabajoAbajo: 480 };
    const overlay = (nombre: string, escena: Record<string, unknown>) => ({ nombre, pagina: 'overlay', escena: { config: AJUSTES.overlay, fondo, ...escena } });

    // Clip 2: ocho segundos de partida que avanzan (cuentas atrás, aviso de voz y aviso del jungla enemigo).
    const pasosPartida = Array.from({ length: 9 }, (_, i) => {
      const tiempo = 562 + i;
      return [
        { ms: i * 1000, canal: 'estado', dato: { ...resumenOverlay({ ...conKda, tiempo }, seg.build, seg.rol, {}, d.version, null), proximaHabilidad: habilidad, compra: estadoOverlay.compra } },
        { ms: i * 1000, canal: 'jungla', dato: estadoJungla(marcas, tiempo, 'ORDER') },
      ];
    }).flat();

    const lista = [
      principal('01-ventana-build-ahri-mid-con-importar', 'campeon', {}),
      principal('02-campeones-tier-list-clasificatoria', 'campeones', {}),
      principal('03-campeones-modo-aram', 'campeones', {}, [pulsarPestana(t('modo.aram'))]),
      principal('04-campeones-modo-arena', 'campeones', {}, [pulsarPestana(t('modo.arena'))]),
      principal('05-bienvenida-primera-vez', 'campeon', { ajustes: { ...AJUSTES, bienvenidaVista: false, ultimaVersionVista: null } }),
      principal('06-novedades-3-0', 'novedades', {}),
      ...(estadoLimitado ? [principal(`07-datos-limitados-${limitado!.campeon.toLowerCase()}-${limitado!.rol!.toLowerCase()}`, 'campeon', { estado: estadoLimitado })] : []),
      ...(estadoSinBuild ? [principal('08-build-no-disponible-ahri-jungla', 'campeon', { estado: estadoSinBuild })] : []),
      overlay('09-pantalla-de-carga-tarjetas', { modo: 'carga', carga: cargaBase, fondo: fondoCarga }),
      overlay('10-partida-overlay-objetivos-flecha-cs-kda-compra-aviso-voz', { estado: overlayPartida, aviso: avisoVoz }),
      overlay('11-partida-aviso-jungla-enemigo-kill', { estado: overlayPartida, aviso: avisoJungla, config: configJungla, jungla: estadoJungla(marcas, 562, 'ORDER'), capa }),
      overlay('12-minimapa-temporizadores-lado-azul', { estado: overlayPartida, config: configJungla, jungla: estadoJungla(marcas, 562, 'ORDER'), capa }),
      overlay('13-minimapa-temporizadores-lado-rojo', { estado: overlayPartida, config: configJungla, jungla: estadoJungla(marcas, 562, 'CHAOS'), capa }),
      overlay('14-modo-mover-marco-del-minimapa', { estado: overlayPartida, config: configJungla, jungla: estadoJungla(marcas, 562, 'ORDER'), capa, mover: true }),
      overlay('15-overlay-aram', { estado: overlayModo('aram') }),
      overlay('16-overlay-arena', { estado: overlayModo('arena') }),
      {
        ...overlay('clip-01-pantalla-de-carga-a-partida', {
          modo: 'carga',
          carga: cargaBase,
          fondo: fondoCarga,
          pasos: [
            { ms: 3500, canal: 'estado', dato: overlayPartida },
            { ms: 3500, canal: 'modo', dato: 'partida' },
            { ms: 4300, canal: 'aviso', dato: avisoVoz },
          ],
        }),
        video: { segundos: 8 },
      },
      {
        ...overlay('clip-02-overlay-en-partida-actualizandose', {
          config: configJungla,
          capa,
          pasos: [...pasosPartida, { ms: 1200, canal: 'aviso', dato: avisoVoz }, { ms: 4500, canal: 'aviso', dato: avisoJungla }],
        }),
        video: { segundos: 8 },
      },
    ];
    return lista;
  }

  if (TIKTOK) capturas.splice(0, capturas.length, ...(await escenasTiktok()));

  mkdirSync(SALIDA, { recursive: true });
  const temporal = mkdtempSync(join(tmpdir(), 'coach-capturas-'));
  const plan = join(temporal, 'plan.json');
  // Cada escena lleva el idioma: el preload simulado lo da a la ventana como el de verdad.
  const conIdioma = capturas.map((c) => ({ ...c, escena: { ...(c.escena as object), idioma: IDIOMA_CAPTURAS } }));
  writeFileSync(plan, JSON.stringify({ salida: SALIDA, dirRenderer: join(DIR_APP, 'out', 'renderer'), capturas: conIdioma, soloPng: TIKTOK }));

  const electron = createRequire(import.meta.url)('electron') as unknown as string;
  const codigo = await new Promise<number>((resolver) => {
    const hijo = spawn(electron, [join(DIR_APP, 'tools', 'capturas-electron.cjs'), `--coach-plan=${plan}`, `--user-data-dir=${join(temporal, 'perfil')}`], {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, ELECTRON_RENDERER_URL: undefined },
    });
    hijo.on('exit', (c) => resolver(c ?? 1));
  });
  rmSync(temporal, { recursive: true, force: true });
  if (codigo !== 0) fallar(`Electron terminó con código ${codigo}.`);
  console.log(`[capturas] Listo: ${SALIDA}`);
}

void main();
