import type { CSSProperties } from 'react';
import { t } from '../../../shared/i18n';
import type { ObjetivoEstado } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { formatoCuenta } from '../posiciones';
import anciano from '../assets/objetivos/anciano.png';
import baron from '../assets/objetivos/baron.png';
import dragon from '../assets/objetivos/dragon.png';
import heraldo from '../assets/objetivos/heraldo.png';
import hextech from '../assets/objetivos/hextech.png';
import infernal from '../assets/objetivos/infernal.png';
import larvas from '../assets/objetivos/larvas.png';
import montana from '../assets/objetivos/montana.png';
import nube from '../assets/objetivos/nube.png';
import oceano from '../assets/objetivos/oceano.png';
import quimtech from '../assets/objetivos/quimtech.png';

/*
 * 3.7: barra de objetivos con el arte del juego. Cada objetivo es un medallón con el retrato del monstruo (el del HUD de
 * League, de CommunityDragon, guardado dentro de la app), un marco dorado estilo hextech y un anillo que se llena según
 * se acerca su aparición. Mientras falta mucho, el retrato está apagado; en el último minuto se enciende con el color
 * de su elemento, y al aparecer brilla.
 */

/** Desde cuántos segundos antes de aparecer se resalta (y late) un objetivo. */
export const PRONTO_S = 60;

/** Tiempo de reaparición de cada objetivo (segundos): el anillo se llena a lo largo de él. */
const PERIODO_S: Record<ObjetivoEstado['id'], number> = {
  dragon: 300,
  anciano: 360,
  baron: 360,
  inhibidor: 300,
  // Larvas y Heraldo salen una sola vez: el anillo cuenta sus últimos 3 minutos.
  larvas: 180,
  heraldo: 180,
};

const TIPOS_DRAGON = ['infernal', 'montana', 'oceano', 'nube', 'hextech', 'quimtech'] as const;
const RETRATO_DRAGON: Record<(typeof TIPOS_DRAGON)[number], string> = { infernal, montana, oceano, nube, hextech, quimtech };
const RETRATOS: Record<Exclude<ObjetivoEstado['id'], 'inhibidor'>, string> = { dragon, anciano, baron, heraldo, larvas };

function tipoDragon(subtipo: string | null): (typeof TIPOS_DRAGON)[number] | null {
  if (!subtipo) return null;
  return TIPOS_DRAGON.find((k) => t(`overlay.dragon.${k}`) === subtipo) ?? null;
}

/** Clase CSS del tipo de dragón a partir de su nombre en español (el que llega en `subtipo`). */
export function claseTipoDragon(subtipo: string | null): string | null {
  const clave = tipoDragon(subtipo);
  return clave ? `tipo-${clave}` : null;
}

/** Retrato del objetivo (el del tipo de dragón si se sabe); null en los inhibidores, que se dibujan aparte. */
export function retratoObjetivo(o: Pick<ObjetivoEstado, 'id' | 'subtipo'>): string | null {
  if (o.id === 'inhibidor') return null;
  const tipo = o.id === 'dragon' ? tipoDragon(o.subtipo) : null;
  return tipo ? RETRATO_DRAGON[tipo] : RETRATOS[o.id];
}

/** Parte del anillo llena (0–1): cuánto ha pasado de su tiempo de reaparición. */
export function progresoObjetivo(o: Pick<ObjetivoEstado, 'id' | 'aparece' | 'disponible'>): number {
  if (o.disponible || o.aparece === null) return 1;
  return Math.min(1, Math.max(0, 1 - o.aparece / PERIODO_S[o.id]));
}

/** Cristal del inhibidor (no tiene retrato de HUD): una gema hextech en el color de su equipo. */
function CristalInhibidor() {
  return (
    <svg viewBox="0 0 32 32" className="ov-obj-cristal" aria-hidden="true">
      <path d="M16 3 25 13 16 29 7 13Z" fill="var(--c)" fillOpacity="0.28" stroke="var(--c)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 3 19.5 13 16 29 12.5 13Z M7 13H25" fill="none" stroke="var(--c)" strokeOpacity="0.75" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

/** Barra superior: un medallón por objetivo con su cuenta atrás; late en el último minuto y brilla al aparecer. */
export function BarraObjetivos({ objetivos }: { objetivos: ObjetivoEstado[] }) {
  return (
    <ul className="ov-objetivos" aria-label={t('overlay.objetivos')}>
      {objetivos.map((o) => {
        const pronto = !o.disponible && o.aparece !== null && o.aparece <= PRONTO_S;
        const nombre =
          o.id === 'inhibidor'
            ? t(o.aliado ? 'overlay.inhibidorAliado' : 'overlay.inhibidorEnemigo', { inhibidor: o.nombre })
            : o.subtipo
              ? t('overlay.objetivoConTipo', { objetivo: o.nombre, tipo: o.subtipo })
              : o.nombre;
        const tiempo = o.disponible || o.aparece === null ? t('overlay.objetivoYa') : formatoCuenta(o.aparece);
        const retrato = retratoObjetivo(o);
        return (
          <li
            key={o.id === 'inhibidor' ? `inhibidor-${o.aliado ? 'a' : 'e'}-${o.subtipo}` : o.id}
            className={clases(
              'ov-obj',
              `obj-${o.id}`,
              o.id === 'inhibidor' ? (o.aliado ? 'aliado' : 'enemigo') : claseTipoDragon(o.subtipo),
              pronto && 'pronto',
              o.disponible && 'disponible',
            )}
            style={{ '--progreso': progresoObjetivo(o) } as CSSProperties}
            data-objetivo={o.id}
            aria-label={`${nombre}: ${tiempo}`}
            title={nombre}
          >
            <span className="ov-obj-medallon" aria-hidden="true">
              <span className="ov-obj-anillo" />
              <span className="ov-obj-retrato">{retrato ? <img src={retrato} alt="" draggable={false} /> : <CristalInhibidor />}</span>
            </span>
            <span className="ov-obj-tiempo" aria-hidden="true">
              {tiempo}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
