import { join } from 'node:path';
import type { Idioma } from '../../shared/i18n';
import type { Ajustes, AudioPcm, AudioVoz, ErrorVozNatural, EstadoInstalacionVoz, EstadoVozNatural } from '../../shared/tiposApp';
import { CacheDisco, CacheMemoria, clave } from './cacheVoz';
import { elegirVozNatural, IDIOMA_MODELO, PAQUETE_SUPERTONIC, urlPaquete, VOCES_NATURALES, VOZ_POR_DEFECTO, type PaqueteVoz } from './catalogo';
import { descargarConReanudacion, ErrorDescarga, instalarPaquete, paqueteInstalado, type FetchMinimo } from './descarga';
import { crearPack, paquetePack, type Pack } from './pack';
import { frasesParaPrecalentar } from './precalentar';
import { pronunciar } from './pronunciacion';
import type { MensajeAlProceso, MensajeDelProceso } from './protocolo';
import { ARCHIVOS_MODELO, type IdiomaSupertonic } from './supertonic';

/**
 * Motor de la voz en main (3.1):
 * - voz pregrabada (paquete por idioma, clips de ElevenLabs generados una vez): si la frase está ENTERA en el
 *   paquete, se devuelven sus clips;
 * - si no, voz natural (Supertonic 3 en un utilityProcess de prioridad baja, con cola y caché);
 * - si nada de eso está (sin descargar, motor «Windows» o fallo), null: el overlay usa la voz de Windows.
 * También descarga e instala el modelo y el paquete del idioma (reanudable, con SHA-256).
 */

/** Pasos de la síntesis (calidad): con 5 se entiende como con 8 y tarda ~0,3 s por frase con 2 hilos en un i9-13900KS. */
export const PASOS_SINTESIS = 5;
/** Hilos de ONNX Runtime: la partida va primero. */
export const HILOS_SINTESIS = 2;
/** Versión de la síntesis en las claves de la caché (cambiarla invalida lo guardado). */
export const VERSION_SINTESIS = 'st3-int8-p5-v1';
/** Sin frases durante este tiempo, el proceso se cierra para liberar memoria (se vuelve a abrir solo). */
export const INACTIVIDAD_MS = 10 * 60_000;
/** Una frase que tarda más que esto se da por perdida (y el proceso se reinicia). */
export const LIMITE_FRASE_MS = 20_000;
/** Tras estos fallos del proceso en una sesión, la voz natural se aparta y queda la de Windows. */
export const MAX_FALLOS = 3;
export const MAX_TEXTO = 300;

export const ARCHIVOS_REQUERIDOS: readonly string[] = [
  ...Object.values(ARCHIVOS_MODELO),
  ...VOCES_NATURALES.map((v) => `voice_styles/${v.estilo}.json`),
];

export interface ProcesoVoz {
  enviar(m: MensajeAlProceso): void;
  alMensaje(cb: (m: MensajeDelProceso) => void): void;
  alSalir(cb: (codigo: number | null) => void): void;
  matar(): void;
}

export interface DependenciasMotorVoz {
  /** userData/voz-natural */
  dir: string;
  ajustes(): Ajustes;
  idioma(): Idioma;
  crearProceso(): ProcesoVoz;
  fetch?: FetchMinimo;
  /** Paquete del modelo neuronal (las pruebas ponen uno propio). */
  paquete?: PaqueteVoz;
  /** Paquete pregrabado de un idioma (por defecto, el de packs.json). */
  paquetePack?: (idioma: Idioma) => PaqueteVoz | null;
  alEstado?(e: EstadoVozNatural): void;
  registrar?(nivel: 'info' | 'aviso' | 'error', mensaje: string): void;
  /** Reintentos de la descarga (las pruebas los acortan). */
  reintentos?: { intentos?: number; espera?: (ms: number) => Promise<void> };
  temporizador?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
}

type Prioridad = 'vivo' | 'fondo';
interface Peticion {
  k: string;
  texto: string;
  idioma: IdiomaSupertonic;
  estilo: string;
  prioridad: Prioridad;
  resolver: (a: AudioPcm | null) => void;
  promesa: Promise<AudioPcm | null>;
}

export interface MedidaVoz {
  ms: number;
  cpuMs: number;
  segundosAudio: number;
}

const REQUERIDOS_PACK = ['manifest.json'] as const;

