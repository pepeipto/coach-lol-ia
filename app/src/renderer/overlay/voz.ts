import { idiomaActual, type Idioma } from '../../shared/i18n';
import type { AudioVoz, FraseVoz, MotorVoz } from '../../shared/tiposApp';

const idioma = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');

/** Prefijo de la voz y orden de preferencia por variante para cada idioma de la app. */
const VOCES_IDIOMA: Record<Idioma, { prefijo: string; preferidas: string[] }> = {
  es: { prefijo: 'es', preferidas: ['es-mx', 'es-es'] },
  en: { prefijo: 'en', preferidas: ['en-us', 'en-gb'] },
  'pt-BR': { prefijo: 'pt', preferidas: ['pt-br', 'pt-pt'] },
  fr: { prefijo: 'fr', preferidas: ['fr-fr', 'fr-ca'] },
  de: { prefijo: 'de', preferidas: ['de-de', 'de-at', 'de-ch'] },
};

/** Voces del sistema en el idioma de la app (las que se ofrecen en los ajustes). */
export function vocesDeIdioma(voces: readonly SpeechSynthesisVoice[], idiomaApp: Idioma = idiomaActual()): SpeechSynthesisVoice[] {
  const { prefijo } = VOCES_IDIOMA[idiomaApp];
  return voces.filter((v) => idioma(v).startsWith(`${prefijo}-`) || idioma(v) === prefijo);
}

/** Voces en español del sistema (compatibilidad: `vocesDeIdioma(voces, 'es')`). */
export function vocesEspanol(voces: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return vocesDeIdioma(voces, 'es');
}

/**
 * Elige la voz: la de los ajustes (por voiceURI o nombre) si sigue instalada y es del idioma de la app; si no,
 * la variante preferida (es-MX y luego es-ES; en-US y luego en-GB…) y luego cualquiera del idioma. Null si no hay
 * ninguna: entonces la voz calla (los avisos siguen en pantalla) y Ajustes lo explica.
 */
export function elegirVoz(
  voces: readonly SpeechSynthesisVoice[],
  vozId: string | null = null,
  idiomaApp: Idioma = idiomaActual(),
): SpeechSynthesisVoice | null {
  const delIdioma = vocesDeIdioma(voces, idiomaApp);
  if (vozId) {
    const elegida = delIdioma.find((v) => v.voiceURI === vozId || v.name === vozId);
    if (elegida) return elegida;
  }
  for (const lang of VOCES_IDIOMA[idiomaApp].preferidas) {
    const v = delIdioma.find((x) => idioma(x) === lang);
    if (v) return v;
  }
  return delIdioma[0] ?? null;
}

/** Las voces pueden estar vacías hasta el evento 'voiceschanged'. */
export function vocesDisponibles(sintesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const ahora = sintesis.getVoices();
  if (ahora.length > 0) return Promise.resolve(ahora);
  return new Promise((resolver) => {
    const alCambiar = () => {
      sintesis.removeEventListener('voiceschanged', alCambiar);
      resolver(sintesis.getVoices());
    };
    sintesis.addEventListener('voiceschanged', alCambiar);
    setTimeout(alCambiar, 2000); // por si el evento nunca llega
  });
}

export interface OpcionesVoz {
  volumen: number;
  vozId: string | null;
  /** 3.1: con 'sistema' solo la de Windows; con los demás se prueba antes la voz que da main (pregrabada o natural). */
  motor?: MotorVoz;
}

/** Voz de main (3.1): pregrabada o natural; null = no hay (sin descargar, apagada o con fallo). */
export interface FuenteNatural {
  sintetizar(texto: string): Promise<AudioVoz | null>;
  /** Empieza a sintetizar una frase recién encolada para que esté lista cuando le toque. */
  preparar?(texto: string): void;
}

/**
 * Reproduce el audio de main con su volumen y avisa al terminar. Devuelve false si no pudo (p. ej. un clip
 * pregrabado dañado): entonces la frase sale con la voz de Windows.
 */
export interface Reproductor {
  /** `alEmpezar` recibe la duración del audio (ms) justo cuando empieza a sonar. */
  reproducir(audio: AudioVoz, volumen: number, alTerminar: () => void, alEmpezar?: (duracionMs: number) => void): Promise<boolean>;
  detener(): void;
}

/** Como mucho se espera esto a la voz de main; si tarda más, la frase sale con la de Windows. */
export const ESPERA_NATURAL_MS = 4000;

