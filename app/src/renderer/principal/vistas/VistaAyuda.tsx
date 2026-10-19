import { Bot, LoaderCircle, Send, Volume2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { t } from '../../../shared/i18n';
import { paraEnviar } from '../../../shared/asistente';
import type { MensajeAsistente } from '../../../shared/tiposApp';
import { Aviso, Boton, Tarjeta } from '../../comun/componentes';
import { CabeceraVista } from './CabeceraVista';

const MAX_CARACTERES = 1000;

/** Vista «Ayuda»: chat con el asistente de soporte (a través de main, IPC 'coach:asistente'). */
export function VistaAyuda({
  historial,
  alCambiarHistorial,
}: {
  /** Vive en App para que la conversación siga al cambiar de vista. */
  historial: MensajeAsistente[];
  alCambiarHistorial: (h: MensajeAsistente[]) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [esperando, setEsperando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [historial, esperando]);

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || esperando) return;
    if (pregunta.length > MAX_CARACTERES) {
      setError(t('ayuda.error.no_valido'));
      return;
    }
    const conPregunta: MensajeAsistente[] = [...historial, { rol: 'usuario', texto: pregunta }];
    alCambiarHistorial(conPregunta);
    setTexto('');
    setError(null);
    setEsperando(true);
    let r;
    try {
      r = await window.coach.asistente(paraEnviar(historial, pregunta));
    } catch {
      r = { ok: false as const, error: 'sin_conexion' as const };
    }
    setEsperando(false);
    if (r.ok) {
      alCambiarHistorial([...conPregunta, { rol: 'asistente', texto: r.respuesta }]);
    } else {
      // La pregunta sin respuesta vuelve al campo para reintentar y el historial sigue alternando.
      alCambiarHistorial(historial);
      setTexto(pregunta);
      setError(t(`ayuda.error.${r.error}`));
    }
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  };

  return (
    <div className="vista-ayuda">
      <CabeceraVista titulo={t('ayuda.titulo')} descripcion={t('ayuda.desc')} />
      <Tarjeta titulo={t('ayuda.asistente')} icono={<Bot size={15} />} className="tarjeta-chat">
        <ol ref={lista} className="chat-mensajes" aria-live="polite" aria-label={t('ayuda.conversacion')}>
          {historial.length === 0 && <li className="chat-vacio">{t('ayuda.bienvenida')}</li>}
          {historial.map((m, i) => (
            <li key={i} className={`chat-burbuja ${m.rol}`}>
              <span className="solo-lectores">{m.rol === 'usuario' ? t('ayuda.tu') : t('ayuda.asistente')}: </span>
              {m.texto}
            </li>
          ))}
          {esperando && (
            <li className="chat-burbuja asistente escribiendo" role="status">
              <LoaderCircle size={14} className="girando" aria-hidden="true" />
              {t('ayuda.escribiendo')}
            </li>
          )}
        </ol>
        {error && <Aviso tono="error">{error}</Aviso>}
        <form className="chat-formulario" onSubmit={(e) => void enviar(e)}>
          <label htmlFor={id} className="solo-lectores">
            {t('ayuda.pregunta')}
          </label>
          <textarea
            id={id}
            className="chat-entrada"
            rows={2}
            maxLength={MAX_CARACTERES}
            value={texto}
            placeholder={t('ayuda.placeholder')}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclear}
          />
          <Boton type="submit" variante="primario" disabled={!texto.trim() || esperando}>
            <Send size={15} aria-hidden="true" />
            {t('ayuda.enviar')}
          </Boton>
        </form>
        <p className="chat-nota">{t('ayuda.nota')}</p>
      </Tarjeta>
      {/* 3.1: créditos y licencias de la voz (Supertonic 3, ONNX Runtime y la voz pregrabada). */}
      <Tarjeta titulo={t('ayuda.creditos.titulo')} icono={<Volume2 size={15} />} className="tarjeta-creditos-voz">
        <p className="texto-secundario">{t('ayuda.creditos.texto')}</p>
      </Tarjeta>
    </div>
  );
}
