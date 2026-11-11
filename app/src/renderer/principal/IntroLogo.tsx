import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../shared/i18n';

/**
 * Intro de apertura de Coach LoL IA, en cinco actos (tiempos en ms desde que se monta; los mismos que intro.css):
 *  1. Ignición (0–800): un punto de luz se enciende con un destello horizontal, la cuadrícula del plano se expande
 *     desde el centro y las líneas guía cruzan la pantalla.
 *  2. Construcción (650–1800): dos cometas dibujan el hexágono a la vez, uno por cada lado, dejando nodos con sus
 *     coordenadas; el círculo guía de la «C» gira con sus tiradores y la «C» se traza.
 *  3. Materialización (1750–2600): el emblema se rellena, un brillo metálico lo barre, el destello azul se enciende
 *     con un reflejo anamórfico, ondas y una lluvia de chispas.
 *  4. Firma (2250–3400): el emblema sube, el nombre aparece cerrando el espaciado, una línea se abre bajo él con el
 *     lema y saltan arcos eléctricos.
 *  5. Salida (3450–4300): anticipación, zoom a través de la «C», destello y la app se enfoca detrás.
 * Se salta con un clic o una tecla. (Hecho con ayuda de IA.)
 */
export const DURACION_INTRO = 4300;
/** Momento en que la app empieza a enfocarse detrás del zoom. */
const REVELAR_APP = 3700;
/** Lo que tarda en desvanecerse si el usuario la salta. */
const DURACION_SALTO = 320;
/** Momento de la lluvia de chispas (cuando se enciende el destello azul). */
const RAFAGA = 2050;

const TAMANO = 168;
const HEX_DERECHA = 'M16 1.5 28.6 8.75 28.6 23.25 16 30.5';
const HEX_IZQUIERDA = 'M16 1.5 3.4 8.75 3.4 23.25 16 30.5';
const HEXAGONO = 'M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z';
const ARCO_C = 'M21.2 11.6a6.4 6.4 0 1 0 0 8.8';
const DESTELLO = 'M22.6 14.2l1.1 1.8 1.8 1.1-1.8 1.1-1.1 1.8-1.1-1.8-1.8-1.1 1.8-1.1Z';
/** Vértices con el momento en que cada cometa pasa por ellos (los dos lados a la vez). */
const NODOS: Array<{ x: number; y: number; ms: number; etiqueta: string; lado: 1 | -1 }> = [
  { x: 16, y: 1.5, ms: 650, etiqueta: '16.0 · 01.5', lado: 1 },
  { x: 28.6, y: 8.75, ms: 900, etiqueta: '28.6 · 08.7', lado: 1 },
  { x: 3.4, y: 8.75, ms: 900, etiqueta: '03.4 · 08.7', lado: -1 },
  { x: 28.6, y: 23.25, ms: 1180, etiqueta: '28.6 · 23.2', lado: 1 },
  { x: 3.4, y: 23.25, ms: 1180, etiqueta: '03.4 · 23.2', lado: -1 },
  { x: 16, y: 30.5, ms: 1450, etiqueta: '16.0 · 30.5', lado: 1 },
];
/** Arcos eléctricos que saltan de las esquinas del emblema (coordenadas del viewBox, quebrados a mano). */
const ARCOS = [
  'M29.4 7.6 31.2 6.1 30.7 4.6 32.9 3.2 32.5 1.4',
  'M2.6 24.4 0.8 25.6 1.3 27.2-0.9 28.2-0.5 30.2',
  'M29.4 21.6 31.6 22.4 32 20.8 34.3 21.5',
];