export function crearMotorVoz(dep: DependenciasMotorVoz) {
  const paquete = dep.paquete ?? PAQUETE_SUPERTONIC;
  const packDe = dep.paquetePack ?? ((i: Idioma) => paquetePack(i));
  const reloj = dep.temporizador ?? { setTimeout, clearTimeout };
  const memoria = new CacheMemoria(32 * 1024 * 1024);
  const disco = new CacheDisco(join(dep.dir, 'cache'), 120 * 1024 * 1024);
  const registrar = dep.registrar ?? (() => {});

  let descargando: EstadoInstalacionVoz | null = null;
  let error: ErrorVozNatural | null = null;
  let errorMotor = false;
  let recibidos = 0;
  let total = 0;
  let descarga: AbortController | null = null;
  let promesaDescarga: Promise<void> | null = null;

  let proceso: ProcesoVoz | null = null;
  let cargado: Promise<boolean> | null = null;
  let resolverCarga: ((ok: boolean) => void) | null = null;
  let fallos = 0;
  let enCurso: { id: number; peticion: Peticion; limite: ReturnType<typeof setTimeout> } | null = null;
  let siguienteId = 1;
  let inactividad: ReturnType<typeof setTimeout> | null = null;
  const cola: Peticion[] = [];
  const pendientes = new Map<string, Peticion>();
  const medidas: MedidaVoz[] = [];
  const packs = new Map<string, Pack>();

  const dirInstalado = () => paqueteInstalado(dep.dir, paquete.id, paquete.sha256, ARCHIVOS_REQUERIDOS);

  /** Paquete pregrabado instalado del idioma actual, o null. */
  function packActual(): Pack | null {
    const p = packDe(dep.idioma());
    if (!p) return null;
    const dir = paqueteInstalado(dep.dir, p.id, p.sha256, REQUERIDOS_PACK);
    if (!dir) return null;
    let pack = packs.get(p.id);
    if (!pack) packs.set(p.id, (pack = crearPack(dir)));
    return pack;
  }

  /** Lo que falta por descargar para el idioma actual: el modelo neuronal y, si existe, su paquete pregrabado. */
  function pendientesDescarga(): PaqueteVoz[] {
    const salida: PaqueteVoz[] = [];
    if (!dirInstalado()) salida.push(paquete);
    const p = packDe(dep.idioma());
    if (p && !paqueteInstalado(dep.dir, p.id, p.sha256, REQUERIDOS_PACK)) salida.push(p);
    return salida;
  }

  function instantanea(): EstadoVozNatural {
    const faltan = pendientesDescarga();
    const p = packDe(dep.idioma());
    return {
      estado: descargando ?? (faltan.length === 0 ? 'instalada' : error ? 'error' : 'no_instalada'),
      recibidos,
      total,
      error: errorMotor ? 'motor' : error,
      voces: VOCES_NATURALES.map((v) => ({ id: v.id, genero: v.genero, numero: v.numero })),
      porDefecto: VOZ_POR_DEFECTO[dep.idioma()],
      naturalInstalada: !!dirInstalado(),
      packDisponible: !!p,
      packInstalado: !!p && !faltan.some((x) => x.id === p.id),
      megasPendientes: Math.round(faltan.reduce((n, x) => n + x.bytes, 0) / 1e6),
    };
  }
  const emitir = () => dep.alEstado?.(instantanea());

  // ---------- Descarga ----------

  /** Descarga e instala lo que falte del idioma actual (modelo y paquete pregrabado), uno detrás de otro. */
  function descargar(): Promise<void> {
    if (promesaDescarga) return promesaDescarga;
    const faltan = pendientesDescarga();
    if (faltan.length === 0) return Promise.resolve();
    descarga = new AbortController();
    descargando = 'descargando';
    error = null;
    recibidos = 0;
    total = faltan.reduce((n, p) => n + p.bytes, 0);
    emitir();
    promesaDescarga = (async () => {
      let base = 0;
      try {
        for (const p of faltan) {
          if (!p.sha256 || !p.bytes) throw new ErrorDescarga('paquete', `El paquete ${p.id} aún no está publicado`);
          const destino = join(dep.dir, 'descargas', `${p.id}.tar.gz`);
          descargando = 'descargando';
          await descargarConReanudacion(
            {
              url: urlPaquete(p),
              destino,
              bytes: p.bytes,
              sha256: p.sha256,
              fetch: dep.fetch,
              senal: descarga!.signal,
              alProgreso: (r) => {
                recibidos = base + r;
                emitir();
              },
            },
            dep.reintentos,
          );
          descargando = 'instalando';
          emitir();
          await instalarPaquete(destino, dep.dir, p.id, p.sha256, p === paquete ? ARCHIVOS_REQUERIDOS : REQUERIDOS_PACK);
          base += p.bytes;
          recibidos = base;
          registrar('info', `Voz instalada (${p.id})`);
        }
      } catch (e) {
        const codigo: ErrorVozNatural = e instanceof ErrorDescarga ? e.codigo : 'red';
        error = codigo === 'cancelada' ? null : codigo;
        registrar(codigo === 'cancelada' ? 'info' : 'aviso', `Voz: ${(e as Error).message}`);
      } finally {
        descargando = null;
        descarga = null;
        promesaDescarga = null;
        emitir();
      }
    })();
    return promesaDescarga;
  }

  function cancelarDescarga(): void {
    descarga?.abort();
  }

  // ---------- Proceso de síntesis ----------

  function cerrarProceso(): void {
    if (inactividad) reloj.clearTimeout(inactividad);
    inactividad = null;
    const p = proceso;
    proceso = null;
    cargado = null;
    resolverCarga?.(false);
    resolverCarga = null;
    p?.matar();
  }

  function programarInactividad(): void {
    if (inactividad) reloj.clearTimeout(inactividad);
    inactividad = reloj.setTimeout(() => {
      if (!enCurso && cola.length === 0) {
        registrar('info', 'Voz natural: proceso cerrado por inactividad');
        cerrarProceso();
      }
    }, INACTIVIDAD_MS);
  }

  function terminar(p: Peticion, audio: AudioPcm | null): void {
    pendientes.delete(p.k);
    p.resolver(audio);
  }

  function fallo(motivo: string): void {
    fallos++;
    registrar('aviso', `Voz natural: ${motivo} (fallo ${fallos} de ${MAX_FALLOS})`);
    if (enCurso) {
      reloj.clearTimeout(enCurso.limite);
      terminar(enCurso.peticion, null);
      enCurso = null;
    }
    cerrarProceso();
    // Lo que esperaba se dice con la voz de Windows; la próxima frase vuelve a abrir el proceso.
    for (const p of cola.splice(0)) terminar(p, null);
    if (fallos >= MAX_FALLOS) {
      // Se aparta hasta reiniciar la app.
      errorMotor = true;
      emitir();
    }
  }

  function asegurarProceso(dir: string): Promise<boolean> {
    if (cargado) return cargado;
    const p = dep.crearProceso();
    proceso = p;
    cargado = new Promise<boolean>((ok) => (resolverCarga = ok));
    p.alMensaje((m) => {
      if (proceso !== p) return;
      if (m.tipo === 'cargado') {
        resolverCarga?.(true);
        resolverCarga = null;
      } else if (m.tipo === 'error' && m.id === null) {
        fallo(m.mensaje);
      } else if ((m.tipo === 'audio' || m.tipo === 'error') && enCurso && m.id === enCurso.id) {
        const { peticion, limite } = enCurso;
        reloj.clearTimeout(limite);
        enCurso = null;
        if (m.tipo === 'audio') {
          const audio: AudioPcm = { sampleRate: m.sampleRate, pcm: m.pcm };
          memoria.guardar(peticion.k, audio);
          disco.guardar(peticion.k, audio);
          const medida = { ms: m.ms, cpuMs: m.cpuMs, segundosAudio: m.pcm.byteLength / 2 / m.sampleRate };
          medidas.push(medida);
          if (medidas.length > 200) medidas.shift();
          registrar('info', `Voz natural (${peticion.prioridad}): ${m.ms} ms, CPU ${m.cpuMs} ms, ${medida.segundosAudio.toFixed(2)} s de audio`);
          terminar(peticion, audio);
        } else {
          registrar('aviso', `Voz natural: no se pudo sintetizar una frase (${m.mensaje})`);
          terminar(peticion, null);
        }
        bombear();
      }
    });
    p.alSalir((codigo) => {
      if (proceso !== p) return;
      fallo(`el proceso de voz terminó (código ${codigo ?? '?'})`);
    });
    p.enviar({ tipo: 'cargar', dir, hilos: HILOS_SINTESIS });
    return cargado;
  }

  function bombear(): void {
    if (enCurso || cola.length === 0 || errorMotor) return;
    const dir = dirInstalado();
    if (!dir) {
      for (const p of cola.splice(0)) terminar(p, null);
      return;
    }
    void asegurarProceso(dir).then((ok) => {
      if (!ok || enCurso || cola.length === 0 || !proceso) return;
      // Primero las frases de la partida; a igualdad, la que llegó antes.
      const i = cola.findIndex((p) => p.prioridad === 'vivo');
      const peticion = cola.splice(i >= 0 ? i : 0, 1)[0]!;
      const id = siguienteId++;
      const limite = reloj.setTimeout(() => fallo('una frase tardó demasiado'), LIMITE_FRASE_MS);
      enCurso = { id, peticion, limite };
      programarInactividad();
      proceso.enviar({ tipo: 'sintetizar', id, texto: peticion.texto, idioma: peticion.idioma, estilo: peticion.estilo, pasos: PASOS_SINTESIS });
    });
  }

  /** Parámetros de una frase para la voz natural con los ajustes actuales, o null si ahora no se usa. */
  function preparar(texto: string): { k: string; texto: string; idioma: IdiomaSupertonic; estilo: string } | null {
    const ajustes = dep.ajustes();
    if (ajustes.overlay.voz.motor === 'sistema' || errorMotor || !dirInstalado()) return null;
    const idiomaApp = dep.idioma();
    const voz = elegirVozNatural(idiomaApp, ajustes.overlay.voz.vocesNaturales);
    const idioma = IDIOMA_MODELO[idiomaApp];
    const listo = pronunciar(texto.trim(), idiomaApp);
    return { k: clave([paquete.id, VERSION_SINTESIS, voz.estilo, idioma, listo]), texto: listo, idioma, estilo: voz.estilo };
  }

  function encolar(datos: NonNullable<ReturnType<typeof preparar>>, prioridad: Prioridad): Promise<AudioPcm | null> {
    const ya = pendientes.get(datos.k);
    if (ya) {
      if (prioridad === 'vivo') ya.prioridad = 'vivo';
      return ya.promesa;
    }
    let resolver!: (a: AudioPcm | null) => void;
    const promesa = new Promise<AudioPcm | null>((ok) => (resolver = ok));
    const p: Peticion = { ...datos, prioridad, resolver, promesa };
    pendientes.set(datos.k, p);
    cola.push(p);
    bombear();
    return promesa;
  }

  const usaPack = () => dep.ajustes().overlay.voz.motor === 'pack';

  /**
   * Audio de una frase, o null si hay que usar la voz de Windows. Con el motor pregrabado, la frase sale del
   * paquete si está entera en él; si no, la frase ENTERA sale con la voz natural (nunca se mezclan voces).
   */
  function sintetizar(texto: string): Promise<AudioVoz | null> {
    if (usaPack()) {
      const audio = packActual()?.buscar(texto);
      if (audio) return Promise.resolve(audio);
    }
    const datos = preparar(texto);
    if (!datos) return Promise.resolve(null);
    const enMemoria = memoria.obtener(datos.k);
    if (enMemoria) return Promise.resolve(enMemoria);
    const enDisco = disco.obtener(datos.k);
    if (enDisco) {
      memoria.guardar(datos.k, enDisco);
      return Promise.resolve(enDisco);
    }
    return encolar(datos, 'vivo');
  }

  /**
   * Prepara en segundo plano, con la voz natural, las frases fijas del idioma que no estén ya en la caché ni
   * enteras en el paquete pregrabado (al empezar la partida), solo si la voz está encendida. Devuelve cuántas encola.
   */
  function precalentar(): number {
    // Con la voz apagada no se gasta CPU ni memoria en preparar frases que no van a sonar.
    if (!dep.ajustes().overlay.voz.activa) return 0;
    const pack = usaPack() ? packActual() : null;
    let n = 0;
    for (const f of frasesParaPrecalentar(dep.idioma())) {
      if (pack?.cubre(f)) continue;
      const datos = preparar(f);
      if (!datos) return 0;
      if (disco.tiene(datos.k) || pendientes.has(datos.k)) continue;
      void encolar(datos, 'fondo');
      n++;
    }
    if (n) registrar('info', `Voz natural: preparando ${n} frases`);
    return n;
  }

  /** Corta lo que esperaba de fondo (p. ej. al salir de la partida); las frases en vivo siguen. */
  function vaciarFondo(): void {
    for (let i = cola.length - 1; i >= 0; i--) if (cola[i]!.prioridad === 'fondo') terminar(cola.splice(i, 1)[0]!, null);
  }

  function detener(): void {
    descarga?.abort();
    for (const p of cola.splice(0)) terminar(p, null);
    if (enCurso) {
      reloj.clearTimeout(enCurso.limite);
      terminar(enCurso.peticion, null);
      enCurso = null;
    }
    cerrarProceso();
  }

  return {
    estado: instantanea,
    descargar,
    cancelarDescarga,
    sintetizar,
    precalentar,
    vaciarFondo,
    detener,
    /** Últimas medidas de la síntesis (ms, CPU y duración), para los informes. */
    medidas: () => [...medidas],
    /** Frases esperando (pruebas). */
    get enCola() {
      return cola.length;
    },
  };
}

export type MotorVozNatural = ReturnType<typeof crearMotorVoz>;
