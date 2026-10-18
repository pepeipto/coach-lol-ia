import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registrar } from '../log';
import { crearClienteLcu, type ClienteLcu } from './cliente';
import { encontrarDirectorioLol, parsearLockfile } from './lockfile';
import { interpretarSeleccion, type SeleccionCampeon } from './seleccion';

const EVENTO_FASE = 'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase';
const EVENTO_SESION = 'OnJsonApiEvent_lol-champ-select_v1_session';

interface Opciones {
  intervaloMs?: number;
  leerArchivo?: (ruta: string) => Promise<string>;
  conectar?: typeof crearClienteLcu;
  buscarDir?: typeof encontrarDirectorioLol;
}

/** Eventos: 'conectado'(ClienteLcu, dirLol) · 'desconectado' · 'fase'(fase) · 'seleccion'(SeleccionCampeon) */
export class VigilanteLcu extends EventEmitter {
  private readonly intervaloMs: number;
  private readonly leerArchivo: (ruta: string) => Promise<string>;
  private readonly conectar: typeof crearClienteLcu;
  private readonly buscarDir: typeof encontrarDirectorioLol;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private cliente: ClienteLcu | null = null;
  private dirLol: string | null = null;
  private ocupado = false;
  private ultimaSeleccion: SeleccionCampeon | null = null;

  constructor(o: Opciones = {}) {
    super();
    this.intervaloMs = o.intervaloMs ?? 3000;
    this.leerArchivo = o.leerArchivo ?? ((ruta) => readFile(ruta, 'utf8'));
    this.conectar = o.conectar ?? crearClienteLcu;
    this.buscarDir = o.buscarDir ?? encontrarDirectorioLol;
  }

  iniciar(): void {
    if (this.temporizador) return;
    this.temporizador = setInterval(() => void this.sondear(), this.intervaloMs);
    void this.sondear();
  }

  detener(): void {
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
            await this.leerArchivo(join(this.dirLol, 'lockfile'));
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

  private async intentarConectar(): Promise<void> {
    const dir = await this.buscarDir();
    let texto: string;
    try {
      texto = await this.leerArchivo(join(dir, 'lockfile'));
    } catch {
      return; // el cliente no está abierto
    }
    try {
      const cliente = await this.conectar(parsearLockfile(texto));
      this.cliente = cliente;
      this.dirLol = dir;
      this.ultimaSeleccion = null;
      cliente.alCerrar?.(() => {
        if (this.cliente === cliente) this.desconectar();
      });
      cliente.suscribir(EVENTO_FASE, (e) => this.alFase(e.data));
      cliente.suscribir(EVENTO_SESION, (e) => this.alSesion(e.data));
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
      this.alFase(fase);
      if (fase === 'ChampSelect') {
        this.alSesion(await cliente.peticion('GET', '/lol-champ-select/v1/session'));
      }
    } catch (e) {
      registrar('aviso', `No se pudo leer el estado actual del cliente: ${String(e)}`);
    }
  }

  private alFase(fase: unknown): void {
    if (typeof fase !== 'string') return;
    registrar('info', `Fase del cliente: ${fase}`);
    if (fase !== 'ChampSelect') this.ultimaSeleccion = null;
    this.emit('fase', fase);
  }

  private alSesion(sesion: unknown): void {
    const sel = interpretarSeleccion(sesion);
    if (!sel) return;
    const previa = this.ultimaSeleccion;
    if (previa && previa.campeonId === sel.campeonId && previa.rol === sel.rol) return;
    this.ultimaSeleccion = sel;
    this.emit('seleccion', sel);
  }

  private desconectar(): void {
    const c = this.cliente;
    this.cliente = null;
    this.dirLol = null;
    this.ultimaSeleccion = null;
    c?.cerrar();
    registrar('info', 'Desconectado del cliente de LoL');
    this.emit('desconectado');
  }
}