/** La intro solo se ve si el sistema permite animaciones (y nunca en las pruebas, que no tienen matchMedia). */
export function introPermitida(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Marca el estado de la intro en <html> para que la app espere desenfocada detrás y luego se enfoque. */
function marcarApp(estado: 'activa' | 'revelando' | null) {
  if (estado) document.documentElement.dataset.intro = estado;
  else delete document.documentElement.dataset.intro;
}

type Particula = { x: number; y: number; vx: number; vy: number; vida: number; max: number; r: number; color: string };

/**
 * Lienzo de partículas: polvo luminoso que flota durante la intro y una ráfaga de chispas que sale del destello
 * azul. Va con requestAnimationFrame y se para al desmontarse; sin contexto 2D (pruebas) no pinta nada.
 */
function usarParticulas(lienzo: RefObject<HTMLCanvasElement | null>, origen: RefObject<SVGPathElement | null>) {
  useEffect(() => {
    const c = lienzo.current;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = c?.getContext('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (!c || !ctx) return;
    const g = ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ajustar = () => {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    // Semilla fija: la intro se ve igual cada vez.
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
    const polvo: Particula[] = Array.from({ length: 90 }, () => ({
      x: azar() * innerWidth,
      y: azar() * innerHeight,
      vx: (azar() - 0.5) * 8,
      vy: -5 - azar() * 12,
      vida: azar() * 6,
      max: 6,
      r: 0.4 + azar() * 1.3,
      color: azar() < 0.55 ? '200,170,110' : '120,155,255',
    }));
    const chispas: Particula[] = [];
    let rafagaHecha = false;
    const enlazados: boolean[] = [];
    const chispear = (ox: number, oy: number, n: number, vmin: number, vrango: number) => {
      for (let i = 0; i < n; i++) {
        const ang = azar() * Math.PI * 2;
        const vel = vmin + azar() * vrango;
        chispas.push({
          x: ox,
          y: oy,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          vida: 0,
          max: 0.35 + azar() * 0.6,
          r: 0.6 + azar() * 1.4,
          color: azar() < 0.7 ? '143,176,255' : '250,226,170',
        });
      }
    };

    const inicio = performance.now();
    let previo = inicio;
    let id = 0;
    const cuadro = (ahora: number) => {
      const ms = ahora - inicio;
      const dt = Math.min(0.05, Math.max(0, (ahora - previo) / 1000));
      previo = ahora;
      const w = innerWidth;
      const h = innerHeight;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';

      // Polvo: aparece en el acto 1 y se apaga en la salida.
      const nivel = Math.min(1, ms / 900) * (ms > 3450 ? Math.max(0, 1 - (ms - 3450) / 450) : 1);
      for (const p of polvo) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vida += dt;
        if (p.y < -4) p.y = h + 4;
        const brillo = (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(p.vida * 2.3 + p.x))) * nivel;
        g.fillStyle = `rgba(${p.color},${brillo.toFixed(3)})`;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }

      // Ráfaga de chispas desde el destello azul.
      if (!rafagaHecha && ms >= RAFAGA && origen.current) {
        rafagaHecha = true;
        const caja = origen.current.getBoundingClientRect();
        chispear(caja.left + caja.width / 2, caja.top + caja.height / 2, 64, 140, 460);
      }
      // Chispas donde se enlazan las piezas: cada vez que un cometa llega a un vértice del hexágono.
      const svg = origen.current?.ownerSVGElement;
      if (svg) {
        const caja = svg.getBoundingClientRect();
        const esc = caja.width / 32;
        NODOS.forEach((n, i) => {
          if (enlazados[i] || ms < n.ms) return;
          enlazados[i] = true;
          chispear(caja.left + n.x * esc, caja.top + n.y * esc, 22, 90, 260);
        });
      }
      for (const p of chispas) {
        if (p.vida >= p.max) continue;
        p.vida += dt;
        p.vx *= 1 - 3.4 * dt;
        p.vy = p.vy * (1 - 3.4 * dt) + 70 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = Math.max(0, 1 - p.vida / p.max);
        g.strokeStyle = `rgba(${p.color},${a.toFixed(3)})`;
        g.lineWidth = p.r;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        g.stroke();
      }

      if (ms < DURACION_INTRO + 200) id = requestAnimationFrame(cuadro);
    };
    id = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', ajustar);
    };
  }, [lienzo, origen]);
}

