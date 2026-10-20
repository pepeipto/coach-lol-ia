import { leerConfiguracion, type Configuracion } from './config';
import { abrirDb } from './db';
import { crearServidor } from './http';
import { iniciarProgramacion } from './programacion';
import { crearClienteStripe } from './premium/stripe';
import { crearRiotApi } from './riot/riotApi';
import { crearEstadoClaveRiot } from './riot/estadoClave';
import { crearClienteAsistente } from './asistente/asistente';
import { crearClienteCoachIa } from './coachIa/rutas';
import { purgarPruebasIp } from './premium/pruebas';

let config: Configuracion;
try {
  config = leerConfiguracion(process.env);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
const { clave, puerto, rutaDb, maxPartidas, regionesRecolector, stripe, urlWeb, trustProxy, salPrueba, asistente, coachIa, premiumHabilitado, porcentajeInteractivo } = config;

const db = abrirDb(rutaDb);
// Al arrancar se borran los hash de IP de las pruebas de hace más de 30 días (también al pedir una prueba).
purgarPruebasIp(db, Date.now());
// Un solo cliente de Riot (y un solo limitador) para el recolector y la pantalla de carga: comparten clave.
// La pantalla de carga (ruta pública) usa como mucho RIOT_PORCENTAJE_INTERACTIVO de cada regla.
// Estado de la clave (la de desarrollo caduca a las 24 h) para /salud, que vigila el aviso de GitHub Actions.
const claveRiot = crearEstadoClaveRiot({ comprobar: () => api.comprobarClave() });
const api = crearRiotApi({
  clave,
  fraccionInteractiva: porcentajeInteractivo / 100,
  alResponder: (estadoHttp) => claveRiot.observar(estadoHttp),
});
const detener = iniciarProgramacion({
  api,
  db,
  maxPartidasPorRegion: maxPartidas,
  regiones: regionesRecolector,
});
console.info(`[servidor] Regiones del recolector: ${regionesRecolector.join(', ')}`);
const app = crearServidor(db, {
  urlWeb,
  trustProxy,
  premiumHabilitado,
  salPrueba,
  jugadores: { api },
  claveRiot,
  asistente: asistente ? { crear: crearClienteAsistente(), ...asistente } : null,
  coachIa: coachIa ? { crear: crearClienteCoachIa(), ...coachIa } : null,
  stripe: stripe
    ? { cliente: crearClienteStripe({ clave: stripe.clave }), secretoWebhook: stripe.webhook, precioId: stripe.precio }
    : undefined,
});
if (!premiumHabilitado) console.info('[servidor] Premium desactivado (PREMIUM_HABILITADO no es 1): Coach LoL IA es gratis.');
else if (!stripe) console.warn('[servidor] Stripe no está configurado: las rutas de premium responden 503.');
if (!asistente) console.warn('[servidor] ANTHROPIC_API_KEY no está definida: el asistente y el coach con IA responden 503.');
else if (coachIa) console.info(`[servidor] Coach con IA: análisis con ${coachIa.modeloAnalisis}, consejos con ${coachIa.modeloConsejo}`);

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
