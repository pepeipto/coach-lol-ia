import type { Build } from '@coach/shared';
import { ArrowDown, ArrowUp, ChartColumn, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../shared/i18n';
import {
  ORDEN_RENDIMIENTO_POR_DEFECTO,
  ordenarRendimiento,
  rendimientoDe,
  siguienteOrdenRendimiento,
  type ClaveRendimiento,
  type OrdenRendimiento,
} from '../../../shared/objetosBuild';
import type { RecursosBuild } from '../../../shared/tiposApp';
import { clases, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { porcentaje, textoCambio } from './CabeceraCampeon';

const COLUMNAS: { clave: ClaveRendimiento; texto: string }[] = [
  { clave: 'uso', texto: 'rendimiento.uso' },
  { clave: 'tasaVictoria', texto: 'rendimiento.victorias' },
  { clave: 'diferencia', texto: 'rendimiento.diferencia' },
];

function IconoOrden({ activa, orden }: { activa: boolean; orden: OrdenRendimiento }) {
  if (!activa) return <ChevronsUpDown size={13} className="orden-icono inactivo" aria-hidden="true" />;
  return orden.direccion === 'asc' ? <ArrowUp size={13} className="orden-icono" aria-hidden="true" /> : <ArrowDown size={13} className="orden-icono" aria-hidden="true" />;
}

/**
 * 3.10 (mejora 13): «Rendimiento de objetos» al estilo del «Item Performance» de Blitz: cada legendario del campeón
 * (y rol) con su % de uso, su % de victorias al completarlo y la diferencia frente a las partidas que no lo
 * completan, ordenable por cualquiera de las tres columnas. Solo Grieta y ARAM: en Arena, Riot no permite enseñar %
 * de victorias de objetos («Products cannot display win rates for Augments or Arena Mode items»); `rendimientoDe`
 * devuelve vacío y la tarjeta no se pinta.
 */
export function TarjetaRendimientoObjetos({ build, recursos, version }: { build: Build; recursos: RecursosBuild; version: string }) {
  const [orden, setOrden] = useState<OrdenRendimiento>(ORDEN_RENDIMIENTO_POR_DEFECTO);
  const lista = rendimientoDe(build);
  if (lista.length === 0) return null;
  const filas = ordenarRendimiento(lista, orden);
  return (
    <Tarjeta titulo={t('rendimiento.titulo')} icono={<ChartColumn size={15} />} className="tarjeta-rendimiento-objetos">
      <table className="tabla-rendimiento" aria-label={t('rendimiento.titulo')}>
        <thead>
          <tr>
            <th scope="col">{t('rendimiento.objeto')}</th>
            {COLUMNAS.map(({ clave, texto }) => {
              const activa = orden.clave === clave;
              return (
                <th key={clave} scope="col" className="col-numero" aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button
                    type="button"
                    className={clases('orden', activa && 'activa')}
                    title={t('campeones.ordenar', { columna: t(texto) })}
                    onClick={() => setOrden(siguienteOrdenRendimiento(orden, clave))}
                  >
                    {t(texto)}
                    <IconoOrden activa={activa} orden={orden} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((o) => {
            const nombre = recursos.objetos[o.id] ?? String(o.id);
            return (
              <tr key={o.id}>
                <th scope="row" className="rendimiento-objeto">
                  <IconoDDragon tipo="objeto" id={o.id} version={version} nombre={nombre} tamano={28} />
                  <span className="rendimiento-nombre">{nombre}</span>
                  {o.datosLimitados && <span className="rendimiento-limitados">{t('rendimiento.datosLimitados')}</span>}
                </th>
                <td className="col-numero">{t('formato.porcentaje', { n: porcentaje(o.uso) })}</td>
                <td className="col-numero">{t('formato.porcentaje', { n: porcentaje(o.tasaVictoria) })}</td>
                <td className={clases('col-numero', o.diferencia !== null && (o.diferencia > 0 ? 'sube' : o.diferencia < 0 ? 'baja' : null))}>
                  {o.diferencia === null ? '—' : textoCambio(o.diferencia)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tier-pie texto-secundario">{t('rendimiento.pie')}</p>
    </Tarjeta>
  );
}
