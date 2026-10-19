/**
 * Proceso auxiliar de la voz natural (utilityProcess de Electron). Aquí corre ONNX Runtime, aislado del proceso
 * principal y con prioridad baja: si el sistema va justo, la partida va primero. Atiende una frase a la vez.
 */
import { readFileSync } from 'node:fs';
import { constants, setPriority } from 'node:os';
import { join } from 'node:path';
import type { MensajeAlProceso, MensajeDelProceso } from './protocolo';
import { aPcm16, leerEstilo, Supertonic, type EstiloVoz, type OrtMinimo } from './supertonic';

interface PuertoPadre {
  on(evento: 'message', cb: (e: { data: MensajeAlProceso }) => void): void;
  postMessage(m: MensajeDelProceso): void;
}
const puerto = (process as unknown as { parentPort?: PuertoPadre }).parentPort;

try {
  setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // sin permiso para cambiar la prioridad: sigue con la normal
}

let modelo: Supertonic | null = null;
let dirModelo = '';
const estilos = new Map<string, EstiloVoz>();
let cola: Promise<void> = Promise.resolve();

const enviar = (m: MensajeDelProceso) => puerto?.postMessage(m);

function estilo(nombre: string): EstiloVoz {
  let e = estilos.get(nombre);
  if (!e) {
    if (!/^[A-Z][0-9]$/.test(nombre)) throw new Error('Estilo no válido');
    e = leerEstilo(JSON.parse(readFileSync(join(dirModelo, 'voice_styles', `${nombre}.json`), 'utf8')));
    estilos.set(nombre, e);
  }
  return e;
}

async function atender(m: MensajeAlProceso): Promise<void> {
  if (m.tipo === 'cargar') {
    try {
      const mod = (await import('onnxruntime-node')) as unknown as OrtMinimo & { default?: OrtMinimo };
      const ort = mod.default ?? mod;
      dirModelo = m.dir;
      modelo = await Supertonic.cargar(ort, (a) => readFileSync(join(m.dir, a), 'utf8'), (a) => join(m.dir, a), m.hilos);
      enviar({ tipo: 'cargado', sampleRate: modelo.sampleRate });
    } catch (e) {
      enviar({ tipo: 'error', id: null, mensaje: `No se pudo cargar el modelo: ${(e as Error).message}` });
    }
    return;
  }
  if (!modelo) return enviar({ tipo: 'error', id: m.id, mensaje: 'Modelo sin cargar' });
  try {
    const inicio = performance.now();
    const cpu = process.cpuUsage();
    const audio = await modelo.sintetizar(m.texto, m.idioma, estilo(m.estilo), { pasos: m.pasos });
    const gasto = process.cpuUsage(cpu);
    const pcm = aPcm16(audio.muestras);
    enviar({
      tipo: 'audio',
      id: m.id,
      sampleRate: audio.sampleRate,
      pcm,
      ms: Math.round(performance.now() - inicio),
      cpuMs: Math.round((gasto.user + gasto.system) / 1000),
    });
  } catch (e) {
    enviar({ tipo: 'error', id: m.id, mensaje: (e as Error).message });
  }
}

puerto?.on('message', (e) => {
  cola = cola.then(() => atender(e.data));
});
