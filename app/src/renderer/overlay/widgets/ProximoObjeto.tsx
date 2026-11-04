import { Check, ShoppingBag } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { EstadoOverlay } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';

type Compra = NonNullable<EstadoOverlay['compra']>;

/**
 * Widget «Siguiente objeto»: siempre a la vista durante la partida, con el siguiente objeto de la build, sus componentes
 * (los que ya tienes, marcados) y lo que toca comprar ya con tu oro, resaltado. Se actualiza con cada estado de la
 * partida, así que cambia solo al comprar o al juntar oro.
 */
export function ProximoObjeto({ compra, version }: { compra: Compra | null; version: string }) {
  if (!compra) return null;
  const componentes = compra.componentes ?? [];
  const pieza = compra.pieza ?? (compra.puedeComprar ? compra.id : null);
  const objetoListo = pieza === compra.id;
  // Solo se resalta un componente aunque la receta lleve dos iguales (p. ej., dos Espadas largas).
  const indicePieza = pieza !== null && !objetoListo ? componentes.findIndex((c) => !c.tengo && c.id === pieza) : -1;
  const componentePieza = indicePieza >= 0 ? componentes[indicePieza] : undefined;
  const falta = compra.oro !== undefined ? Math.max(0, compra.coste - compra.oro) : null;

  let estadoTexto: string;
  if (objetoListo) estadoTexto = t('overlay.proximoObjeto.listo');
  else if (componentePieza) estadoTexto = t('overlay.proximoObjeto.compraYa', { objeto: componentePieza.nombre });
  else if (falta !== null) estadoTexto = t('overlay.proximoObjeto.faltan', { oro: falta });
  else estadoTexto = t('overlay.proximoObjeto.coste', { oro: compra.coste });

  const icono = (id: number, nombre: string, tamano: number) =>
    version ? <IconoDDragon tipo="objeto" id={id} version={version} nombre={nombre} tamano={tamano} /> : <ShoppingBag size={Math.round(tamano / 2)} />;

  return (
    <div className={clases('ov-proximo', objetoListo && 'listo')} role="status" aria-live="polite">
      <div className="ov-proximo-cabecera">
        <span className={clases('ov-proximo-icono', objetoListo && 'resaltado')} aria-hidden="true">
          {icono(compra.id, compra.nombre, 32)}
        </span>
        <span className="ov-proximo-textos">
          <span className="ov-proximo-etiqueta">{t('overlay.proximoObjeto.titulo')}</span>
          <span className="ov-proximo-nombre">{compra.nombre}</span>
          <span className={clases('ov-proximo-estado', pieza !== null && 'ok')}>{estadoTexto}</span>
        </span>
      </div>
      {componentes.length > 0 && (
        <ul className="ov-proximo-componentes" aria-label={t('overlay.proximoObjeto.componentes')}>
          {componentes.map((c, i) => (
            <li
              key={`${c.id}-${i}`}
              className={clases('ov-proximo-componente', c.tengo && 'tengo', i === indicePieza && 'resaltado')}
              title={c.tengo ? t('overlay.proximoObjeto.tienes', { objeto: c.nombre }) : `${c.nombre} · ${c.coste}`}
              aria-label={c.tengo ? t('overlay.proximoObjeto.tienes', { objeto: c.nombre }) : `${c.nombre} · ${c.coste}`}
            >
              <span className="ov-proximo-mini" aria-hidden="true">
                {icono(c.id, c.nombre, 22)}
                {c.tengo && (
                  <span className="ov-proximo-check">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="ov-proximo-precio" aria-hidden="true">{c.tengo ? '✓' : c.coste}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
