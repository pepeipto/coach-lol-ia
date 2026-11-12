import { Sparkles } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { AumentoPanel, PanelAumentos as Panel } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { usePresencia } from './usePresencia';

/** Overlay discreto: solo los de tier S de cada rareza (el resto, y los combos, están en la app). Hecho con ayuda de IA. */
const MAX_VISIBLES = 2;

/** Un aumento: icono con su tier encima y el nombre. */
function Aumento({ a, compacto = false }: { a: AumentoPanel; compacto?: boolean }) {
  return (
    <li className={clases('ov-aum', compacto && 'compacto')} title={a.nombre}>
      <span className="ov-aum-icono">
        {a.icono ? <img src={a.icono} alt="" width={compacto ? 22 : 26} height={compacto ? 22 : 26} /> : <Sparkles size={14} aria-hidden="true" />}
        <b className={`ov-aum-tier tier-${a.tier}`} aria-label={t('overlay.aumentos.tier', { tier: a.tier })}>
          {a.tier}
        </b>
      </span>
      {!compacto && <span className="ov-aum-nombre">{a.nombre}</span>}
    </li>
  );
}

/**
 * 3.4: tier list de aumentos de ARAM: Caos para tu campeón. Tres columnas pequeñas (prismático, oro y plata) con los
 * de tier S (hasta 2 por rareza) que mejor le encajan. El tier es de encaje con el campeón, nunca de
 * victorias (política de Riot).
 */
export function PanelAumentos({ panel }: { panel: Panel | null }) {
  const { valor, saliendo } = usePresencia(panel, 220);
  if (!valor || !valor.columnas.some((c) => c.aumentos.some((a) => a.tier === 'S'))) return <div className="ov-aumentos-hueco" />;
  return (
    <section className={clases('ov-aumentos', saliendo && 'saliendo')} aria-label={t('overlay.aumentos.titulo', { campeon: valor.campeon })}>
      <div className="ov-aumentos-columnas">
        {valor.columnas.filter((c) => c.aumentos.some((a) => a.tier === 'S')).map((c) => (
          <div key={c.rareza} className={`ov-aumentos-col rareza-${c.rareza}`}>
            <h4>{t(`overlay.aumentos.rareza.${c.rareza}`)}</h4>
            <ol>
              {c.aumentos.filter((a) => a.tier === 'S').slice(0, MAX_VISIBLES).map((a) => (
                <Aumento key={a.id} a={a} />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
