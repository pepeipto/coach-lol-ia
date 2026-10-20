/**
 * Historial de versiones que muestra la vista «Novedades». Debe coincidir con `CHANGELOG.md` en la
 * raíz (lo comprueba test/novedades.test.ts); la primera entrada es siempre la versión de la app.
 */
export interface EntradaNovedades {
  version: string;
  /** AAAA-MM-DD */
  fecha: string;
  puntos: string[];
}

export const NOVEDADES: EntradaNovedades[] = [
  {
    version: '3.3.0',
    fecha: '2026-10-20',
    puntos: [
      'Análisis con IA al terminar cada partida: lo que hiciste bien, qué mejorar y momentos clave.',
      'Consejos de IA en los momentos muertos (al morir o al volver a la tienda), adaptados a tu partida.',
    ],
  },
  {
    version: '3.2.0',
    fecha: '2026-10-20',
    puntos: [
      'Cumplimiento de la política de Riot: Arena y ARAM: Caos ya no muestran % de victorias de aumentos ni de objetos de Arena; aviso legal oficial en todas las páginas.',
      'La pantalla de carga nunca busca a los jugadores ocultos o anónimos: de ellos solo enseña el campeón.',
    ],
  },
  {
    version: '3.1.0',
    fecha: '2026-10-20',
    puntos: [
      'Pantalla de carga a pantalla completa con tu tarjeta resaltada (se oculta con Espacio) y opción de solo tarjetas o desactivarla.',
      '460 frases de voz con variantes en cada idioma: objetivos, economía, farmeo, visión, peleas, fases de la partida, modos y ánimo, con nivel de detalle y categorías que puedes activar una a una.',
      'Voz natural (neuronal y sin conexión) en los 5 idiomas, mucho menos robótica; se descarga sola en segundo plano (unos 124 MB), nunca durante la selección, la carga ni la partida.',
      'Importar con todas las páginas de runas ocupadas: la app sustituye una (con tu confirmación).',
    ],
  },
  {
    version: '3.0.2',
    fecha: '2026-10-19',
    puntos: [
      'La pantalla de carga vuelve a salir (se quitaba antes de verse).',
      'Flecha de habilidad ajustada con medidas reales del HUD.',
      'El overlay se adapta a pantallas 2K y 4K y ya no tapa el contador de FPS.',
      'Más avisos del jungla enemigo: también cuando ayuda en una kill o se lleva un objetivo o una torre (solo con eventos oficiales del juego).',
    ],
  },
  {
    version: '3.0.1',
    fecha: '2026-10-19',
    puntos: [
      'Sin avisos emergentes en pantalla por defecto: la voz sigue avisando y los puedes volver a activar en la vista Overlay.',
      'Flecha pequeña estilo Blitz encima de la habilidad que toca subir, solo cuando tienes un punto por gastar, colocada según la escala del HUD de tu LoL.',
      'Runas seleccionables: varias páginas de runas por campeón y rol, con su % de victorias y partidas; la que elijas es la que se importa.',
      'Interfaz con un toque más sombrío y nuevo tema «Sombra» en Ajustes.',
    ],
  },
  {
    version: '3.0.0',
    fecha: '2026-10-19',
    puntos: [
      'Overlay nuevo, hecho de widgets que puedes mover, escalar y activar por separado: barra de objetivos arriba (con el tipo del próximo dragón), flecha grande sobre la habilidad que toca subir, rendimiento con tu CS y tu KDA frente a la media del campeón en su rol (la media aparece cuando se reúnen suficientes partidas nuevas), aviso de compra y avisos.',
      'Temporizadores de jungla manuales y opcionales, apagados por defecto: marcas con un clic o una tecla cuándo limpias un campamento de tu lado o un Escarabajo, y la app cuenta su reaparición.',
      'Temporizadores de jungla sobre el minimapa, estilo Riot, con atajo Alt+Mayús+L para mostrarlos u ocultarlos.',
      'Mucha más voz, de una frase en una y la más urgente primero: objetivos, compras, habilidades, CS, visión, fases de la partida y jungla. En la vista Overlay eliges la voz, el volumen y qué avisos quieres oír.',
      'Pantalla de carga con los dos equipos: rango oficial, maestría y victorias del campeón en su rol de cada jugador, con etiquetas solo positivas o neutras.',
      'Más builds: ahora se publican desde 10 partidas y las que salen de pocas partidas llevan la insignia «Datos limitados».',
      'Apartado «Campeones»: tier list de todos los campeones por rol (S, A, B y C según victorias y uso), con búsqueda, orden y la build completa de cada uno.',
      'Modos ARAM, ARAM: Caos y Arena con sus propias builds y tier list (en ARAM: Caos y Arena, también con aumentos), un selector de modo en «Campeones» y un overlay que en cada modo enseña solo lo que tiene sentido.',
      'Avisos del jungla enemigo por el registro de muertes y su ruta habitual (estimación). La ruta es opcional, viene apagada y aparece cuando se reúnen suficientes partidas nuevas.',
      'Bienvenida la primera vez que abres la app: modo Sin bordes, cómo se importa y el overlay con Ctrl+Mayús+O.',
      'Vista «Novedades» en la barra lateral, y un resumen de cada versión nueva la primera vez que la abres.',
      'La app, en 5 idiomas: español, inglés, portugués (Brasil), francés y alemán.',
      'Se actualiza sola: al abrirla descarga la última versión, la instala y se vuelve a abrir (nunca en medio de una partida: espera a que termine).',
    ],
  },
  {
    version: '2.1.0',
    fecha: '2026-10-19',
    puntos: [
      'Todo es gratis para todos, también el coach en partida (overlay y voz).',
      'Premium queda desactivado, y la barra lateral ofrece «Apoya el proyecto» para quien quiera ayudar.',
      'La web se actualiza con el modelo gratuito y una página para apoyar el proyecto.',
    ],
  },
  {
    version: '2.0.1',
    fecha: '2026-10-19',
    puntos: ['El correo de soporte pasa a ser support@coachlolia.com.'],
  },
  {
    version: '2.0.0',
    fecha: '2026-10-19',
    puntos: [
      'Interfaz nueva: ventana propia con barra lateral y las vistas Campeón, Overlay, Ajustes y Ayuda.',
      'Tres opciones de build por campeón y rol, según el núcleo de objetos más jugado.',
      'Asistente de soporte con IA en la vista «Ayuda» y en la web.',
      'Overlay rediseñado, con próxima habilidad y temporizadores de objetivos.',
      'Página web propia en www.coachlolia.com.',
      'Premium con prueba gratuita de 24 horas (suscripción de pago opcional); desde 2.1.0 está desactivado y todo es gratis.',
    ],
  },
  {
    version: '1.0.0',
    fecha: '2026-10-18',
    puntos: [
      'Primera versión: builds de Esmeralda o superior en EUW, LAN y LAS con runas, hechizos, orden de habilidades y objetos, calculadas por nuestro servidor con la API oficial de Riot.',
      'Importación de runas, hechizos y conjunto de objetos al cliente de League of Legends, a mano o de forma automática.',
      'Overlay básico durante la partida con consejos en español, voz y tecla rápida Ctrl+Mayús+O.',
      'Instalador para Windows con actualizaciones automáticas.',
    ],
  },
];

export const VERSION_ACTUAL = NOVEDADES[0].version;

/** Qué enseñar al abrir la app, según lo que ya vio el usuario. */
export type Arranque = 'bienvenida' | 'novedades' | 'nada';

export function queMostrar(vistos: { bienvenidaVista?: boolean; ultimaVersionVista?: string | null }, version = VERSION_ACTUAL): Arranque {
  if (!vistos.bienvenidaVista) return 'bienvenida';
  return vistos.ultimaVersionVista === version ? 'nada' : 'novedades';
}