/** PCM de 16 bits little-endian → muestras en coma flotante. */
export function aMuestras(pcm: Uint8Array): Float32Array {
  const n = Math.floor(pcm.byteLength / 2);
  const vista = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const salida = new Float32Array(n);
  for (let i = 0; i < n; i++) salida[i] = vista.getInt16(i * 2, true) / 32768;
  return salida;
}

/** Muestras por debajo de esto cuentan como silencio al recortar los clips pregrabados. */
export const UMBRAL_SILENCIO = 0.004;

/** Recorta el silencio del principio y del final de un clip, dejando un margen (los MP3 traen relleno). */
export function recortarSilencio(m: Float32Array, sampleRate: number, umbral = UMBRAL_SILENCIO, margenMs = 12): Float32Array {
  let ini = 0;
  let fin = m.length;
  while (ini < fin && Math.abs(m[ini]!) < umbral) ini++;
  while (fin > ini && Math.abs(m[fin - 1]!) < umbral) fin--;
  if (ini >= fin) return new Float32Array(0);
  const margen = Math.round((sampleRate * margenMs) / 1000);
  return m.subarray(Math.max(0, ini - margen), Math.min(m.length, fin + margen));
}

/**
 * Une los clips de una frase pregrabada sin huecos ni chasquidos: recorta su silencio, deja la pausa que pida la
 * puntuación (pausasMs[i] tras el clip i) y, donde no hay pausa, los funde con un fundido cruzado muy corto.
 */
export function unirClips(clips: Float32Array[], sampleRate: number, pausasMs: number[], fundidoMs = 8): Float32Array {
  const recortados = clips.map((c) => recortarSilencio(c, sampleRate));
  const fundido = Math.round((sampleRate * fundidoMs) / 1000);
  const partes: { datos: Float32Array; solape: number; pausa: number }[] = recortados.map((datos, i) => {
    const pausa = i < recortados.length - 1 ? Math.round((sampleRate * (pausasMs[i] ?? 0)) / 1000) : 0;
    const siguiente = recortados[i + 1];
    const solape = i < recortados.length - 1 && pausa === 0 && siguiente ? Math.min(fundido, datos.length, siguiente.length) : 0;
    return { datos, solape, pausa };
  });
  const largo = partes.reduce((n, p) => n + p.datos.length - p.solape + p.pausa, 0);
  const salida = new Float32Array(Math.max(0, largo));
  let pos = 0;
  let solapeAnterior = 0;
  for (const p of partes) {
    for (let i = 0; i < p.datos.length; i++) {
      let v = p.datos[i]!;
      // Entrada del clip sobre la cola del anterior (fundido lineal): suma de rampas complementarias.
      if (i < solapeAnterior) v *= (i + 1) / (solapeAnterior + 1);
      if (i >= p.datos.length - p.solape) v *= (p.datos.length - i) / (p.solape + 1);
      salida[pos + i] = (salida[pos + i] ?? 0) + v;
    }
    pos += p.datos.length - p.solape + p.pausa;
    solapeAnterior = p.solape;
  }
  return salida;
}

/** Reproductor con Web Audio (un contexto que se crea la primera vez). */
export function crearReproductorWebAudio(crearContexto: () => AudioContext = () => new AudioContext()): Reproductor {
  let contexto: AudioContext | null = null;
  let fuente: AudioBufferSourceNode | null = null;
  let turno = 0;
  /** Clips pregrabados ya decodificados (se repiten mucho: nombres, números, partes fijas). */
  const decodificados = new Map<string, Float32Array>();
  const decodificar = async (ctx: AudioContext, id: string, datos: Uint8Array): Promise<Float32Array> => {
    const ya = decodificados.get(id);
    if (ya) return ya;
    const copia = datos.slice().buffer;
    const buffer = await ctx.decodeAudioData(copia);
    const canal = Float32Array.from(buffer.getChannelData(0));
    if (decodificados.size > 300) decodificados.delete(decodificados.keys().next().value!);
    decodificados.set(id, canal);
    return canal;
  };
  const detener = () => {
    if (!fuente) return;
    fuente.onended = null;
    try {
      fuente.stop();
    } catch {
      // ya había terminado
    }
    fuente = null;
  };
  return {
    async reproducir(audio, volumen, alTerminar, alEmpezar) {
      detener();
      const mio = ++turno;
      contexto ??= crearContexto();
      const ctx = contexto;
      void ctx.resume?.();
      let muestras: Float32Array;
      let sampleRate: number;
      if ('clips' in audio) {
        try {
          const canales = await Promise.all(audio.clips.map((c, i) => decodificar(ctx, audio.ids[i] ?? String(i), c)));
          sampleRate = ctx.sampleRate;
          muestras = unirClips(canales, sampleRate, audio.pausasMs);
        } catch {
          return false;
        }
        if (mio !== turno) return true; // se cortó mientras se decodificaba
      } else {
        muestras = aMuestras(audio.pcm);
        sampleRate = audio.sampleRate;
      }
      if (muestras.length === 0) return false;
      const buffer = ctx.createBuffer(1, muestras.length, sampleRate);
      buffer.getChannelData(0).set(muestras);
      const ganancia = ctx.createGain();
      ganancia.gain.value = volumen;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ganancia).connect(ctx.destination);
      src.onended = () => {
        if (fuente === src) fuente = null;
        alTerminar();
      };
      fuente = src;
      src.start();
      alEmpezar?.((muestras.length / sampleRate) * 1000);
      return true;
    },
    detener: () => {
      turno++;
      detener();
    },
  };
}

