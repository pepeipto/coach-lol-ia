export type TipoAviso = 'compra' | 'habilidad' | 'objetivo' | 'vision' | 'fase';

export interface Ajustes {
  avisos: Record<TipoAviso, boolean>;
  voz: boolean;
  importacionAutomatica: boolean;
  teclaOverlay: string;
  /** Obsoleto (panel fijo de la 2.x): solo se lee para migrar a `overlay.widgets`. */
  posicionOverlay: { x: number; y: number } | null;
  /** Ya se hizo la bienvenida de la primera vez. */
  bienvenidaVista?: boolean;
  /** Última versión cuyas novedades ya se mostraron. */
  ultimaVersionVista?: string | null;
  /** Widgets, opacidad y voz del overlay modular (3.0). `voz` de arriba es un reflejo de `overlay.voz.activa`. */
  overlay: AjustesOverlay;
  /** Teclas globales opcionales para marcar cada campamento de la jungla (vacío: ninguna). */
  teclasJungla: Partial<Record<IdCampamento, string>>;
  /** Tecla global para mostrar u ocultar los temporizadores de la jungla durante la partida ('' = ninguna). */
  teclaJungla: string;
  /**
   * Jungla enemigo (Track F): `avisos`, por el registro de muertes (encendido por defecto); `ruta`, la ruta habitual
   * estimada con datos agregados del servidor (apagada por defecto).
   */
  junglaEnemiga: { avisos: boolean; ruta: boolean };
  /** Idioma de la app (Fase 3). Sin él (ajustes anteriores), el del sistema si es uno de los nuestros; si no, español. */
  idioma: import('./i18n').Idioma;
  /** Tema de la ventana principal (3.0.1). Sin él (ajustes anteriores), 'clasico'. */
  tema: Tema;
}

/** 'clasico': azul y oro con un toque sombrío; 'sombra': carmesí como acento principal y fondos más oscuros. */
export type Tema = 'clasico' | 'sombra';

// ---- Overlay modular (contratos compartidos de la 3.0) ----
export type IdWidget = 'objetivos' | 'habilidad' | 'cs' | 'compra' | 'jungla' | 'avisos';
export interface ConfigWidget { activo: boolean; x: number | null; y: number | null; escala: number } // escala 0.75..1.5
export interface AjustesOverlay { widgets: Record<IdWidget, ConfigWidget>; opacidad: number /*0.5..1*/; voz: AjustesVoz; jungla: AjustesJungla }
/** Marco del minimapa de LoL, en fracciones de la pantalla: x e y del ancho y del alto; lado, del alto. */
export interface MarcoMinimapa { x: number; y: number; lado: number }
/**
 * Presentación de los temporizadores de la jungla: sobre los campamentos del minimapa (por defecto) o el panel
 * lateral. `minimapa` es el marco calibrado en el modo mover; null usa el de por defecto (abajo a la derecha).
 */
