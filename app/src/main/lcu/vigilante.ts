import { EventEmitter } from 'node:events';
import { modoDeCola } from '@coach/shared';
import { readFile } from 'node:fs/promises';
// Las rutas del cliente de LoL son de Windows: se unen como tales también al probar en Linux o macOS.
import { win32 } from 'node:path';
import { registrar } from '../log';
import { crearClienteLcu, type ClienteLcu } from './cliente';
import { DIRECTORIO_POR_DEFECTO, dirDeMetadatos, encontrarDirectorioLol, METADATOS_LOL, parsearLockfile } from './lockfile';
import { interpretarRivales, interpretarSeleccion, type SeleccionCampeon } from './seleccion';

const EVENTO_FASE = 'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase';
const EVENTO_SESION = 'OnJsonApiEvent_lol-champ-select_v1_session';
/**
 * Sesión de gameflow: `gameData.queue.id` es la cola de la partida (también en la selección de campeones).
 * Forma según los tipos del LCU de la comunidad (LolGameflowGameflowSession → gameData: LolGameflowGameflowGameData
 * → queue: LolGameflowQueue { id, gameMode, mapId }): https://github.com/dysolix/hasagi-types (dist/lcu-types.d.ts).
 */
const EVENTO_FLUJO = 'OnJsonApiEvent_lol-gameflow_v1_session';
const RUTA_FLUJO = '/lol-gameflow/v1/session';

/** Cola (queueId) de una sesión de gameflow; null si no la trae. */
export function colaDeFlujo(sesion: unknown): number | null {
  const id = (sesion as { gameData?: { queue?: { id?: unknown } } } | null)?.gameData?.queue?.id;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}
/** 3.8: `gameMode` y mapa de la cola de una sesión de gameflow (`gameData.queue`), si los trae. */
export function infoColaDeFlujo(sesion: unknown): { gameMode?: string; mapa?: number } {
  const q = (sesion as { gameData?: { queue?: { gameMode?: unknown; mapId?: unknown } } } | null)?.gameData?.queue;
  return {
    ...(typeof q?.gameMode === 'string' && q.gameMode ? { gameMode: q.gameMode } : {}),
    ...(typeof q?.mapId === 'number' && Number.isInteger(q.mapId) ? { mapa: q.mapId } : {}),
  };
}
/**
 * Pausa entre búsquedas con PowerShell mientras el cliente está cerrado: empieza en 30 s y se dobla en cada búsqueda
 * sin resultado hasta 5 min (3.6: PowerShell cuesta CPU y algunos antivirus lo vigilan). Al conectar vuelve a 30 s.
 */
const ESPERA_BUSQUEDA_MS = 30_000;
const ESPERA_BUSQUEDA_MAX_MS = 5 * 60_000;

interface Opciones {
  intervaloMs?: number;
  leerArchivo?: (ruta: string) => Promise<string>;
  conectar?: typeof crearClienteLcu;
  buscarDir?: typeof encontrarDirectorioLol;
  ahora?: () => number;
}

/**
 * Eventos: 'conectado'(ClienteLcu, dirLol) · 'desconectado' · 'fase'(fase) · 'seleccion'(SeleccionCampeon).
 * La selección lleva el modo (ARAM, ARAM: Caos, Arena o clasificatoria) de la cola de la selección o de gameflow.
 */
export class VigilanteLcu extends EventEmitter {
  private readonly intervaloMs: number;
  private readonly leerArchivo: (ruta: string) => Promise<string>;
  private readonly conectar: typeof crearClienteLcu;
  private readonly buscarDir: typeof encontrarDirectorioLol;
  private readonly ahora: () => number;
  /** Último directorio de instalación conocido (de PowerShell o de una conexión anterior). */
  private dirConocido: string | null = null;
  private ultimaBusqueda = -Infinity;
  private esperaBusqueda = ESPERA_BUSQUEDA_MS;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private cliente: ClienteLcu | null = null;
  private dirLol: string | null = null;
  private ocupado = false;
  private generacion = 0;
  private ultimaSeleccion: SeleccionCampeon | null = null;
  /** 3.9: últimos rivales emitidos (JSON), para no repetir el evento 'rivales'. */
  private ultimosRivales: string | null = null;
  /** Cola de la sesión de gameflow actual (null si no se sabe). */
  private cola: number | null = null;
  /** 3.8: `gameMode` y mapa de esa cola (para los modos rotativos). */
  private infoCola: { gameMode?: string; mapa?: number } = {};
  /** Ya se intentó leer la sesión de gameflow (con o sin cola): si no hay cola, no se va a saber. */
  private flujoLeido = false;
  /** Última sesión de selección recibida, para volver a interpretarla si llega la cola después. */
  private ultimaSesion: unknown = null;