let reproductorPorDefecto: Reproductor | null = null;
const reproductorComun = (): Reproductor | null => {
  if (typeof AudioContext === 'undefined') return null;
  return (reproductorPorDefecto ??= crearReproductorWebAudio());
};

/** Espera a la voz de main como mucho `ms`; un fallo o un retraso dan null (se usa la de Windows). */
export async function conEspera<T>(p: Promise<T | null>, ms: number): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p.catch(() => null), new Promise<null>((ok) => (temporizador = setTimeout(() => ok(null), ms)))]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Lee un texto suelto (p. ej. «Probar voz»), cortando lo que estuviera sonando. Con la voz de main disponible
 * suena esa; si no, la de Windows del idioma de la app; sin ninguna, calla.
 */
export async function hablar(
  texto: string,
  sintesis: SpeechSynthesis | undefined = globalThis.speechSynthesis,
  opciones: OpcionesVoz = { volumen: 1, vozId: null },
  natural?: FuenteNatural,
  reproductor: Reproductor | null = natural ? reproductorComun() : null,
): Promise<void> {
  if (natural && reproductor && opciones.motor !== 'sistema') {
    const audio = await conEspera(natural.sintetizar(texto), ESPERA_NATURAL_MS * 3);
    if (audio) {
      sintesis?.cancel();
      if (await reproductor.reproducir(audio, opciones.volumen, () => {})) return;
    }
  }
  if (!sintesis) return;
  const voz = elegirVoz(await vocesDisponibles(sintesis), opciones.vozId);
  if (!voz) return;
  const frase = new SpeechSynthesisUtterance(texto);
  frase.voice = voz;
  frase.lang = voz.lang;
  frase.volume = opciones.volumen;
  sintesis.cancel();
  sintesis.speak(frase);
}

interface Pendiente {
  frase: FraseVoz;
  llegada: number;
  orden: number;
}

/** Si el motor de voz no avisa del final (pasa en Chromium), la cola sigue tras este tiempo. */
export const VIGILANTE_VOZ_MS = 12_000;
/** Con la voz de main se sabe lo que dura la frase: el vigilante espera eso más este margen (si pasa de 12 s). */
const MARGEN_VIGILANTE_MS = 2000;
/** Como mucho estas frases esperando: con más, se tira la menos urgente. */
export const MAX_PENDIENTES = 4;

/**
 * Cola central de la voz: una sola frase a la vez (nunca se pisan), primero la más urgente
 * (prioridad; a igualdad, la que llegó antes) y las que caducan mientras esperan no se dicen.
 */
export class ColaVoz {
  private pendientes: Pendiente[] = [];
  private hablando = false;
  private contador = 0;
  private opciones: OpcionesVoz = { volumen: 1, vozId: null };
  private vigilante: ReturnType<typeof setTimeout> | null = null;
  private turno = 0;

  constructor(
    private readonly sintesis: SpeechSynthesis | undefined = globalThis.speechSynthesis,
    private readonly ahora: () => number = Date.now,
    /** 3.1: voz de main (pregrabada o natural); sin ella, solo la de Windows. */
    private readonly natural?: FuenteNatural,
    private readonly reproductor: Reproductor | null = natural ? reproductorComun() : null,
  ) {}

