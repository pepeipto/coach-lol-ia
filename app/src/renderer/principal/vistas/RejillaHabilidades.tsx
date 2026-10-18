import type { Habilidad } from '@coach/shared';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { t } from '../../../shared/i18n';

const FILAS: Habilidad[] = ['Q', 'W', 'E', 'R'];

/** Orden en que conviene subir al máximo Q, W y E: la primera que llega a 5 puntos va antes. */
export function prioridad(orden: Habilidad[]): Habilidad[] {
  const puntos: Record<Habilidad, number> = { Q: 0, W: 0, E: 0, R: 0 };
  const llegada: Partial<Record<Habilidad, number>> = {};
  orden.forEach((h, i) => {
    puntos[h]++;
    if (puntos[h] === 5 && llegada[h] === undefined) llegada[h] = i;
  });
  // Las que no llegan a 5 en los 18 niveles van detrás, la que tenga más puntos primero.
  const clave = (h: Habilidad) => llegada[h] ?? 100 - puntos[h];
  return (['Q', 'W', 'E'] as Habilidad[]).sort((a, b) => clave(a) - clave(b));
}

/** Rejilla de 18 niveles al estilo Blitz: una fila por habilidad y la casilla del nivel coloreada. */
export function RejillaHabilidades({ orden }: { orden: Habilidad[] }) {
  const niveles = orden.slice(0, 18);
  const ordenMaximo = prioridad(niveles);
  return (
    <div className="habilidades">
      <div className="habilidades-prioridad">
        <span className="habilidades-prioridad-titulo">{t('habilidades.prioridad')}</span>
        {ordenMaximo.map((h, i) => (
          <Fragment key={h}>
            {i > 0 && <ChevronRight size={14} className="habilidades-flecha" aria-hidden="true" />}
            <span className={`tecla-habilidad hab-${h}`}>{h}</span>
          </Fragment>
        ))}
      </div>
      <div className="rejilla" style={{ ['--columnas' as string]: Math.max(niveles.length, 1) }}>
        <div className="rejilla-etiquetas" aria-hidden="true">
          {FILAS.map((h) => (
            <span key={h} className={`tecla-habilidad hab-${h}`}>
              {h}
            </span>
          ))}
        </div>
        <div className="rejilla-tablero">
          <div className="rejilla-fondo" aria-hidden="true">
            {FILAS.map((h) => niveles.map((_, i) => <span key={`${h}${i}`} className="rejilla-hueco" />))}
          </div>
          <ol className="rejilla-orden" aria-label={t('ui.habilidades')}>
            {niveles.map((h, i) => (
              <li
                key={i}
                className={`rejilla-celda hab-${h}`}
                data-habilidad={h}
                aria-label={t('habilidades.nivel', { nivel: i + 1, habilidad: h })}
                style={{ gridColumn: i + 1, gridRow: FILAS.indexOf(h) + 1, animationDelay: `${i * 18}ms` }}
              >
                {i + 1}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
