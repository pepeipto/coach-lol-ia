import type { OpcionRunas } from '@coach/shared';
import { TriangleAlert } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { RecursosBuild } from '../../../shared/tiposApp';
import { Insignia, Pestanas } from '../../comun/componentes';
import { porcentaje } from './CabeceraCampeon';
import { Runa } from './TarjetaRunas';

/**
 * Pestañas de la tarjeta de runas para elegir entre las 2-3 páginas de runas (3.0.1): runa clave, rama secundaria,
 * % de victorias y partidas, y «Datos limitados» con menos de 30. Con una sola página no se muestra.
 */
export function SelectorRunas({
  opciones,
  activa,
  recursos,
  version,
  alCambiar,
}: {
  opciones: OpcionRunas[];
  activa: number;
  recursos: RecursosBuild;
  version: string;
  alCambiar: (i: number) => void;
}) {
  if (opciones.length < 2) return null;
  return (
    <div className="selector-opciones selector-runas">
      <Pestanas
        etiqueta={t('runas.paginas')}
        activa={String(activa)}
        alCambiar={(id) => alCambiar(Number(id))}
        opciones={opciones.map((o, i) => {
          const clave = o.runas.runas[0] ?? 0;
          return {
            id: String(i),
            icono: <Runa id={clave} recursos={recursos} version={version} tamano={30} clave />,
            texto: recursos.runas[clave]?.nombre ?? t('runa.desconocida'),
            contenido: (
              <span className="opcion-detalle">
                {/* La rama secundaria distingue páginas con la misma runa clave. */}
                <span className="opcion-rama">
                  <Runa id={o.runas.estiloSecundario} recursos={recursos} version={version} tamano={18} />
                  {recursos.runas[o.runas.estiloSecundario]?.nombre}
                </span>
                <span className="opcion-cifras">
                  <span>{t('opciones.victorias', { porcentaje: porcentaje(o.tasaVictoria) })}</span>
                  <span>{t('ui.partidas', { partidas: o.partidas })}</span>
                </span>
                {o.datosLimitados && (
                  <Insignia tono="aviso" icono={<TriangleAlert size={11} />}>
                    {t('datos.limitados')}
                  </Insignia>
                )}
              </span>
            ),
          };
        })}
      />
    </div>
  );
}
