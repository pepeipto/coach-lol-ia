import { ArrowLeft, ArrowRight, Check, Download, Layers, MonitorPlay, Sparkles, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../shared/i18n';
import { useTrampaFoco } from './useTrampaFoco';
import { Boton, clases } from '../../comun/componentes';
import { Logo } from '../../comun/Logo';

const TOTAL = 4;
const ICONOS: LucideIcon[] = [Sparkles, MonitorPlay, Download, Layers];

function Cuerpo({ paso }: { paso: number }) {
  if (paso === 1)
    return (
      <>
        <p className="bienvenida-texto">{t('bienvenida.p1.texto')}</p>
        <ul className="bienvenida-puntos">
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <Check size={15} aria-hidden="true" />
              <span>{t('bienvenida.p1.punto' + n)}</span>
            </li>
          ))}
        </ul>
      </>
    );
  if (paso === 2)
    return (
      <>
        <p className="bienvenida-texto">{t('bienvenida.p2.texto')}</p>
        <div className="bienvenida-ruta" aria-hidden="true">
          <span>{t('bienvenida.p2.ruta')}</span>
          <i>›</i>
          <span>{t('bienvenida.p2.ruta2')}</span>
          <i>›</i>
          <span>{t('bienvenida.p2.ruta3')}</span>
          <i>›</i>
          <strong>{t('bienvenida.p2.valor')}</strong>
        </div>
      </>
    );
  if (paso === 3)
    return (
      <>
        <p className="bienvenida-texto">{t('bienvenida.p3.texto')}</p>
        <ol className="bienvenida-pasos">
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <span className="bienvenida-numero" aria-hidden="true">
                {n}
              </span>
              <span>{t('bienvenida.p3.paso' + n)}</span>
            </li>
          ))}
        </ol>
        <p className="bienvenida-nota">{t('bienvenida.p3.nota')}</p>
      </>
    );
  return (
    <>
      <p className="bienvenida-texto">{t('bienvenida.p4.texto')}</p>
      <div className="bienvenida-teclas" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className="bienvenida-teclas-grupo">
            {n > 1 && <i>+</i>}
            <kbd className="tecla tecla-grande">{t('bienvenida.p4.tecla' + n)}</kbd>
          </span>
        ))}
      </div>
      <p className="bienvenida-nota">{t('bienvenida.p4.mover')}</p>
      <p className="bienvenida-listo">{t('bienvenida.p4.listo')}</p>
    </>
  );
}

/** Bienvenida de la primera vez: 4 pasos en un diálogo modal. «Saltar» y Escape la dan por vista. */
export function Bienvenida({ alTerminar }: { alTerminar: () => void }) {
  const [paso, setPaso] = useState(1);
  const pie = useRef<HTMLElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  useTrampaFoco(dialogo);
  const Icono = ICONOS[paso - 1];
  const ultimo = paso === TOTAL;

  useEffect(() => {
    pie.current?.querySelector<HTMLButtonElement>('.boton-primario')?.focus();
  }, [paso]);
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alTerminar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alTerminar]);

  return (
    <div className="modal-fondo">
      <div ref={dialogo} className="modal bienvenida" role="dialog" aria-modal="true" aria-labelledby="bienvenida-titulo">
        <div className="modal-halo" aria-hidden="true" />
        <header className="bienvenida-cabecera">
          <span className="bienvenida-marca">
            <Logo tamano={22} />
            {t('app.titulo')}
          </span>
          <span className="bienvenida-contador">{t('bienvenida.paso', { n: paso, total: TOTAL })}</span>
        </header>
        <div className="bienvenida-progreso" role="img" aria-label={t('bienvenida.progreso')}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={clases('bienvenida-segmento', i < paso && 'lleno')} />
          ))}
        </div>
        <div className="bienvenida-escena" key={paso}>
          <div className="bienvenida-medallon" aria-hidden="true">
            <Icono size={30} strokeWidth={1.7} />
          </div>
          <h2 id="bienvenida-titulo" className="bienvenida-titulo">
            {t(`bienvenida.p${paso}.titulo`)}
          </h2>
          <Cuerpo paso={paso} />
        </div>
        <footer className="modal-pie" ref={pie}>
          <Boton variante="fantasma" onClick={alTerminar}>
            {t('bienvenida.saltar')}
          </Boton>
          <span className="modal-pie-espacio" />
          {paso > 1 && (
            <Boton onClick={() => setPaso(paso - 1)}>
              <ArrowLeft size={15} aria-hidden="true" />
              {t('bienvenida.atras')}
            </Boton>
          )}
          {ultimo ? (
            <Boton variante="primario" onClick={alTerminar}>
              <Check size={15} aria-hidden="true" />
              {t('bienvenida.empezar')}
            </Boton>
          ) : (
            <Boton variante="primario" onClick={() => setPaso(paso + 1)}>
              {t('bienvenida.siguiente')}
              <ArrowRight size={15} aria-hidden="true" />
            </Boton>
          )}
        </footer>
      </div>
    </div>
  );
}
