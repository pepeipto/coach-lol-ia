import { Coins } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { OroEnObjetos } from '../../../shared/tiposApp';
import { oroConSigno } from './WidgetCs';

/** «12,3k» / «850»: oro sin signo, en miles a partir de 1000. */
export const oroCorto = (n: number) => oroConSigno(Math.abs(n)).replace(/^[+−]/, '');

/** Parte de la barra que es de tu equipo (0..1); mitad y mitad si aún no hay objetos. */
export function parteAliada(aliados: number, enemigos: number): number {
  const total = aliados + enemigos;
  return total > 0 ? aliados / total : 0.5;
}

const tono = (n: number) => (n > 0 ? 'ok' : n < 0 ? 'atras' : 'igual');

/**
 * 3.19: panel que sale arriba, sobre el marcador de LoL, mientras se mantiene Tab: la diferencia de oro en objetos de
 * tu equipo (con una barra de lo que lleva cada equipo) y la tuya frente a tu rival de línea. El marcador del juego
 * ya enseña los objetos de todos; aquí solo se suma su precio de Data Dragon (el oro sin gastar de los rivales no lo da
 * la API, por eso se dice «en objetos»). No recibe el ratón. Hecho con ayuda de IA.
 */
export function PanelOroTab({ oro }: { oro: OroEnObjetos }) {
  const conTotales = typeof oro.aliados === 'number' && typeof oro.enemigos === 'number';
  const parte = conTotales ? parteAliada(oro.aliados!, oro.enemigos!) : 0.5;
  const resumen = t('overlay.oroTab.resumen', {
    equipo: oroConSigno(oro.equipo),
    rival: oro.rival === null ? '—' : oroConSigno(oro.rival),
  });
  return (
    <div className="ov-oro-tab" role="status" aria-label={resumen}>
      <div className="ov-oro-tab-cabecera">
        <Coins size={14} strokeWidth={2.4} aria-hidden="true" />
        <span>{t('overlay.oroTab.titulo')}</span>
      </div>
      <div className="ov-oro-tab-fila">
        <span className="ov-oro-tab-nombre">{t('overlay.oroTab.equipo')}</span>
        <b className={`ov-oro-tab-dif tono-${tono(oro.equipo)}`}>{oroConSigno(oro.equipo)}</b>
      </div>
      {conTotales && (
        <div className="ov-oro-tab-barra" aria-hidden="true">
          <span className="ov-oro-tab-total aliado">{oroCorto(oro.aliados!)}</span>
          <span className="ov-oro-tab-pista">
            <i style={{ width: `${Math.round(parte * 1000) / 10}%` }} />
          </span>
          <span className="ov-oro-tab-total enemigo">{oroCorto(oro.enemigos!)}</span>
        </div>
      )}
      {oro.rival !== null && (
        <div className="ov-oro-tab-fila ov-oro-tab-linea">
          <span className="ov-oro-tab-nombre">
            {oro.rivalNombre ? t('overlay.oroTab.contra', { rival: oro.rivalNombre }) : t('overlay.oroTab.linea')}
          </span>
          <b className={`ov-oro-tab-dif tono-${tono(oro.rival)}`}>{oroConSigno(oro.rival)}</b>
        </div>
      )}
      <p className="ov-oro-tab-nota">{t('overlay.oroTab.nota')}</p>
    </div>
  );
}
