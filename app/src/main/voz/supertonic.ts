/**
 * Síntesis con Supertonic 3 (Supertone Inc.; código MIT, pesos bajo BigScience OpenRAIL-M) sobre ONNX Runtime.
 * Es una adaptación a TypeScript, con arrays tipados, del ejemplo oficial de Node.js
 * (github.com/supertone-inc/supertonic/tree/main/nodejs, MIT). No usa eSpeak ni ningún fonemizador: el texto se
 * convierte a índices Unicode, así que no hay piezas GPL en la cadena.
 *
 * ONNX Runtime se inyecta (interfaz mínima `OrtMinimo`) para poder probar el preprocesado y las máscaras sin el
 * módulo nativo.
 */

/** Idiomas de Supertonic 3 que usa la app (el modelo admite 31). */
export type IdiomaSupertonic = 'es' | 'en' | 'pt' | 'fr' | 'de';

export interface TensorMinimo {
  readonly data: ArrayLike<number> | ArrayLike<bigint>;
  readonly dims: readonly number[];
}
export interface SesionMinima {
  run(entradas: Record<string, TensorMinimo>): Promise<Record<string, TensorMinimo>>;
  release?(): Promise<void>;
}
export interface OrtMinimo {
  Tensor: new (tipo: 'float32' | 'int64', datos: Float32Array | BigInt64Array, dims: number[]) => TensorMinimo;
  InferenceSession: { create(ruta: string, opciones?: Record<string, unknown>): Promise<SesionMinima> };
}

export interface ConfigSupertonic {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { chunk_compress_factor: number; latent_dim: number };
}

/** Estilo de voz (M1…M5, F1…F5): los dos tensores del JSON oficial, ya aplanados. */
export interface EstiloVoz {
  ttl: { datos: Float32Array; dims: [number, number, number] };
  dp: { datos: Float32Array; dims: [number, number, number] };
}

/** Archivos del modelo dentro de su carpeta (los del paquete que descarga la app). */
export const ARCHIVOS_MODELO = {
  duracion: 'duration_predictor.int8.onnx',
  texto: 'text_encoder.int8.onnx',
  estimador: 'vector_estimator.int8.onnx',
  vocoder: 'vocoder.int8.onnx',
  config: 'tts.json',
  indice: 'unicode_indexer.json',
} as const;

const SUSTITUCIONES: [string, string][] = [
  ['–', '-'],
  ['‑', '-'],
  ['—', '-'],
  ['_', ' '],
  ['“', '"'],
  ['”', '"'],
  ['‘', "'"],
  ['’', "'"],
  ['´', "'"],
  ['`', "'"],
  ['[', ' '],
  [']', ' '],
  ['|', ' '],
  ['/', ' '],
  ['#', ' '],
  ['→', ' '],
  ['←', ' '],
];
const EMOJIS =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;

