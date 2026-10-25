import type { Rol } from '@coach/shared';
import { ArrowDownUp, Check, Download, LoaderCircle, Swords, ThumbsUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { CountersVista, EstadoEnfrentamientos, LineaEnfrentamientoVista, LineaSinergiaVista, ResultadoImportar, SinergiasVista } from '../../../shared/tiposApp';
import { Aviso, Boton, clases, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { porcentaje } from './CabeceraCampeon';
import { mensajeImportacion } from './VistaCampeon';

/*
 * 3.9 «Counters»: enfrentamientos de línea (datos agregados de partidas de clasificatoria terminadas). Solo en la
 * ventana principal, antes de la partida: nunca en el overlay (normas de Riot).
 */

/** Puntuación con signo (+12,5 / −3), en el idioma de la app. */
export function textoPuntuacion(p: number): string {
  const n = Math.abs(p).toLocaleString(localeActual(), { maximumFractionDigits: 1 });
  return p > 0 ? `+${n}` : p < 0 ? `−${n}` : n;
}

/** 3.9.1: fase de líneas (más oro al minuto 14) y puntuación del cruce, si el servidor las da. */
function CifrasFase({ l }: { l: LineaEnfrentamientoVista }) {
  if (l.tasaFaseLineas === undefined) return null;
  return (
    <span className="enfrentamiento-fase">
      <span title={t('enfrentamientos.faseAyuda', { partidas: l.partidasFaseLineas ?? 0 })}>
        {t('enfrentamientos.fase', { porcentaje: porcentaje(l.tasaFaseLineas) })}
      </span>
      {l.puntuacion !== undefined && (
        <b className={clases('enfrentamiento-puntuacion', l.puntuacion >= 0 ? 'bueno' : 'malo')} title={t('enfrentamientos.puntuacionAyuda')}>
          {t('enfrentamientos.puntuacion', { puntuacion: textoPuntuacion(l.puntuacion) })}
        </b>
      )}
    </span>
  );
}

/** Una fila: icono, nombre, tu % de victorias y las partidas que lo respaldan (y, con datos, la fase de líneas). */
function FilaEnfrentamiento({ l, version }: { l: LineaEnfrentamientoVista; version: string }) {
  const tono = l.tasaVictoria >= 0.5 ? 'bueno' : 'malo';
  return (
    <li className="enfrentamiento-fila">
      <IconoDDragon tipo="campeon" id={l.campeon.id} version={version} nombre={l.campeon.nombre} tamano={32} />
      <span className="enfrentamiento-nombre">{l.campeon.nombre}</span>
      <CifrasFase l={l} />
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

type Orden = 'tasa' | 'partidas' | 'fase' | 'puntuacion';

/**
 * «Ver todos»: todos los rivales de línea, ordenables por tu % de victorias o por partidas; 3.9.1: también por fase de
 * líneas y por puntuación si algún cruce las tiene (los que no, al final).
 */
function ListaCompleta({ todos, version }: { todos: LineaEnfrentamientoVista[]; version: string }) {
  const [orden, setOrden] = useState<Orden>('tasa');
  const [ascendente, setAscendente] = useState(false);
  const conFase = todos.some((l) => l.tasaFaseLineas !== undefined);
  const conPuntuacion = todos.some((l) => l.puntuacion !== undefined);
  const ordenes: Orden[] = ['tasa', 'partidas', ...(conFase ? (['fase'] as const) : []), ...(conPuntuacion ? (['puntuacion'] as const) : [])];
  const valor = (l: LineaEnfrentamientoVista): number | undefined =>
    orden === 'tasa' ? l.tasaVictoria : orden === 'partidas' ? l.partidas : orden === 'fase' ? l.tasaFaseLineas : l.puntuacion;
  const clave = (l: LineaEnfrentamientoVista) => valor(l) ?? (ascendente ? Infinity : -Infinity);
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
        {ordenes.map((o) => (
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

/** 3.9.1: un compañero: icono, nombre, tu % de victorias con él y las partidas. */
function FilaSinergia({ a, version }: { a: LineaSinergiaVista; version: string }) {
  return (
    <li className="enfrentamiento-fila">
      <IconoDDragon tipo="campeon" id={a.campeon.id} version={version} nombre={a.campeon.nombre} tamano={28} />
      <span className="enfrentamiento-nombre">{a.campeon.nombre}</span>
      <span className="enfrentamiento-cifras">
        <b className={clases('enfrentamiento-tasa', a.tasaVictoria >= 0.5 ? 'bueno' : 'malo')}>{t('enfrentamientos.tasa', { porcentaje: porcentaje(a.tasaVictoria) })}</b>
        <span className="texto-secundario">
          {t('enfrentamientos.partidas', { partidas: a.partidas })}
          {a.datosLimitados && <span title={t('enfrentamientos.datosLimitadosAyuda')}> · {t('enfrentamientos.datosLimitados')}</span>}
        </span>
      </span>
    </li>
  );
}

/** 3.9.1: tarjeta «Sinergias»: los compañeros con los que más gana, por su rol. */
export function TarjetaSinergias({ sinergias, version }: { sinergias: SinergiasVista; version: string }) {
  if (sinergias.porRol.length === 0) return null;
  return (
    <Tarjeta
      titulo={t('sinergias.titulo')}
      icono={<Users size={15} />}
      className="tarjeta-sinergias"
      extra={<span className="texto-secundario">{t('estado.parche', { parche: sinergias.parche })}</span>}
    >
      <div className="sinergias-roles">
        {sinergias.porRol.map((g) => (
          <div key={g.rol} className="enfrentamientos-columna">
            <h4>{t(`rol.${g.rol}`)}</h4>
            <ol aria-label={t('sinergias.conRol', { rol: t(`rol.${g.rol}`) })}>
              {g.aliados.map((a) => (
                <FilaSinergia key={a.campeon.id} a={a} version={version} />
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="enfrentamientos-pie texto-secundario">{t('sinergias.pie')}</p>
    </Tarjeta>
  );
}

/** 3.9.1: pide las sinergias del campeón y rol ('coach:sinergias') y pinta la tarjeta si hay datos. */
export function TarjetaSinergiasDe({ campeon, rol, version, intento = 0 }: { campeon: string; rol: Rol; version: string; intento?: number }) {
  const [sinergias, setSinergias] = useState<SinergiasVista | null>(null);
  useEffect(() => {
    let vigente = true;
    setSinergias(null);
    const pedir = window.coach?.sinergias;
    if (!pedir) return;
    pedir(campeon, rol).then(
      (r) => vigente && setSinergias(r.ok ? r.sinergias : null),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [campeon, rol, intento]);
  return sinergias ? <TarjetaSinergias sinergias={sinergias} version={version} /> : null;
}
