import { leerConfiguracion, type Configuracion } from './config';
import { abrirDb } from './db';
import { crearServidor } from './http';
import { iniciarProgramacion } from './programacion';
import { crearClienteStripe } from './premium/stripe';
import { crearRiotApi } from './riot/riotApi';
import { crearEstadoClaveRiot } from './riot/estadoClave';
import { crearAlmacenClave, registrarAdminClave } from './riot/claveAdmin';
import { crearClienteAsistente } from './asistente/asistente';
import { crearClienteCoachIa } from './coachIa/rutas';
import { purgarPruebasIp } from './premium/pruebas';
import { crearServicioParche } from './parche/rutas';

let config: Configuracion;
try {
  config = leerConfiguracion(process.env);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
const { clave, admin, puerto, rutaDb, maxPartidas, regionesRecolector, stripe, urlWeb, trustProxy, cabeceraIpCliente, salPrueba, asistente, coachIa, ficha, consejosCruce, parche, premiumHabilitado, claveProduccion, porcentajeInteractivo, jugadores } = config;

/** Lo que dura una clave de desarrollo de Riot. */
const DURACION_CLAVE_DESARROLLO_MS = 24 * 60 * 60_000;

const db = abrirDb(rutaDb);
// Al arrancar se borran los hash de IP de las pruebas de hace más de 30 días (también al pedir una prueba).
purgarPruebasIp(db, Date.now());
// Un solo cliente de Riot (y un solo limitador) para el recolector y la pantalla de carga: comparten clave.
// La pantalla de carga (ruta pública) usa como mucho RIOT_PORCENTAJE_INTERACTIVO de cada regla.
// Estado de la clave (la de desarrollo caduca a las 24 h) para /salud, que vigila el aviso de GitHub Actions.
// 3.9.1: la clave puede renovarse en marcha desde /admin/clave (guardada cifrada); si no, la de RIOT_API_KEY.
const almacenClave = crearAlmacenClave(db, clave, admin);
const claveRiot = crearEstadoClaveRiot({
  comprobar: () => api.comprobarClave(),
  // Al volver a funcionar la clave, un ciclo ya (y no hasta 6 h después): las builds se ponen al día cuanto antes.
  alCambiar: (nuevo, anterior) => {
    if (nuevo === 'ok' && anterior === 'caducada' && detener.lanzar()) console.info('[ciclo] La clave vuelve a funcionar: empieza un ciclo ahora.');
  },
});
const api = crearRiotApi({
  clave: () => almacenClave.actual(),
  fraccionInteractiva: porcentajeInteractivo / 100,
  alResponder: (estadoHttp) => claveRiot.observar(estadoHttp),
});
// Novedades del parche: el ciclo lee las notas oficiales de cada parche nuevo y la ruta /parche sirve los resúmenes.
const servicioParche = crearServicioParche(db, parche ? { crear: crearClienteCoachIa(), ...parche } : null);
const detener = iniciarProgramacion({
  api,
  db,
  parche: servicioParche,
  maxPartidasPorRegion: maxPartidas,
  regiones: regionesRecolector,
});
console.info(`[servidor] Regiones del recolector: ${regionesRecolector.join(', ')}`);
const app = crearServidor(db, {
  urlWeb,
  trustProxy,
  cabeceraIpCliente,
  premiumHabilitado,
  salPrueba,
  jugadores: { api, ...jugadores },
  claveRiot,
  // La clave de desarrollo caduca 24 h después de generarla: se estima desde que el servidor empezó a usarla.
  caducidadClaveRiot: claveProduccion ? undefined : () => new Date(almacenClave.desde() + DURACION_CLAVE_DESARROLLO_MS).toISOString(),
  asistente: asistente ? { crear: crearClienteAsistente(), ...asistente } : null,
  coachIa: coachIa ? { crear: crearClienteCoachIa(), ...coachIa } : null,
  ficha: ficha ? { crear: crearClienteCoachIa(), ...ficha } : null,
  consejosCruce: consejosCruce ? { crear: crearClienteCoachIa(), ...consejosCruce } : null,
  parche: servicioParche,
  stripe: stripe
    ? { cliente: crearClienteStripe({ clave: stripe.clave }), secretoWebhook: stripe.webhook, precioId: stripe.precio }
    : undefined,
});
registrarAdminClave(app, {
  almacen: almacenClave,
  admin,
  comprobar: (candidata) => api.comprobarClave(candidata),
  alGuardar: () => claveRiot.observar(200),
});
if (!admin) console.info('[servidor] ADMIN_TOKEN no está definida: la página /admin/clave está desactivada.');
else console.info(`[servidor] Clave de Riot en uso: la de ${almacenClave.origen() === 'pagina' ? 'la página de administración' : 'RIOT_API_KEY'}.`);
if (!premiumHabilitado) console.info('[servidor] Premium desactivado (PREMIUM_HABILITADO no es 1): Coach LoL IA es gratis.');
else if (!stripe) console.warn('[servidor] Stripe no está configurado: las rutas de premium responden 503.');
if (!asistente) console.warn('[servidor] ANTHROPIC_API_KEY no está definida: el asistente y el coach con IA responden 503.');
else if (coachIa) console.info(`[servidor] Coach con IA: análisis con ${coachIa.modeloAnalisis}, consejos con ${coachIa.modeloConsejo}`);
if (parche) console.info(`[servidor] Novedades del parche con ${parche.modelo} (como mucho ${parche.maxDia} resúmenes nuevos al día)`);
if (ficha) console.info(`[servidor] Ficha del campeón con ${ficha.modelo} (como mucho ${ficha.maxDia} fichas nuevas al día)`);
if (consejosCruce) console.info(`[servidor] Consejos del enfrentamiento con ${consejosCruce.modelo} (como mucho ${consejosCruce.maxDia} nuevos al día)`);

async function apagar(): Promise<void> {
  detener();
  await app.close();
  db.cerrar();
  process.exit(0);
}
process.on('SIGINT', () => void apagar());
process.on('SIGTERM', () => void apagar());

await app.listen({ host: '0.0.0.0', port: puerto });
console.info(`[servidor] escuchando en el puerto ${puerto}`);
