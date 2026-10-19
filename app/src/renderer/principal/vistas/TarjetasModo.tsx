import type { Build, EstadisticaElemento } from '@coach/shared';
import { Gem, ShoppingBag } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { t } from '../../../shared/i18n';
import type { RecursosBuild } from '../../../shared/tiposApp';
import { Aviso, Pestanas, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { porcentaje } from './CabeceraCampeon';
import { formatoPosicion, ordenarElementos, type CriterioElementos } from './elementosModo';
import { TarjetaHechizos } from './TarjetaRunas';

/** Icono de un aumento (CommunityDragon); sin icono o si falla, un hueco del mismo tamaño. */
function IconoAumento({ icono, nombre, tamano = 40 }: { icono: string | null; nombre: string; tamano?: number }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: tamano, height: tamano };
  if (!icono || fallo) return <span className="icono-dd icono-aumento hueco" style={estilo} title={nombre} />;
  return (
    <img
      className="icono-dd icono-aumento"
      src={icono}
      alt={nombre}
      title={nombre}
      style={estilo}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFallo(true)}
    />
  );
}

/** Pestañas «Más elegidos» / «Mejor posición» (Arena) o «Más ganadores» (ARAM: Caos). */
function SelectorCriterio({
  criterio,
  alCambiar,
  arena,
}: {
  criterio: CriterioElementos;
  alCambiar: (c: CriterioElementos) => void;
  arena: boolean;
}) {
  return (
    <Pestanas
      etiqueta={t('modos.ordenarPor')}
      activa={criterio}
      alCambiar={(id) => alCambiar(id as CriterioElementos)}
      opciones={[
        { id: 'uso', texto: t('modos.masElegidos') },
        { id: 'posicion', texto: t(arena ? 'modos.mejorPosicion' : 'modos.masGanadores') },
      ]}
    />
  );
}

/**
 * Lista según la pestaña: los más elegidos, o la lista aparte de los mejores que publica el servidor (por posición
 * media en Arena, por victorias en ARAM: Caos). Con un servidor anterior, en Arena se ordenan los más elegidos.
 */
function listaSegun(criterio: CriterioElementos, todos: EstadisticaElemento[], mejores: EstadisticaElemento[] | undefined, arena: boolean) {
  if (criterio === 'uso') return ordenarElementos(todos, 'uso');
  return mejores ? mejores.slice(0, 8) : arena ? ordenarElementos(todos, 'posicion') : ordenarElementos(todos, 'uso');
}

/** Cifras de una fila: uso y, según el modo, posición media (Arena) o victorias (ARAM: Caos). */
function Cifras({ e, arena }: { e: EstadisticaElemento; arena: boolean }) {
  return (
    <span className="elemento-cifras">
      <span>{t('opciones.uso', { porcentaje: porcentaje(e.uso) })}</span>
      {arena && e.posicionMedia !== null ? (
        <span>{t('modos.posicionMedia', { posicion: formatoPosicion(e.posicionMedia) })}</span>
      ) : (
        <span>{t('opciones.victorias', { porcentaje: porcentaje(e.tasaVictoria) })}</span>
      )}
    </span>
  );
}

function ListaElementos({
  elementos,
  arena,
  icono,
  nombre,
}: {
  elementos: EstadisticaElemento[];
  arena: boolean;
  icono: (e: EstadisticaElemento) => ReactNode;
  nombre: (e: EstadisticaElemento) => string;
}) {
  if (elementos.length === 0) return <p className="texto-secundario">{t('modos.sinElementos')}</p>;
  return (
    <ol className="lista-elementos">
      {elementos.map((e) => (
        <li key={e.id} className="elemento-modo">
          {icono(e)}
          <span className="elemento-textos">
            <span className="elemento-nombre">{nombre(e)}</span>
            <Cifras e={e} arena={arena} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Aumentos de ARAM: Caos o de Arena, con su icono y su nombre en español. */
export function TarjetaAumentos({
  aumentos,
  mejores,
  recursos,
  arena,
}: {
  aumentos: EstadisticaElemento[];
  mejores?: EstadisticaElemento[];
  recursos: RecursosBuild;
  arena: boolean;
}) {
  const [criterio, setCriterio] = useState<CriterioElementos>('uso');
  const conPestanas = arena || !!mejores;
  const lista = listaSegun(conPestanas ? criterio : 'uso', aumentos, mejores, arena);
  const nombre = (e: EstadisticaElemento) => recursos.aumentos?.[e.id]?.nombre ?? t('modos.aumentoDesconocido', { id: e.id });
  return (
    <Tarjeta
      titulo={t('modos.aumentos')}
      icono={<Gem size={15} />}
      className="tarjeta-aumentos"
      extra={conPestanas ? <SelectorCriterio criterio={criterio} alCambiar={setCriterio} arena={arena} /> : undefined}
    >
      <ListaElementos
        elementos={lista}
        arena={arena}
        nombre={nombre}
        icono={(e) => <IconoAumento icono={recursos.aumentos?.[e.id]?.icono ?? null} nombre={nombre(e)} />}
      />
    </Tarjeta>
  );
}

/** Objetos del inventario final en Arena, por uso o por posición media. */
export function TarjetaObjetosArena({
  objetos,
  mejores,
  recursos,
  version,
}: {
  objetos: EstadisticaElemento[];
  mejores?: EstadisticaElemento[];
  recursos: RecursosBuild;
  version: string;
}) {
  const [criterio, setCriterio] = useState<CriterioElementos>('uso');
  const nombre = (e: EstadisticaElemento) => recursos.objetos[e.id] ?? String(e.id);
  return (
    <Tarjeta
      titulo={t('modos.objetosArena')}
      icono={<ShoppingBag size={15} />}
      className="tarjeta-objetos-arena"
      extra={<SelectorCriterio criterio={criterio} alCambiar={setCriterio} arena />}
    >
      <ListaElementos
        elementos={listaSegun(criterio, objetos, mejores, true)}
        arena
        nombre={nombre}
        icono={(e) => <IconoDDragon tipo="objeto" id={e.id} version={version} nombre={nombre(e)} tamano={40} />}
      />
    </Tarjeta>
  );
}

/** Cuerpo de la build de Arena: aumentos, objetos y hechizos (Arena no tiene runas ni orden de habilidades). */
export function CuerpoArena({ build, recursos, version }: { build: Build; recursos: RecursosBuild; version: string }) {
  return (
    <>
      {build.mezclaParches && <Aviso tono="info">{t('ui.mezclaParches')}</Aviso>}
      <div className="rejilla-tarjetas">
        <TarjetaAumentos aumentos={build.aumentos ?? []} mejores={build.aumentosMejores} recursos={recursos} arena />
        <TarjetaObjetosArena objetos={build.objetosArena ?? []} mejores={build.objetosArenaMejores} recursos={recursos} version={version} />
        <TarjetaHechizos hechizos={build.hechizos} recursos={recursos} version={version} />
      </div>
    </>
  );
}
