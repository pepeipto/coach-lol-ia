import { t } from '../../../shared/i18n';
import type { EstadoCs } from '../../../shared/tiposApp';

/** Margen bajo el objetivo en el que el ritmo se considera «cerca» (ámbar). */
export const MARGEN_CERCA = 0.15;

/**
 * Tono del ritmo de CS: verde si llega al objetivo, ámbar si está a menos de un 15 %, neutro si no.
 * Nunca rojo ni nada que avergüence: debajo del objetivo es solo un dato.
 */
export function tonoCs(porMinuto: number, objetivo: number): 'ok' | 'cerca' | 'neutro' {
  if (objetivo <= 0 || porMinuto >= objetivo) return 'ok';
  if (porMinuto >= objetivo * (1 - MARGEN_CERCA)) return 'cerca';
  return 'neutro';
}

/** «7,4» con coma decimal. */
export const decimal = (n: number) => n.toFixed(1).replace('.', ',');

export function WidgetCs({ cs }: { cs: EstadoCs }) {
  const tono = tonoCs(cs.porMinuto, cs.objetivoPorMinuto);
  const progreso = cs.objetivoPorMinuto > 0 ? Math.min(1, cs.porMinuto / cs.objetivoPorMinuto) : 1;
  return (
    <div
      className={`ov-cs tono-${tono}`}
      role="group"
      aria-label={t('overlay.cs.resumen', { cs: cs.cs, ritmo: decimal(cs.porMinuto), objetivo: decimal(cs.objetivoPorMinuto) })}
    >
      <div className="ov-cs-fila">
        <span className="ov-cs-etiqueta">{t('overlay.cs.titulo')}</span>
        <span className="ov-cs-valor">{cs.cs}</span>
        <span className="ov-cs-ritmo">
          <b>{decimal(cs.porMinuto)}</b>
          {t('overlay.cs.porMinuto')}
        </span>
      </div>
      <div className="ov-cs-barra" aria-hidden="true">
        <span style={{ transform: `scaleX(${progreso})` }} />
      </div>
      <div className="ov-cs-pie">
        <span>{t('overlay.cs.objetivo', { objetivo: decimal(cs.objetivoPorMinuto) })}</span>
        {cs.cs10 !== null && <span className="ov-cs-10">{t('overlay.cs.a10', { cs: cs.cs10 })}</span>}
      </div>
    </div>
  );
}
