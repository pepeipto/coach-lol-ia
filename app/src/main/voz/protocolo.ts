import type { IdiomaSupertonic } from './supertonic';

/** Mensajes entre main y el proceso de la voz natural. */
export type MensajeAlProceso =
  | { tipo: 'cargar'; dir: string; hilos: number }
  | { tipo: 'sintetizar'; id: number; texto: string; idioma: IdiomaSupertonic; estilo: string; pasos: number };

export type MensajeDelProceso =
  | { tipo: 'cargado'; sampleRate: number }
  | { tipo: 'audio'; id: number; sampleRate: number; pcm: Uint8Array; ms: number; cpuMs: number }
  | { tipo: 'error'; id: number | null; mensaje: string };
