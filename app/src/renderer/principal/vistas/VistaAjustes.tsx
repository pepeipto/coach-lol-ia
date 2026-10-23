import { BrainCircuit, Crown, Globe, Info, KeyRound, Languages, Palette, Radio, Scale, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { version } from '../../../../package.json';
import { IDIOMAS, LOCALE_INTL, localeActual, NOMBRES_IDIOMA, t, type Idioma } from '../../../shared/i18n';
import type { EstadoLicencia, Tema } from '../../../shared/tiposApp';
import { Aviso, Boton, Esqueleto, Insignia, Interruptor, Pestanas, Tarjeta } from '../../comun/componentes';
import { Logo } from '../../comun/Logo';
import { AvisoLegal } from '../PieLegal';
import { CabeceraVista } from './CabeceraVista';
import { AvisoEstadoLicencia, BotonQuitarLicencia, fechaRenovacion, FormularioLicencia, textoPrueba } from './Licencia';
import { useAjustes } from './useAjustes';
import { TarjetaIa } from './TarjetaIa';
import { Soporte } from './VistaPremium';
import { textoAcelerador } from '../../../shared/teclas';
import { vocesDeIdioma } from '../../overlay/voz';
import { TarjetaStreamer } from '../../streamer/TarjetaStreamer';

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

type Seccion = 'general' | 'ia' | 'streamer' | 'licencia' | 'acerca';

const TEMAS: Tema[] = ['clasico', 'sombra'];

/** Elección del tema: dos muestras con su nombre (grupo de radio, con flechas como uno nativo). */
function SelectorTema({ tema, alCambiar }: { tema: Tema; alCambiar: (t: Tema) => void }) {
  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const siguiente = TEMAS[(TEMAS.indexOf(tema) + paso + TEMAS.length) % TEMAS.length]!;
    alCambiar(siguiente);
    (e.currentTarget.querySelector(`[data-valor="${siguiente}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className="selector-tema" role="radiogroup" aria-labelledby="ajuste-tema" onKeyDown={mover}>
      {TEMAS.map((opcion) => (
        <button
          key={opcion}
          type="button"
          role="radio"
          data-valor={opcion}
          aria-checked={tema === opcion}
          tabIndex={tema === opcion ? 0 : -1}
          className={`opcion-tema${tema === opcion ? ' activa' : ''}`}
          onClick={() => alCambiar(opcion)}
        >
          <span className={`muestra-tema muestra-${opcion}`} aria-hidden="true" />
          {t('ajustes.tema.' + opcion)}
        </button>
      ))}
    </div>
  );
}

interface Props {
  /** null mientras la licencia no ha respondido. */
  licencia: EstadoLicencia | null;
  alCambiarLicencia: (e: EstadoLicencia) => void;
  alVerPremium: () => void;
  /** Con Premium desactivado no hay sección Licencia. */
  mostrarLicencia?: boolean;
}

/** 3.7: lo que gasta la app ahora (memoria y CPU de todos sus procesos), actualizado cada 5 s. */
function FilaConsumo() {
  const [c, setC] = useState<{ ramMb: number; cpu: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    const leer = () => void window.coach.consumo?.().then((x) => vivo && setC(x), () => undefined);
    leer();
    const id = setInterval(leer, 5000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);
  if (!c) return null;
  return (
    <div className="fila-ajuste">
      <span className="interruptor-textos">
        <span className="interruptor-etiqueta">{t('ajustes.consumo')}</span>
        <span className="interruptor-descripcion">{t('ajustes.consumoDesc')}</span>
      </span>
      <span className="consumo-valor">{t('ajustes.consumoValor', { ram: c.ramMb, cpu: c.cpu.toLocaleString(localeActual(), { maximumFractionDigits: 1 }) })}</span>
    </div>
  );
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
          { id: 'ia', texto: t('ajustes.ia.pestana'), icono: <BrainCircuit size={14} /> },
          { id: 'streamer', texto: t('streamer.pestana'), icono: <Radio size={14} /> },
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
              <div className="fila-ajuste fila-idioma">
                <span className="interruptor-textos">
                  <span className="interruptor-etiqueta" id="ajuste-tema">
                    <Palette size={14} aria-hidden="true" /> {t('ajustes.tema')}
                  </span>
                  <span className="interruptor-descripcion">{t('ajustes.temaDesc')}</span>
                </span>
                <SelectorTema tema={ajustes.tema ?? 'clasico'} alCambiar={(tema) => cambiar({ ...ajustes, tema })} />
              </div>
              <Interruptor
                etiqueta={t('ajustes.importacionAutomatica')}
                descripcion={t('ajustes.importacionDesc')}
                marcado={ajustes.importacionAutomatica}
                alCambiar={(v) => cambiar({ ...ajustes, importacionAutomatica: v })}
              />
              <FilaConsumo />
              <Interruptor
                etiqueta={t('ajustes.bandeja')}
                descripcion={t('ajustes.bandejaDesc')}
                marcado={ajustes.bandeja !== false}
                alCambiar={(v) => cambiar({ ...ajustes, bandeja: v })}
              />
              <Interruptor
                etiqueta={t('ajustes.arranqueWindows')}
                descripcion={t('ajustes.arranqueWindowsDesc')}
                marcado={ajustes.arranqueWindows === true}
                alCambiar={(v) => cambiar({ ...ajustes, arranqueWindows: v })}
              />
              <Interruptor
                etiqueta={t('ajustes.alFrenteEnSeleccion')}
                descripcion={t('ajustes.alFrenteEnSeleccionDesc')}
                marcado={ajustes.alFrenteEnSeleccion !== false}
                alCambiar={(v) => cambiar({ ...ajustes, alFrenteEnSeleccion: v })}
              />
              <Interruptor
                etiqueta={t('ajustes.sustituirPagina')}
                descripcion={t('ajustes.sustituirPaginaDesc')}
                marcado={ajustes.sustituirPaginaSinPreguntar === true}
                alCambiar={(v) => cambiar({ ...ajustes, sustituirPaginaSinPreguntar: v })}
              />
              <div className="fila-ajuste">
                <span className="interruptor-textos">
                  <span className="interruptor-etiqueta">{t('ajustes.tecla')}</span>
                  <span className="interruptor-descripcion">{t('ajustes.teclaDesc')}</span>
                </span>
                <kbd className="tecla">{ajustes.teclaOverlay ? textoAcelerador(ajustes.teclaOverlay) : t('ajustes.teclaSinDefinir')}</kbd>
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

      {seccion === 'ia' &&
        (ajustes ? (
          <TarjetaIa ajustes={ajustes} cambiar={cambiar} />
        ) : (
          <div className="lista-interruptores" aria-busy="true">
            <Esqueleto alto={38} />
          </div>
        ))}

      {/* 3.8: modo streamer, fuente para OBS y comando del chat. */}
      {seccion === 'streamer' &&
        (ajustes ? (
          <TarjetaStreamer ajustes={ajustes} cambiar={cambiar} />
        ) : (
          <div className="lista-interruptores" aria-busy="true">
            <Esqueleto alto={38} />
          </div>
        ))}

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
            <AvisoLegal Etiqueta="p" />
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
