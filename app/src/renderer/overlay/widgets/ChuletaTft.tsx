import { useState } from 'react';
import { t } from '../../../shared/i18n';
import type { ElementoTftVista } from '../../../shared/tiposApp';
import type { ChuletaTftVista } from '../../../shared/tftChuleta';
import { textoAcelerador } from '../../../shared/teclas';

/** Icono de una unidad u objeto; sin icono (o si no carga), sus iniciales. */
function Icono({ e, tamano }: { e: ElementoTftVista; tamano: number }) {
  const [roto, setRoto] = useState(false);
  const estilo = { width: tamano, height: tamano };
  if (e.icono && !roto) return <img className="ov-tft-icono" src={e.icono} alt="" title={e.nombre} style={estilo} onError={() => setRoto(true)} />;
  const iniciales = e.nombre
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="ov-tft-icono texto" title={e.nombre} style={estilo}>
      {iniciales}
    </span>
  );
}

/**
 * 3.15: chuleta de TFT. Las composiciones elegidas antes de la partida (campeones y objetos del portador con su
 * receta) y la tabla de recetas de los componentes básicos. Es fija: no cambia con nada de la partida.
 */
export function ChuletaTft({ chuleta, tecla }: { chuleta: ChuletaTftVista; tecla: string }) {
  return (
    <section className="ov-tft" aria-label={t('overlay.tft.titulo')}>
      <header className="ov-tft-cabecera">
        <span>{t('overlay.tft.titulo')}</span>
        <span className="ov-tft-ayuda">{t('overlay.tft.cerrar', { tecla: textoAcelerador(tecla) })}</span>
      </header>
      {chuleta.comps.map((c) => (
        <div key={c.id} className="ov-tft-comp">
          <h4>{c.rasgos.map((r) => r.nombre).join(' + ') || c.portador.nombre}</h4>
          <ul className="ov-tft-unidades">
            {c.unidades.map((u) => (
              <li key={u.id} className={u.id === c.portador.id ? 'portador' : undefined}>
                <Icono e={u} tamano={32} />
                <span>{u.nombre}</span>
              </li>
            ))}
          </ul>
          {c.objetos.length > 0 && (
            <div className="ov-tft-objetos">
              <span className="ov-tft-etiqueta">{t('overlay.tft.objetosDe', { nombre: c.portador.nombre })}</span>
              <ul>
                {c.objetos.map((o) => (
                  <li key={o.id}>
                    <Icono e={o} tamano={26} />
                    <span className="ov-tft-nombre">{o.nombre}</span>
                    {o.receta && (
                      <span className="ov-tft-receta" aria-label={t('overlay.tft.receta', { a: o.receta[0].nombre, b: o.receta[1].nombre })}>
                        = <Icono e={o.receta[0]} tamano={20} /> + <Icono e={o.receta[1]} tamano={20} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
      <div className="ov-tft-recetas">
        <h4>{t('overlay.tft.recetas')}</h4>
        <table>
          <thead>
            <tr>
              <th />
              {chuleta.componentes.map((c) => (
                <th key={c.id} scope="col">
                  <Icono e={c} tamano={20} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chuleta.componentes.map((a, i) => (
              <tr key={a.id}>
                <th scope="row">
                  <Icono e={a} tamano={20} />
                </th>
                {chuleta.componentes.map((b, j) => {
                  const o = chuleta.tabla[i]?.[j] ?? null;
                  return <td key={b.id}>{o && <Icono e={o} tamano={20} />}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ov-tft-pie">{t('overlay.tft.pie')}</p>
    </section>
  );
}
