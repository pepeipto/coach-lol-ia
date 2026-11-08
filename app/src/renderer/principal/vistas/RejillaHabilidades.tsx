import type { Habilidad } from '@coach/shared';
import { ChevronRight } from 'lucide-react';
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

/** Nivel (1-18) en que cada habilidad llega a su máximo, o null si no llega en los niveles dados. */
export function nivelMaximo(orden: Habilidad[], h: Habilidad): number | null {
  const tope = h === 'R' ? 3 : 5;
  let puntos = 0;
  for (let i = 0; i < orden.length; i++) if (orden[i] === h && ++puntos === tope) return i + 1;
  return null;
}

/**
 * Orden de habilidades (3.17, rediseño): arriba la prioridad en teclas grandes con el nivel en que cada una llega al
 * máximo y los niveles de la definitiva; debajo la rejilla de 18 niveles, con una fila por habilidad (la casilla de
 * cada nivel lleva su número). Colores, formas y brillos salen del tema (tokens --hab-* de tokens.css y temas.css).
 */
export function RejillaHabilidades({ orden }: { orden: Habilidad[] }) {
  const niveles = orden.slice(0, 18);
  const ordenMaximo = prioridad(niveles);
  const nivelesR = niveles.flatMap((h, i) => (h === 'R' ? [i + 1] : []));
  return (
    <div className="habilidades">
      <div className="habilidades-cabecera">
        <ol className="habilidades-prioridad" aria-label={t('habilidades.prioridad')}>
          {ordenMaximo.map((h, i) => {
            const nivel = nivelMaximo(niveles, h);
            return (
              <li key={h} className={`prioridad-paso hab-${h}${i === 0 ? ' primera' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>
                {i > 0 && <ChevronRight size={18} className="habilidades-flecha" aria-hidden="true" />}
                <span className="prioridad-tecla">
                  <span className="prioridad-letra">{h}</span>
                  <span className="prioridad-puesto" aria-hidden="true">{i + 1}</span>
                </span>
                <span className="prioridad-textos">
                  {i === 0 && <span className="prioridad-titulo">{t('habilidades.primero')}</span>}
                  {nivel !== null && (
                    <span className="prioridad-nivel" title={t('habilidades.maxNivel', { nivel })}>
                      {t('habilidades.maxCorto', { nivel })}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        {nivelesR.length > 0 && (
          <div className="habilidades-definitiva hab-R">
            <span className="tecla-habilidad hab-R">R</span>
            <span className="prioridad-textos">
              <span className="prioridad-titulo">{t('habilidades.definitiva')}</span>
              <span className="definitiva-niveles">
                {nivelesR.map((n) => (
                  <span key={n} className="definitiva-nivel">{n}</span>
                ))}
              </span>
            </span>
          </div>
        )}
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
            {FILAS.map((h) => niveles.map((_, i) => <span key={`${h}${i}`} className={`rejilla-hueco hab-${h}`} />))}
          </div>
          <ol className="rejilla-orden" aria-label={t('ui.habilidades')}>
            {niveles.map((h, i) => (
              <li
                key={i}
                className={`rejilla-celda hab-${h}`}
                data-habilidad={h}
                aria-label={t('habilidades.nivel', { nivel: i + 1, habilidad: h })}
                style={{ gridColumn: i + 1, gridRow: FILAS.indexOf(h) + 1, animationDelay: `${i * 22}ms` }}
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
