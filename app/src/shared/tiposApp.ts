export type TipoAviso = 'compra' | 'habilidad' | 'objetivo' | 'vision' | 'fase';

export interface Ajustes {
  avisos: Record<TipoAviso, boolean>;
  voz: boolean;
  importacionAutomatica: boolean;
  teclaOverlay: string;
  posicionOverlay: { x: number; y: number } | null;
  /** Ya se hizo la bienvenida de la primera vez. */
  bienvenidaVista?: boolean;
  /** Última versión cuyas novedades ya se mostraron. */
  ultimaVersionVista?: string | null;
}

export interface SeleccionCampeon {
  campeonId: number;
  rol: import('@coach/shared').Rol | null;
  /** Modo de la cola (LCU); falta si la cola no es de un modo con datos o aún no se sabe (se usa clasificatoria). */
  modo?: import('@coach/shared').ModoJuego;
}

import type { ModoJuego, Rol } from '@coach/shared';
import type { ResultadoBuild, ResultadoCampeones } from '../main/builds/clienteBuilds';

/** Nombres e iconos (de Data Dragon) de lo que aparece en la build, para pintarla en la ventana. */
export interface RecursosBuild {
  objetos: Record<number, string>;
  runas: Record<number, { nombre: string; icono: string }>;
  hechizos: Record<number, { nombre: string; imagen: string }>;
  /** ARAM: Caos y Arena: nombre en español e icono (CommunityDragon) de cada aumento; falta si no hay. */
  aumentos?: Record<number, { nombre: string; icono: string | null }>;
}

/** Un campeón de Data Dragon (es_MX): id para las imágenes, nombre en español y clave numérica. */
export interface CampeonDDragon {
  id: string;
  nombre: string;
  key: number;
}

/** Filtro de la lista de campeones ('coach:campeones'); el modo por defecto es clasificatoria. */
export interface FiltroCampeones {
  modo?: ModoJuego;
}

/** Respuesta de 'coach:campeones': todos los campeones de Data Dragon y la lista del servidor (si la hay). */
export type RespuestaCampeones =
  | { ok: true; modo: ModoJuego; version: string; campeones: CampeonDDragon[]; resultado: ResultadoCampeones }
  | { ok: false; error: 'datos' };

/** Respuesta de 'coach:build-de': la build de un campeón y rol cualquiera, para verla sin estar en la selección. */
export type RespuestaBuildDe =
  | {
      ok: true;
      campeon: CampeonDDragon;
      /** null fuera de clasificatoria (ARAM, ARAM: Caos y Arena no tienen roles). */
      rol: Rol | null;
      modo: ModoJuego;
      rolesDisponibles: Rol[];
      resultado: ResultadoBuild;
      version: string;
      recursos: RecursosBuild;
    }
  | { ok: false; error: 'datos' | 'campeon' };

export interface EstadoPrincipal {
  cliente: 'esperando' | 'conectado';
  seleccion: {
    campeon: { id: string; nombre: string; key: number };
    /** null fuera de clasificatoria. */
    rol: Rol | null;
    /** Modo de la cola de la selección; falta en clasificatoria (y en estados de versiones anteriores). */
    modo?: ModoJuego;
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
  /** Lista de campeones con su tier ('coach:campeones'). */
  campeones(filtro?: FiltroCampeones): Promise<RespuestaCampeones>;
  /**
   * Build de un campeón (id de Data Dragon), rol y modo (clasificatoria por defecto), sin estar en la selección
   * ('coach:build-de'). Fuera de clasificatoria el rol es null.
   */
  buildDe(campeon: string, rol: Rol | null, modo?: ModoJuego): Promise<RespuestaBuildDe>;
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
  /** Modo de la partida según la Live Client Data API (`gameMode`); si falta, clasificatoria (la Grieta). */
  modo?: import('@coach/shared').ModoJuego;
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
  /** Modo de la partida (Live Client `gameMode`) y partes del overlay que tienen sentido en él (ver modosOverlay.ts). */
  modo?: import('@coach/shared').ModoJuego;
  widgets?: import('./modosOverlay').WidgetsVisibles;
}
