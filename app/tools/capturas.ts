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
import { ROLES, URL_VERSIONES, urlDatosDDragon, type Build, type Rol, type RolesCampeon } from '@coach/shared';
import { t } from '../src/shared/i18n';
import type { Ajustes, AvisoOverlay, EstadoLicencia, EstadoPrincipal, Panel, RecursosBuild } from '../src/shared/tiposApp';

const DIR_APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVIDOR = (process.env.COACH_SERVIDOR ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const SALIDA = resolve(process.env.CAPTURAS_SALIDA ?? join(DIR_APP, '..', '..', 'capturas'));
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
    pedir<{ data: Record<string, { key: string; id: string; name: string }> }>(urlDatosDDragon(version, 'champion'), 'Data Dragon'),
    pedir<{ data: Record<string, { name: string }> }>(urlDatosDDragon(version, 'item'), 'Data Dragon'),
    pedir<{ id: number; name: string; icon: string; slots: { runes: { id: number; name: string; icon: string }[] }[] }[]>(
      urlDatosDDragon(version, 'runesReforged'),
      'Data Dragon',
    ),
    pedir<{ data: Record<string, { key: string; name: string; image: { full: string } }> }>(urlDatosDDragon(version, 'summoner'), 'Data Dragon'),
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
  teclaOverlay: 'Alt+C',
  posicionOverlay: { x: 56, y: 150 },
};

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

  // Panel y aviso del overlay con los mismos textos que genera el motor en partida.
  const compraId = segunda.build.nucleo[1] ?? segunda.build.nucleo[0] ?? 0;
  const panel: Panel = {
    proximaCompra: t('panel.compra', { objeto: d.objetos[compraId] ?? String(compraId), oro: 425 }),
    proximoObjetivo: t('aviso.objetivoPronto', { objetivo: t('objetivo.dragon'), segundos: 38 }),
    compraId,
    version: d.version,
  };
  const habilidad = segunda.build.ordenHabilidades[5] ?? 'R';
  const aviso: AvisoOverlay = { texto: t('aviso.habilidad', { nivel: 6, habilidad }), voz: false, tipo: 'habilidad' };

  const estadoAhri = estadoPrincipal(ahri, 'MIDDLE', rolesAhri, d);
  const capturas = [
    { nombre: 'campeon-gratis', pagina: 'principal', vista: 'campeon', escena: { estado: estadoAhri, licencia: GRATIS, ajustes: AJUSTES } },
    { nombre: 'campeon-premium', pagina: 'principal', vista: 'campeon', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
    { nombre: 'premium', pagina: 'principal', vista: 'premium', escena: { estado: estadoAhri, licencia: GRATIS, ajustes: AJUSTES } },
    { nombre: 'overlay-ajustes', pagina: 'principal', vista: 'overlay', escena: { estado: estadoAhri, licencia: PREMIUM, ajustes: AJUSTES } },
    {
      nombre: 'overlay-partida',
      pagina: 'overlay',
      escena: { panel, aviso, posicion: AJUSTES.posicionOverlay, fondo: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c2.id}_0.jpg` },
    },
  ];

  mkdirSync(SALIDA, { recursive: true });
  const temporal = mkdtempSync(join(tmpdir(), 'coach-capturas-'));
  const plan = join(temporal, 'plan.json');
  writeFileSync(plan, JSON.stringify({ salida: SALIDA, dirRenderer: join(DIR_APP, 'out', 'renderer'), capturas }));

  const electron = createRequire(import.meta.url)('electron') as unknown as string;
  const codigo = await new Promise<number>((resolver) => {
    const hijo = spawn(electron, [join(DIR_APP, 'tools', 'capturas-electron.cjs'), `--coach-plan=${plan}`], {
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
