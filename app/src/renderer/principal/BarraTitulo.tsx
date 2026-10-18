import { Minus, Square, X } from 'lucide-react';
import { t } from '../../shared/i18n';

/** Barra de título propia: toda ella arrastra la ventana salvo los botones. */
export function BarraTitulo({ titulo }: { titulo: string }) {
  return (
    <header className="barra-titulo">
      <span className="barra-titulo-texto">{titulo}</span>
      <div className="barra-titulo-botones">
        <button type="button" className="boton-ventana" aria-label={t('ventana.minimizar')} title={t('ventana.minimizar')} onClick={() => window.coach.ventana('minimizar')}>
          <Minus size={16} strokeWidth={1.75} />
        </button>
        <button type="button" className="boton-ventana" aria-label={t('ventana.maximizar')} title={t('ventana.maximizar')} onClick={() => window.coach.ventana('maximizar')}>
          <Square size={13} strokeWidth={1.75} />
        </button>
        <button type="button" className="boton-ventana cerrar" aria-label={t('ventana.cerrar')} title={t('ventana.cerrar')} onClick={() => window.coach.ventana('cerrar')}>
          <X size={17} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