  /** La voz de main se intenta si hay fuente y reproductor y el motor elegido no es Windows. */
  private get usaNatural(): boolean {
    return !!this.natural && !!this.reproductor && this.opciones.motor !== 'sistema';
  }

  configurar(opciones: OpcionesVoz): void {
    this.opciones = opciones;
  }

  encolar(frase: FraseVoz): void {
    if (!this.sintesis && !this.usaNatural) return;
    // La síntesis empieza ya, mientras suena la frase anterior: cuando le toque, estará lista.
    if (this.usaNatural) this.natural!.preparar?.(frase.texto);
    // La misma clave sustituye a la que esperaba (p. ej. una cuenta atrás más reciente).
    this.pendientes = this.pendientes.filter((p) => p.frase.clave !== frase.clave);
    this.pendientes.push({ frase, llegada: this.ahora(), orden: this.contador++ });
    if (this.pendientes.length > MAX_PENDIENTES) {
      this.ordenar();
      this.pendientes.length = MAX_PENDIENTES;
    }
    if (!this.hablando) void this.siguiente();
  }

  /** Frases que esperan (para las pruebas y la depuración). */
  get enEspera(): readonly FraseVoz[] {
    return this.pendientes.map((p) => p.frase);
  }

  get ocupada(): boolean {
    return this.hablando;
  }

  /** Vacía la cola y corta la frase en curso (fin de la partida o voz apagada). */
  detener(): void {
    this.pendientes = [];
    this.turno++;
    this.terminar();
    this.sintesis?.cancel();
    this.reproductor?.detener();
  }

  private ordenar(): void {
    this.pendientes.sort((a, b) => a.frase.prioridad - b.frase.prioridad || a.orden - b.orden);
  }

  private terminar(): void {
    this.hablando = false;
    if (this.vigilante) clearTimeout(this.vigilante);
    this.vigilante = null;
  }

  private async siguiente(): Promise<void> {
    const sintesis = this.sintesis;
    if ((!sintesis && !this.usaNatural) || this.hablando) return;
    const ahora = this.ahora();
    this.pendientes = this.pendientes.filter((p) => ahora - p.llegada <= p.frase.caducaMs);
    this.ordenar();
    const elegida = this.pendientes.shift();
    if (!elegida) return;
    this.hablando = true;
    const turno = ++this.turno;
    const fin = () => {
      if (turno !== this.turno) return;
      this.turno++;
      this.terminar();
      void this.siguiente();
    };
    if (this.usaNatural) {
      const audio = await conEspera(this.natural!.sintetizar(elegida.frase.texto), ESPERA_NATURAL_MS);
      if (turno !== this.turno) return; // se detuvo mientras se sintetizaba
      if (audio) {
        this.vigilante = setTimeout(fin, VIGILANTE_VOZ_MS);
        // Una frase larga (p. ej. de un paquete de voz) no debe cortarse: el vigilante pasa a su duración más un margen.
        const alEmpezar = (duracionMs: number) => {
          if (turno !== this.turno) return;
          if (this.vigilante) clearTimeout(this.vigilante);
          this.vigilante = setTimeout(fin, Math.max(VIGILANTE_VOZ_MS, duracionMs + MARGEN_VIGILANTE_MS));
        };
        const ok = await this.reproductor!.reproducir(audio, this.opciones.volumen, fin, alEmpezar);
        if (ok || turno !== this.turno) return;
        if (this.vigilante) clearTimeout(this.vigilante);
        this.vigilante = null;
      }
      // Sin voz de main (sin descargar, con fallo o tarde): la frase sale con la de Windows.
    }
    if (!sintesis) {
      this.terminar();
      void this.siguiente();
      return;
    }
    const voz = elegirVoz(await vocesDisponibles(sintesis), this.opciones.vozId);
    if (turno !== this.turno) return; // se detuvo mientras se cargaban las voces
    if (!voz) {
      // Sin voz del idioma de la app la cola se vacía en silencio (los avisos siguen en pantalla).
      this.pendientes = [];
      this.terminar();
      return;
    }
    const frase = new SpeechSynthesisUtterance(elegida.frase.texto);
    frase.voice = voz;
    frase.lang = voz.lang;
    frase.volume = this.opciones.volumen;
    frase.onend = fin;
    frase.onerror = fin;
    this.vigilante = setTimeout(fin, VIGILANTE_VOZ_MS);
    sintesis.speak(frase);
  }
}
