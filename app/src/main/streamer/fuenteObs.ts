import { t } from '../../shared/i18n';
import { textoSubtitulo } from '../../shared/streamer';
import type { AjustesOverlay, AumentoPanel, EstadoOverlay, ModoOverlay, ObjetivoEstado, PanelAumentos } from '../../shared/tiposApp';

/*
 * 3.8: lo que enseña la fuente para OBS. Sale del mismo estado que ya recibe el overlay y solo lleva lo que el overlay
 * enseña al jugador (normas de Riot): la barra de objetivos, el panel de aumentos de ARAM: Caos (tier de encaje, nunca
 * % de victorias) y la última frase que dijo la voz. Nunca lleva nombres ni datos de otros jugadores, claves ni rutas.
 */

export interface ObjetivoObs {
  id: ObjetivoEstado['id'];
  texto: string;
  tiempo: string;
  pronto: boolean;
  disponible: boolean;
  /** Solo en los inhibidores: 'aliado' o 'enemigo'. */
  lado: 'aliado' | 'enemigo' | null;
}

export interface AumentoObs {
  nombre: string;
  tier: AumentoPanel['tier'];
  /** Solo iconos de CommunityDragon (la página no carga nada de otro sitio). */
  icono: string | null;
}

export interface VistaObs {
  /** Número de versión del estado: sube con cada cambio. */
  n: number;
  objetivos: ObjetivoObs[];
  aumentos: {
    titulo: string;
    columnas: { titulo: string; rareza: 'prismatico' | 'oro' | 'plata'; aumentos: AumentoObs[] }[];
    combos: { titulo: string; aumentos: AumentoObs[] }[];
    pie: string;
  } | null;
  /** Última frase de la voz; `id` cambia con cada frase (la página la quita sola a los pocos segundos). */
  subtitulo: { id: number; texto: string } | null;
  etiquetas: { objetivos: string; aumentos: string; subtitulos: string };
}

/** Mismo umbral que la barra del overlay: en el último minuto el objetivo se resalta. */
const PRONTO_S = 60;
const ICONO_PERMITIDO = /^https:\/\/raw\.communitydragon\.org\/[\w\-./]+$/i;

function cuenta(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Igual que el nombre de BarraObjetivos (overlay). */
export function objetivoObs(o: ObjetivoEstado): ObjetivoObs {
  const texto =
    o.id === 'inhibidor'
      ? t(o.aliado ? 'overlay.inhibidorAliado' : 'overlay.inhibidorEnemigo', { inhibidor: o.nombre })
      : o.subtipo
        ? t('overlay.objetivoConTipo', { objetivo: o.nombre, tipo: o.subtipo })
        : o.nombre;
  return {
    id: o.id,
    texto,
    tiempo: o.disponible || o.aparece === null ? t('overlay.objetivoYa') : cuenta(o.aparece),
    pronto: !o.disponible && o.aparece !== null && o.aparece <= PRONTO_S,
    disponible: o.disponible,
    lado: o.id === 'inhibidor' ? (o.aliado ? 'aliado' : 'enemigo') : null,
  };
}

const aumentoObs = (a: AumentoPanel): AumentoObs => ({
  nombre: a.nombre,
  tier: a.tier,
  icono: a.icono && ICONO_PERMITIDO.test(a.icono) ? a.icono : null,
});

export function aumentosObs(p: PanelAumentos): NonNullable<VistaObs['aumentos']> {
  return {
    titulo: t('overlay.aumentos.titulo', { campeon: p.campeon }),
    columnas: p.columnas.map((c) => ({ titulo: t(`overlay.aumentos.rareza.${c.rareza}`), rareza: c.rareza, aumentos: c.aumentos.map(aumentoObs) })),
    combos: p.combos.map((c) => ({ titulo: t(`overlay.aumentos.combo.${c.id.replace(':', '.')}`), aumentos: c.aumentos.map(aumentoObs) })),
    // Sin la tecla del overlay (Alt+Shift+A), que no pinta nada en el directo.
    pie: t('streamer.obs.pieAumentos'),
  };
}

/** Recoge lo que llega al overlay y avisa a la fuente de OBS de cada cambio. */
export function crearFuenteObs() {
  let modo: ModoOverlay = 'oculto';
  let estado: EstadoOverlay | null = null;
  let config: AjustesOverlay | null = null;
  let panel: PanelAumentos | null = null;
  let subtitulo: VistaObs['subtitulo'] = null;
  let n = 0;
  let idFrase = 0;
  const oyentes = new Set<(v: VistaObs) => void>();

  function vista(): VistaObs {
    const enPartida = modo === 'partida';
    // Los widgets que el overlay enseña: encendidos en Ajustes y con sentido en el modo de juego (widgetsDeModo).
    const visible = (id: 'objetivos' | 'aumentos') => !!config?.widgets[id].activo && estado?.widgets?.[id] !== false;
    const objetivos = enPartida && estado && visible('objetivos') ? estado.objetivos.map(objetivoObs) : [];
    const aumentos = enPartida && panel && estado?.widgets?.aumentos && visible('aumentos') ? aumentosObs(panel) : null;
    return {
      n,
      objetivos,
      aumentos,
      subtitulo: enPartida && config?.voz.activa ? subtitulo : null,
      etiquetas: { objetivos: t('overlay.objetivos'), aumentos: t('overlay.widget.aumentos'), subtitulos: t('streamer.obs.subtitulos') },
    };
  }

  function cambio(): void {
    n++;
    const v = vista();
    for (const cb of oyentes) cb(v);
  }

  return {
    vista,
    /** Avisa de cada cambio; devuelve la función para dejar de escuchar. */
    alCambiar(cb: (v: VistaObs) => void): () => void {
      oyentes.add(cb);
      return () => void oyentes.delete(cb);
    },
    modo(m: ModoOverlay): void {
      modo = m;
      if (m !== 'partida') {
        estado = null;
        panel = null;
        subtitulo = null;
      }
      cambio();
    },
    estado(e: EstadoOverlay): void {
      estado = e;
      cambio();
    },
    config(c: AjustesOverlay): void {
      config = c;
      cambio();
    },
    aumentos(p: PanelAumentos | null): void {
      panel = p;
      cambio();
    },
    /** La voz del overlay empieza a decir esta frase. */
    frase(texto: unknown): void {
      const limpio = textoSubtitulo(texto);
      if (!limpio || modo !== 'partida') return;
      subtitulo = { id: ++idFrase, texto: limpio };
      cambio();
    },
  };
}

export type FuenteObs = ReturnType<typeof crearFuenteObs>;
