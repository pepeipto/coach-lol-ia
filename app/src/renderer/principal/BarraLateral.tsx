import { Crown, Heart, Layers, LayoutGrid, LifeBuoy, Settings, Sparkles, Swords, type LucideIcon } from 'lucide-react';
import { t } from '../../shared/i18n';
import type { EstadoPrincipal, Plan } from '../../shared/tiposApp';
import { clases, Insignia } from '../comun/componentes';
import { Logo } from '../comun/Logo';

export type Vista = 'campeon' | 'campeones' | 'overlay' | 'ajustes' | 'premium' | 'apoyar' | 'ayuda' | 'novedades';

/** Entradas de la barra lateral: con Premium desactivado, «Apoya el proyecto» ocupa el sitio de «Premium». */
function entradas(premiumHabilitado: boolean): { id: Vista; icono: LucideIcon }[] {
  return [
    { id: 'campeon', icono: Swords },
    { id: 'campeones', icono: LayoutGrid },
    { id: 'overlay', icono: Layers },
    { id: 'ajustes', icono: Settings },
    premiumHabilitado ? { id: 'premium', icono: Crown } : { id: 'apoyar', icono: Heart },
    { id: 'novedades', icono: Sparkles },
    { id: 'ayuda', icono: LifeBuoy },
  ];
}

interface Props {
  vista: Vista;
  alCambiar: (v: Vista) => void;
  cliente: EstadoPrincipal['cliente'];
  /** null mientras la licencia no ha respondido. */
  plan: Plan | null;
  premiumHabilitado: boolean;
}

export function BarraLateral({ vista, alCambiar, cliente, plan, premiumHabilitado }: Props) {
  const conectado = cliente === 'conectado';
  return (
    <aside className="barra-lateral">
      <div className="marca">
        <Logo tamano={30} />
        <div className="marca-textos">
          <span className="marca-nombre">{t('app.titulo')}</span>
          <span className="marca-lema">{t('app.lema')}</span>
        </div>
      </div>

      <nav className="navegacion" aria-label={t('nav.principal')}>
        {entradas(premiumHabilitado).map(({ id, icono: Icono }) => (
          <button
            key={id}
            type="button"
            className={clases('nav-entrada', id === vista && 'activa', id === 'premium' && 'nav-premium')}
            aria-current={id === vista ? 'page' : undefined}
            onClick={() => alCambiar(id)}
          >
            <Icono size={18} strokeWidth={1.9} aria-hidden="true" />
            <span>{t('nav.' + id)}</span>
          </button>
        ))}
      </nav>

      <div className="barra-lateral-pie">
        {plan && (
          <Insignia tono={plan === 'premium' ? 'oro' : 'neutro'} icono={plan === 'premium' ? <Crown size={12} /> : undefined}>
            {t('plan.' + plan)}
          </Insignia>
        )}
        <div className={clases('conexion', conectado && 'conectada')} role="status">
          <span className="conexion-punto" aria-hidden="true" />
          <div className="conexion-textos">
            <span className="conexion-titulo">{t('conexion.titulo')}</span>
            <span className="conexion-estado">{conectado ? t('conexion.conectado') : t('conexion.esperando')}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
