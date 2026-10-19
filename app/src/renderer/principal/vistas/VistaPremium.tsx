import { useState } from 'react';
import { BadgeCheck, Check, Crown, ExternalLink, KeyRound, LifeBuoy } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { EstadoLicencia } from '../../../shared/tiposApp';
import { Aviso, Boton, Esqueleto, Insignia, Tarjeta } from '../../comun/componentes';
import { AvisoEstadoLicencia, BotonQuitarLicencia, fechaRenovacion, FormularioLicencia, textoPrueba, useAhora } from './Licencia';

const BENEFICIOS = ['overlay', 'avisos', 'voz', 'anuncios'] as const;

interface Props {
  /** null mientras la licencia no ha respondido. */
  licencia: EstadoLicencia | null;
  alCambiarLicencia: (e: EstadoLicencia) => void;
}

function Beneficios() {
  return (
    <ul className="beneficios">
      {BENEFICIOS.map((b) => (
        <li key={b}>
          <span className="beneficio-marca" aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
          {t('premium.beneficio.' + b)}
        </li>
      ))}
    </ul>
  );
}

export function Soporte() {
  return (
    <p className="soporte">
      <LifeBuoy size={15} aria-hidden="true" />
      <span>{t('soporte.texto', { correo: t('soporte.correo') })}</span>
    </p>
  );
}

export function VistaPremium({ licencia, alCambiarLicencia }: Props) {
  // Se acaba de activar desde esta vista: la confirmación sobrevive al cambio a la vista premium.
  const [recienActivada, setRecienActivada] = useState(false);
  const ahora = useAhora();
  const abrir = (ruta: '/premium' | '/premium/gestionar') => void window.coach.abrirWeb(ruta).catch(() => undefined);

  if (!licencia) {
    return (
      <div className="vista-premium" aria-busy="true">
        <span className="solo-lectores">{t('vacio.cargando')}</span>
        <Esqueleto alto={220} />
        <Esqueleto alto={140} />
      </div>
    );
  }

  if (licencia.plan === 'premium') {
    const fecha = fechaRenovacion(licencia.renuevaEn);
    return (
      <div className="vista-premium">
        <section className="premium-hero activo">
          <div className="premium-hero-icono" aria-hidden="true">
            <BadgeCheck size={30} />
          </div>
          <div className="premium-hero-textos">
            <Insignia tono="oro" icono={<Crown size={12} />}>
              {t('premium.titulo')}
            </Insignia>
            <h1 className="premium-titulo">{t('premium.activo')}</h1>
            {licencia.vitalicia || licencia.tipo === 'vitalicia' ? (
              <p className="premium-subtitulo">{t('premium.vitalicia')}</p>
            ) : licencia.tipo === 'prueba' ? (
              <p className="premium-subtitulo">{textoPrueba(licencia, ahora)}</p>
            ) : (
              fecha && <p className="premium-subtitulo">{t('premium.renueva', { fecha })}</p>
            )}
            {licencia.claveVisible && <p className="premium-clave">{t('premium.claveActual', { clave: licencia.claveVisible })}</p>}
          </div>
          <div className="premium-hero-acciones">
            {!licencia.vitalicia && (licencia.tipo ?? 'suscripcion') === 'suscripcion' && (
              <Boton variante="primario" onClick={() => abrir('/premium/gestionar')}>
                <ExternalLink size={16} aria-hidden="true" />
                {t('premium.gestionar')}
              </Boton>
            )}
            <BotonQuitarLicencia alCambiarLicencia={alCambiarLicencia} />
          </div>
        </section>
        {recienActivada && <Aviso tono="exito">{t('premium.activada')}</Aviso>}
        <AvisoEstadoLicencia licencia={licencia} />
        <Tarjeta titulo={t('premium.incluido')} icono={<Crown size={15} />}>
          <Beneficios />
        </Tarjeta>
        <Soporte />
      </div>
    );
  }

  return (
    <div className="vista-premium">
      <section className="premium-hero">
        <div className="premium-hero-icono" aria-hidden="true">
          <Crown size={30} />
        </div>
        <div className="premium-hero-textos">
          <h1 className="premium-titulo">{t('premium.titulo')}</h1>
          <p className="premium-subtitulo">{t('premium.subtitulo')}</p>
          <Beneficios />
        </div>
        <div className="premium-precio">
          <span className="premium-precio-valor">{t('premium.precio')}</span>
          <span className="premium-precio-nota">{t('premium.cancela')}</span>
          <Boton variante="primario" className="boton-suscribirme" onClick={() => abrir('/premium')}>
            <Crown size={16} aria-hidden="true" />
            {t('premium.suscribirme')}
          </Boton>
        </div>
      </section>
      <AvisoEstadoLicencia licencia={licencia} />
      <Tarjeta titulo={t('premium.yaTienes')} icono={<KeyRound size={15} />}>
        <FormularioLicencia alCambiarLicencia={alCambiarLicencia} alActivar={() => setRecienActivada(true)} />
      </Tarjeta>
      <p className="texto-secundario centrado">{t('premium.gratisIncluye')}</p>
      <Soporte />
    </div>
  );
}
