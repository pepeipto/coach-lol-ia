import { ExternalLink, Heart } from 'lucide-react';
import { t } from '../../../shared/i18n';
import { Boton, Tarjeta } from '../../comun/componentes';
import { CabeceraVista } from './CabeceraVista';
import { Soporte } from './VistaPremium';

/** Coach LoL IA es gratis: esta vista explica cómo se financia y lleva a /apoyar en la web. */
export function VistaApoyar() {
  return (
    <div className="vista-ajustes">
      <CabeceraVista titulo={t('nav.apoyar')} descripcion={t('apoyar.desc')} />
      <Tarjeta titulo={t('apoyar.titulo')} icono={<Heart size={15} />}>
        <p className="texto-secundario">{t('apoyar.texto')}</p>
        <div className="fila-botones">
          <Boton variante="primario" onClick={() => void window.coach.abrirWeb('/apoyar').catch(() => undefined)}>
            <ExternalLink size={14} aria-hidden="true" />
            {t('apoyar.ver')}
          </Boton>
        </div>
        <Soporte />
      </Tarjeta>
    </div>
  );
}
