export type TipoAviso = 'compra' | 'habilidad' | 'objetivo' | 'vision' | 'fase';

export interface Ajustes {
  avisos: Record<TipoAviso, boolean>;
  voz: boolean;
  importacionAutomatica: boolean;
  /** 3.7: la importación automática ya se encendió una vez por defecto (para no volver a hacerlo si se apaga). */
  importacionAutomaticaMigrada?: boolean;
  /** 3.6: al cerrar la ventana, la app sigue en la bandeja del sistema (overlay, voz y análisis siguen funcionando). */
  bandeja: boolean;
  /** 3.6: abrir Coach LoL IA al iniciar Windows (en la bandeja, sin ventana). */
  arranqueWindows: boolean;
  /** 3.6: mostrar la ventana al empezar la selección de campeón (sin quitar el foco al cliente). */
  alFrenteEnSeleccion: boolean;
  /**
   * 3.1: al pulsar «Importar» sin páginas de runas libres, sustituir una sin preguntar («No volver a preguntar»).
   * La importación automática nunca borra nada.
   */
  sustituirPaginaSinPreguntar?: boolean;
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
  /** 3.4: tecla para enseñar u ocultar el panel de aumentos en ARAM: Caos (Alt+Shift+A; vacía, sin tecla). */
  teclaAumentos: string;
  /** 3.9: teclas globales opcionales para marcar cada reliquia de vida en ARAM (vacío: ninguna; main siempre lo rellena). */
  teclasReliquias?: Partial<Record<IdReliquia, string>>;
  /**
   * Jungla enemigo (Track F): `avisos`, por el registro de muertes (encendido por defecto); `ruta`, la ruta habitual
   * estimada con datos agregados del servidor (apagada por defecto).
   */
  junglaEnemiga: { avisos: boolean; ruta: boolean };
  /** Idioma de la app (Fase 3). Sin él (ajustes anteriores), el del sistema si es uno de los nuestros; si no, español. */
  idioma: import('./i18n').Idioma;
  /**
   * 3.0.1: ya se apagaron una vez los avisos emergentes (widgets `avisos` y `compra`) de unos ajustes anteriores.
   * Sin la marca, al cargar se apagan; con ella, se respeta lo que elija el usuario.
   */
  avisosEmergentesMigrados?: boolean;
  /** Tema de la ventana principal (3.0.1). Sin él (ajustes anteriores), 'clasico'. */
  tema: Tema;
  /** 3.2: coach con IA. Sin la sección (ajustes anteriores), los valores por defecto (todo encendido, 6 consejos). */
  ia: AjustesIa;
  /** 3.8: modo streamer y fuente para OBS (todo apagado por defecto; main siempre la rellena al normalizar). */
  streamer?: import('./streamer').AjustesStreamer;
}

/**
 * Coach con IA (3.2): análisis al terminar la partida y consejos en los momentos muertos. Los datos de la partida
 * (sin nombres de invocador ni Riot ID) se mandan a nuestro servidor para procesarlos con IA y no se guardan.
 */
export interface AjustesIa {
  /** Análisis con IA al terminar cada partida. */
  analisis: boolean;
  /** Consejos con IA en los momentos muertos (muerto, al volver a la tienda). */
  consejos: boolean;
  /** Máximo de consejos por partida (1-8). */
  maxConsejos: number;
  /** Decir en voz alta «Tu análisis está listo» (si la voz está encendida). */
  vozAnalisis: boolean;
  /** 3.5: charla de voz del coach personal al empezar cada partida (reto y cómo te va con ese campeón). */
  charlaPrevia: boolean;
}

/** Un análisis guardado en el historial local (userData/analisis.json, los 50 últimos). */
export interface EntradaAnalisis {
  id: string;
  /** ISO. */
  fecha: string;
  modo: import('@coach/shared').ModoJuego;
  campeon: string;
  nombreCampeon?: string;
  rol: import('@coach/shared').Rol | null;
  resultado: import('@coach/shared').ResultadoPartidaIa | null;
  duracion: number;
  final: import('@coach/shared').EstadisticasFinales;
  linea: import('@coach/shared').MuestraMinuto[];
  muertes: number[];
  objetivos: import('@coach/shared').ObjetivoTomadoIa[];
  csObjetivoMinuto: number | null;
  analisis: import('@coach/shared').AnalisisPartida;
  /** Versión de Data Dragon, para los iconos. */
  version?: string;
  /** 3.8: cola de una normal de la Grieta o de un modo rotativo (la UI dice «Normal», «Otro modo»…). */
  cola?: number;
}

export type ErrorAnalisis = 'no_configurado' | 'limite' | 'no_disponible' | 'no_valido' | 'sin_conexion';
/** Estado del análisis de la última partida, para la vista «Análisis». */
export type EstadoAnalisis = { estado: 'analizando' } | { estado: 'listo'; id: string } | { estado: 'error'; error: ErrorAnalisis } | { estado: 'inactivo' };

