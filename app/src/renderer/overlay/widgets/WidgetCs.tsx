import type { KdaMedio } from '@coach/shared';
import type { ReactNode } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { EstadoCs, EstadoRendimiento, KdaPartida } from '../../../shared/tiposApp';

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

/**
 * Tono del KDA: verde si llega a la media del campeón en su rol; neutro si no o si no hay media.
 * Nunca rojo ni textos negativos.
 */
export function tonoKda(ratio: number, medio: KdaMedio | null): 'ok' | 'neutro' {
  // Con la misma precisión con que se enseñan (un decimal): «2,5» frente a «Media 2,5» es verde.
  const unDecimal = (n: number) => Math.round(n * 10) / 10;
  return medio && unDecimal(ratio) >= unDecimal(medio.ratio) ? 'ok' : 'neutro';
}

/** «7,4» con coma decimal. */
/** Un decimal con el separador del idioma de la app («6,5» en español, «6.5» en inglés). */
export const decimal = (n: number) =>
  n.toLocaleString(localeActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });

export function WidgetCs({ cs, children }: { cs: EstadoCs; children?: ReactNode }) {
  const tono = tonoCs(cs.porMinuto, cs.objetivoPorMinuto);
  const progreso = cs.objetivoPorMinuto > 0 ? Math.min(1, cs.porMinuto / cs.objetivoPorMinuto) : 1;
  return (
    <div className={`ov-cs tono-${tono}`}>
      <div
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
      {children}
    </div>
  );
}

/** Fila del KDA en vivo: «4/2/7», el ratio y la media del campeón en su rol (si hay datos). */
function FilaKda({ kda, medio }: { kda: KdaPartida; medio: KdaMedio | null }) {
  const ratio = decimal(kda.ratio);
  const resumen =
    t('overlay.rendimiento.resumen', { k: kda.k, d: kda.d, a: kda.a, ratio }) +
    (medio ? t('overlay.rendimiento.resumenMedia', { ratio: decimal(medio.ratio) }) : '');
  return (
    <div className={`ov-kda tono-${tonoKda(kda.ratio, medio)}`} role="group" aria-label={resumen}>
      <div className="ov-cs-fila">
        <span className="ov-cs-etiqueta">{t('overlay.rendimiento.kda')}</span>
        <span className="ov-kda-valor">{`${kda.k}/${kda.d}/${kda.a}`}</span>
        <span className="ov-cs-ritmo">
          <b>{ratio}</b>
        </span>
      </div>
      {medio && (
        <div className="ov-cs-pie ov-kda-pie" title={t('overlay.rendimiento.mediaTitulo')}>
          <span>{t('overlay.rendimiento.media', { ratio: decimal(medio.ratio) })}</span>
        </div>
      )}
    </div>
  );
}

/** «+1,2k» / «−300»: oro con signo, en miles a partir de 1000. */
export function oroConSigno(n: number): string {
  const signo = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return abs >= 1000 ? `${signo}${decimal(abs / 1000)}k` : `${signo}${Math.round(abs)}`;
}

/** 3.5: diferencia de oro en objetos (Tab) de tu equipo y frente a tu rival de línea; verde si vais por delante. */
function FilaOro({ oro }: { oro: NonNullable<EstadoRendimiento['oro']> }) {
  const tono = (n: number) => (n > 0 ? 'ok' : 'neutro');
  return (
    <div className="ov-oro" role="group" aria-label={t('overlay.oro.resumen', { equipo: oroConSigno(oro.equipo), rival: oro.rival === null ? '—' : oroConSigno(oro.rival) })}>
      <span className="ov-cs-etiqueta">{t('overlay.oro.titulo')}</span>
      <span className={`ov-oro-valor tono-${tono(oro.equipo)}`}>
        <small>{t('overlay.oro.equipo')}</small> {oroConSigno(oro.equipo)}
      </span>
      {oro.rival !== null && (
        <span className={`ov-oro-valor tono-${tono(oro.rival)}`}>
          <small>{t('overlay.oro.rival')}</small> {oroConSigno(oro.rival)}
        </span>
      )}
    </div>
  );
}

/** Widget «Rendimiento»: el CS con su ritmo y el KDA de la partida junto a la media del campeón. */
export function WidgetRendimiento({ rendimiento }: { rendimiento: EstadoRendimiento }) {
  const kda = rendimiento.kda && <FilaKda kda={rendimiento.kda} medio={rendimiento.kdaMedio} />;
  // Fuera de la Grieta no hay CS: solo el KDA.
  if (!rendimiento.cs) return <div className="ov-cs ov-solo-kda">{kda}</div>;
  return (
    <WidgetCs cs={rendimiento.cs}>
      {kda}
      {rendimiento.oro && <FilaOro oro={rendimiento.oro} />}
    </WidgetCs>
  );
}
