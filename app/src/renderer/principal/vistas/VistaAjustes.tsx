import { Crown, Globe, Info, KeyRound, Languages, Scale, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { version } from '../../../../package.json';
import { IDIOMAS, LOCALE_INTL, NOMBRES_IDIOMA, t, type Idioma } from '../../../shared/i18n';
import type { EstadoLicencia } from '../../../shared/tiposApp';
import { Aviso, Boton, Esqueleto, Insignia, Interruptor, Pestanas, Tarjeta } from '../../comun/componentes';
import { Logo } from '../../comun/Logo';
import { CabeceraVista } from './CabeceraVista';
import { AvisoEstadoLicencia, BotonQuitarLicencia, fechaRenovacion, FormularioLicencia, textoPrueba } from './Licencia';
import { useAjustes } from './useAjustes';
import { Soporte } from './VistaPremium';
import { vocesDeIdioma } from '../../overlay/voz';

/**
 * ¿Hay voz de Windows para el idioma? null mientras no se sabe (las voces llegan tarde, con 'voiceschanged'),
 * o si el sistema no tiene ninguna voz (entonces la nota de la vista Overlay ya lo explica).
 */
function useHayVoz(idioma: Idioma): boolean | null {
  const [hay, setHay] = useState<boolean | null>(null);
  useEffect(() => {
    const sintesis = globalThis.speechSynthesis;
    if (!sintesis) return;
    const leer = () => {
      const voces = sintesis.getVoices();
      setHay(voces.length === 0 ? null : vocesDeIdioma(voces, idioma).length > 0);
    };
    leer();
    sintesis.addEventListener?.('voiceschanged', leer);
    return () => sintesis.removeEventListener?.('voiceschanged', leer);
  }, [idioma]);
  return hay;
}

type Seccion = 'general' | 'licencia' | 'acerca';

interface Props {
  /** null mientras la licencia no ha respondido. */
  licencia: EstadoLicencia | null;
  alCambiarLicencia: (e: EstadoLicencia) => void;
  alVerPremium: () => void;
  /** Con Premium desactivado no hay sección Licencia. */
  mostrarLicencia?: boolean;
}

export function VistaAjustes({ licencia, alCambiarLicencia, alVerPremium, mostrarLicencia = true }: Props) {
  const [seccion, setSeccion] = useState<Seccion>('general');
  const [recienActivada, setRecienActivada] = useState(false);
  const { ajustes, cambiar, guardado } = useAjustes();
  const hayVoz = useHayVoz(ajustes?.idioma ?? 'es');

  return (
    <div className="vista-ajustes">
      <CabeceraVista titulo={t('nav.ajustes')} descripcion={t('vistaAjustes.desc')} guardado={guardado} />
      <Pestanas
        etiqueta={t('nav.ajustes')}
        activa={seccion}
        alCambiar={(id) => setSeccion(id as Seccion)}
        opciones={[
          { id: 'general', texto: t('ajustes.general'), icono: <SlidersHorizontal size={14} /> },
          ...(mostrarLicencia ? [{ id: 'licencia', texto: t('ajustes.licencia'), icono: <KeyRound size={14} /> }] : []),
          { id: 'acerca', texto: t('ajustes.acerca'), icono: <Info size={14} /> },
        ]}
      />

      {seccion === 'general' && (
        <Tarjeta key="general" titulo={t('ajustes.general')} icono={<SlidersHorizontal size={15} />}>
          {ajustes ? (
            <div className="lista-interruptores">
              <div className="fila-ajuste fila-idioma">
                <span className="interruptor-textos">
                  <label className="interruptor-etiqueta" htmlFor="ajuste-idioma">
                    <Languages size={14} aria-hidden="true" /> {t('ajustes.idioma')}
                  </label>
                  <span className="interruptor-descripcion">{t('ajustes.idiomaDesc')}</span>
                </span>
                <select
                  id="ajuste-idioma"
                  className="selector-idioma"
                  value={ajustes.idioma}
                  onChange={(e) => cambiar({ ...ajustes, idioma: e.target.value as Idioma })}
                >
                  {IDIOMAS.map((i) => (
                    <option key={i} value={i} lang={LOCALE_INTL[i]}>
                      {NOMBRES_IDIOMA[i]}
                    </option>
                  ))}
                </select>
              </div>
              {hayVoz === false && (
                <Aviso tono="info">{t('ajustes.idiomaSinVoz', { idioma: NOMBRES_IDIOMA[ajustes.idioma] })}</Aviso>
              )}
              <Interruptor
                etiqueta={t('ajustes.importacionAutomatica')}
                descripcion={t('ajustes.importacionDesc')}
                marcado={ajustes.importacionAutomatica}
                alCambiar={(v) => cambiar({ ...ajustes, importacionAutomatica: v })}
              />
              <div className="fila-ajuste">
                <span className="interruptor-textos">
                  <span className="interruptor-etiqueta">{t('ajustes.tecla')}</span>
                  <span className="interruptor-descripcion">{t('ajustes.teclaDesc')}</span>
                </span>
                <kbd className="tecla">{ajustes.teclaOverlay || t('ajustes.teclaSinDefinir')}</kbd>
              </div>
            </div>
          ) : (
            <div className="lista-interruptores" aria-busy="true">
              <span className="solo-lectores">{t('ajustes.cargando')}</span>
              <Esqueleto alto={38} />
              <Esqueleto alto={38} />
            </div>
          )}
        </Tarjeta>
      )}

      {mostrarLicencia && seccion === 'licencia' && !licencia && (
        <Tarjeta key="licencia-cargando" titulo={t('ajustes.licencia')} icono={<KeyRound size={15} />}>
          <div className="lista-interruptores" aria-busy="true">
            <span className="solo-lectores">{t('vacio.cargando')}</span>
            <Esqueleto alto={38} />
            <Esqueleto alto={38} />
          </div>
        </Tarjeta>
      )}

      {mostrarLicencia && seccion === 'licencia' && licencia && (
        <Tarjeta key="licencia" titulo={t('ajustes.licencia')} icono={<KeyRound size={15} />}>
          <div className="licencia-estado">
            <span className="interruptor-etiqueta">{t('premium.planActual')}</span>
            <Insignia tono={licencia.plan === 'premium' ? 'oro' : 'neutro'} icono={licencia.plan === 'premium' ? <Crown size={12} /> : undefined}>
              {t('plan.' + licencia.plan)}
            </Insignia>
          </div>
          {recienActivada && licencia.plan === 'premium' && <Aviso tono="exito">{t('premium.activada')}</Aviso>}
          <AvisoEstadoLicencia licencia={licencia} />
          {licencia.plan === 'premium' ? (
            <div className="licencia-premium">
              {licencia.claveVisible && <p className="premium-clave">{t('premium.claveActual', { clave: licencia.claveVisible })}</p>}
              {licencia.vitalicia || licencia.tipo === 'vitalicia' ? (
                <p className="texto-secundario">{t('premium.vitalicia')}</p>
              ) : licencia.tipo === 'prueba' ? (
                <p className="texto-secundario">{textoPrueba(licencia)}</p>
              ) : (
                fechaRenovacion(licencia.renuevaEn) && (
                  <p className="texto-secundario">{t('premium.renueva', { fecha: fechaRenovacion(licencia.renuevaEn) })}</p>
                )
              )}
              <div className="fila-botones">
                {!licencia.vitalicia && (licencia.tipo ?? 'suscripcion') === 'suscripcion' && (
                  <Boton variante="secundario" onClick={() => void window.coach.abrirWeb('/premium/gestionar').catch(() => undefined)}>
                    {t('premium.gestionar')}
                  </Boton>
                )}
                <BotonQuitarLicencia alCambiarLicencia={alCambiarLicencia} />
              </div>
            </div>
          ) : (
            <>
              <FormularioLicencia alCambiarLicencia={alCambiarLicencia} alActivar={() => setRecienActivada(true)} />
              <div className="fila-botones">
                <Boton variante="secundario" onClick={alVerPremium}>
                  <Crown size={14} aria-hidden="true" />
                  {t('banner.ver')}
                </Boton>
              </div>
            </>
          )}
        </Tarjeta>
      )}

      {seccion === 'acerca' && (
        <Tarjeta key="acerca" titulo={t('ajustes.acerca')} icono={<Info size={15} />}>
          <div className="acerca">
            <Logo tamano={48} />
            <div className="acerca-textos">
              <span className="acerca-nombre">{t('app.titulo')}</span>
              <span className="texto-secundario">{t('acerca.version', { version })}</span>
            </div>
            <Boton variante="secundario" onClick={() => void window.coach.abrirWeb('/').catch(() => undefined)}>
              <Globe size={15} aria-hidden="true" />
              {t('acerca.web')}
            </Boton>
          </div>
          <p className="acerca-descripcion">{t('acerca.descripcion')}</p>
          <Soporte />
          <div className="acerca-legal">
            <span className="rama-titulo">
              <Scale size={12} aria-hidden="true" /> {t('acerca.legal')}
            </span>
            <p>{t('legal.aviso')}</p>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