export interface AjustesJungla { presentacion: 'minimapa' | 'panel'; minimapa: MarcoMinimapa | null }
export interface AjustesVoz { activa: boolean; volumen: number /*0..1*/; vozId: string | null; tipos: Record<TipoVoz, boolean> }
export type TipoVoz = 'objetivo' | 'compra' | 'habilidad' | 'cs' | 'vision' | 'fase' | 'jungla' | 'junglaEnemiga';
export interface ObjetivoEstado { id: 'dragon' | 'anciano' | 'larvas' | 'heraldo' | 'baron'; nombre: string; subtipo: string | null /* dragon type, e.g. 'Infernal' */; aparece: number | null; disponible: boolean }
export interface EstadoCs { cs: number; porMinuto: number; objetivoPorMinuto: number; cs10: number | null }
/** KDA de la partida en curso; ratio = (k + a) / máx(1, d). */
export interface KdaPartida { k: number; d: number; a: number; ratio: number }
/** Widget «Rendimiento»: CS y KDA en vivo junto al KDA medio del campeón en su rol (de la build). */
/** cs es null fuera de la Grieta (ARAM, ARAM: Caos y Arena): allí el widget solo enseña el KDA. */
export interface EstadoRendimiento { cs: EstadoCs | null; kda: KdaPartida | null; kdaMedio: KdaMedio | null }
export interface EstadoOverlay {   // replaces Panel for the new renderer
  tiempo: number;
  objetivos: ObjetivoEstado[];
  proximaHabilidad: Habilidad | null;   // only when a point is available
  /** null sin CS (la API no lo da); kda es null si faltan asesinatos, muertes o asistencias. */
  rendimiento: EstadoRendimiento | null;
  compra: { id: number; nombre: string; coste: number; puedeComprar: boolean } | null;
  version: string;                      // Data Dragon
  /** Modo de la partida (Track E); clasificatoria en la Grieta. */
  modo: import('@coach/shared').ModoJuego;
  /** Widgets que tienen sentido en el modo (`widgetsDeModo`); el renderer oculta los demás. */
  widgets: import('./modosOverlay').WidgetsVisibles;
}
export interface JugadorCarga { equipo: 'aliado' | 'enemigo'; riotId: string; campeonId: number; campeon: string; rol: Rol | null;
  nombre: string;                       // champion display name from Data Dragon (es_MX); campeon is the Data Dragon id
  rango: { tier: string; division: string; lp: number; victorias: number; derrotas: number } | null;
  maestria: { nivel: number; puntos: number } | null;
  campeonWinrate: number | null;        // our aggregated data for campeón+rol
  /**
   * `texto` en español (lo que mandan los servidores anteriores a la 3.0); `clave` y `params` (Fase 3), la clave de i18n
   * para enseñarla en el idioma de la app («carga.etiqueta.*», «carga.rasgo.*»).
   */
  etiquetas: { tipo: 'positivo' | 'neutro' | 'info'; texto: string; clave?: string; params?: Record<string, string> }[];
  /** Aún faltan datos (Data Dragon o el servidor): la tarjeta enseña «Cargando datos…». */
  cargando?: boolean }
export interface EstadoCarga {
  jugadores: JugadorCarga[];
  version: string;
  /** Track F2 (opcional, apagado por defecto): ruta habitual estimada del jungla enemigo, ya en texto («Estimación: … suele …»). */
  rutaJungla?: RutaJunglaCarga | null;
}
export interface RutaJunglaCarga {
  /** Id de Data Dragon del jungla enemigo. */
  campeon: string;
  texto: string;
}

export type ModoOverlay = 'carga' | 'partida' | 'oculto';

/** Campamentos que se pueden cronometrar: solo los de tu lado y los dos Escarabajos (nunca los del rival). */
export type IdCampamento = 'azul' | 'gromp' | 'lobos' | 'aviar' | 'rojo' | 'krugs' | 'escarabajoArriba' | 'escarabajoAbajo';
export interface CampamentoEstado {
  id: IdCampamento;
  nombre: string;
  /** 'arriba' o 'abajo' en el mapa, según tu lado. */
  zona: 'arriba' | 'abajo';
  /** Segundos hasta que aparece (primera aparición o reaparición marcada); null si ya está. */
  aparece: number | null;
  disponible: boolean;
  /** Hay una reaparición marcada a mano en curso. */
  marcado: boolean;
}
export interface EstadoJungla { lado: 'azul' | 'rojo'; campamentos: CampamentoEstado[] }

/** Frase de voz que el overlay pone en su cola (prioridad: menor = más urgente). */
export interface FraseVoz {
  tipo: TipoVoz;
  clave: string;
  texto: string;
  prioridad: number;
  /** Milisegundos tras los que deja de tener sentido decirla. */
  caducaMs: number;
}

export interface SeleccionCampeon {
  campeonId: number;
  rol: import('@coach/shared').Rol | null;
  /** Modo de la cola (LCU); falta si la cola no es de un modo con datos o aún no se sabe (se usa clasificatoria). */
  modo?: import('@coach/shared').ModoJuego;
  /** La cola aún no se sabe (se está leyendo la sesión de gameflow): no se importa solo hasta que llegue. */
  modoPendiente?: true;
}

