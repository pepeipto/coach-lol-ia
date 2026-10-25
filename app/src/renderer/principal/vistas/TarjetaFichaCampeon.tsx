import { BookOpen, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DesgloseDanio } from '@coach/shared';
import { t } from '../../../shared/i18n';
import type { FichaVista } from '../../../shared/tiposApp';
import { Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';

/*
 * Ficha del campeón: «Información clave», «Fortalezas», «Debilidades», «Campeones parecidos» y «Desglose de daño».
 * Los textos los escribe la IA del servidor a partir de Data Dragon (una vez por parche e idioma); el daño sale de
 * partidas de clasificatoria terminadas. Es información de antes de la partida: no va en el overlay.
 */

const TIPOS = ['fisico', 'magico', 'verdadero'] as const;

const pct = (x: number) => Math.round(x * 100);

/** Barra del desglose de daño (físico, mágico y verdadero), con la leyenda en porcentajes. */
export function BarraDanio({ danio }: { danio: DesgloseDanio }) {
  const resumen = TIPOS.map((tipo) => `${t(`fichaCampeon.${tipo}`)} ${t('formato.porcentaje', { n: pct(danio[tipo]) })}`).join(' · ');
  return (
    <div className="ficha-danio">
      <h4>{t('fichaCampeon.danio')}</h4>
      <div className="ficha-danio-barra" role="img" aria-label={resumen}>
        {TIPOS.filter((tipo) => danio[tipo] > 0).map((tipo) => (
          <span key={tipo} className={`ficha-danio-${tipo}`} style={{ width: `${danio[tipo] * 100}%` }} />
        ))}
      </div>
      <ul className="ficha-danio-leyenda" aria-hidden="true">
        {TIPOS.map((tipo) => (
          <li key={tipo}>
            <span className={`ficha-danio-punto ficha-danio-${tipo}`} />
            {t(`fichaCampeon.${tipo}`)} <b>{t('formato.porcentaje', { n: pct(danio[tipo]) })}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bloque({ titulo, frases, clase }: { titulo: string; frases: string[]; clase: string }) {
  return (
    <div className={`ficha-bloque ${clase}`}>
      <h4>{titulo}</h4>
      <ul>
        {frases.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

export function TarjetaFichaCampeon({
  ficha,
  version,
  alAbrirCampeon,
}: {
  ficha: FichaVista;
  version: string;
  /** Abre la vista de un campeón parecido (id de Data Dragon); sin ella, los iconos no se pueden pulsar. */
  alAbrirCampeon?: (id: string) => void;
}) {
  return (
    <Tarjeta
      titulo={t('fichaCampeon.titulo')}
      icono={<BookOpen size={15} />}
      className="tarjeta-ficha-campeon"
      extra={ficha.sinConexion ? <span className="texto-secundario">{t('fichaCampeon.sinConexion')}</span> : undefined}
    >
      <Bloque titulo={t('fichaCampeon.claves')} frases={ficha.claves} clase="ficha-claves" />
      <div className="ficha-columnas">
        <Bloque titulo={t('fichaCampeon.fortalezas')} frases={ficha.fortalezas} clase="ficha-fortalezas" />
        <Bloque titulo={t('fichaCampeon.debilidades')} frases={ficha.debilidades} clase="ficha-debilidades" />
      </div>
      {ficha.parecidos.length > 0 && (
        <div className="ficha-parecidos">
          <h4>{t('fichaCampeon.parecidos')}</h4>
          <ul>
            {ficha.parecidos.map((c) => {
              const icono = <IconoDDragon tipo="campeon" id={c.id} version={version} nombre={c.nombre} tamano={40} />;
              return (
                <li key={c.id}>
                  {alAbrirCampeon ? (
                    <button
                      type="button"
                      className="ficha-parecido"
                      onClick={() => alAbrirCampeon(c.id)}
                      title={t('fichaCampeon.abrir', { campeon: c.nombre })}
                      aria-label={t('fichaCampeon.abrir', { campeon: c.nombre })}
                    >
                      {icono}
                      <span>{c.nombre}</span>
                    </button>
                  ) : (
                    <span className="ficha-parecido">
                      {icono}
                      <span>{c.nombre}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {ficha.danio && <BarraDanio danio={ficha.danio} />}
      <p className="ficha-pie texto-secundario">{t(ficha.danio ? 'fichaCampeon.pieDanio' : 'fichaCampeon.pie')}</p>
    </Tarjeta>
  );
}

/** Pide la ficha del campeón ('coach:ficha-campeon') y la pinta; mientras llega, un aviso de carga; sin ficha, nada. */
export function TarjetaFichaCampeonDe({
  campeon,
  version,
  alAbrirCampeon,
  intento = 0,
}: {
  campeon: string;
  version: string;
  alAbrirCampeon?: (id: string) => void;
  intento?: number;
}) {
  const [estado, setEstado] = useState<{ ficha: FichaVista; version: string } | 'cargando' | null>('cargando');
  useEffect(() => {
    let vigente = true;
    const pedir = window.coach?.fichaCampeon;
    if (!pedir) {
      setEstado(null);
      return;
    }
    setEstado('cargando');
    pedir(campeon).then(
      (r) => vigente && setEstado(r.ok ? { ficha: r.ficha, version: r.version } : null),
      () => vigente && setEstado(null),
    );
    return () => {
      vigente = false;
    };
  }, [campeon, intento]);
  if (estado === null) return null;
  if (estado === 'cargando') {
    return (
      <Tarjeta titulo={t('fichaCampeon.titulo')} icono={<BookOpen size={15} />} className="tarjeta-ficha-campeon cargando">
        <p className="texto-secundario" aria-busy="true">
          <LoaderCircle size={14} className="girando" aria-hidden="true" /> {t('fichaCampeon.cargando')}
        </p>
      </Tarjeta>
    );
  }
  return <TarjetaFichaCampeon ficha={estado.ficha} version={estado.version || version} alAbrirCampeon={alAbrirCampeon} />;
}
