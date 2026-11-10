import { Coins } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { OroEnObjetos } from '../../../shared/tiposApp';
import { oroConSigno } from './WidgetCs';

/** Separación entre filas a 1080p con escala 1 (la de los jugadores del marcador de LoL; la escala del widget la ajusta). */
export const PASO_FILA_TAB = 58;

const tono = (n: number) => (n > 0 ? 'ok' : n < 0 ? 'atras' : 'igual');

/**
 * 3.19: diferencia de oro en objetos mientras se mantiene Tab, pensada para quedar en el centro del marcador de LoL,
 * entre los dos equipos: arriba el total de tu equipo y debajo una fila por pareja enfrentada (cada jugador de tu
 * equipo frente al que tiene delante), en verde si el tuyo va por delante y en rojo si va por detrás. Tu fila va
 * resaltada. El marcador ya enseña los objetos de todos: aquí solo se suma su precio de Data Dragon (el oro sin gastar
 * de los rivales no lo da la API). No recibe el ratón. Hecho con ayuda de IA.
 */
export function PanelOroTab({ oro }: { oro: OroEnObjetos }) {
  const parejas = oro.parejas ?? [];
  return (
    <div className="ov-oro-tab" role="status" aria-label={t('overlay.oroTab.resumen', { equipo: oroConSigno(oro.equipo) })}>
      <div className="ov-oro-tab-cabecera">
        <Coins size={13} strokeWidth={2.4} aria-hidden="true" />
        <span>{t('overlay.oroTab.titulo')}</span>
        <b className={`ov-oro-tab-dif tono-${tono(oro.equipo)}`}>{oroConSigno(oro.equipo)}</b>
      </div>
      <ol className="ov-oro-tab-filas" style={{ ['--paso-fila' as string]: `${PASO_FILA_TAB}px` }}>
        {parejas.map((p, i) => (
          <li
            key={i}
            className={p.tuyo ? 'ov-oro-tab-pareja tuyo' : 'ov-oro-tab-pareja'}
            aria-label={t('overlay.oroTab.fila', { aliado: p.aliado, enemigo: p.enemigo, diferencia: oroConSigno(p.diferencia) })}
          >
            <span className={`ov-oro-tab-valor tono-${tono(p.diferencia)}`}>{oroConSigno(p.diferencia)}</span>
          </li>
        ))}
      </ol>
      <p className="ov-oro-tab-nota">{t('overlay.oroTab.nota')}</p>
    </div>
  );
}