import type { Habilidad, KdaMedio, ModoJuego, Rol } from '@coach/shared';
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
  /** Idioma de la app al cargar la ventana (Fase 3); opcional en las pruebas. */
  idioma?: string;
  /** Avisa cuando cambia el idioma de la app (evento 'coach:idioma'). */
  alCambiarIdioma?(cb: (idioma: string) => void): () => void;
  /** Tema de la ventana principal al cargarla (síncrono, para pintar ya con él); opcional en las pruebas. */
  tema?: string;
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
  /** Avisa cuando los ajustes cambian fuera de esta ventana (Alt+Shift+L o el marco del minimapa en el modo mover). Opcional en las pruebas. */
  alCambiarAjustes?(cb: (a: Ajustes) => void): () => void;
  /** Vuelve a poner el marco del minimapa en su sitio por defecto; devuelve los ajustes guardados. */
  restablecerMinimapa?(): Promise<Ajustes>;
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
  /** Idioma de la app al cargar la ventana (Fase 3); opcional en las pruebas. */
  idioma?: string;
  /** Avisa cuando cambia el idioma de la app (evento 'coach:idioma'). */
  alCambiarIdioma?(cb: (idioma: string) => void): () => void;
  alEstado(cb: (e: EstadoOverlay) => void): void;
  alAviso(cb: (a: AvisoOverlay) => void): void;
  alMover(cb: (activo: boolean) => void): void;
  alModo(cb: (m: ModoOverlay) => void): void;
  alCarga(cb: (c: EstadoCarga) => void): void;
  alConfig(cb: (c: AjustesOverlay) => void): void;
  alJungla(cb: (j: EstadoJungla) => void): void;
  alVoz(cb: (f: FraseVoz) => void): void;
  /** Configuración actual (al cargar la ventana; luego llega por alConfig). */
  obtenerConfig(): Promise<AjustesOverlay>;
  /** Posición de un widget tras arrastrarlo en modo mover; se guarda al salir de él. */
  guardarWidget(id: IdWidget, x: number, y: number): void;
  /** Marco del minimapa calibrado en el modo mover, en fracciones de la pantalla; null lo restablece. */
  guardarMinimapa(marco: MarcoMinimapa | null): void;
  /** Marca que un campamento se acaba de limpiar ('overlay:jungla-marcar'). */
  marcarJungla(id: IdCampamento): void;
  /**
   * Pide recibir el ratón mientras el cursor está sobre un widget: en modo mover (cualquier widget)
   * o sobre los botones de la jungla (si ese widget está activo). Fuera de eso, todo deja pasar los clics.
   */
  capturarRaton(capturar: boolean): void;
  /** Igual que capturarRaton, para los botones de la jungla (también fuera del modo mover). */
  capturarRatonJungla(capturar: boolean): void;
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
  /** EventID de la API (para no repetir un evento). */
  id?: number;
  /** Solo en ChampionKill (el registro de muertes): campeones (id de Data Dragon) reconocidos entre los jugadores. */
  asesino?: string;
  victima?: string;
  asistentes?: string[];
}

/** Un jugador de la partida según la Live Client Data API (lo mismo que enseña el marcador del juego). */
export interface JugadorPartida {
  /** Id de Data Dragon (p. ej. "LeeSin"). */
  campeon: string;
  equipo: 'ORDER' | 'CHAOS';
  /** `position` de la API si es un rol válido; null si no la da (suele venir vacía). */
  posicion: import('@coach/shared').Rol | null;
  /** Lleva Castigo (hechizo de invocador visible en el marcador). */
  castigo: boolean;
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
  /** Súbditos y monstruos (allPlayers[yo].scores.creepScore); ausente si la API no lo da. */
  cs?: number;
  /** Asesinatos, muertes y asistencias del jugador activo (scores); ausente si falta alguno. */
  kda?: { k: number; d: number; a: number };
  /** Equipo del jugador activo (ORDER = lado azul); ausente si no se sabe. */
  equipo?: 'ORDER' | 'CHAOS';
  /** gameData.mapTerrain si no es «Default» (p. ej. «Infernal»): el elemento de la Grieta. */
  terreno?: string;
  /** Modo de la partida según la Live Client Data API (`gameMode`); si falta, clasificatoria (la Grieta). */
  modo?: import('@coach/shared').ModoJuego;
  /** Todos los jugadores con equipo y campeón reconocibles. */
  jugadores?: JugadorPartida[];
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

