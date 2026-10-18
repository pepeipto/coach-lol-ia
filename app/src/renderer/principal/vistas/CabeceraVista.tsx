import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../../shared/i18n';

/** Título y descripción de una vista, con el aviso de «Ajustes guardados» a la derecha. */
export function CabeceraVista({ titulo, descripcion, guardado, extra }: { titulo: string; descripcion?: string; guardado?: boolean; extra?: ReactNode }) {
  return (
    <header className="cabecera-vista">
      <div>
        <h1 className="vista-titulo">{titulo}</h1>
        {descripcion && <p className="vista-descripcion">{descripcion}</p>}
      </div>
      <div className="cabecera-vista-extra">
        {guardado && (
          <span className="guardado" role="status">
            <Check size={14} aria-hidden="true" />
            {t('ajustes.guardado')}
          </span>
        )}
        {extra}
      </div>
    </header>
  );
}
