import { useCallback, useEffect, useRef, useState } from 'react';

/** Duración total de la intro (ms): trazo del logo, relleno, nombre y zoom hacia la app. */
export const DURACION_INTRO = 3600;
/** Lo que tarda en desvanecerse si el usuario la salta con un clic o una tecla. */
const DURACION_SALTO = 260;

/** Contorno del hexágono del logo (viewBox 0 0 32 32), el mismo de `comun/Logo.tsx`. */
const HEXAGONO = 'M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z';
const VERTICES: Array<[number, number]> = [
  [16, 1.5],
  [28.6, 8.75],
  [28.6, 23.25],
  [16, 30.5],
  [3.4, 23.25],
  [3.4, 8.75],
];
/** La «C»: arco de radio 6,4 con centro en (16,55; 16). */
const ARCO_C = 'M21.2 11.6a6.4 6.4 0 1 0 0 8.8';
const CENTRO_C: [number, number] = [16.55, 16];
const DESTELLO = 'M22.6 14.2l1.1 1.8 1.8 1.1-1.8 1.1-1.1 1.8-1.1-1.8-1.8-1.1 1.8-1.1Z';

/** Tamaño del logo en la intro (px). La punta del lápiz recorre el hexágono a esta escala. */
const TAMANO = 150;

/** El contorno del hexágono escalado a píxeles, para mover la punta brillante con `offset-path`. */
function hexagonoEnPixeles(tamano: number): string {
  const k = tamano / 32;
  const p = VERTICES.map(([x, y]) => `${(x * k).toFixed(1)} ${(y * k).toFixed(1)}`);
  return `path('M${p.join(' L')} Z')`;
}

/** La intro solo se ve si el sistema permite animaciones (y nunca en las pruebas, que no tienen matchMedia). */
export function introPermitida(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animación de apertura de la app: sobre una cuadrícula de plano aparece un punto de luz que dibuja
 * el hexágono del logo con nodos de construcción, se traza la «C», se rellena, destella el brillo
 * azul, aparece «Coach LoL IA» y el logo se lanza hacia la cámara para dejar ver la app.
 * Se salta con un clic o cualquier tecla. (Hecho con ayuda de IA.)
 */
export function IntroLogo({ alTerminar }: { alTerminar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);
  const terminado = useRef(false);

  const terminar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    alTerminar();
  }, [alTerminar]);

  useEffect(() => {
    const fin = setTimeout(terminar, DURACION_INTRO);
    return () => clearTimeout(fin);
  }, [terminar]);

  useEffect(() => {
    if (!saliendo) return;
    const fin = setTimeout(terminar, DURACION_SALTO);
    return () => clearTimeout(fin);
  }, [saliendo, terminar]);

  useEffect(() => {
    const saltar = () => setSaliendo(true);
    window.addEventListener('keydown', saltar);
    return () => window.removeEventListener('keydown', saltar);
  }, []);

  return (
    <div
      className={`intro${saliendo ? ' intro-saltada' : ''}`}
      onClick={() => setSaliendo(true)}
      role="presentation"
      aria-hidden="true"
      data-testid="intro-logo"
    >
      <div className="intro-cuadricula" />
      <div className="intro-guia intro-guia-h" />
      <div className="intro-guia intro-guia-v" />
      <svg className="intro-rayo" viewBox="0 0 60 220" preserveAspectRatio="none">
        <path d="M34 0 24 46 38 52 18 112 30 118 8 220" />
      </svg>

      <div className="intro-escena">
        <div className="intro-marca">
          <div className="intro-logo" style={{ width: TAMANO, height: TAMANO }}>
            <svg width={TAMANO} height={TAMANO} viewBox="0 0 32 32" overflow="visible">
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

              {/* Construcción: círculo guía de la «C», tiradores y nodos en los vértices. */}
              <g className="intro-construccion">
                <circle className="intro-circulo-guia" cx={CENTRO_C[0]} cy={CENTRO_C[1]} r="6.4" pathLength={1} />
                <line className="intro-tirador" x1="21.2" y1="11.6" x2="17.6" y2="7.4" />
                <line className="intro-tirador" x1="21.2" y1="20.4" x2="17.6" y2="24.6" />
                <circle className="intro-nodo-redondo" cx="17.6" cy="7.4" r="0.45" />
                <circle className="intro-nodo-redondo" cx="17.6" cy="24.6" r="0.45" />
                <circle className="intro-nodo-redondo" cx={CENTRO_C[0]} cy={CENTRO_C[1]} r="0.35" />
                {VERTICES.map(([x, y], i) => (
                  <rect
                    key={i}
                    className="intro-nodo"
                    x={x - 0.6}
                    y={y - 0.6}
                    width="1.2"
                    height="1.2"
                    style={{ animationDelay: `${300 + i * 150}ms` }}
                  />
                ))}
              </g>

              <path className="intro-relleno" d={HEXAGONO} fill="url(#intro-fondo)" />
              <path className="intro-trazo-hex" d={HEXAGONO} stroke="url(#intro-oro)" pathLength={1} />
              <path className="intro-trazo-c" d={ARCO_C} stroke="url(#intro-oro)" pathLength={1} />
              <path className="intro-destello" d={DESTELLO} fill="#4f7cff" />
            </svg>
            <span className="intro-punta" style={{ offsetPath: hexagonoEnPixeles(TAMANO) }} />
            <span className="intro-onda" />
          </div>
          <div className="intro-nombre">
            {'Coach LoL'.split('').map((letra, i) => (
              <span key={i} style={{ animationDelay: `${1900 + i * 45}ms` }}>
                {letra === ' ' ? ' ' : letra}
              </span>
            ))}
            <span className="intro-ia" style={{ animationDelay: `${1900 + 10 * 45}ms` }}>
              &nbsp;IA
            </span>
          </div>
        </div>
      </div>
      <div className="intro-flash" />
    </div>
  );
}
