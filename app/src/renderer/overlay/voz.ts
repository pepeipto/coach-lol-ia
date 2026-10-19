import { idiomaActual, type Idioma } from '../../shared/i18n';
import type { FraseVoz } from '../../shared/tiposApp';

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
}

/** Lee un texto suelto (p. ej. «Probar voz»), cortando lo que estuviera sonando; sin voz del idioma de la app, calla. */
export async function hablar(
  texto: string,
  sintesis: SpeechSynthesis | undefined = globalThis.speechSynthesis,
  opciones: OpcionesVoz = { volumen: 1, vozId: null },
): Promise<void> {
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
  ) {}

  configurar(opciones: OpcionesVoz): void {
    this.opciones = opciones;
  }

  encolar(frase: FraseVoz): void {
    if (!this.sintesis) return;
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
    if (!sintesis || this.hablando) return;
    const ahora = this.ahora();
    this.pendientes = this.pendientes.filter((p) => ahora - p.llegada <= p.frase.caducaMs);
    this.ordenar();
    const elegida = this.pendientes.shift();
    if (!elegida) return;
    this.hablando = true;
    const turno = ++this.turno;
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
    const fin = () => {
      if (turno !== this.turno) return;
      this.turno++;
      this.terminar();
      void this.siguiente();
    };
    frase.onend = fin;
    frase.onerror = fin;
    this.vigilante = setTimeout(fin, VIGILANTE_VOZ_MS);
    sintesis.speak(frase);
  }
}
