import { leerConfiguracion, type Configuracion } from './config';
import { abrirDb } from './db';
import { crearServidor } from './http';
import { iniciarProgramacion } from './programacion';
import { crearClienteStripe } from './premium/stripe';
import { crearRiotApi } from './riot/riotApi';
import { crearClienteAsistente } from './asistente/asistente';
import { purgarPruebasIp } from './premium/pruebas';

let config: Configuracion;
try {
  config = leerConfiguracion(process.env);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
const { clave, puerto, rutaDb, maxPartidas, regionesRecolector, stripe, urlWeb, trustProxy, salPrueba, asistente, premiumHabilitado } = config;

const db = abrirDb(rutaDb);
// Al arrancar se borran los hash de IP de las pruebas de hace más de 30 días (también al pedir una prueba).
purgarPruebasIp(db, Date.now());
// Un solo cliente de Riot (y un solo limitador) para el recolector y la pantalla de carga: comparten clave.
const api = crearRiotApi({ clave });
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
  asistente: asistente ? { crear: crearClienteAsistente(), ...asistente } : null,
  stripe: stripe
    ? { cliente: crearClienteStripe({ clave: stripe.clave }), secretoWebhook: stripe.webhook, precioId: stripe.precio }
    : undefined,
});
if (!premiumHabilitado) console.info('[servidor] Premium desactivado (PREMIUM_HABILITADO no es 1): Coach LoL IA es gratis.');
else if (!stripe) console.warn('[servidor] Stripe no está configurado: las rutas de premium responden 503.');
if (!asistente) console.warn('[servidor] ANTHROPIC_API_KEY no está definida: el asistente responde 503.');

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
