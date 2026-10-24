import { Check, Copy, EyeOff, Keyboard, MessageSquare, RefreshCw, Video, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { t } from '../../shared/i18n';
import { puertoValido, STREAMER_POR_DEFECTO, TAMANO_OBS, URL_WEB_COACH, type AjustesStreamer, type EstadoObs } from '../../shared/streamer';
import { aceleradorDe, chocaConLol, mismoAcelerador, textoAcelerador } from '../../shared/teclas';
import type { Ajustes } from '../../shared/tiposApp';
import { Aviso, Boton, clases, Interruptor, Tarjeta } from '../comun/componentes';
import './streamer.css';

/*
 * 3.8: pestaña «Streamer» de Ajustes: modo streamer (nombres sustituidos por el campeón), fuente para OBS (servidor
 * local de solo lectura) y el texto del comando !coach para el bot del chat. Nada de esto se conecta a Twitch ni pide
 * cuentas: solo se copia al portapapeles.
 */

/** Mensaje del comando !coach en el idioma de la app. */
export const mensajeComando = () => t('streamer.chat.mensaje', { url: URL_WEB_COACH });
/** Línea para crear el comando en cada bot (se escribe en el chat del canal con la cuenta del streamer). */
export const comandoNightbot = () => `!addcom !coach ${mensajeComando()}`;
export const comandoStreamElements = () => `!command add !coach ${mensajeComando()}`;

/** Por qué no vale la tecla del modo streamer, o null si vale. */
export function problemaTeclaStreamer(acelerador: string, a: Ajustes): string | null {
  const tecla = textoAcelerador(acelerador);
  if (chocaConLol(acelerador)) return t('overlay.config.teclaChocaLol', { tecla });
  if (mismoAcelerador(acelerador, a.teclaOverlay)) return t('overlay.config.teclaEsOverlay', { tecla });
  const otras = [a.teclaJungla, a.teclaAumentos, ...Object.values(a.teclasJungla)].filter((x): x is string => !!x);
  if (otras.some((o) => mismoAcelerador(o, acelerador))) return t('streamer.teclaUsada', { tecla });
  return null;
}

/** Estado de la fuente para OBS, al día con los avisos de main. */
function useEstadoObs(): EstadoObs | null {
  const [estado, setEstado] = useState<EstadoObs | null>(null);
  useEffect(() => {
    let vivo = true;
    void window.coach.estadoObs?.().then((e) => vivo && setEstado(e), () => undefined);
    const dejar = window.coach.alCambiarObs?.((e) => vivo && setEstado(e));
    return () => {
      vivo = false;
      dejar?.();
    };
  }, []);
  return estado;
}

/** Botón «Copiar» que dice «Copiado» un momento. */
function BotonCopiar({ texto, etiqueta }: { texto: string | null; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const id = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(id);
  }, [copiado]);
  return (
    <Boton
      variante="secundario"
      disabled={!texto}
      onClick={() => {
        if (!texto) return;
        void window.coach.copiarTexto?.(texto).then((ok) => setCopiado(!!ok), () => undefined);
      }}
    >
      {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copiado ? t('streamer.copiado') : etiqueta}
    </Boton>
  );
}

