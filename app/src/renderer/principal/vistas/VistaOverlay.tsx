import { Bell, Crown, Eye, Keyboard, LayoutGrid, Move, Pin, Play, Trees, Volume2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../../shared/i18n';
import type { Ajustes, AjustesOverlay, AjustesVoz, ConfigWidget, IdCampamento, IdWidget, Plan, TipoAviso, TipoVoz } from '../../../shared/tiposApp';
import { CAMPAMENTOS_JUNGLA } from '../../../shared/jungla';
import { Avisos } from '../../overlay/Avisos';
import { DEMO } from '../../overlay/Overlay';
import { aceleradorDe, chocaConLol, mismoAcelerador } from '../../../shared/teclas';
import { hablar, vocesEspanol } from '../../overlay/voz';
import { BarraObjetivos } from '../../overlay/widgets/BarraObjetivos';
import { Jungla } from '../../overlay/widgets/Jungla';
import { ToastCompra } from '../../overlay/widgets/ToastCompra';
import { WidgetRendimiento } from '../../overlay/widgets/WidgetCs';
import { Aviso, Boton, clases, Esqueleto, Interruptor, Tarjeta } from '../../comun/componentes';
import '../../overlay/vistaOverlay.css';
import { CabeceraVista } from './CabeceraVista';
import { useAjustes, useMoverOverlay } from './useAjustes';

const AVISOS: TipoAviso[] = ['compra', 'habilidad', 'objetivo', 'vision', 'fase'];
const WIDGETS_LISTA: IdWidget[] = ['objetivos', 'habilidad', 'cs', 'compra', 'avisos'];
const TIPOS_VOZ: TipoVoz[] = ['objetivo', 'compra', 'habilidad', 'cs', 'vision', 'fase', 'jungla'];
const AVISO_EJEMPLO = [{ id: 0, texto: t('vistaOverlay.ejemploAviso'), tipo: 'habilidad' as const }];
const porcentaje = (v: number) => `${Math.round(v * 100)} %`;

/** Control deslizante que guarda al soltar (o tras una pausa), no en cada píxel. */
function Deslizador({
  etiqueta,
  etiquetaAccesible,
  valor,
  min,
  max,
  paso,
  alCambiar,
  deshabilitado,
}: {
  etiqueta: string;
  /** Nombre completo para lectores de pantalla (p. ej. «Tamaño · CS»); por defecto, la etiqueta. */
  etiquetaAccesible?: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  alCambiar(v: number): void;
  deshabilitado?: boolean;
}) {
  const [local, setLocal] = useState(valor);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLocal(valor), [valor]);
  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), []);
  const cambiar = (v: number) => {
    setLocal(v);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => alCambiar(v), 250);
  };
  return (
    <label className={clases('vo-deslizador', deshabilitado && 'deshabilitado')}>
      <span className="vo-deslizador-etiqueta">{etiqueta}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={local}
        disabled={deshabilitado}
        aria-label={etiquetaAccesible ?? etiqueta}
        onChange={(e) => cambiar(Number(e.target.value))}
        style={{ ['--progreso' as string]: `${((local - min) / (max - min)) * 100}%` }}
      />
      <output className="vo-deslizador-valor">{porcentaje(local)}</output>
    </label>
  );
}

/** Voces en español del sistema, al día cuando Windows termina de cargarlas. */
function useVocesEspanol(): SpeechSynthesisVoice[] {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const sintesis = globalThis.speechSynthesis;
    if (!sintesis) return;
    const leer = () => setVoces(vocesEspanol(sintesis.getVoices()));
    leer();
    sintesis.addEventListener?.('voiceschanged', leer);
    return () => sintesis.removeEventListener?.('voiceschanged', leer);
  }, []);
  return voces;
}

/** Por qué no vale una tecla para la jungla (texto en español), o null si vale. */
export function problemaTecla(acelerador: string, teclaOverlay: string): string | null {
  if (mismoAcelerador(acelerador, teclaOverlay)) return t('overlay.config.teclaEsOverlay', { tecla: acelerador });
  if (chocaConLol(acelerador)) return t('overlay.config.teclaChocaLol', { tecla: acelerador });
  return null;
}

