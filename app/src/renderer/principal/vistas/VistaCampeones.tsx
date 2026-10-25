import { MODO_POR_DEFECTO, MODOS_JUEGO, ROLES, tieneRoles, type ModoJuego, type Rol } from '@coach/shared';
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCw, Search, ServerCrash, TriangleAlert, WifiOff, CalendarClock } from 'lucide-react';
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { t } from '../../../shared/i18n';
import type { EstadoPrincipal, RespuestaCampeones } from '../../../shared/tiposApp';
import { Aviso, Boton, Esqueleto, Insignia, Pestanas, clases } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { CambioTasa, porcentaje } from './CabeceraCampeon';
import { CabeceraVista } from './CabeceraVista';
import { DetalleCampeon } from './DetalleCampeon';
import { EstadoVacio } from './EstadoVacio';
import { formatoPosicion } from './elementosModo';
import {
  CLAVES_SOLO_CLASIFICATORIA,
  construirFilas,
  filtrarFilas,
  ordenarFilas,
  ORDEN_POR_DEFECTO,
  siguienteOrden,
  type ClaveOrden,
  type Fila,
  type FiltroRol,
  type Orden,
} from './listaCampeones';
import type { Importacion } from './VistaCampeon';

type Lista = Extract<RespuestaCampeones, { ok: true }>;

interface Props {
  estado: EstadoPrincipal | null;
  importacion: Importacion;
  onImportar: () => void;
  onCambiarOpcion: (i: number) => void;
  onCambiarRunas?: (i: number) => void;
}

interface Columna {
  clave: ClaveOrden | null;
  texto: string;
  clase: string;
}

/**
 * Columnas de la tabla según el modo: el rol solo en clasificatoria, y en Arena la posición media y el top 4
 * en lugar de las victorias (que allí son el 1.er puesto). 3.9.2: en clasificatoria, también la tasa de selección y
 * la de bloqueo (del campeón, todos sus roles), ordenables.
 */
export function columnasDe(modo: ModoJuego): Columna[] {
  const columnas: Columna[] = [
    { clave: null, texto: 'campeones.col.posicion', clase: 'col-posicion' },
    { clave: 'nombre', texto: 'campeones.col.campeon', clase: 'col-campeon' },
  ];
  if (tieneRoles(modo)) columnas.push({ clave: null, texto: 'campeones.col.rol', clase: 'col-rol' });
  columnas.push({ clave: 'tier', texto: 'campeones.col.tier', clase: 'col-tier' });
  if (modo === 'arena') {
    columnas.push(
      { clave: 'posicionMedia', texto: 'campeones.col.posicionMedia', clase: 'col-numero' },
      { clave: 'top4', texto: 'campeones.col.top4', clase: 'col-numero' },
    );
  } else {
    columnas.push({ clave: 'tasaVictoria', texto: 'campeones.col.victorias', clase: 'col-numero' });
  }
  columnas.push({ clave: 'uso', texto: 'campeones.col.uso', clase: 'col-numero' });
  if (modo === 'clasificatoria') {
    columnas.push(
      { clave: 'tasaSeleccion', texto: 'campeones.col.seleccion', clase: 'col-numero' },
      { clave: 'tasaBloqueo', texto: 'campeones.col.bloqueo', clase: 'col-numero' },
    );
  }
  columnas.push({ clave: 'partidas', texto: 'campeones.col.partidas', clase: 'col-numero' });
  return columnas;
}

const pct = (x: number) => t('formato.porcentaje', { n: porcentaje(x) });

