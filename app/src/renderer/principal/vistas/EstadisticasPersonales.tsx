import { ArrowDown, ArrowUp, ChartNoAxesColumn } from 'lucide-react';
import { ROLES, type Rol } from '@coach/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { Perfil } from '../../../shared/perfil';
import { MINIMO_PARTIDAS_PERSONAL, type CampeonTierPersonal, type CrucePersonal, type EstadisticasPersonales, type RivalPersonal } from '../../../shared/personal';
import { clases, Insignia, Pestanas, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { EstadoVacio } from './EstadoVacio';

/*
 * 3.9: «Tus estadísticas» del Perfil: tus counters, tu tier list y tus peores rivales (lo que U.GG cobra como
 * «Personal Counters & Stats» y «Personal Tier List»), calculados en este PC con tu propio historial
 * ('coach:personal-stats'). Tablas ordenables, con iconos de campeón y filtro de rol.
 */

export type TablaPersonal = 'tierList' | 'counters' | 'rivales';
type FiltroRol = Rol | 'todos';

const numero = (n: number, decimales = 0) => n.toLocaleString(localeActual(), { maximumFractionDigits: decimales, minimumFractionDigits: decimales });
const porcentaje = (n: number) => t('formato.porcentaje', { n: Math.round(n * 100) });

function Campeon({ perfil, id }: { perfil: Perfil; id: number }) {
  const dd = perfil.campeonesDD[id];
  return (
    <span className="personal-campeon">
      <IconoDDragon tipo="campeon" id={dd?.id ?? ''} version={perfil.version} nombre={dd?.nombre ?? String(id)} tamano={28} />
      <span>{dd?.nombre ?? String(id)}</span>
    </span>
  );
}

/** Nota 0–100 con el mismo color que el resto del Perfil (nunca rojo). */
function NotaPersonal({ valor }: { valor: number }) {
  const tono = valor >= 70 ? 'alta' : valor >= 50 ? 'media' : 'baja';
  return (
    <span className={clases('nota-perfil', `nota-${tono}`)} title={t('perfil.nota.titulo')}>
      {Math.round(valor)}
    </span>
  );
}

function Winrate({ valor, pocas }: { valor: number; pocas: boolean }) {
  return (
    <span className="personal-winrate">
      <span className={clases(valor >= 0.55 ? 'bien' : valor < 0.45 && 'mal')}>{porcentaje(valor)}</span>
      {pocas && <Insignia tono="aviso">{t('personal.pocas')}</Insignia>}
    </span>
  );
}

interface Columna<F> {
  id: string;
  titulo: string;
  /** Valor para ordenar (sin él, la columna no se ordena). */
  valor?: (f: F) => number | string;
  pintar: (f: F) => ReactNode;
  numerica?: boolean;
}

/** Tabla ordenable: al pulsar una cabecera se ordena por ella; otra vez, al revés. */
export function TablaOrdenable<F>({ filas, columnas, clave, inicial, etiqueta }: { filas: F[]; columnas: Columna<F>[]; clave: (f: F) => string; inicial: { id: string; asc: boolean }; etiqueta: string }) {
  const [orden, setOrden] = useState(inicial);
  const ordenadas = useMemo(() => {
    const col = columnas.find((c) => c.id === orden.id);
    if (!col?.valor) return filas;
    const v = col.valor;
    return [...filas].sort((a, b) => {
      const x = v(a);
      const y = v(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), localeActual());
      return orden.asc ? r : -r;
    });
  }, [filas, columnas, orden]);
  return (
    <div className="personal-tabla-marco">
      <table className="personal-tabla" aria-label={etiqueta}>
        <thead>
          <tr>
            {columnas.map((c) => {
              const activa = orden.id === c.id;
              return (
                <th key={c.id} scope="col" className={clases(c.numerica && 'num')} aria-sort={activa ? (orden.asc ? 'ascending' : 'descending') : undefined}>
                  {c.valor ? (
                    <button type="button" className={clases('personal-orden', activa && 'activo')} onClick={() => setOrden(activa ? { id: c.id, asc: !orden.asc } : { id: c.id, asc: !c.numerica })}>
                      {c.titulo}
                      {activa && (orden.asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => (
            <tr key={clave(f)}>
              {columnas.map((c) => (
                <td key={c.id} className={clases(c.numerica && 'num')}>
                  {c.pintar(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const colRol = <F extends { rol: Rol }>(): Columna<F> => ({ id: 'rol', titulo: t('personal.col.rol'), valor: (f) => ROLES.indexOf(f.rol), pintar: (f) => t(`rol.${f.rol}`) });
const colPartidas = <F extends { partidas: number }>(): Columna<F> => ({ id: 'partidas', titulo: t('personal.col.partidas'), valor: (f) => f.partidas, pintar: (f) => f.partidas, numerica: true });
const colWinrate = <F extends { winrate: number; pocas: boolean }>(): Columna<F> => ({
  id: 'winrate',
  titulo: t('personal.col.winrate'),
  valor: (f) => f.winrate,
  pintar: (f) => <Winrate valor={f.winrate} pocas={f.pocas} />,
  numerica: true,
});
const colNota = <F extends { nota: number }>(titulo = t('personal.col.nota')): Columna<F> => ({ id: 'nota', titulo, valor: (f) => f.nota, pintar: (f) => <NotaPersonal valor={f.nota} />, numerica: true });

function TablaTier({ perfil, filas }: { perfil: Perfil; filas: CampeonTierPersonal[] }) {
  const columnas: Columna<CampeonTierPersonal>[] = [
    { id: 'tier', titulo: t('personal.col.tier'), valor: (f) => f.puntos, pintar: (f) => <span className={`personal-tier tier-${f.tier}`} title={t('personal.tier.puntos', { n: numero(f.puntos, 1) })}>{f.tier}</span>, numerica: true },
    { id: 'campeon', titulo: t('personal.col.campeon'), valor: (f) => perfil.campeonesDD[f.campeonId]?.nombre ?? String(f.campeonId), pintar: (f) => <Campeon perfil={perfil} id={f.campeonId} /> },
    colRol(),
    colPartidas(),
    colWinrate(),
    { id: 'kda', titulo: t('personal.col.kda'), valor: (f) => f.kda, pintar: (f) => numero(f.kda, 2), numerica: true },
    colNota(),
  ];
  return <TablaOrdenable filas={filas} columnas={columnas} clave={(f) => `${f.campeonId}-${f.rol}`} inicial={{ id: 'tier', asc: false }} etiqueta={t('personal.tabla.tierList')} />;
}

function TablaCounters({ perfil, filas }: { perfil: Perfil; filas: CrucePersonal[] }) {
  const columnas: Columna<CrucePersonal>[] = [
    { id: 'campeon', titulo: t('personal.col.tuCampeon'), valor: (f) => perfil.campeonesDD[f.campeonId]?.nombre ?? String(f.campeonId), pintar: (f) => <Campeon perfil={perfil} id={f.campeonId} /> },
    { id: 'rival', titulo: t('personal.col.rival'), valor: (f) => perfil.campeonesDD[f.rivalId]?.nombre ?? String(f.rivalId), pintar: (f) => <Campeon perfil={perfil} id={f.rivalId} /> },
    colRol(),
    colPartidas(),
    colWinrate(),
    colNota(),
  ];
  return <TablaOrdenable filas={filas} columnas={columnas} clave={(f) => `${f.campeonId}-${f.rivalId}-${f.rol}`} inicial={{ id: 'winrate', asc: true }} etiqueta={t('personal.tabla.counters')} />;
}

function TablaRivales({ perfil, filas }: { perfil: Perfil; filas: RivalPersonal[] }) {
  const columnas: Columna<RivalPersonal>[] = [
    { id: 'rival', titulo: t('personal.col.rival'), valor: (f) => perfil.campeonesDD[f.rivalId]?.nombre ?? String(f.rivalId), pintar: (f) => <Campeon perfil={perfil} id={f.rivalId} /> },
    colRol(),
    colPartidas(),
    { id: 'derrotas', titulo: t('personal.col.vd'), valor: (f) => f.derrotas, pintar: (f) => t('perfil.victoriasDerrotas', { v: f.victorias, d: f.derrotas }), numerica: true },
    colWinrate(),
    colNota(t('personal.col.tuNota')),
  ];
  return <TablaOrdenable filas={filas} columnas={columnas} clave={(f) => `${f.rivalId}-${f.rol}`} inicial={{ id: 'winrate', asc: true }} etiqueta={t('personal.tabla.rivales')} />;
}

/** Filas de una tabla con el filtro de rol. */
export function filtrarPorRol<F extends { rol: Rol }>(filas: F[], rol: FiltroRol): F[] {
  return rol === 'todos' ? filas : filas.filter((f) => f.rol === rol);
}

/** Texto del estado vacío: cuántas partidas faltan (o que con ese rol aún no hay). */
export function textoVacio(e: EstadisticasPersonales, tabla: TablaPersonal, rol: FiltroRol): string {
  const faltan = e.faltan[tabla];
  if (faltan > 0) return t(`personal.vacio.${tabla}`, { n: faltan, minimo: MINIMO_PARTIDAS_PERSONAL });
  return t('personal.vacio.rol', { rol: rol === 'todos' ? t('personal.rol.todos') : t(`rol.${rol}`), minimo: MINIMO_PARTIDAS_PERSONAL });
}

export function TarjetaEstadisticasPersonales({ perfil }: { perfil: Perfil }) {
  const [datos, setDatos] = useState<EstadisticasPersonales | null>(null);
  const [tabla, setTabla] = useState<TablaPersonal>('tierList');
  const [rol, setRol] = useState<FiltroRol>('todos');

  // Se vuelve a pedir cada vez que cambia el perfil (partidas nuevas, otra cuenta…).
  useEffect(() => {
    let vivo = true;
    void window.coach.estadisticasPersonales?.().then(
      (r) => vivo && setDatos(r.estadisticas),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [perfil]);

  if (!datos) return null;
  const filas = tabla === 'tierList' ? filtrarPorRol(datos.tierList, rol) : tabla === 'counters' ? filtrarPorRol(datos.counters, rol) : filtrarPorRol(datos.peoresRivales, rol);
  const sinNada = !datos.tierList.length && !datos.counters.length && !datos.peoresRivales.length;

  return (
    <Tarjeta titulo={t('personal.titulo')} icono={<ChartNoAxesColumn size={15} />} className="perfil-personal" extra={<Insignia tono="oro">{t('personal.gratis')}</Insignia>}>
      <p className="texto-secundario">{t('personal.desc', { n: datos.partidas })}</p>
      {sinNada ? (
        <EstadoVacio icono={<ChartNoAxesColumn size={28} />} titulo={t('personal.vacio.titulo')} descripcion={t('personal.vacio.desc', { n: datos.faltan.tierList, minimo: MINIMO_PARTIDAS_PERSONAL, partidas: datos.partidas })} />
      ) : (
        <>
          <div className="personal-controles">
            <Pestanas
              etiqueta={t('personal.tabla.etiqueta')}
              activa={tabla}
              alCambiar={(id) => setTabla(id as TablaPersonal)}
              opciones={(['tierList', 'counters', 'rivales'] as TablaPersonal[]).map((id) => ({ id, texto: t(`personal.tabla.${id}`) }))}
            />
            <div className="personal-roles" role="group" aria-label={t('personal.filtroRol')}>
              {(['todos', ...ROLES] as FiltroRol[]).map((r) => (
                <button key={r} type="button" className={clases('chip', rol === r && 'activo')} aria-pressed={rol === r} onClick={() => setRol(r)}>
                  {r === 'todos' ? t('personal.rol.todos') : t(`rol.${r}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="texto-secundario personal-ayuda">{t(`personal.ayuda.${tabla}`)}</p>
          {filas.length ? (
            tabla === 'tierList' ? (
              <TablaTier perfil={perfil} filas={filas as CampeonTierPersonal[]} />
            ) : tabla === 'counters' ? (
              <TablaCounters perfil={perfil} filas={filas as CrucePersonal[]} />
            ) : (
              <TablaRivales perfil={perfil} filas={filas as RivalPersonal[]} />
            )
          ) : (
            <p className="texto-secundario personal-vacio">{textoVacio(datos, tabla, rol)}</p>
          )}
        </>
      )}
      <p className="nota-privacidad-ia personal-privacidad">{t('personal.privacidad')}</p>
    </Tarjeta>
  );
}