  constructor(o: Opciones = {}) {
    super();
    this.intervaloMs = o.intervaloMs ?? 3000;
    this.leerArchivo = o.leerArchivo ?? ((ruta) => readFile(ruta, 'utf8'));
    this.conectar = o.conectar ?? crearClienteLcu;
    this.buscarDir = o.buscarDir ?? encontrarDirectorioLol;
    this.ahora = o.ahora ?? Date.now;
  }

  iniciar(): void {
    if (this.temporizador) return;
    this.generacion++;
    this.temporizador = setInterval(() => void this.sondear(), this.intervaloMs);
    void this.sondear();
  }

  detener(): void {
    this.generacion++;
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.cliente?.cerrar();
    this.cliente = null;
  }

  private async sondear(): Promise<void> {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      if (this.cliente) {
        // Conectado: si el lockfile desaparece, el cliente se cerró.
        if (this.dirLol) {
          try {
            await this.leerArchivo(win32.join(this.dirLol, 'lockfile'));
          } catch {
            this.desconectar();
          }
        }
        return;
      }
      await this.intentarConectar();
    } finally {
      this.ocupado = false;
    }
  }

  private async leerLockfile(dir: string): Promise<string | null> {
    try {
      return await this.leerArchivo(win32.join(dir, 'lockfile'));
    } catch {
      return null;
    }
  }

  /**
   * Busca el lockfile primero en el último directorio conocido y en el de por defecto. Solo si no
   * está en ninguno pregunta a PowerShell (lento), y como mucho una vez cada 30 s.
   */
  private async buscarLockfile(gen: number): Promise<{ dir: string; texto: string } | null> {
    // 3.6: la ruta que guarda el Riot Client en sus metadatos (leer un archivo, sin PowerShell).
    const deMetadatos = dirDeMetadatos(await this.leerArchivo(METADATOS_LOL).catch(() => ''));
    const candidatos = [...new Set([this.dirConocido ?? DIRECTORIO_POR_DEFECTO, ...(deMetadatos ? [deMetadatos] : []), DIRECTORIO_POR_DEFECTO])];
    for (const dir of candidatos) {
      const texto = await this.leerLockfile(dir);
      if (gen !== this.generacion) return null;
      if (texto !== null) return { dir, texto };
    }
    if (this.ahora() - this.ultimaBusqueda < this.esperaBusqueda) return null;
    if (this.ultimaBusqueda > -Infinity) this.esperaBusqueda = Math.min(ESPERA_BUSQUEDA_MAX_MS, this.esperaBusqueda * 2);
    this.ultimaBusqueda = this.ahora();
    const dir = await this.buscarDir();
    if (gen !== this.generacion || candidatos.includes(dir)) return null;
    this.dirConocido = dir;
    const texto = await this.leerLockfile(dir);
    if (gen !== this.generacion || texto === null) return null;
    return { dir, texto };
  }

  private async intentarConectar(): Promise<void> {
    const gen = this.generacion;
    const encontrado = await this.buscarLockfile(gen);
    if (!encontrado) return; // el cliente no está abierto
    const { dir, texto } = encontrado;
    this.dirConocido = dir;
    this.esperaBusqueda = ESPERA_BUSQUEDA_MS;
    try {
      const cliente = await this.conectar(parsearLockfile(texto));
      if (gen !== this.generacion) {
        cliente.cerrar();
        return;
      }
      this.cliente = cliente;
      this.dirLol = dir;
      this.ultimaSeleccion = null;
      this.ultimosRivales = null;
      this.ultimaSesion = null;
      this.cola = null;
      this.infoCola = {};
      this.flujoLeido = false;
      cliente.alCerrar?.(() => {
        if (this.cliente === cliente) this.desconectar();
      });
      cliente.suscribir(EVENTO_FASE, (e) => this.alFase(e.data));
      cliente.suscribir(EVENTO_SESION, (e) => this.alSesion(e.data));
      cliente.suscribir(EVENTO_FLUJO, (e) => this.alFlujo(e.data));
      registrar('info', 'Conectado con el cliente de LoL');
      this.emit('conectado', cliente, dir);
      await this.leerEstadoActual(cliente);
    } catch (e) {
      registrar('aviso', `No se pudo conectar con el cliente de LoL: ${String(e)}`);
      if (this.cliente) this.desconectar();
    }
  }

  private async leerEstadoActual(cliente: ClienteLcu): Promise<void> {
    try {
      const fase = await cliente.peticion<string>('GET', '/lol-gameflow/v1/gameflow-phase');
      if (fase === 'ChampSelect') await this.leerFlujo(cliente);
      this.alFase(fase);
      if (fase === 'ChampSelect') {
        this.alSesion(await cliente.peticion('GET', '/lol-champ-select/v1/session'));
      }
    } catch (e) {
      registrar('aviso', `No se pudo leer el estado actual del cliente: ${String(e)}`);
    }
  }

  /** Lee la cola de la sesión de gameflow (por si el evento llegó antes de conectar). Un fallo se ignora. */
  private async leerFlujo(cliente: ClienteLcu): Promise<void> {
    try {
      const sesion = await cliente.peticion('GET', RUTA_FLUJO);
      const cola = colaDeFlujo(sesion);
      if (cola !== null && this.cliente === cliente) this.alCola(cola, infoColaDeFlujo(sesion));
    } catch (e) {
      registrar('aviso', `No se pudo leer la cola de la partida: ${String(e)}`);
    }
    if (this.cliente === cliente && !this.flujoLeido) {
      this.flujoLeido = true;
      // Sin cola (o con error) ya no se espera más: la selección pendiente se vuelve a emitir sin «pendiente».
      if (this.ultimaSesion) this.alSesion(this.ultimaSesion);
    }
  }

  private alFlujo(sesion: unknown): void {
    const cola = colaDeFlujo(sesion);
    if (cola !== null) {
      this.flujoLeido = true;
      this.alCola(cola, infoColaDeFlujo(sesion));
    }
  }

  /** Cambia la cola; si ya había una selección, se vuelve a emitir con el modo nuevo. */
  private alCola(cola: number, info: { gameMode?: string; mapa?: number } = {}): void {
    if (cola === this.cola) return;
    this.cola = cola;
    this.infoCola = info;
    registrar('info', `Cola de la partida: ${cola} (modo ${modoDeCola(cola) ?? 'sin datos'})`);
    if (this.ultimaSesion) this.alSesion(this.ultimaSesion);
  }

  private alFase(fase: unknown): void {
    if (typeof fase !== 'string') return;
    registrar('info', `Fase del cliente: ${fase}`);
    if (fase !== 'ChampSelect') {
      this.ultimaSeleccion = null;
      this.ultimosRivales = null;
      this.ultimaSesion = null;
      // La siguiente selección vuelve a leer la cola (otra partida, quizá otro modo).
      if (fase === 'None' || fase === 'Lobby') {
        this.cola = null;
        this.infoCola = {};
        this.flujoLeido = false;
      }
    } else if (this.cola === null && this.cliente) {
      void this.leerFlujo(this.cliente);
    }
    this.emit('fase', fase);
  }

  private alSesion(sesion: unknown): void {
    // 3.9: rivales ya elegidos (aunque tú aún no hayas elegido): para los enfrentamientos de línea.
    const rivales = interpretarRivales(sesion, this.cola);
    const claveRivales = JSON.stringify(rivales);
    if (claveRivales !== this.ultimosRivales) {
      this.ultimosRivales = claveRivales;
      this.emit('rivales', rivales);
    }
    const leida = interpretarSeleccion(sesion);
    if (!leida) return;
    this.ultimaSesion = sesion;
    const modoCola = modoDeCola(this.cola);
    let sel: SeleccionCampeon = !leida.modo && modoCola ? { ...leida, modo: modoCola } : leida;
    // 3.8: normal de la Grieta o modo rotativo: la cola (de la selección o de gameflow), con su gameMode y su mapa.
    if (!sel.modo) {
      const cola = sel.cola ?? this.cola ?? undefined;
      if (cola !== undefined && cola > 0) {
        const info = cola === this.cola ? this.infoCola : {};
        sel = { ...sel, cola, ...info };
      }
    }
    // Sin modo y sin haber leído aún la cola: se marca pendiente (no se importa solo hasta saberla).
    if (!sel.modo && this.cola === null && !this.flujoLeido) sel = { ...sel, modoPendiente: true };
    const previa = this.ultimaSeleccion;
    if (
      previa &&
      previa.campeonId === sel.campeonId &&
      previa.rol === sel.rol &&
      previa.modo === sel.modo &&
      previa.modoPendiente === sel.modoPendiente &&
      previa.cola === sel.cola &&
      previa.gameMode === sel.gameMode &&
      previa.mapa === sel.mapa
    )
      return;
    this.ultimaSeleccion = sel;
    this.emit('seleccion', sel);
  }

  private desconectar(): void {
    const c = this.cliente;
    this.cliente = null;
    this.dirLol = null;
    this.ultimaSeleccion = null;
    this.ultimosRivales = null;
    this.ultimaSesion = null;
    this.cola = null;
    this.infoCola = {};
    this.flujoLeido = false;
    c?.cerrar();
    registrar('info', 'Desconectado del cliente de LoL');
    this.emit('desconectado');
  }
}