/** Animación de apertura con el emblema de Coach LoL IA (ver la línea de tiempo arriba). */
export function IntroLogo({ alTerminar }: { alTerminar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);
  const terminado = useRef(false);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const destello = useRef<SVGPathElement>(null);
  usarParticulas(lienzo, destello);

  const terminar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    alTerminar();
  }, [alTerminar]);

  useEffect(() => {
    marcarApp('activa');
    const revelar = setTimeout(() => marcarApp('revelando'), REVELAR_APP);
    const fin = setTimeout(terminar, DURACION_INTRO);
    return () => {
      clearTimeout(revelar);
      clearTimeout(fin);
      marcarApp(null);
    };
  }, [terminar]);

  useEffect(() => {
    if (!saliendo) return;
    marcarApp('revelando');
    const fin = setTimeout(terminar, DURACION_SALTO);
    return () => clearTimeout(fin);
  }, [saliendo, terminar]);

  useEffect(() => {
    const saltar = () => setSaliendo(true);
    window.addEventListener('keydown', saltar);
    return () => window.removeEventListener('keydown', saltar);
  }, []);

  const k = TAMANO / 32;
  const posDestello = { left: 23.6 * k, top: 17.1 * k };
  return (
    <div
      className={`intro${saliendo ? ' intro-saltada' : ''}`}
      onClick={() => setSaliendo(true)}
      role="presentation"
      aria-hidden="true"
      data-testid="intro-logo"
    >
      <div className="intro-cuadricula" />
      <div className="intro-cuadricula intro-cuadricula-gruesa" />
      <canvas ref={lienzo} className="intro-lienzo" />
      <div className="intro-guia intro-guia-h" />
      <div className="intro-guia intro-guia-v" />

      <div className="intro-escena">
        <div className="intro-marca">
          <div className="intro-logo" style={{ width: TAMANO, height: TAMANO }}>
            <div className="intro-ignicion">
              <span className="intro-ignicion-raya" />
              <span className="intro-ignicion-raya intro-ignicion-raya-v" />
              <span className="intro-ignicion-punto" />
            </div>
            <svg width={TAMANO} height={TAMANO} viewBox="0 0 32 32" overflow="visible">
              <defs>
                <linearGradient id="intro-oro" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fbecc8" />
                  <stop offset="0.45" stopColor="#d9bb7c" />
                  <stop offset="1" stopColor="#8a6d3b" />
                </linearGradient>
                <linearGradient id="intro-fondo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1d2740" />
                  <stop offset="1" stopColor="#090d18" />
                </linearGradient>
                <linearGradient id="intro-brillo" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#fff" stopOpacity="0.32" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="intro-halo">
                  <stop offset="0" stopColor="#4f7cff" stopOpacity="0.5" />
                  <stop offset="0.6" stopColor="#4f7cff" stopOpacity="0.12" />
                  <stop offset="1" stopColor="#4f7cff" stopOpacity="0" />
                </radialGradient>
                <clipPath id="intro-recorte">
                  <path d={HEXAGONO} />
                </clipPath>
              </defs>

              <circle className="intro-halo" cx="16" cy="16" r="24" fill="url(#intro-halo)" />

              {/* Construcción del emblema */}
              <g className="intro-construccion">
                <circle className="intro-circulo-guia" cx="16.55" cy="16" r="6.4" pathLength={1} />
                <g className="intro-giro">
                  <circle className="intro-circulo-giro" cx="16.55" cy="16" r="8.8" />
                </g>
                <line className="intro-cruz" x1="13.8" y1="16" x2="19.3" y2="16" />
                <line className="intro-cruz" x1="16.55" y1="13.25" x2="16.55" y2="18.75" />
                <line className="intro-tirador" x1="21.2" y1="11.6" x2="17.4" y2="7.2" />
                <line className="intro-tirador" x1="21.2" y1="20.4" x2="17.4" y2="24.8" />
                <circle className="intro-tirador-punta" cx="17.4" cy="7.2" r="0.42" />
                <circle className="intro-tirador-punta" cx="17.4" cy="24.8" r="0.42" />
                {NODOS.map((n) => (
                  <g key={n.etiqueta} className="intro-nodo" style={{ animationDelay: `${n.ms}ms` }}>
                    <rect x={n.x - 0.65} y={n.y - 0.65} width="1.3" height="1.3" />
                    <text x={n.x + n.lado * 1.6} y={n.y + 0.38} textAnchor={n.lado === 1 ? 'start' : 'end'}>
                      {n.etiqueta}
                    </text>
                  </g>
                ))}
              </g>

              <path className="intro-relleno" d={HEXAGONO} fill="url(#intro-fondo)" />
              <g clipPath="url(#intro-recorte)">
                <rect className="intro-barrido" x="-14" y="-10" width="12" height="52" fill="url(#intro-brillo)" />
              </g>
              <path className="intro-trazo intro-trazo-hex" d={HEX_DERECHA} stroke="url(#intro-oro)" pathLength={1} />
              <path className="intro-trazo intro-trazo-hex" d={HEX_IZQUIERDA} stroke="url(#intro-oro)" pathLength={1} />
              <path className="intro-cometa intro-cometa-hex" d={HEX_DERECHA} pathLength={1} />
              <path className="intro-cometa intro-cometa-hex" d={HEX_IZQUIERDA} pathLength={1} />
              <path className="intro-trazo intro-trazo-c" d={ARCO_C} stroke="url(#intro-oro)" pathLength={1} />
              <path className="intro-cometa intro-cometa-c" d={ARCO_C} pathLength={1} />
              <path ref={destello} className="intro-destello" d={DESTELLO} fill="#5b86ff" />
              {ARCOS.map((d, i) => (
                <path key={d} className="intro-arco" d={d} style={{ animationDelay: `${2550 + i * 120}ms` }} />
              ))}
            </svg>
            <span className="intro-anamorfico" style={posDestello} />
            <span className="intro-onda" style={posDestello} />
            <span className="intro-onda intro-onda-2" style={posDestello} />
          </div>
          <div className="intro-firma">
            <div className="intro-nombre">
              <span className="intro-palabra">Coach</span>
              <span className="intro-palabra">LoL</span>
              <span className="intro-palabra intro-ia">IA</span>
            </div>
            <div className="intro-linea" />
            <div className="intro-lema">{t('intro.lema')}</div>
          </div>
        </div>
      </div>

      <div className="intro-flash" />
      <div className="intro-vineta" />
      <div className="intro-saltar">{t('intro.saltar')}</div>
    </div>
  );
}