/** 'clasico': azul y oro con un toque sombrío; 'sombra': carmesí como acento principal y fondos más oscuros. */
export type Tema = 'clasico' | 'sombra';

// ---- Overlay modular (contratos compartidos de la 3.0) ----
export type IdWidget = 'objetivos' | 'habilidad' | 'cs' | 'compra' | 'jungla' | 'avisos' | 'aumentos' | 'reliquias';
export interface ConfigWidget { activo: boolean; x: number | null; y: number | null; escala: number } // escala 0.75..1.5
/**
 * Escala del HUD que el jugador eligió en LoL (Config/game.cfg, sección [HUD]): `global` es GlobalScale y `minimapa`
 * MinimapScale, ambos entre 0 y 1 (null si no se pudo leer); `minimapaIzquierda` es FlipMiniMap=1.
 */
export interface EscalaHud { global: number | null; minimapa: number | null; minimapaIzquierda: boolean }
/** Posición calibrada de la flecha de habilidad (esquina del widget, px) por tamaño de pantalla («1920x1080»). */
export type CalibracionHabilidad = Record<string, { x: number; y: number }>;
export interface AjustesOverlay {
  widgets: Record<IdWidget, ConfigWidget>;
  opacidad: number /*0.5..1*/;
  voz: AjustesVoz;
  jungla: AjustesJungla;
  /** 3.0.1: calibración de la flecha en el modo mover, por tamaño de pantalla; manda sobre la escala del HUD leída. */
  calibracionHabilidad?: CalibracionHabilidad;
  /** 3.1: cómo se ve la pantalla de carga y si Espacio la oculta. */
  carga: AjustesCarga;
}
/**
 * Pantalla de carga (3.1): 'completa' tapa toda la pantalla con un diseño opaco (por defecto); 'tarjetas', las 10
 * tarjetas translúcidas sobre la pantalla de carga del juego (como en la 3.0.2); 'desactivada', no sale.
 */
export type ModoPantallaCarga = 'completa' | 'tarjetas' | 'desactivada';
export interface AjustesCarga {
  modo: ModoPantallaCarga;
  /** Mientras se ve la pantalla de carga, Espacio la oculta en esa partida (la tecla solo se reserva entonces). */
  ocultarConEspacio: boolean;
}
/** Marco del minimapa de LoL, en fracciones de la pantalla: x e y del ancho y del alto; lado, del alto. */
export interface MarcoMinimapa { x: number; y: number; lado: number }
/**
 * Presentación de los temporizadores de la jungla: sobre los campamentos del minimapa (por defecto) o el panel
 * lateral. `minimapa` es el marco calibrado en el modo mover; null usa el de por defecto (abajo a la derecha).
 */
export interface AjustesJungla { presentacion: 'minimapa' | 'panel'; minimapa: MarcoMinimapa | null }
export interface AjustesVoz {
  activa: boolean;
  volumen: number /*0..1*/;
  /** Voz de Windows elegida (voiceURI o nombre); null = la preferida del idioma. */
  vozId: string | null;
  tipos: Record<TipoVoz, boolean>;
  /**
   * 3.1: motor de la voz. 'pack' (por defecto) es la voz pregrabada de Coach LoL IA cuando hay paquete para el
   * idioma; las frases que no estén enteras en él salen con la natural. 'natural' es la voz neuronal sin conexión.
   * Lo que no esté descargado o falle sale con la de Windows, sin avisar. 'sistema' usa siempre la de Windows.
   */
  motor: MotorVoz;
  /** 3.1: voz natural elegida por idioma (id del catálogo); sin entrada, la recomendada del idioma. */
  vocesNaturales: Partial<Record<import('./i18n').Idioma, string>>;
  /**
   * 3.7: ritmo de la voz. «tranquilo»: una frase cada 12 s y, en una pelea, solo los objetivos a punto de salir;
   * «normal»: una cada 5 s; «activo»: una cada 3 s.
   */
  ritmo?: RitmoVoz;
}
export type RitmoVoz = 'tranquilo' | 'normal' | 'activo';
export type MotorVoz = 'pack' | 'natural' | 'sistema';
/**
 * Audio de la voz que main da al renderizador: PCM de 16 bits little-endian mono (voz natural), o los clips
 * comprimidos de la voz pregrabada que el renderizador decodifica y une sin cortes (`ids` sirve de caché).
 */
