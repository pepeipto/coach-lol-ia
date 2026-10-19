import { Check, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { t } from '../../../shared/i18n';
import { NOVEDADES, VERSION_ACTUAL } from '../../../shared/novedades';
import { useTrampaFoco } from './useTrampaFoco';
import { Boton } from '../../comun/componentes';

/** «Novedades de la versión X»: se muestra una vez tras actualizar. */
export function ModalNovedades({ alCerrar, alVerTodas }: { alCerrar: () => void; alVerTodas: () => void }) {
  const pie = useRef<HTMLElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  useTrampaFoco(dialogo);
  const entrada = NOVEDADES.find((n) => n.version === VERSION_ACTUAL) ?? NOVEDADES[0];

  useEffect(() => {
    pie.current?.querySelector<HTMLButtonElement>('.boton-primario')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  return (
    <div className="modal-fondo">
      <div ref={dialogo} className="modal novedades-modal" role="dialog" aria-modal="true" aria-labelledby="novedades-modal-titulo">
        <div className="modal-halo" aria-hidden="true" />
        <div className="bienvenida-escena">
          <div className="bienvenida-medallon" aria-hidden="true">
            <Sparkles size={30} strokeWidth={1.7} />
          </div>
          <span className="novedades-etiqueta">{t('novedades.modalEtiqueta')}</span>
          <h2 id="novedades-modal-titulo" className="bienvenida-titulo">
            {t('novedades.modalTitulo', { version: entrada.version })}
          </h2>
          <ul className="bienvenida-puntos novedades-lista">
            {entrada.puntos.map((p) => (
              <li key={p}>
                <Check size={15} aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <footer className="modal-pie" ref={pie}>
          <Boton variante="fantasma" onClick={alVerTodas}>
            {t('novedades.verTodas')}
          </Boton>
          <span className="modal-pie-espacio" />
          <Boton variante="primario" onClick={alCerrar}>
            {t('novedades.entendido')}
          </Boton>
        </footer>
      </div>
    </div>
  );
}
