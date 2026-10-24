import { t } from '../../shared/i18n';
import type { Perfil } from '../../shared/perfil';
import { STREAMER_POR_DEFECTO, type AjustesStreamer, type EstadoObs } from '../../shared/streamer';
import { chocaConLol, mismoAcelerador } from '../../shared/teclas';
import type { Ajustes, EstadoCarga } from '../../shared/tiposApp';
import { crearAtajo } from '../atajo';
import { registrar } from '../log';
import type { ControlOverlayCompleto } from '../ventanas/overlayControl';
import { anonimizarCarga, anonimizarPerfil } from './anonimizar';
import { crearFuenteObs } from './fuenteObs';
import { crearServidorObs, HOST_OBS } from './servidorObs';
import { crearAlmacenToken } from './tokenObs';

/*
 * 3.8: modo streamer y fuente para OBS, juntos para tocar lo mínimo de main/index.ts:
 * - envuelve el control del overlay: la pantalla de carga sale ya con los nombres sustituidos y lo que va al overlay
 *   (estado, aumentos, modo, configuración) alimenta también la fuente de OBS;
 * - `perfil()` sustituye los nombres del perfil antes de mandarlo a la ventana;
 * - registra el IPC de Ajustes ('streamer:*') y del overlay ('overlay:voz-dicha') y la tecla opcional.
 * No manda nada a ningún servidor.
 */

interface IpcMain {
  handle(canal: string, fn: (e: { sender: unknown }, ...args: unknown[]) => unknown): void;
  on(canal: string, fn: (e: { sender: unknown }, ...args: unknown[]) => void): void;
}

export interface DependenciasStreamer {
  ipcMain: IpcMain;
  globalShortcut: { register(tecla: string, cb: () => void): boolean; unregister(tecla: string): void };
  clipboard: { writeText(texto: string): void };
  leerAjustes: () => Ajustes;
  /** Guarda unos ajustes nuevos (la tecla del modo streamer) y avisa a las ventanas. */
  guardarAjustes: (a: Ajustes) => void;
  /** userData/obs.json (token de la URL). */
  rutaToken: string;
  esPrincipal: (sender: unknown) => boolean;
  esOverlay: (sender: unknown) => boolean;
  /** Manda un evento a la ventana principal (si está abierta). */
  enviarPrincipal: (canal: string, dato: unknown) => void;
}

