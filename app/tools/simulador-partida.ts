import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Simulador {
  puerto: number;
  cerrar(): Promise<void>;
}

/** Sirve /liveclientdata/allgamedata avanzando un fotograma cada `intervaloMs`; al final repite el último. */
export function iniciarSimulador(
  frames: unknown[],
  o: { puerto?: number; intervaloMs?: number; host?: string } = {},
): Promise<Simulador> {
  if (frames.length === 0) return Promise.reject(new Error('La grabación no tiene fotogramas'));
  const intervaloMs = o.intervaloMs ?? 1000;
  const inicio = Date.now();
  const servidor: Server = createServer((req, res) => {
    if (req.url?.split('?')[0] !== '/liveclientdata/allgamedata') {
      res.writeHead(404).end();
      return;
    }
    const indice = Math.min(frames.length - 1, Math.floor((Date.now() - inicio) / intervaloMs));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(frames[indice]));
  });
  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(o.puerto ?? 2999, o.host ?? '127.0.0.1', () => {
      resolver({
        puerto: (servidor.address() as AddressInfo).port,
        cerrar: () => new Promise((r) => {
          servidor.closeAllConnections();
          servidor.close(() => r());
        }),
      });
    });
  });
}

async function principal(): Promise<void> {
  const [ruta, velocidadTxt] = process.argv.slice(2);
  const velocidad = Number(velocidadTxt ?? 1);
  if (!ruta || !(velocidad > 0)) {
    console.error('Uso: npm run simular -w app -- <grabacion.json> [velocidad]');
    process.exit(1);
  }
  const frames = JSON.parse(readFileSync(ruta, 'utf8')) as unknown[];
  const sim = await iniciarSimulador(frames, { intervaloMs: 1000 / velocidad });
  console.log(`Simulador en http://127.0.0.1:${sim.puerto} (${frames.length} fotogramas, velocidad ${velocidad}). Ctrl+C para salir.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  principal().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
