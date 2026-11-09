import { t } from '../../../shared/i18n';
import { ENFOQUES_VOZ, esEnfoqueVoz } from '../../../shared/enfoquesVoz';
import type { AjustesVoz } from '../../../shared/tiposApp';

/**
 * 3.18: «Modo enfoque» de la voz. Un solo aspecto que mejorar (objetivos, visión, farmeo…): en la Grieta la voz solo
 * dice las frases de ese aspecto. «Sin enfoque» (por defecto) deja mandar a las categorías de debajo.
 */
export function SelectorEnfoque({ voz, alCambiar }: { voz: AjustesVoz; alCambiar(enfoque: AjustesVoz['enfoque']): void }) {
  const actual = voz.enfoque ?? null;
  return (
    <div className="vo-enfoque-voz">
      <p className="vo-subtitulo">{t('overlay.config.enfoque')}</p>
      <p className="texto-secundario">{t('overlay.config.enfoque.ayuda')}</p>
      <label className="vo-select">
        <span>{t('overlay.config.enfoque')}</span>
        <select value={actual ?? ''} disabled={!voz.activa} onChange={(e) => alCambiar(esEnfoqueVoz(e.target.value) ? e.target.value : null)}>
          <option value="">{t('overlay.config.enfoque.ninguno')}</option>
          {ENFOQUES_VOZ.map((e) => (
            <option key={e} value={e}>
              {t(`overlay.config.enfoque.${e}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="texto-secundario">{t(`overlay.config.enfoque.${actual ?? 'ninguno'}Desc`)}</p>
    </div>
  );
}