export type AudioVoz = AudioPcm | AudioClips;
export interface AudioPcm { sampleRate: number; pcm: Uint8Array }
export interface AudioClips { clips: Uint8Array[]; ids: string[]; pausasMs: number[] }
export type EstadoInstalacionVoz = 'no_instalada' | 'descargando' | 'instalando' | 'instalada' | 'error';
export type ErrorVozNatural = 'red' | 'checksum' | 'incompleta' | 'cancelada' | 'paquete' | 'motor';
/** Estado de la voz natural y del paquete pregrabado del idioma actual, para la vista Overlay. */
export interface EstadoVozNatural {
  /** Estado conjunto de lo que hay que descargar (modelo neuronal y, si existe, el paquete pregrabado del idioma). */
  estado: EstadoInstalacionVoz;
  recibidos: number;
  total: number;
  error: ErrorVozNatural | null;
  /** Voces del modelo neuronal (las mismas en todos los idiomas). */
  voces: { id: string; genero: 'masculina' | 'femenina'; numero: number }[];
  /** Voz neuronal recomendada para el idioma actual. */
  porDefecto: string;
  /** El modelo neuronal está instalado. */
  naturalInstalada: boolean;
  /** Hay voz pregrabada publicada para el idioma actual. */
  packDisponible: boolean;
  /** La voz pregrabada del idioma actual está instalada. */
  packInstalado: boolean;
  /** Megabytes que faltan por descargar (modelo + paquete del idioma). */
  megasPendientes: number;
}
/**
 * Categorías de las frases de voz (3.1: más de 400 frases). Cada una se puede apagar en la vista Overlay; el nivel de
 * detalle (shared/vozCategorias.ts) enciende un conjunto de ellas.
 */
export type TipoVoz =
  | 'objetivo'
  | 'compra'
  | 'habilidad'
  | 'cs'
  | 'vision'
  | 'fase'
  | 'jungla'
  | 'junglaEnemiga'
  | 'economia'
  | 'nivel'
  | 'combate'
  | 'equipo'
  | 'muerte'
  | 'animo'
  | 'modo'
  /** 3.9: un enemigo vigilado completa un objeto clave (lo que se ve en el Tab). */
  | 'spike';
export interface ObjetivoEstado {
  id: 'dragon' | 'anciano' | 'larvas' | 'heraldo' | 'baron' | 'inhibidor';
  nombre: string;
  subtipo: string | null /* dragon type, e.g. 'Infernal'; en un inhibidor, la calle */;
  aparece: number | null;
  disponible: boolean;
  /** 3.5: inhibidor de tu equipo (true) o del rival (false). Solo en los inhibidores. */
  aliado?: boolean;
}
export interface EstadoCs { cs: number; porMinuto: number; objetivoPorMinuto: number; cs10: number | null }
/** KDA de la partida en curso; ratio = (k + a) / máx(1, d). */
export interface KdaPartida { k: number; d: number; a: number; ratio: number }
/** Widget «Rendimiento»: CS y KDA en vivo junto al KDA medio del campeón en su rol (de la build). */
/** cs es null fuera de la Grieta (ARAM, ARAM: Caos y Arena): allí el widget solo enseña el KDA. */
export interface EstadoRendimiento {
  cs: EstadoCs | null;
  kda: KdaPartida | null;
  kdaMedio: KdaMedio | null;
  /**
   * 3.5: diferencia de oro en objetos (lo que enseña el Tab): de tu equipo frente al rival y tuya frente a tu rival de
   * línea (null si no se sabe quién es). Solo en la Grieta.
   */
  oro?: { equipo: number; rival: number | null } | null;
}
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
/** 3.4: perfil de un campeón en Data Dragon (champion.json): clases, daño, alcance y recurso. */
export interface PerfilCampeon {
  /** `tags` (Marksman, Mage, Assassin, Fighter, Tank, Support), la principal primero. */
  clases: string[];
  /** `info.attack` e `info.magic` (0–10). */
  ataque: number;
  magia: number;
  /** `stats.attackrange`. */
  alcance: number;
  /** `partype` (Mana, Energy, None…). */
  recurso: string;
}
/** 3.4: tier de un aumento de ARAM: Caos para tu campeón (encaje, nunca % de victorias: política de Riot). */
export type TierAumento = 'S' | 'A' | 'B' | 'C';
export interface AumentoPanel {
  id: number;
  nombre: string;
  icono: string | null;
  tier: TierAumento;
}
/** 3.4: panel de aumentos del overlay en ARAM: Caos. */
export interface PanelAumentos {
  /** Nombre del campeón para el título. */
  campeon: string;
  /** Los mejores de cada rareza (prismático, oro, plata), de mejor a peor. */
  columnas: { rareza: 'prismatico' | 'oro' | 'plata'; aumentos: AumentoPanel[] }[];
  /** Grupos que se combinan entre sí (`tema:critico`, `familia:pan`…). */
  combos: { id: string; aumentos: AumentoPanel[] }[];
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
  cargando?: boolean;
  /** 3.1: es el jugador local (su tarjeta se resalta y su campeón pone el fondo de la pantalla completa). */
  propio?: boolean;
  /** 3.2: jugador anonimizado u oculto: nunca se busca y su tarjeta solo enseña el campeón (sin rango, maestría ni winrate). */
  anonimo?: boolean;
  /** 3.8: modo streamer: `riotId` ya es el nombre del campeón (la tarjeta no lo repite). */
  streamer?: boolean }
