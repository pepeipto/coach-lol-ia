export type TipoAviso = 'compra' | 'habilidad' | 'objetivo' | 'vision' | 'fase';

export interface Ajustes {
  avisos: Record<TipoAviso, boolean>;
  voz: boolean;
  importacionAutomatica: boolean;
  teclaOverlay: string;
  posicionOverlay: { x: number; y: number } | null;
}

export interface SeleccionCampeon {
  campeonId: number;
  rol: import('@coach/shared').Rol | null;
}

import type { Rol } from '@coach/shared';
import type { ResultadoBuild } from '../main/builds/clienteBuilds';

/** Nombres e iconos (de Data Dragon) de lo que aparece en la build, para pintarla en la ventana. */
export interface RecursosBuild {
  objetos: Record<number, string>;
  runas: Record<number, { nombre: string; icono: string }>;
  hechizos: Record<number, { nombre: string; imagen: string }>;
}

export interface EstadoPrincipal {
  cliente: 'esperando' | 'conectado';
  seleccion: {
    campeon: { id: string; nombre: string; key: number };
    rol: Rol;
    rolesDisponibles: Rol[];
    resultado: ResultadoBuild;
    /** Opción de build elegida (índice en `build.opciones`; 0 por defecto o con una build de v1). */
    opcion: number;
  } | null;
  version: string; // Data Dragon, para las imágenes ('' si no hay datos)
  recursos: RecursosBuild;
  /** 'datos' si no se pudieron cargar los datos de Data Dragon (sin red ni caché). */
  error: 'datos' | null;
  /** Resultado de la última importación (automática o manual) de la selección actual. */
  importacion: ResultadoImportar | null;
  /** Aviso en español para la ventana principal (p. ej. el modo de pantalla completa); null si no hay. */
  aviso: string | null;
}

export type ResultadoParte = { ok: true } | { ok: false; motivo: 'sin_paginas' | 'error' };
export interface ResultadoImportar {
  runas: ResultadoParte;
  hechizos: ResultadoParte;
  objetos: ResultadoParte;
}

export interface ApiCoach {
  alCambiarEstado(cb: (e: EstadoPrincipal) => void): void;
  importar(): Promise<ResultadoImportar>;
  cambiarRol(rol: Rol): Promise<void>;
  /** Elige otra opción de build ('coach:cambiar-opcion'); un índice no válido se ignora. */
  cambiarOpcion(i: number): Promise<void>;
  obtenerAjustes(): Promise<Ajustes>;
  guardarAjustes(a: Ajustes): Promise<void>;
  /** Activa o desactiva el modo mover; devuelve el estado real tras la orden. */
  moverOverlay(activar: boolean): Promise<boolean>;
  overlayMoviendo(): Promise<boolean>;
  /** Avisa cuando el modo mover se activa o desactiva (también con Esc o desde el propio overlay). */
  alCambiarMover(cb: (activo: boolean) => void): () => void;
  /** Botones de la barra de título propia (la ventana principal no tiene marco nativo). */
  ventana(accion: AccionVentana): void;
  /** Estado de la licencia ('coach:licencia-estado'). */
  licencia(): Promise<EstadoLicencia>;
  /** Activa una clave de licencia ('coach:licencia-activar'). */
  activarLicencia(clave: string): Promise<EstadoLicencia>;
  /** Quita la licencia guardada ('coach:licencia-quitar'). */
  quitarLicencia(): Promise<EstadoLicencia>;
  /** Abre una página de la web oficial en el navegador del sistema ('coach:abrir-web'). */
  abrirWeb(ruta: RutaWeb): Promise<void>;
  /** Avisa cuando cambia la licencia (evento 'coach:licencia'); devuelve la función para dejar de escuchar. */
  alCambiarLicencia(cb: (e: EstadoLicencia) => void): () => void;
  /** Pregunta al asistente de soporte ('coach:asistente'); el último mensaje es la pregunta. */
  asistente(mensajes: MensajeAsistente[]): Promise<RespuestaAsistente>;
}

export interface MensajeAsistente {
  rol: 'usuario' | 'asistente';
  texto: string;
}
export type ErrorAsistente = 'no_configurado' | 'limite' | 'no_disponible' | 'no_valido' | 'sin_conexion';
export type RespuestaAsistente = { ok: true; respuesta: string } | { ok: false; error: ErrorAsistente };

