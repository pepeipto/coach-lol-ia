import type { Build } from '@coach/shared';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { t } from '../../../shared/i18n';
import type { RecursosBuild } from '../../../shared/tiposApp';
import { clases, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';

interface Props {
  build: Build;
  recursos: RecursosBuild;
  version: string;
}

interface PropsObjeto {
  id: number;
  recursos: RecursosBuild;
  version: string;
  tamano?: number;
}

function Objeto({ id, recursos, version, tamano = 44 }: PropsObjeto) {
  return <IconoDDragon tipo="objeto" id={id} version={version} nombre={recursos.objetos[id] ?? String(id)} tamano={tamano} />;
}

function Etapa({ titulo, children, clase }: { titulo: string; children: ReactNode; clase?: string }) {
  return (
    <div className={clases('etapa', clase)}>
      <span className="etapa-titulo">{titulo}</span>
      <div className="etapa-objetos">{children}</div>
    </div>
  );
}

function Flecha({ pequena }: { pequena?: boolean }) {
  return <ChevronRight className={clases('flecha', pequena && 'flecha-pequena')} size={pequena ? 14 : 20} aria-hidden="true" />;
}

/** Inicio → núcleo (con flechas) → botas; debajo, los situacionales. */
export function TarjetaBuild({ build, recursos, version }: Props) {
  return (
    <Tarjeta titulo={t('ui.objetos')} icono={<ShoppingBag size={15} />} className="tarjeta-build">
      <div className="ruta-build">
        <Etapa titulo={t('build.inicio')}>
          {build.objetosIniciales.length > 0 ? (
            build.objetosIniciales.map((id, i) => <Objeto key={i} id={id} recursos={recursos} version={version} />)
          ) : (
            <span className="etapa-vacia">{t('build.ninguno')}</span>
          )}
        </Etapa>
        <Flecha />
        <Etapa titulo={t('conjunto.nucleo')} clase="etapa-nucleo">
          {build.nucleo.map((id, i) => (
            <Fragment key={i}>
              {i > 0 && <Flecha pequena />}
              <Objeto id={id} recursos={recursos} version={version} tamano={48} />
            </Fragment>
          ))}
        </Etapa>
        <Flecha />
        <Etapa titulo={t('conjunto.botas')}>
          {build.botas !== null ? (
            <Objeto id={build.botas} recursos={recursos} version={version} />
          ) : (
            <span className="etapa-vacia">{t('build.sinBotas')}</span>
          )}
        </Etapa>
      </div>
      {build.situacionales.length > 0 && (
        <div className="situacionales">
          <span className="etapa-titulo">{t('conjunto.situacionales')}</span>
          <div className="etapa-objetos">
            {build.situacionales.map((id, i) => (
              <Objeto key={i} id={id} recursos={recursos} version={version} tamano={40} />
            ))}
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
