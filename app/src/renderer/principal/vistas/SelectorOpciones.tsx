import type { Build } from '@coach/shared';
import { Trophy } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { RecursosBuild } from '../../../shared/tiposApp';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { Insignia, Pestanas } from '../../comun/componentes';
import { porcentaje } from './CabeceraCampeon';

/** Índice de la opción con más victorias (empate: la más jugada, que va antes). */
function masGanadora(opciones: Build[]): number {
  let mejor = 0;
  opciones.forEach((o, i) => {
    if (o.tasaVictoria > opciones[mejor]!.tasaVictoria) mejor = i;
  });
  return mejor;
}

/** Pestañas sobre las tarjetas para elegir entre las 2-3 opciones de build (núcleo, % de uso y % de victorias). */
export function SelectorOpciones({
  opciones,
  activa,
  recursos,
  version,
  alCambiar,
}: {
  opciones: Build[];
  activa: number;
  recursos: RecursosBuild;
  version: string;
  alCambiar: (i: number) => void;
}) {
  if (opciones.length < 2) return null;
  const ganadora = masGanadora(opciones);
  return (
    <div className="selector-opciones">
      <Pestanas
        etiqueta={t('opciones.titulo')}
        activa={String(activa)}
        alCambiar={(id) => alCambiar(Number(id))}
        opciones={opciones.map((o, i) => ({
          id: String(i),
          texto: t('opciones.opcion', { n: i + 1 }),
          contenido: (
            <span className="opcion-detalle">
              <span className="opcion-nucleo">
                {o.nucleo.slice(0, 3).map((id) => (
                  <IconoDDragon key={id} tipo="objeto" id={id} version={version} nombre={recursos.objetos[id] ?? String(id)} tamano={22} />
                ))}
              </span>
              <span className="opcion-cifras">
                {o.popularidad !== undefined && <span>{t('opciones.uso', { porcentaje: porcentaje(o.popularidad) })}</span>}
                <span>{t('opciones.victorias', { porcentaje: porcentaje(o.tasaVictoria) })}</span>
              </span>
              {i === ganadora && (
                <Insignia tono="exito" icono={<Trophy size={11} />}>
                  {t('opciones.masGanadora')}
                </Insignia>
              )}
            </span>
          ),
        }))}
      />
    </div>
  );
}