export type AccionVentana = 'minimizar' | 'maximizar' | 'cerrar';
export type RutaWeb = '/premium' | '/premium/gestionar' | '/apoyar' | '/descargar' | '/';

export type Plan = 'gratis' | 'premium';
export type TipoLicencia = 'suscripcion' | 'vitalicia' | 'prueba';
export interface EstadoLicencia {
  plan: Plan;
  estado:
    | 'sin_licencia'
    | 'activa'
    | 'cancelada'
    | 'impagada'
    | 'sin_conexion'
    /** Prueba pasada su fecha. */
    | 'caducada'
    /** La prueba está vinculada a otro dispositivo. */
    | 'otro_dispositivo'
    /** Este dispositivo ya usó otra prueba. */
    | 'prueba_ya_usada';
  renuevaEn: string | null;
  claveVisible: string | null;
  /** Tipo de licencia, si el servidor lo indica. */
  tipo?: TipoLicencia;
  /** ISO; solo en las pruebas. */
  caducaEn?: string | null;
  /** Licencia vitalicia (sin suscripción que renovar ni gestionar). */
  vitalicia?: boolean;
}

/** API del overlay (ventana distinta de la principal, con su propio preload). */
export interface ApiOverlay {
  alPanel(cb: (p: Panel) => void): void;
  alAviso(cb: (a: AvisoOverlay) => void): void;
  alMover(cb: (activo: boolean) => void): void;
  obtenerPosicion(): Promise<{ x: number; y: number } | null>;
  guardarPosicion(x: number, y: number): void;
  /** En modo mover, pide recibir el ratón mientras el cursor está sobre el panel. */
  capturarRaton(capturar: boolean): void;
  /** Botón «Fijar aquí»: sale del modo mover. */
  fijar(): void;
}

export interface AvisoOverlay {
  texto: string;
  voz: boolean;
  /** Tipo del aviso, para su icono. Si falta, el overlay lo deduce del texto. */
  tipo?: TipoAviso;
}

export interface EventoPartida {
  nombre: string; // EventName
  tiempo: number; // EventTime, en segundos
  /** Solo en DragonKill: DragonType de la API («Fire», «Earth»…, «Elder»). */
  dragon?: string;
  /** Equipo de quien lo mató, si se reconoce entre los jugadores (para contar el alma de dragón). */
  equipo?: 'ORDER' | 'CHAOS';
}

export interface EstadoPartida {
  tiempo: number;
  oro: number;
  nivel: number;
  /** Id de Data Dragon (p. ej. "Ahri"). */
  campeon: string;
  objetos: number[];
  habilidades: Record<import('@coach/shared').Habilidad, number>;
  eventos: EventoPartida[];
}

export interface Indicacion {
  tipo: TipoAviso;
  clave: string;
  texto: string;
}

/** Objetivos de la lista del overlay: épicos y, al empezar, la primera aparición de los campamentos. */
export type IdObjetivo = 'campamentos' | 'escarabajo' | 'larvas' | 'dragon' | 'anciano' | 'heraldo' | 'baron';

export interface ObjetivoPanel {
  id: IdObjetivo;
  /** Nombre corto en español para la lista. */
  nombre: string;
  /** Segundos que faltan para que aparezca; null si ya está disponible. */
  aparece: number | null;
  disponible: boolean;
}

export interface Panel {
  proximaCompra: string | null;
  proximoObjetivo: string | null;
  /** Habilidad que toca subir en el siguiente punto, según el orden de la build (null sin build o con el orden completo). */
  proximaHabilidad: import('@coach/shared').Habilidad | null;
  /** Objetivos vigentes con su cuenta atrás, en orden fijo. */
  objetivos: ObjetivoPanel[];
  /** Opcional: id del objeto de la próxima compra y versión de Data Dragon, para su icono. */
  compraId?: number | null;
  version?: string;
}

// --- Pantalla de carga (Coach LoL IA 3.0, contrato compartido) ---
export interface JugadorCarga { equipo: 'aliado' | 'enemigo'; riotId: string; campeonId: number; campeon: string; rol: Rol | null;
  rango: { tier: string; division: string; lp: number; victorias: number; derrotas: number } | null;
  maestria: { nivel: number; puntos: number } | null;
  campeonWinrate: number | null;        // our aggregated data for campeón+rol
  etiquetas: { tipo: 'positivo' | 'neutro' | 'info'; texto: string }[] }
export interface EstadoCarga { jugadores: JugadorCarga[]; version: string }
