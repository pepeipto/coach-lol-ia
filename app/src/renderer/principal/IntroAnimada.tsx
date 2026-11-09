import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n';
import { useIdioma } from '../comun/idioma';

/** Duración de la intro hasta que empieza a desvanecerse, y del zoom final (ms). Igual que en intro.css. */
const DURACION = 2300;
const SALIDA = 650;

/** En las pruebas y con «reducir movimiento» del sistema no se enseña la intro. */
function debeMostrarse(): boolean {
  if ((import.meta as { env?: { MODE?: string } }).env?.MODE === 'test') return false;
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/**
 * Intro al abrir la app: se dibuja el contorno del emblema con un trazo de luz, se rellena con un
 * destello y un rayo, aparece el nombre y todo hace zoom hacia la pantalla principal.
 * Dura unos tres segundos y se salta con un clic o cualquier tecla.
 */
export function IntroAnimada() {
  useIdioma();
  const [fase, setFase] = useState<'dentro' | 'saliendo' | 'fuera'>(() => (debeMostrarse() ? 'dentro' : 'fuera'));

  useEffect(() => {
    if (fase === 'fuera') return;
    const reloj =
      fase === 'dentro'
        ? window.setTimeout(() => setFase('saliendo'), DURACION)
        : window.setTimeout(() => setFase('fuera'), SALIDA);
    return () => window.clearTimeout(reloj);
  }, [fase]);

  useEffect(() => {
    if (fase !== 'dentro') return;
    const saltar = () => setFase('saliendo');
    window.addEventListener('keydown', saltar);
    return () => window.removeEventListener('keydown', saltar);
  }, [fase]);

  if (fase === 'fuera') return null;

  return (
    <div
      className={`intro intro--${fase}`}
      role="presentation"
      aria-hidden="true"
      onClick={() => fase === 'dentro' && setFase('saliendo')}
    >
      <div className="intro-halo" />
      <svg className="intro-rayo" viewBox="0 0 100 300" preserveAspectRatio="none">
        <path d="M58 0 L40 92 L55 96 L30 190 L47 194 L22 300" />
      </svg>
      <div className="intro-centro">
        <svg className="intro-emblema" viewBox="0 0 32 32" width="132" height="132">
          <defs>
            <linearGradient id="intro-oro" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f0d9a6" />
              <stop offset="0.55" stopColor="#c8aa6e" />
              <stop offset="1" stopColor="#8a6d3b" />
            </linearGradient>
            <linearGradient id="intro-fondo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a2236" />
              <stop offset="1" stopColor="#0a0e1a" />
            </linearGradient>
          </defs>
          <path className="intro-hex-relleno" d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z" fill="url(#intro-fondo)" />
          <path
            className="intro-trazo intro-hex"
            d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z"
            pathLength={1}
            fill="none"
            stroke="url(#intro-oro)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            className="intro-trazo intro-c"
            d="M21.2 11.6a6.4 6.4 0 1 0 0 8.8"
            pathLength={1}
            fill="none"
            stroke="url(#intro-oro)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            className="intro-chispa"
            d="M22.6 14.2l1.1 1.8 1.8 1.1-1.8 1.1-1.1 1.8-1.1-1.8-1.8-1.1 1.8-1.1Z"
            fill="#4f7cff"
          />
        </svg>
        <div className="intro-nombre">
          <span>Coach</span> <span>LoL</span> <em>IA</em>
        </div>
        <div className="intro-lema">{t('intro.lema')}</div>
      </div>
      <div className="intro-saltar">{t('intro.saltar')}</div>
    </div>
  );
}
