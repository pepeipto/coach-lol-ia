import { abrirDb } from './db';
import { crearServidor } from './http';
import { iniciarProgramacion } from './programacion';
import { crearRiotApi } from './riot/riotApi';

const clave = process.env.RIOT_API_KEY;
if (!clave) {
  console.error('Falta la variable de entorno RIOT_API_KEY.');
  process.exit(1);
}

const puerto = Number(process.env.PUERTO ?? 8080);
const rutaDb = process.env.RUTA_DB ?? './coach.db';
const maxPartidas = process.env.MAX_PARTIDAS ? Number(process.env.MAX_PARTIDAS) : undefined;

const db = abrirDb(rutaDb);
const detener = iniciarProgramacion({
  api: crearRiotApi({ clave }),
  db,
  maxPartidasPorRegion: maxPartidas,
});
const app = crearServidor(db);

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
