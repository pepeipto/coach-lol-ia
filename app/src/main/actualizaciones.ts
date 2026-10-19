import * as nodeFs from 'node:fs';
import { t } from '../shared/i18n';
import { registrar } from './log';

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Último intento de instalación (en `userData/actualizacion.json`): evita un bucle de reinicios si falla. */
export interface MarcaInstalacion {
  /** Versión que se intentó instalar. */
  version: string;
  /** Instante (ms epoch) en que se llamó a quitAndInstall. */
  intento: number;
}

export interface AlmacenMarca {
  leer(): MarcaInstalacion | null;
  guardar(m: MarcaInstalacion): void;
  borrar(): void;
}

/** Tras un intento fallido, no se vuelve a reiniciar para la misma versión hasta pasadas 24 h. */
export const VENTANA_REINTENTO_MS = 24 * 60 * 60_000;

/** Lo que se usa de node:fs (sustituible en las pruebas). */
export interface FsMarca {
  readFileSync(ruta: string, codificacion: 'utf8'): string;
  writeFileSync(ruta: string, datos: string): void;
  rmSync(ruta: string, opciones: { force: boolean }): void;
}

/** La marca en un archivo JSON. Un archivo dañado cuenta como sin marca; un fallo de disco nunca se propaga. */
export function crearMarcaArchivo(ruta: string, fs: FsMarca = nodeFs): AlmacenMarca {
  return {
    leer() {
      try {
        const m = JSON.parse(fs.readFileSync(ruta, 'utf8')) as Partial<MarcaInstalacion> | null;
        return m && typeof m.version === 'string' && typeof m.intento === 'number' && Number.isFinite(m.intento)
          ? { version: m.version, intento: m.intento }
          : null;
      } catch {
        return null;
      }
    },
    guardar(m) {
      try {
        fs.writeFileSync(ruta, JSON.stringify(m));
      } catch (e) {
        registrar('aviso', `No se pudo guardar la marca de la actualización: ${mensaje(e)}`);
      }
    },
    borrar() {
      try {
        fs.rmSync(ruta, { force: true });
      } catch {
        // Sin marca que borrar o sin permisos: no importa.
      }
    },
  };
}

