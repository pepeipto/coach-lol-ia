import { TriangleAlert } from 'lucide-react';
import type { PeligroGank } from '../../../shared/tiposApp';

interface Tira {
  lado: 'arriba' | 'abajo' | 'izquierda' | 'derecha';
  /** Frecuencia del ruido: estirada a lo largo del borde para que el humo corra en hilos y no en manchas. */
  frecuencia: string;
  semilla: number;
}

const TIRAS: Tira[] = [
  { lado: 'arriba', frecuencia: '0.0035 0.016', semilla: 3 },
  { lado: 'abajo', frecuencia: '0.0035 0.016', semilla: 11 },
  { lado: 'izquierda', frecuencia: '0.016 0.0035', semilla: 19 },
  { lado: 'derecha', frecuencia: '0.016 0.0035', semilla: 29 },
];

/**
 * Una tira de humo pegada a un borde: ruido fractal deformado por otro ruido más lento (domain warp), que da
 * volutas retorcidas en vez de manchas, teñido de rojo sangre. Se dibuja una vez y luego solo se desplaza.
 */
function TiraHumo({ tira }: { tira: Tira }) {
  const id = `ov-humo-${tira.lado}`;
  return (
    <div className={`ov-peligro-tira ${tira.lado}`}>
      <svg preserveAspectRatio="none" aria-hidden="true">
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={tira.frecuencia} numOctaves={4} seed={tira.semilla} result="ruido" />
          <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves={2} seed={tira.semilla + 40} result="deformacion" />
          <feDisplacementMap in="ruido" in2="deformacion" scale={70} xChannelSelector="R" yChannelSelector="G" />
          {/* Color fijo (rojo sangre) y transparencia según el ruido: quedan hilos sueltos, no una mancha. */}
          <feColorMatrix values="1.15 0 0 0 0.02  0.06 0 0 0 0  0.09 0 0 0 0.01  2.3 0 0 0 -0.98" />
          <feGaussianBlur stdDeviation={2.5} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </div>
  );
}

/**
 * 3.18: borde de «posible gank» alrededor de toda la pantalla, con una etiqueta pequeña arriba. No recibe el ratón
 * (pointer-events: none) y se apaga solo con su animación CSS; Overlay lo retira al acabar `duracionMs`.
 * 3.20: el borde es un resplandor rojo sangre que respira, con humo fino que se mueve despacio pegado a los bordes.
 */
export function BordePeligro({ peligro }: { peligro: PeligroGank }) {
  return (
    <div className="ov-peligro" data-motivo={peligro.motivo} role="alert" style={{ ['--peligro-ms' as string]: `${peligro.duracionMs}ms` }}>
      <div className="ov-peligro-humo" aria-hidden="true">
        {TIRAS.map((tira) => (
          <TiraHumo key={tira.lado} tira={tira} />
        ))}
      </div>
      <div className="ov-peligro-etiqueta">
        <TriangleAlert size={16} strokeWidth={2.4} aria-hidden="true" />
        <b>{peligro.etiqueta}</b>
        <span>{peligro.texto}</span>
      </div>
    </div>
  );
}
