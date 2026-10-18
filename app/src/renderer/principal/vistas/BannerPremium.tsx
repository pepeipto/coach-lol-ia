import { Crown, X } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { Plan } from '../../../shared/tiposApp';
import { Boton } from '../../comun/componentes';

interface Props {
  plan: Plan;
  /** Cerrado durante esta sesión. */
  cerrado: boolean;
  alCerrar: () => void;
  alVer: () => void;
}

/** Franja promocional propia (no es una red de anuncios) que solo ve el plan gratuito. */
export function BannerPremium({ plan, cerrado, alCerrar, alVer }: Props) {
  if (plan !== 'gratis' || cerrado) return null;
  return (
    <aside className="banner-premium">
      <span className="banner-premium-icono" aria-hidden="true">
        <Crown size={16} />
      </span>
      <p className="banner-premium-texto">{t('banner.texto')}</p>
      <Boton variante="secundario" className="banner-premium-ver" onClick={alVer}>
        {t('banner.ver')}
      </Boton>
      <button type="button" className="banner-premium-cerrar" aria-label={t('banner.cerrar')} title={t('banner.cerrar')} onClick={alCerrar}>
        <X size={15} />
      </button>
    </aside>
  );
}
