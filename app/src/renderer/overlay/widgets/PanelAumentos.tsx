import { Sparkles } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { AumentoPanel, PanelAumentos as Panel } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { usePresencia } from './usePresencia';

/** Un aumento: icono con su tier encima y el nombre. */
function Aumento({ a, compacto = false }: { a: AumentoPanel; compacto?: boolean }) {
  return (
    <li className={clases('ov-aum', compacto && 'compacto')} title={a.nombre}>
      <span className="ov-aum-icono">
        {a.icono ? <img src={a.icono} alt="" width={compacto ? 26 : 30} height={compacto ? 26 : 30} /> : <Sparkles size={16} aria-hidden="true" />}
        <b className={`ov-aum-tier tier-${a.tier}`} aria-label={t('overlay.aumentos.tier', { tier: a.tier })}>
          {a.tier}
        </b>
      </span>
      {!compacto && <span className="ov-aum-nombre">{a.nombre}</span>}
    </li>
  );
}

/**
 * 3.4: tier list de aumentos de ARAM: Caos para tu campeón. Tres columnas (prismático, oro y plata) con los que
 * mejor le encajan y, debajo, los grupos que se combinan entre sí. El tier es de encaje con el campeón, nunca de
 * victorias (política de Riot).
 */
export function PanelAumentos({ panel }: { panel: Panel | null }) {
  const { valor, saliendo } = usePresencia(panel, 220);
  if (!valor) return <div className="ov-aumentos-hueco" />;
  return (
    <section className={clases('ov-aumentos', saliendo && 'saliendo')} aria-label={t('overlay.aumentos.titulo', { campeon: valor.campeon })}>
      <header className="ov-aumentos-cabecera">
        <Sparkles size={14} aria-hidden="true" />
        <span>{t('overlay.aumentos.titulo', { campeon: valor.campeon })}</span>
      </header>
      <div className="ov-aumentos-columnas">
        {valor.columnas.map((c) => (
          <div key={c.rareza} className={`ov-aumentos-col rareza-${c.rareza}`}>
            <h4>{t(`overlay.aumentos.rareza.${c.rareza}`)}</h4>
            <ol>
              {c.aumentos.map((a) => (
                <Aumento key={a.id} a={a} />
              ))}
            </ol>
          </div>
        ))}
      </div>
      {valor.combos.length > 0 && (
        <div className="ov-aumentos-combos">
          <h4>{t('overlay.aumentos.combos')}</h4>
          {valor.combos.map((c) => (
            <div key={c.id} className="ov-aumentos-combo">
              <span className="ov-aumentos-combo-nombre">{t(`overlay.aumentos.combo.${c.id.replace(':', '.')}`)}</span>
              <ol>
                {c.aumentos.map((a) => (
                  <Aumento key={a.id} a={a} compacto />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <footer className="ov-aumentos-pie">{t('overlay.aumentos.pie')}</footer>
    </section>
  );
}