export function crearModoStreamer(dep: DependenciasStreamer) {
  const fuente = crearFuenteObs();
  const almacen = crearAlmacenToken(dep.rutaToken);
  const servidor = crearServidorObs({ token: () => almacen.token(), vista: () => fuente.vista(), alCambiar: (cb) => fuente.alCambiar(cb) });
  let error: EstadoObs['error'] = null;
  let base: ControlOverlayCompleto | null = null;
  let ultimaCarga: EstadoCarga | null = null;
  let reenviarPerfil: () => void = () => {};
  const streamerDe = (a: Ajustes): AjustesStreamer => a.streamer ?? STREAMER_POR_DEFECTO;
  let anterior: AjustesStreamer = streamerDe(dep.leerAjustes());
  const modo = () => streamerDe(dep.leerAjustes());

  function estadoObs(): EstadoObs {
    const s = modo().obs;
    const puerto = servidor.puerto();
    return {
      activa: s.activa,
      escuchando: servidor.escuchando(),
      puerto: puerto ?? s.puerto,
      url: puerto !== null ? `http://${HOST_OBS}:${puerto}/${almacen.token()}/` : null,
      error,
    };
  }
  const avisarObs = () => dep.enviarPrincipal('streamer:obs', estadoObs());

  /** Arranca, rearranca o para el servidor según los ajustes. */
  async function sincronizarObs(): Promise<void> {
    const s = modo().obs;
    if (!s.activa) {
      await servidor.detener();
      error = null;
    } else if (servidor.puerto() !== s.puerto) {
      const r = await servidor.arrancar(s.puerto);
      error = r.ok ? null : r.error;
      if (r.ok) registrar('info', `Fuente para OBS escuchando en ${HOST_OBS}:${r.puerto}`);
      else registrar('aviso', `No se pudo abrir la fuente para OBS en el puerto ${s.puerto}: ${r.error}`);
    }
    avisarObs();
  }

  // Tecla opcional (Ajustes > Streamer): enciende o apaga el modo streamer; se registra mientras esté definida.
  const atajo = crearAtajo(dep.globalShortcut, () => {
    const a = dep.leerAjustes();
    const activo = !streamerDe(a).activo;
    dep.guardarAjustes({ ...a, streamer: { ...streamerDe(a), activo } });
    ajustesCambiados();
    base?.enviarAviso({ texto: t(activo ? 'streamer.atajo.activado' : 'streamer.atajo.desactivado'), voz: false });
  });
  function sincronizarTecla(): void {
    const a = dep.leerAjustes();
    const tecla = streamerDe(a).tecla;
    const ocupada = [a.teclaOverlay, a.teclaJungla, a.teclaAumentos].some((x) => x && mismoAcelerador(x, tecla));
    if (tecla && !ocupada && !chocaConLol(tecla)) atajo.registrar(tecla);
    else atajo.liberar();
  }

  /** Vuelve a mandar la pantalla de carga y el perfil con el modo nuevo. */
  function reaplicar(): void {
    if (ultimaCarga && base) base.enviarCarga(anonimizarCarga(ultimaCarga, modo()));
    reenviarPerfil();
  }

  /** Tras guardar los ajustes (desde la ventana o con la tecla). */
  function ajustesCambiados(): void {
    const ahora = modo();
    if (ahora.activo !== anterior.activo || ahora.ocultarPropio !== anterior.ocultarPropio) reaplicar();
    if (ahora.tecla !== anterior.tecla) sincronizarTecla();
    if (ahora.obs.activa !== anterior.obs.activa || ahora.obs.puerto !== anterior.obs.puerto) void sincronizarObs();
    anterior = ahora;
  }

  const soloPrincipal = (sender: unknown) => {
    if (!dep.esPrincipal(sender)) throw new Error('Remitente no permitido');
  };
  dep.ipcMain.handle('streamer:obs-estado', (e) => {
    soloPrincipal(e.sender);
    return estadoObs();
  });
  dep.ipcMain.handle('streamer:obs-regenerar', (e) => {
    soloPrincipal(e.sender);
    almacen.regenerar();
    // El token se comprueba en cada petición; las fuentes que seguían abiertas con la URL anterior se cortan ya.
    servidor.cortarClientes();
    avisarObs();
    return estadoObs();
  });
  dep.ipcMain.handle('streamer:copiar', (e, texto: unknown) => {
    soloPrincipal(e.sender);
    if (typeof texto !== 'string' || !texto || texto.length > 2000) return false;
    dep.clipboard.writeText(texto);
    return true;
  });
  // Subtítulos: el overlay avisa de cada frase que empieza a decir la voz.
  dep.ipcMain.on('overlay:voz-dicha', (e, texto: unknown) => {
    if (dep.esOverlay(e.sender)) fuente.frase(texto);
  });

  return {
    fuente,
    /** El control del overlay con el modo streamer aplicado y la fuente de OBS alimentada. */
    envolverOverlay(control: ControlOverlayCompleto): ControlOverlayCompleto {
      base = control;
      return {
        ...control,
        enviarCarga: (carga) => {
          ultimaCarga = carga;
          control.enviarCarga(anonimizarCarga(carga, modo()));
        },
        enviarEstado: (estado) => {
          control.enviarEstado(estado);
          fuente.estado(estado);
        },
        enviarAumentos: (panel) => {
          control.enviarAumentos?.(panel);
          fuente.aumentos(panel);
        },
        enviarModo: (m) => {
          // Fuera de la pantalla de carga no se guarda la última (al reaplicar el modo no vuelve a salir).
          if (m !== 'carga') ultimaCarga = null;
          control.enviarModo(m);
          fuente.modo(m);
        },
        enviarConfig: (config) => {
          control.enviarConfig(config);
          fuente.config(config);
        },
      };
    },
    /** El perfil tal como lo ve la ventana. */
    perfil: (p: Perfil): Perfil => anonimizarPerfil(p, modo(), t('streamer.tuNombre')),
    /** Cómo volver a mandar el perfil a la ventana cuando cambia el modo. */
    alReaplicarPerfil(fn: () => void): void {
      reenviarPerfil = fn;
    },
    ajustesCambiados,
    /** Al arrancar la app: la tecla y, si estaba encendida, la fuente de OBS. */
    iniciar(): void {
      fuente.config(dep.leerAjustes().overlay);
      sincronizarTecla();
      void sincronizarObs();
    },
    async detener(): Promise<void> {
      atajo.liberar();
      await servidor.detener();
    },
  };
}