export interface EstadoCarga {
  jugadores: JugadorCarga[];
  version: string;
  /** Track F2 (opcional, apagado por defecto): ruta habitual estimada del jungla enemigo, ya en texto («Estimación: … suele …»). */
  rutaJungla?: RutaJunglaCarga | null;
  /** 3.1: id de la cola (`gameData.queue.id` de la sesión: 420 Solo/Dúo, 440 Flexible…); null o ausente si no se sabe. */
  cola?: number | null;
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

/** 3.9: reliquias de vida del Abismo (ARAM y ARAM: Caos): las dos de tu mitad y las dos de la del rival. */
export type IdReliquia = 'propiaExterior' | 'propiaInterior' | 'rivalExterior' | 'rivalInterior';
export interface ReliquiaEstado {
  id: IdReliquia;
  nombre: string;
  /** Segundos hasta que aparece (primera aparición o reaparición marcada); null si ya está. */
  aparece: number | null;
  disponible: boolean;
  /** Hay una reaparición marcada a mano en curso. */
  marcado: boolean;
}
export interface EstadoReliquias { reliquias: ReliquiaEstado[] }

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
  /**
   * 3.8: cola (queueId) cuando no es de uno de los cuatro modos con datos: una normal de la Grieta (que usa
   * clasificatoria) o un modo rotativo (URF, Uno para todos…). Falta en los cuatro modos.
   */
  cola?: number;
  /** 3.8: `gameMode` y mapa de la cola (sesión de gameflow, `gameData.queue`), si se saben. Solo con `cola`. */
  gameMode?: string;
  mapa?: number;
}

/** 3.9: tu rol y los campeones que ya ha elegido el equipo rival en la selección (sesión de champ select). */
export interface RivalesSeleccion {
  /** Tu rol asignado; null si la cola no los asigna. */
  rol: import('@coach/shared').Rol | null;
  /** Rol del rival si el cliente lo dice (en clasificatoria no lo dice: null). */
  rivales: { campeonId: number; rol: import('@coach/shared').Rol | null }[];
  /**
   * 3.9.2: la selección está en la fase de bloqueos (hay bloqueos pendientes y uno en curso, o la fase de
   * planificación previa). Falta fuera de ella.
   */
  faseBloqueos?: true;
  /** 3.9.2: claves de los campeones ya bloqueados (los dos equipos); falta si no hay ninguno. */
  bloqueados?: number[];
  /** 3.9.2: claves de los campeones de tus compañeros (elegidos o en intención); falta si no hay ninguno. */
  aliados?: number[];
}

/**
 * 3.9.2: una idea de bloqueo durante la fase de bloqueos. Siempre van varias juntas: son opciones, nunca una orden
 * (normas de Riot, ver `main/builds/baneos.ts`).
 */
export interface IdeaBaneoVista {
  campeon: CampeonDDragon;
  /** 'counter': le cuesta a tu campeón en tu línea; 'fuerte': de los más fuertes del parche en el rol de tu rival de línea. */
  motivo: 'counter' | 'fuerte';
  /** counter: TU % de victorias contra él; fuerte: SU % de victorias en el rol. */
  tasaVictoria: number;
  partidas: number;
  /** fuerte: su % de selección en el rol (uso del rol en `/campeones`). */
  seleccionRol?: number;
  /** Su tasa de bloqueo en el parche, si el servidor la da. */
  tasaBloqueo?: number;
}

/** 3.9.2: tarjeta «Ideas para banear». */
export interface IdeasBaneoVista {
  /** Tu campeón (el elegido o en intención) si ya se sabe: entonces las primeras ideas son sus counters. */
  campeon: CampeonDDragon | null;
  ideas: IdeaBaneoVista[];
}

/** 3.9: un cruce para pintarlo, con el campeón ya resuelto en Data Dragon (id exacto para el icono y nombre traducido). */
export interface LineaEnfrentamientoVista {
  campeon: CampeonDDragon;
  partidas: number;
  /** Tu tasa de victorias (0..1) en ese cruce. */
  tasaVictoria: number;
  datosLimitados: boolean;
  /** 3.9.1: tu % de fase de líneas ganada (más oro al minuto 14), sus partidas y la puntuación (−100..100); solo si el servidor los da. */
  tasaFaseLineas?: number;
  partidasFaseLineas?: number;
  puntuacion?: number;
}

/** 3.9: enfrentamientos de línea de un campeón y rol, listos para la vista. */
export interface CountersVista {
  parche: string;
  partidas: number;
  /** Todos los cruces listables, de mejor a peor («Ver todos»). */
  todos: LineaEnfrentamientoVista[];
  /** Te va bien (mejor primero). */
  faciles: LineaEnfrentamientoVista[];
  /** Te cuesta (peor primero). */
  dificiles: LineaEnfrentamientoVista[];
  /** Vienen de la caché en disco (sin servidor). */
  sinConexion: boolean;
}

/**
 * 3.9: enfrentamientos durante la selección (solo Grieta con roles; nunca en el overlay ni en partida: es información
 * de antes de la partida).
 */