/** Compara «x.y.z» numéricamente (se ignora el sufijo de prerelease): <0, 0 o >0. */
export function compararVersiones(a: string, b: string): number {
  const partes = (v: string) => v.split('-')[0].split('.').map((x) => Number.parseInt(x, 10) || 0);
  const [pa, pb] = [partes(a), partes(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Lo que se usa del autoUpdater de electron-updater (sustituible en las pruebas). */
export interface Actualizador {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  on(evento: 'update-available', cb: (info: { version: string }) => void): unknown;
  on(evento: 'download-progress', cb: (p: { percent: number }) => void): unknown;
  on(evento: 'update-downloaded', cb: (info: { version: string }) => void): unknown;
  on(evento: 'error', cb: (e: unknown) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface OpcionesActualizar {
  /** Texto para la ventana principal (null lo quita). */
  avisar: (texto: string | null) => void;
  /**
   * No se puede reiniciar ahora: selección de campeón, pantalla de carga, partida, reconexión… (ver `ocupado.ts`).
   * Nunca se reinicia la app en esos momentos.
   */
  ocupado: () => boolean;
  /** Programa una repetición (inyectable en las pruebas); devuelve una función que la cancela. */
  programar?: (cb: () => void, ms: number) => () => void;
  /** Versión instalada (app.getVersion()); sin ella no se comprueba el bucle de reinicios. */
  versionActual?: string;
  /** Marca del último intento de instalación (por defecto, ninguna: solo en las pruebas antiguas). */
  marca?: AlmacenMarca;
  ahora?: () => number;
}

/** Cada cuánto se vuelve a buscar una versión nueva con la app abierta. */
export const INTERVALO_BUSQUEDA_MS = 4 * 60 * 60_000;
/** Cada cuánto se comprueba si ya terminó la partida para instalar lo descargado. */
export const ESPERA_FIN_PARTIDA_MS = 30_000;

/**
 * Actualización automática desde GitHub Releases: al arrancar (y luego cada 4 h) busca la última versión,
 * la descarga enseñando el progreso y, en cuanto está lista, la instala en silencio y vuelve a abrir la app.
 * Nunca reinicia en medio de una partida: espera a que termine (y, si la app se cierra antes, se instala al salir).
 * No usa checkForUpdatesAndNotify, cuya notificación está en inglés: los textos salen de los archivos de idioma.
 * Un fallo nunca debe tumbar la app.
 */
export function crearActualizacionAutomatica(actualizador: Actualizador, o: OpcionesActualizar) {
  const programar =
    o.programar ??
    ((cb: () => void, ms: number) => {
      const id = setTimeout(cb, ms);
      return () => clearTimeout(id);
    });
  let nueva = '';
  let descargada: string | null = null;
  let instalando = false;
  let decena = -1;
  let cancelar: (() => void) | null = null;
  /** detener(): ni nuevas búsquedas ni instalaciones (lo descargado se instala al salir). */
  let detenido = false;
  const ahora = o.ahora ?? Date.now;

  /**
   * ¿Ya se intentó instalar esta versión hace menos de 24 h y la app sigue en la vieja? Entonces la instalación
   * silenciosa falló (antivirus, permisos…) y reiniciar otra vez solo crearía un bucle de reinicios.
   */
  function intentoReciente(version: string): MarcaInstalacion | null {
    const m = o.marca?.leer() ?? null;
    if (!m || m.version !== version || !o.versionActual) return null;
    if (compararVersiones(o.versionActual, m.version) >= 0) return null;
    return ahora() - m.intento < VENTANA_REINTENTO_MS ? m : null;
  }

  function instalarSiSePuede(): void {
    cancelar = null;
    if (!descargada || instalando || detenido) return;
    if (o.ocupado()) {
      o.avisar(t('actualizacion.trasPartida', { version: descargada }));
      cancelar = programar(instalarSiSePuede, ESPERA_FIN_PARTIDA_MS);
      return;
    }
    const previo = intentoReciente(descargada);
    if (previo) {
      // Sin reiniciar: autoInstallOnAppQuit la instalará al cerrar la app.
      instalando = true;
      registrar(
        'aviso',
        `La instalación de la versión ${descargada} ya se intentó a las ${new Date(previo.intento).toISOString()} y la app sigue en la ${o.versionActual}: no se reinicia otra vez, se instalará al cerrar`,
      );
      o.avisar(t('actualizacion.descargada', { version: descargada }));
      return;
    }
    instalando = true;
    o.avisar(t('actualizacion.instalando', { version: descargada }));
    registrar('info', `Instalando la versión ${descargada} y reiniciando la app`);
    // Antes de reiniciar: si la instalación falla y vuelve a abrirse la versión vieja, no lo repetirá en bucle.
    o.marca?.guardar({ version: descargada, intento: ahora() });
    try {
      // Silenciosa (sin el asistente del instalador) y vuelve a abrir la app al terminar.
      actualizador.quitAndInstall(true, true);
    } catch (e) {
      instalando = false;
      // No hubo reinicio, así que no hay bucle que evitar.
      o.marca?.borrar();
      registrar('error', `No se pudo instalar la actualización: ${mensaje(e)}`);
      o.avisar(t('actualizacion.descargada', { version: descargada }));
    }
  }

  async function buscar(): Promise<void> {
    cancelar = null;
    try {
      await actualizador.checkForUpdates();
    } catch (e) {
      registrar('error', `No se pudo buscar actualizaciones: ${mensaje(e)}`);
    }
    if (detenido) return;
    if (!descargada && !cancelar) cancelar = programar(() => void buscar(), INTERVALO_BUSQUEDA_MS);
  }

  return {
    async iniciar(): Promise<void> {
      try {
        // La versión de la marca ya está instalada (o una posterior): la instalación salió bien.
        const m = o.marca?.leer() ?? null;
        if (m && o.versionActual && compararVersiones(o.versionActual, m.version) >= 0) {
          registrar('info', `Actualización a la versión ${m.version} completada`);
          o.marca?.borrar();
        }
        actualizador.logger = {
          info: (m: unknown) => registrar('info', String(m)),
          warn: (m: unknown) => registrar('aviso', String(m)),
          error: (m: unknown) => registrar('error', String(m)),
          debug: () => {},
        };
        actualizador.autoDownload = true;
        // Si la app se cierra antes de poder reiniciar (p. ej. durante una partida), se instala al salir.
        actualizador.autoInstallOnAppQuit = true;
        actualizador.on('update-available', (info) => {
          nueva = info.version;
          decena = 0;
          o.avisar(t('actualizacion.descargando', { version: nueva, porcentaje: 0 }));
        });
        actualizador.on('download-progress', (p) => {
          const porcentaje = Math.max(0, Math.min(100, Math.floor(p?.percent ?? 0)));
          // Solo al cambiar de decena: no saturar la ventana con mensajes.
          if (Math.floor(porcentaje / 10) === decena) return;
          decena = Math.floor(porcentaje / 10);
          o.avisar(t('actualizacion.descargando', { version: nueva, porcentaje }));
        });
        actualizador.on('update-downloaded', (info) => {
          descargada = info.version;
          cancelar?.();
          instalarSiSePuede();
        });
        actualizador.on('error', (e) => {
          registrar('error', `Actualización: ${mensaje(e)}`);
          if (!descargada) o.avisar(null);
        });
      } catch (e) {
        registrar('error', `No se pudo preparar la actualización: ${mensaje(e)}`);
        return;
      }
      await buscar();
    },
    detener(): void {
      detenido = true;
      cancelar?.();
      cancelar = null;
    },
  };
}
