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

/** Pestañas «Más elegidos» / «Mejor posición» (solo en Arena, donde hay posición media). */
function SelectorCriterio({ criterio, alCambiar }: { criterio: CriterioElementos; alCambiar: (c: CriterioElementos) => void }) {
  return (
    <Pestanas
      etiqueta={t('modos.ordenarPor')}
      activa={criterio}
      alCambiar={(id) => alCambiar(id as CriterioElementos)}
      opciones={[
        { id: 'uso', texto: t('modos.masElegidos') },
        { id: 'posicion', texto: t('modos.mejorPosicion') },
      ]}
    />
  );
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
export function TarjetaAumentos({ aumentos, recursos, arena }: { aumentos: EstadisticaElemento[]; recursos: RecursosBuild; arena: boolean }) {
  const [criterio, setCriterio] = useState<CriterioElementos>('uso');
  const lista = ordenarElementos(aumentos, arena ? criterio : 'uso');
  const nombre = (e: EstadisticaElemento) => recursos.aumentos?.[e.id]?.nombre ?? t('modos.aumentoDesconocido', { id: e.id });
  return (
    <Tarjeta
      titulo={t('modos.aumentos')}
      icono={<Gem size={15} />}
      className="tarjeta-aumentos"
      extra={arena ? <SelectorCriterio criterio={criterio} alCambiar={setCriterio} /> : undefined}
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
export function TarjetaObjetosArena({ objetos, recursos, version }: { objetos: EstadisticaElemento[]; recursos: RecursosBuild; version: string }) {
  const [criterio, setCriterio] = useState<CriterioElementos>('uso');
  const nombre = (e: EstadisticaElemento) => recursos.objetos[e.id] ?? String(e.id);
  return (
    <Tarjeta
      titulo={t('modos.objetosArena')}
      icono={<ShoppingBag size={15} />}
      className="tarjeta-objetos-arena"
      extra={<SelectorCriterio criterio={criterio} alCambiar={setCriterio} />}
    >
      <ListaElementos
        elementos={ordenarElementos(objetos, criterio)}
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
        <TarjetaAumentos aumentos={build.aumentos ?? []} recursos={recursos} arena />
        <TarjetaObjetosArena objetos={build.objetosArena ?? []} recursos={recursos} version={version} />
        <TarjetaHechizos hechizos={build.hechizos} recursos={recursos} version={version} />
      </div>
    </>
  );
}