/** Apartado «Campeones»: tier list de todos los campeones (al estilo U.GG/Blitz) y, al pulsar uno, su build. */
export function VistaCampeones({ estado, importacion, onImportar, onCambiarOpcion, onCambiarRunas }: Props) {
  // Selector de modo: clasificatoria (por rol), ARAM, ARAM: Caos y Arena (por campeón).
  const [modo, setModo] = useState<ModoJuego>(MODO_POR_DEFECTO);
  const [respuesta, setRespuesta] = useState<Lista | 'cargando' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState<FiltroRol>('TODOS');
  const [orden, setOrden] = useState<Orden>(ORDEN_POR_DEFECTO);
  const [detalle, setDetalle] = useState<{ campeon: string; rol: Rol | null } | null>(null);
  const busquedaDiferida = useDeferredValue(busqueda);

  useEffect(() => {
    let vigente = true;
    setRespuesta('cargando');
    window.coach.campeones({ modo }).then(
      (r) => vigente && setRespuesta(r.ok ? r : 'error'),
      () => vigente && setRespuesta('error'),
    );
    return () => {
      vigente = false;
    };
  }, [modo, intento]);

  const lista = typeof respuesta === 'object' ? respuesta : null;
  const todas = useMemo(
    () => (lista ? construirFilas(lista.campeones, lista.resultado.estado === 'no_disponible' ? null : lista.resultado.lista.campeones) : []),
    [lista],
  );
  const conRoles = tieneRoles(modo);
  const filas = useMemo(
    () => ordenarFilas(filtrarFilas(todas, { busqueda: busquedaDiferida, rol: conRoles ? rol : 'TODOS' }), orden),
    [todas, busquedaDiferida, rol, orden, conRoles],
  );
  const cambiarModo = (m: ModoJuego) => {
    setModo(m);
    // Las columnas de Arena no existen en los demás modos (y al revés): se vuelve al orden por tier.
    if (orden.clave === 'posicionMedia' || orden.clave === 'top4' || orden.clave === 'tasaVictoria' || CLAVES_SOLO_CLASIFICATORIA.includes(orden.clave))
      setOrden(ORDEN_POR_DEFECTO);
  };

  if (detalle) {
    return (
      <DetalleCampeon
        campeon={detalle.campeon}
        rol={detalle.rol}
        modo={modo}
        alCambiarRol={(r) => setDetalle({ ...detalle, rol: r })}
        alVolver={() => setDetalle(null)}
        estado={estado}
        importacion={importacion}
        onImportar={onImportar}
        onCambiarOpcion={onCambiarOpcion}
        onCambiarRunas={onCambiarRunas}
      />
    );
  }

  const reintentar = (
    <Boton onClick={() => setIntento((n) => n + 1)}>
      <RotateCw size={15} aria-hidden="true" />
      {t('campeones.reintentar')}
    </Boton>
  );

  let insignia = null;
  if (lista && lista.resultado.estado !== 'no_disponible' && lista.resultado.lista.parche) {
    const { parche } = lista.resultado.lista;
    insignia =
      lista.resultado.estado === 'sin_conexion' ? (
        <Insignia tono="aviso" icono={<WifiOff size={13} />}>
          {t('estado.sinConexion', { parche })}
        </Insignia>
      ) : (
        <Insignia tono="oro" icono={<CalendarClock size={13} />}>
          {t('estado.parche', { parche })}
        </Insignia>
      );
  }

  return (
    <div className="vista-campeones">
      <CabeceraVista titulo={t('campeones.titulo')} descripcion={t('campeones.desc')} extra={insignia} />
      <div className="campeones-modos">
        <Pestanas
          etiqueta={t('campeones.modos')}
          activa={modo}
          alCambiar={(id) => cambiarModo(id as ModoJuego)}
          opciones={MODOS_JUEGO.map((m) => ({ id: m, texto: t('modo.' + m) }))}
        />
      </div>

      {respuesta === 'error' ? (
        <EstadoVacio icono={<ServerCrash size={34} />} tono="error" titulo={t('campeones.errorTitulo')} descripcion={t('campeones.errorDesc')}>
          {reintentar}
        </EstadoVacio>
      ) : (
        <>
          {lista?.resultado.estado === 'no_disponible' && (
            <Aviso tono="aviso" accion={reintentar}>
              {t('campeones.sinServidor')}
            </Aviso>
          )}
          <div className="campeones-controles">
            <label className="campo-busqueda">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label={t('campeones.buscar')}
                placeholder={t('campeones.buscarPlaceholder')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            {conRoles && (
              <Pestanas
                etiqueta={t('campeones.roles')}
                activa={rol}
                alCambiar={(id) => setRol(id as FiltroRol)}
                opciones={[
                  { id: 'TODOS', texto: t('campeones.todos') },
                  ...ROLES.map((r) => ({ id: r, texto: t('rol.' + r) })),
                ]}
              />
            )}
            {lista && <span className="campeones-cuenta">{t('campeones.resultados', { n: filas.length })}</span>}
          </div>

          {respuesta === 'cargando' ? (
            <TablaCargando />
          ) : (
            <Tabla
              filas={filas}
              modo={modo}
              version={lista!.version}
              orden={orden}
              alOrdenar={(c) => setOrden(siguienteOrden(orden, c))}
              alAbrir={setDetalle}
            />
          )}
          {lista && filas.length === 0 && (
            <p className="texto-secundario centrado">{t('campeones.sinResultados', { busqueda: busquedaDiferida })}</p>
          )}
          <p className="campeones-leyenda">{t(modo === 'arena' ? 'campeones.leyendaArena' : conRoles ? 'campeones.leyenda' : 'campeones.leyendaSinRol')}</p>
        </>
      )}
    </div>
  );
}

function IconoOrden({ activa, orden }: { activa: boolean; orden: Orden }) {
  if (!activa) return <ChevronsUpDown size={13} className="orden-icono inactivo" aria-hidden="true" />;
  return orden.direccion === 'asc' ? (
    <ArrowUp size={13} className="orden-icono" aria-hidden="true" />
  ) : (
    <ArrowDown size={13} className="orden-icono" aria-hidden="true" />
  );
}

function Tabla({
  filas,
  modo,
  version,
  orden,
  alOrdenar,
  alAbrir,
}: {
  filas: Fila[];
  modo: ModoJuego;
  version: string;
  orden: Orden;
  alOrdenar: (c: ClaveOrden) => void;
  alAbrir: (f: { campeon: string; rol: Rol | null }) => void;
}) {
  const columnas = columnasDe(modo);
  return (
    <div className="tabla-campeones-marco">
      <table className="tabla-campeones" aria-label={t('campeones.tabla')}>
        <thead>
          <tr>
            {columnas.map(({ clave, texto, clase }) => {
              const activa = clave !== null && orden.clave === clave;
              return (
                <th
                  key={texto}
                  scope="col"
                  className={clase}
                  aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {clave ? (
                    <button
                      type="button"
                      className={clases('orden', activa && 'activa')}
                      title={t('campeones.ordenar', { columna: t(texto) })}
                      onClick={() => alOrdenar(clave)}
                    >
                      {t(texto)}
                      <IconoOrden activa={activa} orden={orden} />
                    </button>
                  ) : (
                    t(texto)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <FilaCampeon
              key={`${f.campeon.id}-${f.entrada ? (f.entrada.rol ?? 'modo') : 'sin'}${f.sinDatosEnRol ? '-rol' : ''}`}
              fila={f}
              posicion={i + 1}
              version={version}
              columnas={columnas.length}
              arena={modo === 'arena'}
              tasas={modo === 'clasificatoria'}
              alAbrir={alAbrir}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fila memorizada: al escribir en la búsqueda o cambiar de orden solo se repintan las filas que cambian. */
const FilaCampeon = memo(function FilaCampeon({
  fila,
  posicion,
  version,
  columnas,
  arena,
  tasas = false,
  alAbrir,
}: {
  fila: Fila;
  posicion: number;
  version: string;
  /** Número de columnas de la tabla (para la celda «sin datos»). */
  columnas: number;
  arena: boolean;
  /** 3.9.2: columnas de selección y bloqueo (clasificatoria). */
  tasas?: boolean;
  alAbrir: (f: { campeon: string; rol: Rol | null }) => void;
}) {
  const { campeon, entrada } = fila;
  const icono = <IconoDDragon tipo="campeon" id={campeon.id} version={version} nombre={campeon.nombre} tamano={36} />;
  if (!entrada) {
    return (
      <tr className="sin-datos" data-campeon={campeon.id}>
        <td className="col-posicion">–</td>
        <td className="col-campeon">
          <span className="celda-campeon">
            {icono}
            <span className="nombre-campeon">{campeon.nombre}</span>
          </span>
        </td>
        <td colSpan={columnas - 2} className="celda-sin-datos">
          {t(fila.sinDatosEnRol ? 'campeones.sinDatosRol' : 'campeones.sinDatos')}
        </td>
      </tr>
    );
  }
  const abrir = () => alAbrir({ campeon: campeon.id, rol: entrada.rol });
  return (
    <tr className="con-datos" data-campeon={campeon.id} onClick={abrir}>
      <td className="col-posicion">{posicion}</td>
      <td className="col-campeon">
        <span className="celda-campeon">
          {icono}
          <button
            type="button"
            className="nombre-campeon"
            aria-label={
              entrada.rol
                ? t('campeones.verBuild', { campeon: campeon.nombre, rol: t('rol.' + entrada.rol) })
                : t('campeones.verBuildModo', { campeon: campeon.nombre })
            }
            onClick={(e) => {
              e.stopPropagation();
              abrir();
            }}
          >
            {campeon.nombre}
          </button>
          {entrada.datosLimitados && (
            <span className="dato-limitado" title={t('campeones.datosLimitados')}>
              <TriangleAlert size={13} aria-hidden="true" />
            </span>
          )}
        </span>
      </td>
      {entrada.rol && <td className="col-rol">{t('rol.' + entrada.rol)}</td>}
      <td className="col-tier">
        <span className={`tier tier-${entrada.tier}`} aria-label={t('campeones.tier', { tier: entrada.tier })}>
          {entrada.tier}
        </span>
      </td>
      {arena ? (
        <>
          <td className={clases('col-numero', (entrada.posicionMedia ?? 8) <= 4.5 ? 'positivo' : 'bajo')}>
            {entrada.posicionMedia !== undefined ? formatoPosicion(entrada.posicionMedia) : '–'}
          </td>
          <td className="col-numero">{entrada.top4 !== undefined ? pct(entrada.top4) : '–'}</td>
        </>
      ) : (
        <td className={clases('col-numero', entrada.tasaVictoria >= 0.5 ? 'positivo' : 'bajo')}>
          {pct(entrada.tasaVictoria)}
          <CambioTasa cambio={entrada.cambioTasaVictoria} />
        </td>
      )}
      <td className="col-numero">{pct(entrada.uso)}</td>
      {tasas && (
        <>
          <td className="col-numero">{entrada.tasaSeleccion !== undefined ? pct(entrada.tasaSeleccion) : '–'}</td>
          <td className="col-numero">{entrada.tasaBloqueo !== undefined ? pct(entrada.tasaBloqueo) : '–'}</td>
        </>
      )}
      <td className="col-numero">{entrada.partidas}</td>
    </tr>
  );
});

function TablaCargando() {
  return (
    <div className="tabla-campeones-marco cargando" aria-busy="true">
      <span className="solo-lectores">{t('campeones.cargando')}</span>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="fila-esqueleto" aria-hidden="true">
          <Esqueleto ancho={20} alto={12} />
          <Esqueleto ancho={36} alto={36} />
          <Esqueleto ancho="22%" alto={12} />
          <Esqueleto ancho={28} alto={28} />
          <Esqueleto ancho="12%" alto={12} />
          <Esqueleto ancho="10%" alto={12} />
        </div>
      ))}
    </div>
  );
}
