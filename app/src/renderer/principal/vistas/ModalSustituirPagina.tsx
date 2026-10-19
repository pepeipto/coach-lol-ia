import { Layers } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../../../shared/i18n';
import { Boton } from '../../comun/componentes';
import { useTrampaFoco } from './useTrampaFoco';

/**
 * 3.1: «Importar» sin páginas de runas libres. Pregunta antes de sustituir una página del jugador (nunca una
 * predefinida: la elige main). «No volver a preguntar» se guarda en los ajustes y se puede deshacer en Ajustes.
 */
export function ModalSustituirPagina({
  nombre,
  alSustituir,
  alCancelar,
}: {
  nombre: string;
  alSustituir: (noVolverAPreguntar: boolean) => void;
  alCancelar: () => void;
}) {
  const id = useId();
  const dialogo = useRef<HTMLDivElement>(null);
  const [noPreguntar, setNoPreguntar] = useState(false);
  useTrampaFoco(dialogo);

  useEffect(() => {
    dialogo.current?.querySelector<HTMLButtonElement>('.boton-primario')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCancelar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCancelar]);

  return (
    <div className="modal-fondo">
      <div ref={dialogo} className="modal modal-sustituir" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-texto`}>
        <h2 id={`${id}-titulo`} className="modal-sustituir-titulo">
          <Layers size={18} aria-hidden="true" />
          {t('runas.sustituir.titulo')}
        </h2>
        <p id={`${id}-texto`}>{t('runas.sustituir.texto', { nombre })}</p>
        <label className="modal-sustituir-casilla">
          <input type="checkbox" checked={noPreguntar} onChange={(e) => setNoPreguntar(e.target.checked)} />
          {t('runas.sustituir.noPreguntar')}
        </label>
        <footer className="modal-pie">
          <span className="modal-pie-espacio" />
          <Boton variante="secundario" onClick={alCancelar}>
            {t('runas.sustituir.cancelar')}
          </Boton>
          <Boton variante="primario" onClick={() => alSustituir(noPreguntar)}>
            {t('runas.sustituir.confirmar')}
          </Boton>
        </footer>
      </div>
    </div>
  );
}
