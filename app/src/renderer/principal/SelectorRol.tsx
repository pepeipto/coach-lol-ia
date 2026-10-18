import type { Rol } from '@coach/shared';
import { ROLES } from '@coach/shared';
import { t } from '../../shared/i18n';

interface Props {
  rol: Rol;
  disponibles: Rol[];
  onCambiar: (rol: Rol) => void;
}

/** Los roles con datos van primero; el resto se puede probar igualmente (el servidor dirá si hay build). */
export function SelectorRol({ rol, disponibles, onCambiar }: Props) {
  return (
    <div className="selector-rol" role="group" aria-label={t('ui.rol')}>
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          className={r === rol ? 'activo' : disponibles.includes(r) ? '' : 'sin-datos'}
          aria-pressed={r === rol}
          onClick={() => onCambiar(r)}
        >
          {t('rol.' + r)}
        </button>
      ))}
    </div>
  );
}