/** Botón que espera una pulsación y la convierte en tecla global para un campamento. */
function AsignarTecla({
  id,
  tecla,
  teclaOverlay,
  alCambiar,
  alProblema,
}: {
  id: IdCampamento;
  tecla: string | undefined;
  teclaOverlay: string;
  alCambiar(t: string | null): void;
  alProblema(texto: string | null): void;
}) {
  const [esperando, setEsperando] = useState(false);
  const nombre = t(`jungla.${id}`);
  return (
    <div className="vo-tecla">
      <span className="vo-tecla-nombre">{nombre}</span>
      <button
        type="button"
        className={clases('vo-tecla-boton', esperando && 'esperando')}
        onClick={() => setEsperando(true)}
        onBlur={() => setEsperando(false)}
        onKeyDown={(e) => {
          if (!esperando) return;
          e.preventDefault();
          if (e.key === 'Escape') return setEsperando(false);
          const acelerador = aceleradorDe(e.nativeEvent);
          if (!acelerador) return;
          const problema = problemaTecla(acelerador, teclaOverlay);
          alProblema(problema);
          if (problema) return;
          alCambiar(acelerador);
          setEsperando(false);
        }}
      >
        {esperando ? t('overlay.config.pulsaTecla') : tecla ? <kbd className="tecla">{tecla}</kbd> : t('overlay.config.asignar')}
      </button>
      {tecla && (
        <button type="button" className="vo-tecla-quitar" aria-label={t('overlay.config.quitar', { campamento: nombre })} onClick={() => alCambiar(null)}>
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Escena de muestra: un 16:9 con los widgets activos donde irían en la pantalla. */
function Previa({ overlay }: { overlay: AjustesOverlay }) {
  const w = overlay.widgets;
  const estilo = (id: IdWidget) => ({ opacity: overlay.opacidad, ['--escala-previa' as string]: w[id].escala });
  return (
    <div className="vo-escena" aria-hidden="true">
      {w.objetivos.activo && (
        <div className="vo-previa vo-previa-objetivos" style={estilo('objetivos')}>
          <BarraObjetivos objetivos={DEMO.objetivos} />
        </div>
      )}
      {w.cs.activo && (
        <div className="vo-previa vo-previa-cs" style={estilo('cs')}>
          <WidgetRendimiento rendimiento={DEMO.rendimiento} />
        </div>
      )}
      {w.avisos.activo && (
        <div className="vo-previa vo-previa-avisos" style={estilo('avisos')}>
          <Avisos avisos={AVISO_EJEMPLO} estaticos />
        </div>
      )}
      {w.jungla.activo && (
        <div className="vo-previa vo-previa-jungla" style={estilo('jungla')}>
          <Jungla estado={DEMO.jungla} alMarcar={() => {}} bloqueado />
        </div>
      )}
      {w.compra.activo && (
        <div className="vo-previa vo-previa-compra" style={estilo('compra')}>
          <ToastCompra compra={null} version="" demo={DEMO.compra} />
        </div>
      )}
      <div className="vo-hud">
        {w.habilidad.activo && (
          <div className="vo-previa-flecha hab-R" style={estilo('habilidad')}>
            <span className="ov-flecha-letra">R</span>
          </div>
        )}
        <div className="vo-hud-casillas">
          {['Q', 'W', 'E', 'R'].map((h) => (
            <span key={h} className={clases('vo-hud-casilla', h === 'R' && 'activa')}>
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VistaOverlay({ plan, alVerPremium }: { plan: Plan | null; alVerPremium: () => void }) {
  const { ajustes, cambiar, guardado } = useAjustes();
  const [moviendo, alternarMover] = useMoverOverlay();
  const voces = useVocesEspanol();
  const [problemaTeclaJungla, setProblemaTeclaJungla] = useState<string | null>(null);

  const cambiarOverlay = useCallback(
    (a: Ajustes, o: Partial<AjustesOverlay>) => {
      const overlay = { ...a.overlay, ...o };
      cambiar({ ...a, overlay, voz: overlay.voz.activa });
    },
    [cambiar],
  );
  const cambiarWidget = (a: Ajustes, id: IdWidget, c: Partial<ConfigWidget>) =>
    cambiarOverlay(a, { widgets: { ...a.overlay.widgets, [id]: { ...a.overlay.widgets[id], ...c } } });
  const cambiarVoz = (a: Ajustes, v: Partial<AjustesVoz>) => cambiarOverlay(a, { voz: { ...a.overlay.voz, ...v } });
  const cambiarTecla = (a: Ajustes, id: IdCampamento, tecla: string | null) => {
    const teclasJungla = { ...a.teclasJungla };
    if (tecla) {
      // Una tecla solo puede marcar un campamento.
      for (const k of Object.keys(teclasJungla) as IdCampamento[]) if (teclasJungla[k] === tecla) delete teclasJungla[k];
      teclasJungla[id] = tecla;
    } else delete teclasJungla[id];
    cambiar({ ...a, teclasJungla });
  };

  return (
    <div className="vista-ajustes">
      <CabeceraVista titulo={t('nav.overlay')} descripcion={t('overlay.config.desc')} guardado={guardado} />

      {plan === 'gratis' && (
        <Aviso
          tono="info"
          accion={
            <Boton variante="secundario" className="boton-pequeno" onClick={alVerPremium}>
              <Crown size={14} aria-hidden="true" />
              {t('banner.ver')}
            </Boton>
          }
        >
          {t('vistaOverlay.avisoPremium')}
        </Aviso>
      )}

      <div className="rejilla-overlay">
        <Tarjeta titulo={t('vistaOverlay.previa')} icono={<Eye size={15} />} className="tarjeta-previa">
          <p className="texto-secundario">{t('overlay.config.previaDesc')}</p>
          {ajustes ? <Previa overlay={ajustes.overlay} /> : <Esqueleto alto={220} />}
        </Tarjeta>

        <Tarjeta titulo={t('overlay.config.posicion')} icono={<Move size={15} />} className="tarjeta-posicion">
          <p className="texto-secundario">
            {t('overlay.config.moverDesc', { tecla: ajustes?.teclaOverlay || t('ajustes.teclaSinDefinir') })}
          </p>
          {moviendo && <Aviso tono="aviso">{t('overlay.config.moviendo')}</Aviso>}
          <Boton variante={moviendo ? 'secundario' : 'primario'} onClick={alternarMover} className="boton-mover">
            {moviendo ? <Pin size={16} aria-hidden="true" /> : <Move size={16} aria-hidden="true" />}
            {moviendo ? t('overlay.config.fijar') : t('overlay.config.mover')}
          </Boton>
        </Tarjeta>

        <Tarjeta titulo={t('overlay.config.widgets')} icono={<LayoutGrid size={15} />} className="tarjeta-widgets">
          <p className="texto-secundario">{t('overlay.config.widgetsDesc')}</p>
          {ajustes ? (
            <>
              <Deslizador
                etiqueta={t('overlay.config.opacidad')}
                valor={ajustes.overlay.opacidad}
                min={0.5}
                max={1}
                paso={0.05}
                alCambiar={(opacidad) => cambiarOverlay(ajustes, { opacidad })}
              />
              <div className="lista-interruptores vo-widgets">
                {WIDGETS_LISTA.map((id) => (
                  <div key={id} className="vo-widget" data-widget-config={id}>
                    <Interruptor
                      etiqueta={t(`overlay.widget.${id}`)}
                      descripcion={t(`overlay.config.widget.${id}Desc`)}
                      marcado={ajustes.overlay.widgets[id].activo}
                      alCambiar={(activo) => cambiarWidget(ajustes, id, { activo })}
                    />
                    <Deslizador
                      etiqueta={t('overlay.config.escala')}
                      etiquetaAccesible={`${t('overlay.config.escala')} · ${t(`overlay.widget.${id}`)}`}
                      valor={ajustes.overlay.widgets[id].escala}
                      min={0.75}
                      max={1.5}
                      paso={0.05}
                      deshabilitado={!ajustes.overlay.widgets[id].activo}
                      alCambiar={(escala) => cambiarWidget(ajustes, id, { escala })}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            WIDGETS_LISTA.map((id) => <Esqueleto key={id} alto={38} />)
          )}
        </Tarjeta>

        <Tarjeta titulo={t('overlay.config.voz')} icono={<Volume2 size={15} />} className="tarjeta-voz">
          {ajustes ? (
            <>
              <Interruptor
                etiqueta={t('overlay.config.vozActiva')}
                descripcion={t('overlay.config.vozActivaDesc')}
                marcado={ajustes.overlay.voz.activa}
                alCambiar={(activa) => cambiarVoz(ajustes, { activa })}
              />
              <Deslizador
                etiqueta={t('overlay.config.volumen')}
                valor={ajustes.overlay.voz.volumen}
                min={0}
                max={1}
                paso={0.05}
                deshabilitado={!ajustes.overlay.voz.activa}
                alCambiar={(volumen) => cambiarVoz(ajustes, { volumen })}
              />
              <div className="vo-fila-voz">
                <label className="vo-select">
                  <span>{t('overlay.config.vozSistema')}</span>
                  <select
                    value={ajustes.overlay.voz.vozId ?? ''}
                    disabled={!ajustes.overlay.voz.activa}
                    onChange={(e) => cambiarVoz(ajustes, { vozId: e.target.value || null })}
                  >
                    <option value="">{t('overlay.config.vozAuto')}</option>
                    {voces.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </label>
                <Boton
                  variante="secundario"
                  className="boton-pequeno"
                  onClick={() => void hablar(t('overlay.config.vozPrueba'), globalThis.speechSynthesis, { volumen: ajustes.overlay.voz.volumen, vozId: ajustes.overlay.voz.vozId })}
                >
                  <Play size={14} aria-hidden="true" />
                  {t('overlay.config.probar')}
                </Boton>
              </div>
              {voces.length === 0 && <p className="texto-secundario">{t('overlay.config.sinVoces')}</p>}
              <p className="vo-subtitulo">{t('overlay.config.tipos')}</p>
              <div className="lista-interruptores">
                {TIPOS_VOZ.map((tipo) => (
                  <Interruptor
                    key={tipo}
                    etiqueta={t(`overlay.config.tipo.${tipo}`)}
                    marcado={ajustes.overlay.voz.tipos[tipo]}
                    deshabilitado={!ajustes.overlay.voz.activa}
                    alCambiar={(v) => cambiarVoz(ajustes, { tipos: { ...ajustes.overlay.voz.tipos, [tipo]: v } })}
                  />
                ))}
              </div>
            </>
          ) : (
            <Esqueleto alto={38} />
          )}
        </Tarjeta>

        <Tarjeta titulo={t('overlay.config.jungla')} icono={<Trees size={15} />} className="tarjeta-jungla">
          {ajustes ? (
            <>
              <Interruptor
                etiqueta={t('overlay.config.junglaActiva')}
                descripcion={t('overlay.config.junglaNota')}
                marcado={ajustes.overlay.widgets.jungla.activo}
                alCambiar={(activo) => cambiarWidget(ajustes, 'jungla', { activo })}
              />
              {ajustes.overlay.widgets.jungla.activo && (
                <>
                  <Deslizador
                    etiqueta={t('overlay.config.escala')}
                    etiquetaAccesible={`${t('overlay.config.escala')} · ${t('overlay.widget.jungla')}`}
                    valor={ajustes.overlay.widgets.jungla.escala}
                    min={0.75}
                    max={1.5}
                    paso={0.05}
                    alCambiar={(escala) => cambiarWidget(ajustes, 'jungla', { escala })}
                  />
                  <p className="vo-subtitulo">
                    <Keyboard size={14} aria-hidden="true" />
                    {t('overlay.config.teclas')}
                  </p>
                  <p className="texto-secundario">{t('overlay.config.teclasDesc')}</p>
                  <div className="vo-teclas">
                    {CAMPAMENTOS_JUNGLA.map((c) => (
                      <AsignarTecla
                        key={c.id}
                        id={c.id}
                        tecla={ajustes.teclasJungla[c.id]}
                        teclaOverlay={ajustes.teclaOverlay}
                        alCambiar={(tecla) => cambiarTecla(ajustes, c.id, tecla)}
                        alProblema={setProblemaTeclaJungla}
                      />
                    ))}
                  </div>
                  {problemaTeclaJungla && <Aviso tono="aviso">{problemaTeclaJungla}</Aviso>}
                </>
              )}
            </>
          ) : (
            <Esqueleto alto={38} />
          )}
        </Tarjeta>

        <Tarjeta titulo={t('ajustes.avisos')} icono={<Bell size={15} />} className="tarjeta-avisos">
          <p className="texto-secundario">{t('ajustes.avisosDesc')}</p>
          <div className="lista-interruptores">
            {ajustes
              ? AVISOS.map((a) => (
                  <Interruptor
                    key={a}
                    etiqueta={t('ajustes.aviso.' + a)}
                    descripcion={t(`ajustes.aviso.${a}Desc`)}
                    marcado={ajustes.avisos[a]}
                    alCambiar={(v) => cambiar({ ...ajustes, avisos: { ...ajustes.avisos, [a]: v } })}
                  />
                ))
              : AVISOS.map((a) => <Esqueleto key={a} alto={38} />)}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
