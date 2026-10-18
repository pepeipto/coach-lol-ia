import { writeFileSync } from 'node:fs';
import { Agent, get } from 'node:https';

const INTERVALO_MS = 5000;
const agente = new Agent({ rejectUnauthorized: false }); // certificado autofirmado de Riot, solo 127.0.0.1

function obtener(url: string): Promise<unknown> {
  return new Promise((resolver, rechazar) => {
    const req = get(url, { agent: agente, timeout: 4000 }, (res) => {
      const trozos: Buffer[] = [];
      res.on('data', (t: Buffer) => trozos.push(t));
      res.on('error', rechazar);
      res.on('end', () => {
        try {
          if ((res.statusCode ?? 0) >= 300) throw new Error(`HTTP ${res.statusCode}`);
          resolver(JSON.parse(Buffer.concat(trozos).toString('utf8')));
        } catch (e) {
          rechazar(e);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', rechazar);
  });
}

const salida = process.argv[2];
if (!salida) {
  console.error('Uso: npm run grabar -w app -- <salida.json>');
  process.exit(1);
}
const frames: unknown[] = [];
console.log(`Grabando un fotograma cada ${INTERVALO_MS / 1000} s en ${salida}. Ctrl+C para terminar.`);
setInterval(() => {
  obtener('https://127.0.0.1:2999/liveclientdata/allgamedata').then(
    (f) => {
      frames.push(f);
      writeFileSync(salida, JSON.stringify(frames, null, 2));
      console.log(`Fotograma ${frames.length} guardado`);
    },
    (e) => console.log(`Sin partida: ${e instanceof Error ? e.message : String(e)}`),
  );
}, INTERVALO_MS);
