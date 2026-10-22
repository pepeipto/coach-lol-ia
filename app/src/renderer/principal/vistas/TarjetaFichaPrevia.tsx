import { History, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { Perfil } from '../../../shared/perfil';
import type { EntradaAnalisis } from '../../../shared/tiposApp';
import { Tarjeta } from '../../comun/componentes';
import { Nota } from './VistaPerfil';

const numero = (n: number, d = 1) => n.toLocaleString(localeActual(), { maximumFractionDigits: d, minimumFractionDigits: d });

/**
 * 3.6: ficha previa en la selección de campeón: cómo te va con ese campeón (tus partidas guardadas), tu reto y el
 * enfoque que te dejó el último análisis. La versión visual de la charla de voz al empezar la partida.
 */
export function TarjetaFichaPrevia({ campeonKey, nombre }: { campeonKey: number; nombre: string }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [enfoque, setEnfoque] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void window.coach?.perfil?.(false).then((p) => vivo && setPerfil(p), () => undefined);
    void window.coach?.historialAnalisis?.().then((l: EntradaAnalisis[]) => vivo && setEnfoque(l[0]?.analisis.enfoque ?? null), () => undefined);
    return () => {
      vivo = false;
    };
  }, [campeonKey]);
  if (!perfil) return null;
  const c = perfil.campeones.find((x) => x.campeonId === campeonKey);
  const reto = perfil.reto && !perfil.reto.completado ? perfil.reto : null;
  if (!c && !reto && !enfoque) return null;
  return (
    <Tarjeta titulo={t('ficha.titulo', { campeon: nombre })} icono={<History size={15} />} className="tarjeta-ficha-previa">
      {c ? (
        <dl className="ficha-cifras">
          <div>
            <dt>{t('ficha.partidas')}</dt>
            <dd>{c.partidas}</dd>
          </div>
          <div>
            <dt>{t('ficha.victorias')}</dt>
            <dd>{t('formato.porcentaje', { n: Math.round((c.victorias / c.partidas) * 100) })}</dd>
          </div>
          <div>
            <dt>{t('analisis.stat.kda')}</dt>
            <dd>{numero(c.kda)}</dd>
          </div>
          <div>
            <dt>{t('perfil.tendencia.csMin')}</dt>
            <dd>{numero(c.csMin)}</dd>
          </div>
          <div>
            <dt>{t('perfil.nota.total')}</dt>
            <dd>
              <Nota valor={c.puntuacion} />
            </dd>
          </div>
        </dl>
      ) : (
        <p className="texto-secundario">{t('ficha.primera', { campeon: nombre })}</p>
      )}
      {reto && (
        <p className="ficha-linea">
          <Target size={14} aria-hidden="true" /> {t('inicio.reto', { reto: t(`perfil.reto.${reto.id}.nombre`), hechas: reto.hechas, objetivo: reto.objetivo })}
        </p>
      )}
      {enfoque && <p className="ficha-linea ficha-enfoque">{t('ficha.enfoque', { enfoque })}</p>}
    </Tarjeta>
  );
}
