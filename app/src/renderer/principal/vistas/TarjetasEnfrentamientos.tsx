import { ArrowDownUp, Check, Download, LoaderCircle, Swords, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../shared/i18n';
import type { CountersVista, EstadoEnfrentamientos, LineaEnfrentamientoVista, ResultadoImportar } from '../../../shared/tiposApp';
import { Aviso, Boton, clases, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { porcentaje } from './CabeceraCampeon';
import { mensajeImportacion } from './VistaCampeon';

/*
 * 3.9 «Counters»: enfrentamientos de línea (datos agregados de partidas de clasificatoria terminadas). Solo en la
 * ventana principal, antes de la partida: nunca en el overlay (normas de Riot).
 */

/** Una fila: icono, nombre, tu % de victorias y las partidas que lo respaldan. */
function FilaEnfrentamiento({ l, version }: { l: LineaEnfrentamientoVista; version: string }) {
  const tono = l.tasaVictoria >= 0.5 ? 'bueno' : 'malo';
  return (
    <li className="enfrentamiento-fila">
      <IconoDDragon tipo="campeon" id={l.campeon.id} version={version} nombre={l.campeon.nombre} tamano={32} />
      <span className="enfrentamiento-nombre">{l.campeon.nombre}</span>
      <span className="enfrentamiento-cifras">
        <b className={clases('enfrentamiento-tasa', tono)}>{t('enfrentamientos.tasa', { porcentaje: porcentaje(l.tasaVictoria) })}</b>
        <span className="texto-secundario">
          {t('enfrentamientos.partidas', { partidas: l.partidas })}
          {l.datosLimitados && <span title={t('enfrentamientos.datosLimitadosAyuda')}> · {t('enfrentamientos.datosLimitados')}</span>}
        </span>
      </span>
    </li>
  );
}

function Columna({ titulo, lineas, version, vacio }: { titulo: string; lineas: LineaEnfrentamientoVista[]; version: string; vacio: string }) {
  return (
    <div className="enfrentamientos-columna">
      <h4>{titulo}</h4>
      {lineas.length === 0 ? (
        <p className="texto-secundario">{vacio}</p>
      ) : (
        <ol aria-label={titulo}>
          {lineas.map((l) => (
            <FilaEnfrentamiento key={l.campeon.id} l={l} version={version} />
          ))}
        </ol>
      )}
    </div>
  );
}

type Orden = 'tasa' | 'partidas';

/** «Ver todos»: todos los rivales de línea, ordenables por tu % de victorias o por partidas. */
function ListaCompleta({ todos, version }: { todos: LineaEnfrentamientoVista[]; version: string }) {
  const [orden, setOrden] = useState<Orden>('tasa');
  const [ascendente, setAscendente] = useState(false);
  const clave = (l: LineaEnfrentamientoVista) => (orden === 'tasa' ? l.tasaVictoria : l.partidas);
  const ordenada = [...todos].sort((a, b) => (ascendente ? clave(a) - clave(b) : clave(b) - clave(a)) || a.campeon.nombre.localeCompare(b.campeon.nombre));
  const elegir = (o: Orden) => {
    if (o === orden) setAscendente((x) => !x);
    else {
      setOrden(o);
      setAscendente(false);
    }
  };
  return (
    <div className="enfrentamientos-todos">
      <div className="enfrentamientos-orden" role="group" aria-label={t('enfrentamientos.ordenar')}>
        <ArrowDownUp size={14} aria-hidden="true" />
        {(['tasa', 'partidas'] as const).map((o) => (
          <Boton key={o} variante={orden === o ? 'primario' : 'fantasma'} className="boton-pequeno" aria-pressed={orden === o} onClick={() => elegir(o)}>
            {t(`enfrentamientos.orden.${o}`)}
          </Boton>
        ))}
      </div>
      <ol className="enfrentamientos-lista-completa" aria-label={t('enfrentamientos.todos')}>
        {ordenada.map((l) => (
          <FilaEnfrentamiento key={l.campeon.id} l={l} version={version} />
        ))}
      </ol>
    </div>
  );
}

/** Tarjeta «Enfrentamientos»: «Te cuesta» y «Te va bien», con «Ver todos». */
export function TarjetaEnfrentamientos({ counters, version }: { counters: CountersVista; version: string }) {
  const [verTodos, setVerTodos] = useState(false);
  const hayMas = counters.todos.length > counters.faciles.length + counters.dificiles.length;
  return (
    <Tarjeta
      titulo={t('enfrentamientos.titulo')}
      icono={<Swords size={15} />}
      className="tarjeta-enfrentamientos"
      extra={<span className="texto-secundario">{t('enfrentamientos.base', { partidas: counters.partidas, parche: counters.parche })}</span>}
    >
      {verTodos ? (
        <ListaCompleta todos={counters.todos} version={version} />
      ) : (
        <div className="enfrentamientos-columnas">
          <Columna titulo={t('enfrentamientos.teCuesta')} lineas={counters.dificiles} version={version} vacio={t('enfrentamientos.ninguno')} />
          <Columna titulo={t('enfrentamientos.teVaBien')} lineas={counters.faciles} version={version} vacio={t('enfrentamientos.ninguno')} />
        </div>
      )}
      {(hayMas || verTodos) && counters.todos.length > 0 && (
        <Boton variante="fantasma" className="boton-pequeno enfrentamientos-ver-todos" aria-expanded={verTodos} onClick={() => setVerTodos((x) => !x)}>
          {verTodos ? t('enfrentamientos.verMenos') : t('enfrentamientos.verTodos', { n: counters.todos.length })}
        </Boton>
      )}
      <p className="enfrentamientos-pie texto-secundario">{t('enfrentamientos.pie')}</p>
    </Tarjeta>
  );
}

/** Tarjeta destacada «Contra {rival}»: tu % en el cruce, las partidas y la build del cruce (importable). */
export function TarjetaContraRival({
  enfrentamientos,
  version,
  alImportar,
}: {
  enfrentamientos: EstadoEnfrentamientos;
  version: string;
  alImportar?: () => Promise<ResultadoImportar>;
}) {
  const [importacion, setImportacion] = useState<ResultadoImportar | 'importando' | null>(null);
  const { rival, contra } = enfrentamientos;
  if (!rival) return null;
  const build = contra?.build;
  const recursos = contra?.recursos;
  const importar = async () => {
    if (!alImportar) return;
    setImportacion('importando');
    try {
      setImportacion(await alImportar());
    } catch {
      setImportacion({ runas: { ok: false, motivo: 'error' }, hechizos: { ok: false, motivo: 'error' }, objetos: { ok: false, motivo: 'error' } });
    }
  };
  const mensaje = importacion && importacion !== 'importando' ? mensajeImportacion(importacion) : null;
  const hecho = mensaje?.tono === 'exito';
  return (
    <Tarjeta
      titulo={t('enfrentamientos.contra', { rival: rival.nombre })}
      icono={<IconoDDragon tipo="campeon" id={rival.id} version={version} nombre={rival.nombre} tamano={22} />}
      className="tarjeta-contra-rival"
      extra={rival.inferido ? <span className="texto-secundario" title={t('enfrentamientos.inferidoAyuda')}>{t('enfrentamientos.inferido')}</span> : undefined}
    >
      {contra ? (
        <div className="contra-cifras">
          <b className={clases('contra-tasa', contra.tasaVictoria >= 0.5 ? 'bueno' : 'malo')}>
            {t('enfrentamientos.tasa', { porcentaje: porcentaje(contra.tasaVictoria) })}
          </b>
          <span>
            {t('enfrentamientos.tuTasa', { partidas: contra.partidas })}
            {contra.datosLimitados && <span className="texto-secundario"> · {t('enfrentamientos.datosLimitados')}</span>}
          </span>
        </div>
      ) : (
        <p className="texto-secundario">{t('enfrentamientos.sinDatosCruce')}</p>
      )}
      {build && recursos && (
        <div className="contra-build">
          <h4>{t('enfrentamientos.buildCruce')}</h4>
          <div className="contra-build-fila">
            {build.runas.runas[0] !== undefined && recursos.runas[build.runas.runas[0]] && (
              <IconoDDragon
                tipo="runa"
                id={build.runas.runas[0]}
                version={version}
                nombre={recursos.runas[build.runas.runas[0]]!.nombre}
                imagen={recursos.runas[build.runas.runas[0]]!.icono}
                tamano={32}
              />
            )}
            {build.nucleo.map((id) => (
              <IconoDDragon key={id} tipo="objeto" id={id} version={version} nombre={recursos.objetos[id] ?? String(id)} tamano={32} />
            ))}
            <span className="texto-secundario">
              {t('enfrentamientos.buildCifras', { porcentaje: porcentaje(build.tasaVictoria), partidas: build.partidas })}
            </span>
          </div>
          {alImportar && (
            <Boton variante="primario" className={clases('boton-pequeno', hecho && 'exito')} disabled={importacion === 'importando'} onClick={() => void importar()}>
              {importacion === 'importando' ? (
                <LoaderCircle size={15} className="girando" aria-hidden="true" />
              ) : hecho ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Download size={15} aria-hidden="true" />
              )}
              {importacion === 'importando' ? t('ui.importando') : t('enfrentamientos.importarCruce')}
            </Boton>
          )}
          {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
        </div>
      )}
    </Tarjeta>
  );
}

/** Sin campeón elegido y con el rival de tu línea ya elegido: los que mejor le van contra él en tu rol. */
export function TarjetaBuenasElecciones({ enfrentamientos, version }: { enfrentamientos: EstadoEnfrentamientos; version: string }) {
  const { rival, buenasElecciones } = enfrentamientos;
  if (!rival || buenasElecciones.length === 0) return null;
  return (
    <Tarjeta
      titulo={t('enfrentamientos.buenasContra', { rival: rival.nombre })}
      icono={<ThumbsUp size={15} />}
      className="tarjeta-buenas-elecciones"
      extra={<span className="texto-secundario">{t(`rol.${enfrentamientos.rol}`)}</span>}
    >
      <ol aria-label={t('enfrentamientos.buenasContra', { rival: rival.nombre })}>
        {buenasElecciones.map((l) => (
          <FilaEnfrentamiento key={l.campeon.id} l={l} version={version} />
        ))}
      </ol>
      {rival.inferido && <p className="texto-secundario">{t('enfrentamientos.inferidoAyuda')}</p>}
    </Tarjeta>
  );
}
