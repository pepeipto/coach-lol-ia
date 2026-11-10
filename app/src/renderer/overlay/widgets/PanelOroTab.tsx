import { Coins } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { OroEnObjetos } from '../../../shared/tiposApp';
import { oroConSigno } from './WidgetCs';

/**
 * Separación entre las filas de jugadores del marcador de LoL a 1080p con escala 1 (la del widget la ajusta). Medida en
 * partidas reales de Carlos a 2560×1440: filas cada 101,25 px (= 75,9 a 1080p), con los equipos lado a lado y el tuyo
 * a la izquierda.
 */
export const PASO_FILA_TAB = 75.9;

const tono = (n: number) => (n > 0 ? 'ok' : n < 0 ? 'atras' : 'igual');

/**
 * 3.19: diferencia de oro en objetos mientras se mantiene Tab, con el aspecto del propio marcador de LoL (sin cajas: la
 * misma letra y sombra que la recompensa «200 oro» que el juego pone encima del KDA). Una fila por pareja enfrentada
 * (cada jugador de tu equipo frente al que tiene delante): el número va debajo del KDA de tu aliado, en verde si va por
 * delante y en rojo si va por detrás. Bajo el marcador, una pestaña con el total de tu equipo. El marcador ya enseña los
 * objetos de todos: aquí solo se suma su precio de Data Dragon (el oro sin gastar de los rivales no lo da la API). No
 * recibe el ratón. Hecho con ayuda de IA.
 */
export function PanelOroTab({ oro }: { oro: OroEnObjetos }) {
  const parejas = oro.parejas ?? [];
  return (
    <div className="ov-oro-tab" role="status" aria-label={t('overlay.oroTab.resumen', { equipo: oroConSigno(oro.equipo) })}>
      <ol className="ov-oro-tab-filas" style={{ ['--paso-fila' as string]: `${PASO_FILA_TAB}px` }}>
        {parejas.map((p, i) => (
          <li
            key={i}
            className={p.tuyo ? 'ov-oro-tab-pareja tuyo' : 'ov-oro-tab-pareja'}
            aria-label={t('overlay.oroTab.fila', { aliado: p.aliado, enemigo: p.enemigo, diferencia: oroConSigno(p.diferencia) })}
          >
            <span className={`ov-oro-tab-valor tono-${tono(p.diferencia)}`}>
              <Coins size={11} strokeWidth={2.2} aria-hidden="true" />
              {oroConSigno(p.diferencia)}
            </span>
          </li>
        ))}
      </ol>
      <div className="ov-oro-tab-cabecera">
        <Coins size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{t('overlay.oroTab.titulo')}</span>
        <b className={`ov-oro-tab-dif tono-${tono(oro.equipo)}`}>{oroConSigno(oro.equipo)}</b>
      </div>
    </div>
  );
}
