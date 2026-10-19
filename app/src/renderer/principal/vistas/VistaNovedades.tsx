import { Sparkles } from 'lucide-react';
import { t } from '../../../shared/i18n';
import { NOVEDADES, VERSION_ACTUAL } from '../../../shared/novedades';
import { Insignia, Tarjeta } from '../../comun/componentes';
import { CabeceraVista } from './CabeceraVista';

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Historial de versiones, de la más reciente a la más antigua. */
export function VistaNovedades() {
  return (
    <div className="vista-ajustes">
      <CabeceraVista titulo={t('novedades.titulo')} descripcion={t('novedades.desc')} />
      <div className="linea-versiones">
        {NOVEDADES.map((n) => (
          <Tarjeta
            key={n.version}
            className={n.version === VERSION_ACTUAL ? 'version-actual' : undefined}
            icono={<Sparkles size={15} />}
            titulo={fechaLarga(n.fecha)}
            extra={n.version === VERSION_ACTUAL ? <Insignia tono="oro">{t('novedades.actual')}</Insignia> : undefined}
          >
            <h2 className="version-titulo">{t('novedades.version', { version: n.version })}</h2>
            <ul className="version-puntos">
              {n.puntos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