export interface EstadoEnfrentamientos {
  rol: import('@coach/shared').Rol;
  /** El rival de tu línea, si ya ha elegido; `inferido` si su rol se dedujo (el cliente no lo dice en clasificatoria). */
  rival: (CampeonDDragon & { inferido: boolean }) | null;
  /** Tus counters (con tu campeón elegido). */
  counters: CountersVista | null;
  /** Tu campeón contra el rival: tu % y la build del cruce si la hay (con sus nombres e iconos). */
  contra: {
    partidas: number;
    tasaVictoria: number;
    datosLimitados: boolean;
    /** 3.9.2: fase de líneas ganada (0..1), sus partidas y la puntuación del cruce (−100..100), si el servidor las da. */
    tasaFaseLineas?: number;
    partidasFaseLineas?: number;
    puntuacion?: number;
    build?: import('@coach/shared').Build;
    recursos?: RecursosBuild;
  } | null;
  /** Sin campeón elegido y con el rival ya elegido: los 5 que mejor le van contra él en tu rol. */
  buenasElecciones: LineaEnfrentamientoVista[];
  /** 3.9.2: solo en la fase de bloqueos y con ideas que dar. */
  ideasBaneo?: IdeasBaneoVista;
  /**
   * Tu propio historial (solo local, de este PC) con tu campeón contra el rival de tu línea en tu rol; solo con
   * `MINIMO_PARTIDAS_PERSONAL` partidas o más.
   */
  historial?: HistorialCrucePersonal | null;
  /** Rivales (id de Data Dragon) contra los que tu historial con este campeón y rol es malo (menos del 50 %). */
  historialMalo?: HistorialRivalMalo[];
}

/** Tu historial en un cruce, para la tarjeta «Contra {rival}». */
export interface HistorialCrucePersonal {
  partidas: number;
  victorias: number;
  derrotas: number;
  /** Nota media 0–100. */
  nota: number;
}

/** Un rival contra el que tu historial es malo, para marcarlo en la tarjeta «Enfrentamientos». */
export interface HistorialRivalMalo {
  /** Id de Data Dragon del rival. */
  rival: string;
  victorias: number;
  derrotas: number;
}

/** Consejos del enfrentamiento («Claves del cruce») listos para la vista. */
export interface ConsejosCruceVista {
  consejos: string[];
  combos: string[];
  /** Vienen de la caché en disco (sin servidor). */
  sinConexion: boolean;
}

/** Respuesta de 'coach:consejos-enfrentamiento'. */
export type RespuestaConsejosEnfrentamiento = { ok: true; consejos: ConsejosCruceVista } | { ok: false };

/** 3.9.1: un compañero de equipo para pintarlo (campeón resuelto en Data Dragon). */
export interface LineaSinergiaVista {
  campeon: CampeonDDragon;
  partidas: number;
  /** Tu tasa de victorias (0..1) jugando con él. */
  tasaVictoria: number;
  datosLimitados: boolean;
}

/** 3.9.1: mejores compañeros de un campeón y rol, por rol del compañero. */
export interface SinergiasVista {
  parche: string;
  porRol: { rol: import('@coach/shared').Rol; aliados: LineaSinergiaVista[] }[];
  sinConexion: boolean;
}

/** 3.9.1: respuesta de 'coach:sinergias'. */
export type RespuestaSinergias = { ok: true; version: string; sinergias: SinergiasVista } | { ok: false };

/** Ficha del campeón con los parecidos resueltos (nombre e icono de Data Dragon). */
export interface FichaVista {
  campeon: CampeonDDragon;
  claves: string[];
  fortalezas: string[];
  debilidades: string[];
  /** Los parecidos que Data Dragon conoce, en el orden del servidor. */
  parecidos: CampeonDDragon[];
  danio?: import('@coach/shared').DesgloseDanio;
  sinConexion: boolean;
}

/** Novedades del parche: un campeón cambiado, con nombre e icono de Data Dragon. */
export interface CambioCampeonVista {
  campeon: CampeonDDragon;
  tipo: import('@coach/shared').TipoCambioParche;
  resumen: string;
  /** Solo en «Tus campeones»: tus partidas con él (del Perfil local). */
  partidas?: number;
}

/** Novedades del parche: un objeto cambiado (nombre en el idioma de la app si Data Dragon lo conoce). */
export interface CambioObjetoVista {
  id?: number;
  nombre: string;
  tipo: import('@coach/shared').TipoCambioParche;
  resumen: string;
}

export interface NotasParcheVista {
  /** Número del parche en el juego («26.21»). */
  parcheJuego: string;
  /** Notas oficiales de Riot en el idioma de la app. */
  url: string;
  general?: string;
  /** Tus campeones más jugados que cambian, del más jugado al menos. */
  tuyos: CambioCampeonVista[];
  /** El resto de campeones cambiados, por nombre. */
  resto: CambioCampeonVista[];
  objetos: CambioObjetoVista[];
  /** Hay partidas en el Perfil local (si no, «Tus campeones» no se puede calcular). */
  hayPerfil: boolean;
  sinConexion: boolean;
}