/** Botón que espera una pulsación y la guarda como tecla del modo streamer. */
function AsignarTeclaStreamer({ ajustes, tecla, alCambiar }: { ajustes: Ajustes; tecla: string; alCambiar: (tecla: string) => void }) {
  const [esperando, setEsperando] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  return (
    <>
      <div className="fila-ajuste">
        <span className="interruptor-textos">
          <span className="interruptor-etiqueta">
            <Keyboard size={14} aria-hidden="true" /> {t('streamer.tecla')}
          </span>
          <span className="interruptor-descripcion">{t('streamer.teclaDesc')}</span>
        </span>
        <span className="st-tecla">
          <button
            type="button"
            className={clases('st-tecla-boton', esperando && 'esperando')}
            onClick={() => setEsperando(true)}
            onBlur={() => setEsperando(false)}
            onKeyDown={(e) => {
              if (!esperando) return;
              e.preventDefault();
              if (e.key === 'Escape') return setEsperando(false);
              const acelerador = aceleradorDe(e.nativeEvent);
              if (!acelerador) return;
              const p = problemaTeclaStreamer(acelerador, ajustes);
              setProblema(p);
              if (p) return;
              alCambiar(acelerador);
              setEsperando(false);
            }}
          >
            {esperando ? t('overlay.config.pulsaTecla') : tecla ? <kbd className="tecla">{textoAcelerador(tecla)}</kbd> : t('overlay.config.asignar')}
          </button>
          {tecla && (
            <button type="button" className="st-tecla-quitar" aria-label={t('streamer.teclaQuitar')} onClick={() => alCambiar('')}>
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      {problema && <Aviso tono="aviso">{problema}</Aviso>}
    </>
  );
}

/** Puerto de la fuente para OBS: se guarda al salir del campo o con Intro, solo si es válido. */
function CampoPuerto({ puerto, alCambiar }: { puerto: number; alCambiar: (p: number) => void }) {
  const id = useId();
  const [texto, setTexto] = useState(String(puerto));
  useEffect(() => setTexto(String(puerto)), [puerto]);
  const n = Number(texto);
  const valido = puertoValido(n);
  const aplicar = () => {
    if (valido && n !== puerto) alCambiar(n);
    else if (!valido) setTexto(String(puerto));
  };
  return (
    <div className="fila-ajuste">
      <span className="interruptor-textos">
        <label className="interruptor-etiqueta" htmlFor={id}>
          {t('streamer.obs.puerto')}
        </label>
        <span className="interruptor-descripcion">{t('streamer.obs.puertoDesc')}</span>
      </span>
      <input
        id={id}
        className={clases('st-puerto', !valido && 'invalido')}
        inputMode="numeric"
        value={texto}
        aria-invalid={!valido || undefined}
        onChange={(e) => setTexto(e.target.value.replace(/\D/g, '').slice(0, 5))}
        onBlur={aplicar}
        onKeyDown={(e) => e.key === 'Enter' && aplicar()}
      />
    </div>
  );
}

export function TarjetaStreamer({ ajustes, cambiar }: { ajustes: Ajustes; cambiar: (a: Ajustes) => void }) {
  // Unos ajustes sin la sección (main anterior a la 3.8): todo apagado.
  const s = ajustes.streamer ?? STREAMER_POR_DEFECTO;
  const obs = useEstadoObs();
  const [regenerado, setRegenerado] = useState<EstadoObs | null>(null);
  const estado = regenerado ?? obs;
  const cambiarStreamer = (parcial: Partial<AjustesStreamer>) => cambiar({ ...ajustes, streamer: { ...s, ...parcial } });
  const cambiarObs = (parcial: Partial<AjustesStreamer['obs']>) => cambiarStreamer({ obs: { ...s.obs, ...parcial } });
  // Un aviso nuevo de main manda sobre lo que devolvió «Cambiar enlace».
  useEffect(() => setRegenerado(null), [obs]);
  const url = s.obs.activa ? (estado?.url ?? null) : null;

  return (
    <>
      <Tarjeta titulo={t('streamer.titulo')} icono={<EyeOff size={15} />}>
        <p className="texto-secundario">{t('streamer.desc')}</p>
        <div className="lista-interruptores">
          <Interruptor etiqueta={t('streamer.activo')} descripcion={t('streamer.activoDesc')} marcado={s.activo} alCambiar={(v) => cambiarStreamer({ activo: v })} />
          <Interruptor
            etiqueta={t('streamer.ocultarPropio')}
            descripcion={t('streamer.ocultarPropioDesc')}
            marcado={s.ocultarPropio}
            deshabilitado={!s.activo}
            alCambiar={(v) => cambiarStreamer({ ocultarPropio: v })}
          />
          <AsignarTeclaStreamer ajustes={ajustes} tecla={s.tecla} alCambiar={(tecla) => cambiarStreamer({ tecla })} />
        </div>
      </Tarjeta>

      <Tarjeta titulo={t('streamer.obs.titulo')} icono={<Video size={15} />}>
        <p className="texto-secundario">{t('streamer.obs.desc')}</p>
        <div className="lista-interruptores">
          <Interruptor etiqueta={t('streamer.obs.activa')} descripcion={t('streamer.obs.activaDesc')} marcado={s.obs.activa} alCambiar={(v) => cambiarObs({ activa: v })} />
          <CampoPuerto puerto={s.obs.puerto} alCambiar={(puerto) => cambiarObs({ puerto })} />
        </div>
        {s.obs.activa && estado?.error && (
          <Aviso tono="error">{t(`streamer.obs.error.${estado.error}`, { puerto: estado.puerto })}</Aviso>
        )}
        {s.obs.activa && url && (
          <div className="st-url">
            <label className="interruptor-etiqueta" htmlFor="st-url-obs">
              {t('streamer.obs.url')}
            </label>
            <input id="st-url-obs" className="st-campo" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <div className="fila-botones">
              <BotonCopiar texto={url} etiqueta={t('streamer.obs.copiar')} />
              <Boton
                variante="secundario"
                onClick={() => void window.coach.regenerarTokenObs?.().then(setRegenerado, () => undefined)}
              >
                <RefreshCw size={14} aria-hidden="true" />
                {t('streamer.obs.regenerar')}
              </Boton>
            </div>
            <p className="texto-secundario st-nota">{t('streamer.obs.privada')}</p>
          </div>
        )}
        <Aviso tono="info">{t('streamer.obs.comoAnadir', { ancho: TAMANO_OBS.ancho, alto: TAMANO_OBS.alto })}</Aviso>
      </Tarjeta>

      <Tarjeta titulo={t('streamer.chat.titulo')} icono={<MessageSquare size={15} />}>
        <p className="texto-secundario">{t('streamer.chat.desc')}</p>
        <div className="st-comando">
          <span className="interruptor-etiqueta">Nightbot</span>
          <code className="st-campo">{comandoNightbot()}</code>
          <BotonCopiar texto={comandoNightbot()} etiqueta={t('streamer.copiar')} />
        </div>
        <div className="st-comando">
          <span className="interruptor-etiqueta">StreamElements</span>
          <code className="st-campo">{comandoStreamElements()}</code>
          <BotonCopiar texto={comandoStreamElements()} etiqueta={t('streamer.copiar')} />
        </div>
        <p className="texto-secundario st-nota">{t('streamer.chat.nota')}</p>
      </Tarjeta>
    </>
  );
}
