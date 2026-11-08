import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EstadoLicencia } from '../../../shared/tiposApp';
import { t } from '../../../shared/i18n';
import { Boton } from '../../comun/componentes';
import { consultarLicencia } from '../licencia';

/**
 * 3.16: botón que acompaña al aviso de cuota agotada. En el plan Gratis lleva a los planes; con un plan de pago,
 * a «Gestionar» (cambiar de plan o comprar partidas extra). Solo se cobra volumen de IA, nunca la ayuda en partida.
 */
export function BotonMasCuota() {
  const [licencia, setLicencia] = useState<EstadoLicencia | null>(null);
  useEffect(() => {
    let vivo = true;
    void consultarLicencia().then((l) => vivo && setLicencia(l));
    return () => {
      vivo = false;
    };
  }, []);
  if (!licencia) return null;
  // Una prueba gratuita va a los planes, como el plan Gratis.
  const deGratis = licencia.plan !== 'premium' || licencia.tipo === 'prueba';
  const ruta = deGratis ? '/premium' : '/premium/gestionar';
  return (
    <Boton variante={deGratis ? 'primario' : 'secundario'} className="boton-mas-cuota" onClick={() => void window.coach.abrirWeb(ruta).catch(() => undefined)}>
      <ExternalLink size={14} aria-hidden="true" />
      {t(deGratis ? 'cuota.boton.gratis' : 'cuota.boton.pago')}
    </Boton>
  );
}
