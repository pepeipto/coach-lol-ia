import { Bug, Crown, Eye, Flame, Shell, ShoppingBag, Skull, Sparkles, Target, Trees } from 'lucide-react';
import { t } from '../../shared/i18n';
import type { ObjetivoPanel, Panel as DatosPanel } from '../../shared/tiposApp';
import { IconoDDragon } from '../comun/IconoDDragon';
import { analizarObjetivo, type Objetivo } from './textos';

/** Ventana de la cuenta atrás: la barra se llena en el último minuto antes del objetivo. */
export const VENTANA_CUENTA_ATRAS_S = 60;

const ICONO_OBJETIVO: Record<Objetivo, typeof Flame> = {
  campamentos: Trees,
  escarabajo: Shell,
  larvas: Bug,
  dragon: Flame,
  anciano: Crown,
  heraldo: Eye,
  baron: Skull,
};

/** «1:05» a partir de segundos. */
export function formatoCuenta(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Lista compacta de objetivos con su cuenta atrás. */
function ListaObjetivos({ objetivos }: { objetivos: ObjetivoPanel[] }) {
  return (
    <ul className="ov-objetivos" aria-label={t('overlay.objetivos')}>
      {objetivos.map((o) => {
        const Icono = ICONO_OBJETIVO[o.id] ?? Target;
        return (
          <li key={o.id} className={o.disponible ? 'ov-objetivo disponible' : 'ov-objetivo'} data-objetivo={o.id}>
            <Icono size={13} className={`ov-objetivo-icono ${o.id}`} aria-hidden="true" />
            <span className="ov-objetivo-nombre">{o.nombre}</span>
            <span className="ov-objetivo-tiempo">
              {o.disponible || o.aparece === null ? t('overlay.objetivoYa') : formatoCuenta(o.aparece)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
        <span
          className={panel?.proximaHabilidad ? `ov-icono habilidad hab-${panel.proximaHabilidad}` : 'ov-icono habilidad'}
          role={panel?.proximaHabilidad ? 'img' : undefined}
          aria-label={panel?.proximaHabilidad ? t('overlay.habilidad', { habilidad: panel.proximaHabilidad }) : undefined}
          aria-hidden={panel?.proximaHabilidad ? undefined : true}
        >
          {panel?.proximaHabilidad ?? <Sparkles size={17} />}
        </span>
        <div className="ov-textos">
          <span className="ov-etiqueta">{t('overlay.proximaHabilidad')}</span>
          {!panel?.proximaHabilidad && <span className="ov-valor">{t('overlay.nada')}</span>}
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
      {panel && panel.objetivos?.length > 0 && <ListaObjetivos objetivos={panel.objetivos} />}
    </div>
  );
}