/** Respuesta de 'coach:notas-parche'. */
export type RespuestaNotasParche = { ok: true; version: string; notas: NotasParcheVista } | { ok: false };

/** Respuesta de 'coach:ficha-campeon'. */
export type RespuestaFichaCampeon = { ok: true; version: string; ficha: FichaVista } | { ok: false };

/** 3.9: respuesta de 'coach:counters' (counters de cualquier campeón y rol, para el apartado Campeones). */
export type RespuestaCounters = { ok: true; version: string; counters: CountersVista } | { ok: false };

/**
 * 3.8: modo rotativo de la selección. 'datos': la build es la del modo (`/rotativos/:cola/builds/:campeon`);
 * 'respaldo': aún no hay datos del modo y se enseña la build de su mapa (`base`); 'pve': modo sin builds (Enjambre…).
 */
export interface RotativoSeleccion {
  cola: number;
  /** Nombre del servidor (inglés, de queues.json) o el `gameMode` si el servidor no conoce la cola. */
  nombre: string;
  gameMode: string | null;
  /** Modo con datos del mapa del rotativo (Grieta: clasificatoria, Abismo: ARAM, Rings of Wrath: Arena). */
  base: import('@coach/shared').ModoJuego;
  estado: 'datos' | 'respaldo' | 'pve';
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
    /**
     * Página de runas elegida (índice en `build.opcionesRunas`, 3.0.1); 0 (la más jugada) por defecto. Sin
     * `opcionesRunas` (servidor anterior) se ignora y las runas son las de la opción de build.
     */
    opcionRunas?: number;
    /** 3.4: tier list de aumentos para el campeón (solo en ARAM: Caos; no depende de que haya build). */
    aumentosCaos?: PanelAumentos;
    /** 3.8: cola de una normal de la Grieta (la UI dice «Normal», «Partida rápida» o «Flex»). */
    cola?: number;
    /** 3.8: la selección es de un modo rotativo (URF, Uno para todos…). */
    rotativo?: RotativoSeleccion;
  } | null;
  version: string; // Data Dragon, para las imágenes ('' si no hay datos)
  recursos: RecursosBuild;
  /** 'datos' si no se pudieron cargar los datos de Data Dragon (sin red ni caché). */
  error: 'datos' | null;
  /** Resultado de la última importación (automática o manual) de la selección actual. */
  importacion: ResultadoImportar | null;
  /** Aviso en español para la ventana principal (p. ej. el modo de pantalla completa); null si no hay. */
  aviso: string | null;
  /** 3.9: enfrentamientos de línea de la selección (falta o null fuera de ella). */
  enfrentamientos?: EstadoEnfrentamientos | null;
}

/** 3.1: si no quedan páginas libres, la del jugador que se sustituiría al confirmar (id y nombre). */
export type ResultadoParte =
  | { ok: true }
  | { ok: false; motivo: 'sin_paginas'; sustituible?: { id: number; nombre: string } }
  | { ok: false; motivo: 'error' };

