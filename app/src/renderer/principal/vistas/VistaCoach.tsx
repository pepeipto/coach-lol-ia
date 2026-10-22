import type { MensajePersonal } from '@coach/shared';
import { useEffect, useState } from 'react';
import { t } from '../../../shared/i18n';
import { CabeceraVista } from './CabeceraVista';
import { TarjetaCoach } from './TarjetaCoach';
import './perfil.css';

/** 3.6: vista «Tu coach»: el chat con el coach personal, con su propia entrada en la barra lateral. */
export function VistaCoach({ mensajes, alCambiarMensajes }: { mensajes: MensajePersonal[]; alCambiarMensajes: (m: MensajePersonal[]) => void }) {
  const [hayPartidas, setHayPartidas] = useState(true);
  useEffect(() => {
    let vivo = true;
    void window.coach.perfil?.(false).then((p) => vivo && setHayPartidas(p.partidas.length > 0), () => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <div className="vista-ajustes vista-perfil vista-coach">
      <CabeceraVista titulo={t('perfil.coach.titulo')} descripcion={t('perfil.coach.vistaDesc')} />
      <TarjetaCoach hayPartidas={hayPartidas} mensajes={mensajes} alCambiarMensajes={alCambiarMensajes} />
    </div>
  );
}
