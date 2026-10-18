import { t } from '../../shared/i18n';
import type { Panel as DatosPanel } from '../../shared/tiposApp';

export function Panel({ panel }: { panel: DatosPanel | null }) {
  return (
    <dl className="panel-datos">
      <dt>{t('overlay.proximaCompra')}</dt>
      <dd>{panel?.proximaCompra ?? t('overlay.nada')}</dd>
      <dt>{t('overlay.proximoObjetivo')}</dt>
      <dd>{panel?.proximoObjetivo ?? t('overlay.nada')}</dd>
    </dl>
  );
}
