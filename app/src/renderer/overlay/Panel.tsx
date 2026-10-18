import { Eye, Flame, ShoppingBag, Skull, Target } from 'lucide-react';
import { t } from '../../shared/i18n';
import type { Panel as DatosPanel } from '../../shared/tiposApp';
import { IconoDDragon } from '../comun/IconoDDragon';
import { analizarObjetivo, type Objetivo } from './textos';

/** Ventana de la cuenta atrás: la barra se llena en el último minuto antes del objetivo. */
export const VENTANA_CUENTA_ATRAS_S = 60;

const ICONO_OBJETIVO: Record<Objetivo, typeof Flame> = { dragon: Flame, heraldo: Eye, baron: Skull };

function CuentaAtras({ segundos, disponible }: { segundos: number; disponible: boolean }) {
  const pasado = disponible ? VENTANA_CUENTA_ATRAS_S : Math.max(0, Math.min(VENTANA_CUENTA_ATRAS_S, VENTANA_CUENTA_ATRAS_S - segundos));
  return (
    <div
      className={disponible ? 'ov-barra disponible' : 'ov-barra'}
      role="progressbar"
      aria-label={t('overlay.cuentaAtras')}
      aria-valuemin={0}
      aria-valuemax={VENTANA_CUENTA_ATRAS_S}
      aria-valuenow={pasado}
    >
      <span className="ov-barra-relleno" style={{ width: `${(pasado / VENTANA_CUENTA_ATRAS_S) * 100}%` }} />
    </div>
  );
}

export function Panel({ panel }: { panel: DatosPanel | null }) {
  const compra = panel?.proximaCompra ?? null;
  const objetivo = panel?.proximoObjetivo ?? null;
  const datosObjetivo = objetivo ? analizarObjetivo(objetivo) : null;
  const IconoObjetivo = datosObjetivo?.objetivo ? ICONO_OBJETIVO[datosObjetivo.objetivo] : Target;
  return (
    <div className="ov-datos">
      <div className="ov-fila">
        <span className="ov-icono compra" aria-hidden="true">
          {panel?.compraId && panel.version ? (
            <IconoDDragon tipo="objeto" id={panel.compraId} version={panel.version} nombre={compra ?? ''} tamano={34} />
          ) : (
            <ShoppingBag size={17} />
          )}
        </span>
        <div className="ov-textos">
          <span className="ov-etiqueta">{t('overlay.proximaCompra')}</span>
          <span className="ov-valor">{compra ?? t('overlay.nada')}</span>
        </div>
      </div>
      <div className="ov-fila">
        <span className={`ov-icono objetivo ${datosObjetivo?.objetivo ?? ''}`} aria-hidden="true">
          <IconoObjetivo size={17} />
        </span>
        <div className="ov-textos">
          <span className="ov-etiqueta">{t('overlay.proximoObjetivo')}</span>
          <span className="ov-valor">{objetivo ?? t('overlay.nada')}</span>
          {datosObjetivo && datosObjetivo.segundos !== null && (
            <CuentaAtras segundos={datosObjetivo.segundos} disponible={datosObjetivo.disponible} />
          )}
        </div>
      </div>
    </div>
  );
}
