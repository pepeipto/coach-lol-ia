import { BrainCircuit, ShieldCheck } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { Ajustes } from '../../../shared/tiposApp';
import { Interruptor, Tarjeta } from '../../comun/componentes';

const MAXIMOS = [1, 2, 3, 4, 5, 6, 7, 8];

/** 3.2: ajustes del coach con IA (análisis al terminar la partida y consejos en los momentos muertos). */
export function TarjetaIa({ ajustes, cambiar }: { ajustes: Ajustes; cambiar: (a: Ajustes) => void }) {
  const ia = ajustes.ia;
  const poner = (cambios: Partial<Ajustes['ia']>) => cambiar({ ...ajustes, ia: { ...ia, ...cambios } });
  return (
    <Tarjeta key="ia" titulo={t('ajustes.ia.titulo')} icono={<BrainCircuit size={15} />}>
      <p className="texto-secundario">{t('ajustes.ia.desc')}</p>
      <div className="lista-interruptores">
        <Interruptor
          etiqueta={t('ajustes.ia.analisis')}
          descripcion={t('ajustes.ia.analisisDesc')}
          marcado={ia.analisis}
          alCambiar={(v) => poner({ analisis: v })}
        />
        <Interruptor
          etiqueta={t('ajustes.ia.vozAnalisis')}
          descripcion={t('ajustes.ia.vozAnalisisDesc')}
          marcado={ia.vozAnalisis}
          deshabilitado={!ia.analisis}
          alCambiar={(v) => poner({ vozAnalisis: v })}
        />
        <Interruptor
          etiqueta={t('ajustes.ia.consejos')}
          descripcion={t('ajustes.ia.consejosDesc')}
          marcado={ia.consejos}
          alCambiar={(v) => poner({ consejos: v })}
        />
        <div className="fila-ajuste">
          <span className="interruptor-textos">
            <label className="interruptor-etiqueta" htmlFor="ajuste-max-consejos">
              {t('ajustes.ia.maxConsejos')}
            </label>
            <span className="interruptor-descripcion">{t('ajustes.ia.maxConsejosDesc')}</span>
          </span>
          <select
            id="ajuste-max-consejos"
            className="selector-idioma"
            value={ia.maxConsejos}
            disabled={!ia.consejos}
            onChange={(e) => poner({ maxConsejos: Number(e.target.value) })}
          >
            {MAXIMOS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="nota-privacidad-ia">
        <ShieldCheck size={14} aria-hidden="true" /> {t('ajustes.ia.privacidad')}
      </p>
    </Tarjeta>
  );
}