/** 3.1: «Importar» pulsado tras confirmar que se sustituya esta página de runas (su id). */
export interface OpcionesImportar {
  sustituirPagina?: number;
}
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
  /** Importación manual («Importar»); con `sustituirPagina`, el jugador confirmó sustituir esa página de runas. */
  importar(opciones?: OpcionesImportar): Promise<ResultadoImportar>;
  cambiarRol(rol: Rol): Promise<void>;
  /** Elige otra opción de build ('coach:cambiar-opcion'); un índice no válido se ignora. */
  cambiarOpcion(i: number): Promise<void>;
  /** Elige otra página de runas ('coach:cambiar-runas'); un índice no válido se ignora. */
  cambiarRunas(i: number): Promise<void>;
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
  /** 3.9: enfrentamientos de línea de un campeón (id de Data Dragon) y rol ('coach:counters'). */
  counters?(campeon: string, rol: Rol): Promise<RespuestaCounters>;
  /** 3.9.1: mejores compañeros de equipo de un campeón (id de Data Dragon) y rol ('coach:sinergias'). */
  sinergias?(campeon: string, rol: Rol): Promise<RespuestaSinergias>;
  /** Ficha del campeón (id de Data Dragon) en el idioma de la app ('coach:ficha-campeon'). */
  fichaCampeon?(campeon: string): Promise<RespuestaFichaCampeon>;
  /** Consejos del enfrentamiento (ids de Data Dragon y rol) en el idioma de la app ('coach:consejos-enfrentamiento'). */
  consejosEnfrentamiento?(campeon: string, rival: string, rol: Rol): Promise<RespuestaConsejosEnfrentamiento>;
  /** Novedades del parche en el idioma de la app, con tus campeones primero ('coach:notas-parche'). */
  notasParche?(): Promise<RespuestaNotasParche>;
  /** Abre las notas oficiales de Riot en el navegador ('coach:abrir-notas-parche'; solo URL de leagueoflegends.com). */
  abrirNotasParche?(url: string): Promise<void>;
  /** 3.9: importa la build del cruce contra el rival de tu línea ('coach:importar-enfrentamiento'). */
  importarEnfrentamiento?(): Promise<ResultadoImportar>;
  /** 3.1: voz natural ('voz:sintetizar'); null si no está instalada o falla (entonces se usa la de Windows). */
  sintetizarVoz?(texto: string): Promise<AudioVoz | null>;
  /** 3.1: estado de la voz natural ('voz:estado'). */
  estadoVozNatural?(): Promise<EstadoVozNatural>;
  /** 3.1: descarga (o reanuda) la voz natural y la pregrabada del idioma ('voz:descargar'). */
  descargarVozNatural?(): Promise<EstadoVozNatural>;
  /** 3.1: cancela la descarga en curso ('voz:cancelar'); lo bajado se conserva para reanudar. */
  cancelarDescargaVoz?(): Promise<EstadoVozNatural>;
  /** 3.1: avisa del progreso de la descarga y de los cambios de la voz natural (evento 'voz:estado'). */
  alCambiarVozNatural?(cb: (e: EstadoVozNatural) => void): () => void;
  /** 3.2: historial de análisis con IA ('coach:analisis-historial'), del más reciente al más antiguo. */
  historialAnalisis?(): Promise<EntradaAnalisis[]>;
  /** 3.2: estado del análisis de la última partida ('coach:analisis-estado'). */
  estadoAnalisis?(): Promise<EstadoAnalisis>;
  /** 3.2: avisa de un análisis nuevo o de su estado (evento 'coach:analisis'); `hablar`: decir que está listo. */
  alAnalisis?(cb: (e: { estado: EstadoAnalisis; entrada?: EntradaAnalisis; hablar?: boolean }) => void): () => void;
  /** 3.2: main pide abrir una vista (p. ej. al pulsar la notificación del análisis). */
  alNavegar?(cb: (vista: string) => void): () => void;
  /** 3.5: perfil, historial y retos del jugador ('coach:perfil'); `actualizar` lo vuelve a leer del cliente. */
  perfil?(actualizar?: boolean): Promise<import('./perfil').Perfil>;
  /** 3.5: línea de tiempo de una partida del historial ('coach:perfil-linea'); null si no se puede leer. */
  lineaTiempo?(id: number): Promise<import('./perfil').LineaTiempo | null>;
  /** 3.7: copia al portapapeles o guarda como PNG la tarjeta compartible de una partida ('coach:compartir-tarjeta'). */
  compartirTarjeta?(png: string, accion: 'copiar' | 'guardar', nombre: string): Promise<{ ok: boolean; ruta?: string }>;
  /** 3.5: elige el reto activo (null lo quita). */
  elegirReto?(id: import('./perfil').IdReto | null): Promise<import('./perfil').Perfil>;
  /**
   * 3.9: «Tus estadísticas» ('coach:personal-stats'): counters, tier list y peores rivales con tu propio historial;
   * con campeón y rol, también tus counters con él, y con rival, ese cruce. Solo local.
   */
  estadisticasPersonales?(consulta?: import('./personal').ConsultaPersonal): Promise<import('./personal').RespuestaPersonal>;
  /** 3.5: pregunta al coach personal ('coach:personal'): la conversación acaba con el mensaje del usuario. */
  coachPersonal?(mensajes: import('@coach/shared').MensajePersonal[]): Promise<{ ok: true; datos: string } | { ok: false; error: ErrorAnalisis }>;
  /** 3.7: memoria (MB) y CPU (%) que usa la app ahora ('coach:consumo'). */
  consumo?(): Promise<{ ramMb: number; cpu: number }>;
  /** 3.5: el perfil cambió (evento 'coach:perfil'). */
  alPerfil?(cb: (p: import('./perfil').Perfil) => void): () => void;
  /** 3.8: estado de la fuente para OBS ('streamer:obs-estado'). */
  estadoObs?(): Promise<import('./streamer').EstadoObs>;
  /** 3.8: cambia el token de la URL de OBS (la anterior deja de funcionar). */
  regenerarTokenObs?(): Promise<import('./streamer').EstadoObs>;
  /** 3.8: avisa cuando cambia la fuente para OBS (evento 'streamer:obs'). */
  alCambiarObs?(cb: (e: import('./streamer').EstadoObs) => void): () => void;
  /** 3.8: copia un texto al portapapeles ('streamer:copiar'): la URL de OBS o el comando del chat. */
  copiarTexto?(texto: string): Promise<boolean>;
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
  /** 3.1: el jugador pulsó Espacio: la pantalla de carga se desvanece ('overlay:carga-ocultar'); opcional en las pruebas. */
  alOcultarCarga?(cb: () => void): void;
  alConfig(cb: (c: AjustesOverlay) => void): void;
  alJungla(cb: (j: EstadoJungla) => void): void;
  /** 3.9: reliquias de vida de ARAM ('overlay:reliquias'); opcional en las pruebas. */
  alReliquias?(cb: (r: EstadoReliquias) => void): void;
  /** 3.4: panel de aumentos de ARAM: Caos ('overlay:aumentos'; null lo oculta); opcional en las pruebas. */
  alAumentos?(cb: (p: PanelAumentos | null) => void): void;
  alVoz(cb: (f: FraseVoz) => void): void;
  /** Configuración actual (al cargar la ventana; luego llega por alConfig). */
  obtenerConfig(): Promise<AjustesOverlay>;
  /**
   * Posición de un widget tras arrastrarlo en modo mover; se guarda al salir de él. Con el tamaño de la pantalla,
   * la de la flecha se guarda como calibración de ese tamaño (3.0.1).
   */
  guardarWidget(id: IdWidget, x: number, y: number, pantalla?: { ancho: number; alto: number }): void;
  /** Escala del HUD de LoL leída de game.cfg ('overlay:hud'); opcional en las pruebas. */
  alHud?(cb: (hud: EscalaHud | null) => void): void;
  /** La última escala del HUD leída (al cargar la ventana). */
  obtenerHud?(): Promise<EscalaHud | null>;
  /** Marco del minimapa calibrado en el modo mover, en fracciones de la pantalla; null lo restablece. */
  guardarMinimapa(marco: MarcoMinimapa | null): void;
  /** Marca que un campamento se acaba de limpiar ('overlay:jungla-marcar'). */
  marcarJungla(id: IdCampamento): void;
  /** 3.9: marca que una reliquia de vida se acaba de recoger ('overlay:reliquia-marcar'); opcional en las pruebas. */
  marcarReliquia?(id: IdReliquia): void;
  /**
   * Pide recibir el ratón mientras el cursor está sobre un widget: en modo mover (cualquier widget)
   * o sobre los botones de la jungla (si ese widget está activo). Fuera de eso, todo deja pasar los clics.
   */
  capturarRaton(capturar: boolean): void;
  /** Igual que capturarRaton, para los botones de la jungla (también fuera del modo mover). */
  capturarRatonJungla(capturar: boolean): void;
  /** Botón «Fijar aquí»: sale del modo mover. */
  fijar(): void;
  /** 3.1: voz natural de una frase ('voz:sintetizar'); null = usar la de Windows. Opcional en las pruebas. */
  sintetizarVoz?(texto: string): Promise<AudioVoz | null>;
  /** 3.1: empieza a sintetizar una frase recién encolada para que esté lista cuando le toque ('voz:preparar'). */
  prepararVoz?(texto: string): void;
  /** 3.8: la voz empieza a decir esta frase ('overlay:voz-dicha'): subtítulos de la fuente para OBS. */
  vozDicha?(texto: string): void;
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
  /**
   * Campeones (id de Data Dragon) reconocidos entre los jugadores: KillerName y Assisters de ChampionKill y, desde la
   * 3.0.2, de los objetivos (DragonKill, HordeKill, HeraldKill, BaronKill, AtakhanKill) y las estructuras
   * (TurretKilled, InhibKilled). VictimName solo en ChampionKill.
   */
  asesino?: string;
  victima?: string;
  asistentes?: string[];
  /**
   * Solo en TurretKilled / InhibKilled (y, desde la 3.1, InhibRespawningSoon / InhibRespawned): el nombre de la
   * estructura («Turret_T1_L_03_A», «Barracks_T2_R1»).
   */
  estructura?: string;
  /** 3.1: objetivo robado (campo `Stolen` de DragonKill, HeraldKill y BaronKill). */
  robado?: boolean;
  /** 3.1: Multikill → `KillStreak` (2 = doble… 5 = pentakill). */
  racha?: number;
  /** 3.1: GameEnd → `Result` («Win» o «Lose»). */
  resultado?: 'Win' | 'Lose';
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
  /** 3.1: nombre del campeón en el idioma del juego (`championName`), para la voz. */
  nombre?: string;
  /** 3.1: nivel (el marcador lo enseña a todos). */
  nivel?: number;
  /** 3.1: asesinatos del marcador (`scores.kills`), para comparar el marcador de los equipos. */
  asesinatos?: number;
  /** 3.2: objetos que enseña el marcador (TAB) de cada jugador (`items[].itemID`), para los consejos con IA. */
  objetos?: number[];
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
  /** 3.1: el jugador activo está muerto (`isDead`) y los segundos que le faltan para reaparecer (`respawnTimer`). */
  muerto?: boolean;
  reaparece?: number;
  /** 3.1: puntuación de visión del jugador activo (`scores.wardScore`). */
  vision?: number;
  /**
   * 3.8: `gameMode` de un modo rotativo (URF, ONEFORALL…): cualquiera que no sea de los cuatro modos con datos. El
   * `modo` es entonces el de su mapa; la voz y los avisos se adaptan (ver `vozEnPartida`).
   */
  rotativo?: string;
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

