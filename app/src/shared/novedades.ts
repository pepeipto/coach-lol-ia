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
    version: '3.0.0',
    fecha: '2026-10-19',
    puntos: [
      'Overlay nuevo, hecho de widgets que puedes mover, escalar y activar por separado: barra de objetivos, flecha de la próxima habilidad, contador de CS, aviso de compra y avisos.',
      'Temporizadores de jungla manuales y opcionales: tú los pones en marcha y la app te avisa cuando toca.',
      'Pantalla de carga con el equipo aliado y el enemigo: rango oficial, campeón y rol de cada jugador.',
      'Mucha más voz: avisos de objetivos, compras, habilidades, CS, visión, fases de la partida y jungla, que puedes activar uno a uno.',
      'Más builds: ahora se publican desde 10 partidas y las que salen de pocas partidas llevan la insignia «Datos limitados».',
      'Bienvenida la primera vez que abres la app: modo Sin bordes, cómo se importa y el overlay con Ctrl+Mayús+O.',
      'Vista «Novedades» en la barra lateral, y un resumen de cada versión nueva la primera vez que la abres.',
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
