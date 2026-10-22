import type { MensajePersonal } from '@coach/shared';
import { Loader2, MessageCircleHeart, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../shared/i18n';
import { Aviso, Boton, clases, Tarjeta } from '../../comun/componentes';

const SUGERENCIAS = ['perfil.coach.sugerencia.mejorar', 'perfil.coach.sugerencia.preparar', 'perfil.coach.sugerencia.reto'] as const;

/**
 * 3.5: «Tu coach» (estilo Project AVA): conversación con un coach que conoce tu perfil (rango, campeones, tendencias
 * y reto, sin nombres ni Riot ID). La conversación vive solo en esta ventana mientras está abierta.
 */
export function TarjetaCoach({
  hayPartidas,
  mensajes: mensajesFuera,
  alCambiarMensajes,
}: {
  hayPartidas: boolean;
  /** 3.6: la conversación vive en App mientras la app está abierta (no se pierde al cambiar de vista). */
  mensajes?: MensajePersonal[];
  alCambiarMensajes?: (m: MensajePersonal[]) => void;
}) {
  const [mensajesLocal, setMensajesLocal] = useState<MensajePersonal[]>([]);
  const mensajes = mensajesFuera ?? mensajesLocal;
  const setMensajes = alCambiarMensajes ?? setMensajesLocal;
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    lista.current?.scrollTo?.({ top: lista.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, pensando]);

  const preguntar = async (pregunta: string) => {
    const limpia = pregunta.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!limpia || pensando || !window.coach.coachPersonal) return;
    const nuevos: MensajePersonal[] = [...mensajes, { rol: 'usuario', texto: limpia }];
    setMensajes(nuevos);
    setTexto('');
    setError(null);
    setPensando(true);
    try {
      const r = await window.coach.coachPersonal(nuevos);
      if (r.ok) setMensajes([...nuevos, { rol: 'coach', texto: r.datos }]);
      else setError(t(`perfil.coach.error.${r.error}`));
    } catch {
      setError(t('perfil.coach.error.sin_conexion'));
    } finally {
      setPensando(false);
    }
  };

  return (
    <Tarjeta titulo={t('perfil.coach.titulo')} icono={<MessageCircleHeart size={15} />} className="tarjeta-coach">
      <p className="texto-secundario">{t(hayPartidas ? 'perfil.coach.desc' : 'perfil.coach.descSinPartidas')}</p>
      {mensajes.length > 0 && (
        <ol className="coach-mensajes" ref={lista} aria-live="polite">
          {mensajes.map((m, i) => (
            <li key={i} className={clases('coach-mensaje', m.rol === 'coach' ? 'del-coach' : 'del-usuario')}>
              {m.texto}
            </li>
          ))}
          {pensando && (
            <li className="coach-mensaje del-coach pensando">
              <Loader2 size={14} className="girando" aria-hidden="true" /> {t('perfil.coach.pensando')}
            </li>
          )}
        </ol>
      )}
      {mensajes.length === 0 && (
        <div className="coach-sugerencias">
          {SUGERENCIAS.map((clave) => (
            <button key={clave} type="button" className="chip" disabled={pensando} onClick={() => void preguntar(t(clave))}>
              {t(clave)}
            </button>
          ))}
        </div>
      )}
      {error && <Aviso tono="aviso">{error}</Aviso>}
      {mensajes.length > 0 && !pensando && (
        <button type="button" className="coach-nueva" onClick={() => setMensajes([])}>
          {t('perfil.coach.nueva')}
        </button>
      )}
      <form
        className="coach-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void preguntar(texto);
        }}
      >
        <input
          type="text"
          value={texto}
          maxLength={600}
          placeholder={t('perfil.coach.placeholder')}
          aria-label={t('perfil.coach.placeholder')}
          onChange={(e) => setTexto(e.target.value)}
          disabled={pensando}
        />
        <Boton variante="primario" type="submit" disabled={pensando || !texto.trim()} aria-label={t('perfil.coach.enviar')}>
          <Send size={15} aria-hidden="true" />
        </Boton>
      </form>
      <p className="nota-privacidad-ia">
        <ShieldCheck size={14} aria-hidden="true" /> {t('perfil.coach.privacidad')}
      </p>
    </Tarjeta>
  );
}