/** Normaliza el texto como el preprocesado oficial y lo envuelve en las etiquetas del idioma (`<es>…</es>`). */
export function preprocesar(texto: string, idioma: IdiomaSupertonic): string {
  let t = texto.normalize('NFKD').replace(EMOJIS, '');
  for (const [de, a] of SUSTITUCIONES) t = t.replaceAll(de, a);
  t = t.replace(/[♥☆♡©\\]/g, '');
  t = t.replace(/ ([,.!?;:'])/g, '$1');
  while (t.includes('""')) t = t.replace('""', '"');
  while (t.includes("''")) t = t.replace("''", "'");
  t = t.replace(/\s+/g, ' ').trim();
  if (!/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(t)) t += '.';
  return `<${idioma}>${t}</${idioma}>`;
}

/** Índices del modelo para cada unidad UTF-16 del texto ya preprocesado (0 si el carácter no está). */
export function aIndices(texto: string, indice: ArrayLike<number>): BigInt64Array {
  const salida = new BigInt64Array(texto.length);
  for (let i = 0; i < texto.length; i++) salida[i] = BigInt(indice[texto.charCodeAt(i)] ?? 0);
  return salida;
}

/** Número de bloques latentes para una duración (s), con el tamaño de bloque del modelo. */
export function bloquesLatentes(segundos: number, cfg: ConfigSupertonic): number {
  const muestras = Math.floor(segundos * cfg.ae.sample_rate);
  const bloque = cfg.ae.base_chunk_size * cfg.ttl.chunk_compress_factor;
  return Math.max(1, Math.floor((muestras + bloque - 1) / bloque));
}

/** Ruido gaussiano (Box-Muller) con el generador indicado (Math.random por defecto). */
export function ruidoNormal(n: number, aleatorio: () => number = Math.random): Float32Array {
  const salida = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(1e-10, aleatorio());
    const u2 = aleatorio();
    salida[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return salida;
}

/** Lee un estilo de voz del JSON oficial (`style_ttl` y `style_dp` con `dims` y `data` anidado). */
export function leerEstilo(json: unknown): EstiloVoz {
  const o = json as { style_ttl?: { dims?: number[]; data?: unknown }; style_dp?: { dims?: number[]; data?: unknown } };
  const tensor = (t: { dims?: number[]; data?: unknown } | undefined, nombre: string) => {
    const dims = t?.dims;
    if (!Array.isArray(dims) || dims.length !== 3 || dims[0] !== 1) throw new Error(`Estilo de voz no válido (${nombre})`);
    const plano = (Array.isArray(t?.data) ? (t.data as unknown[]).flat(Infinity) : []) as number[];
    if (plano.length !== dims[0]! * dims[1]! * dims[2]!) throw new Error(`Estilo de voz incompleto (${nombre})`);
    return { datos: Float32Array.from(plano), dims: dims as [number, number, number] };
  };
  return { ttl: tensor(o.style_ttl, 'ttl'), dp: tensor(o.style_dp, 'dp') };
}

export interface OpcionesSintesis {
  /** Pasos de la estimación por flujo: más pasos, más calidad y más CPU (8 en el ejemplo oficial). */
  pasos: number;
  /** Velocidad (1,05 en el ejemplo oficial). */
  velocidad?: number;
  aleatorio?: () => number;
}

export interface AudioSintetizado {
  muestras: Float32Array;
  sampleRate: number;
}

/** Modelo cargado: cuatro sesiones ONNX, la configuración y el índice Unicode. */
export class Supertonic {
  private constructor(
    private readonly ort: OrtMinimo,
    private readonly cfg: ConfigSupertonic,
    private readonly indice: ArrayLike<number>,
    private readonly duracion: SesionMinima,
    private readonly codificador: SesionMinima,
    private readonly estimador: SesionMinima,
    private readonly vocoder: SesionMinima,
  ) {}

  get sampleRate(): number {
    return this.cfg.ae.sample_rate;
  }

  /**
   * Carga el modelo de una carpeta. `hilos` limita los hilos de ONNX Runtime (1–2: la partida va primero) y la
   * ejecución es secuencial.
   */
  static async cargar(ort: OrtMinimo, leer: (archivo: string) => string, dir: (archivo: string) => string, hilos: number): Promise<Supertonic> {
    const cfg = JSON.parse(leer(ARCHIVOS_MODELO.config)) as ConfigSupertonic;
    const indice = JSON.parse(leer(ARCHIVOS_MODELO.indice)) as number[];
    const opciones = {
      intraOpNumThreads: hilos,
      interOpNumThreads: 1,
      executionMode: 'sequential',
      graphOptimizationLevel: 'all',
      executionProviders: ['cpu'],
      // Sin espera activa: los hilos de ONNX Runtime no giran en vacío entre operaciones (menos CPU en la partida).
      extra: { session: { intra_op: { allow_spinning: '0' }, inter_op: { allow_spinning: '0' } } },
    };
    const [d, c, e, v] = await Promise.all(
      [ARCHIVOS_MODELO.duracion, ARCHIVOS_MODELO.texto, ARCHIVOS_MODELO.estimador, ARCHIVOS_MODELO.vocoder].map((a) =>
        ort.InferenceSession.create(dir(a), opciones),
      ),
    );
    return new Supertonic(ort, cfg, indice, d!, c!, e!, v!);
  }

  async sintetizar(texto: string, idioma: IdiomaSupertonic, estilo: EstiloVoz, o: OpcionesSintesis): Promise<AudioSintetizado> {
    const { Tensor } = this.ort;
    const procesado = preprocesar(texto, idioma);
    const ids = aIndices(procesado, this.indice);
    const n = ids.length;
    const textIds = new Tensor('int64', ids, [1, n]);
    const textMask = new Tensor('float32', new Float32Array(n).fill(1), [1, 1, n]);
    const styleTtl = new Tensor('float32', estilo.ttl.datos, [...estilo.ttl.dims]);
    const styleDp = new Tensor('float32', estilo.dp.datos, [...estilo.dp.dims]);

    const dur = await this.duracion.run({ text_ids: textIds, style_dp: styleDp, text_mask: textMask });
    const segundos = Number((dur.duration!.data as ArrayLike<number>)[0]) / (o.velocidad ?? 1.05);
    const emb = await this.codificador.run({ text_ids: textIds, style_ttl: styleTtl, text_mask: textMask });

    const largo = bloquesLatentes(segundos, this.cfg);
    const dim = this.cfg.ttl.latent_dim * this.cfg.ttl.chunk_compress_factor;
    let latente = ruidoNormal(dim * largo, o.aleatorio);
    const mascaraLatente = new Tensor('float32', new Float32Array(largo).fill(1), [1, 1, largo]);
    const total = new Tensor('float32', Float32Array.of(o.pasos), [1]);
    for (let paso = 0; paso < o.pasos; paso++) {
      const r = await this.estimador.run({
        noisy_latent: new Tensor('float32', latente, [1, dim, largo]),
        text_emb: emb.text_emb!,
        style_ttl: styleTtl,
        text_mask: textMask,
        latent_mask: mascaraLatente,
        total_step: total,
        current_step: new Tensor('float32', Float32Array.of(paso), [1]),
      });
      latente = Float32Array.from(r.denoised_latent!.data as ArrayLike<number>);
    }
    const voc = await this.vocoder.run({ latent: new Tensor('float32', latente, [1, dim, largo]) });
    const wav = voc.wav_tts!.data as ArrayLike<number>;
    const util = Math.min(wav.length, Math.floor(segundos * this.sampleRate));
    return { muestras: Float32Array.from({ length: util }, (_, i) => wav[i]!), sampleRate: this.sampleRate };
  }

  async liberar(): Promise<void> {
    await Promise.all([this.duracion, this.codificador, this.estimador, this.vocoder].map((s) => s.release?.()));
  }
}

/** Float32 [-1, 1] → PCM de 16 bits little-endian (lo que viaja por IPC y se guarda en la caché). */
export function aPcm16(muestras: Float32Array): Uint8Array {
  const salida = new Uint8Array(muestras.length * 2);
  const vista = new DataView(salida.buffer);
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]!));
    vista.setInt16(i * 2, Math.round(s * 32767), true);
  }
  return salida;
}
