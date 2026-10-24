import type { Build, ElementoPopular } from '@coach/shared';
import { Gem, ShoppingBag, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { t } from '../../../shared/i18n';
import type { AumentoPanel, PanelAumentos, RecursosBuild } from '../../../shared/tiposApp';
import { Aviso, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { porcentaje } from './CabeceraCampeon';
import { ordenarPorUso } from './elementosModo';
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

/**
 * Cifras de una fila: solo el % de uso. La política de Riot prohíbe enseñar % de victorias de aumentos y de objetos
 * de Arena («Products cannot display win rates for Augments or Arena Mode items»), y la posición media de un aumento
 * u objeto en Arena es lo mismo con otro nombre: tampoco se enseña.
 */
function Cifras({ e }: { e: ElementoPopular }) {
  return (
    <span className="elemento-cifras">
      <span>{t('opciones.uso', { porcentaje: porcentaje(e.uso) })}</span>
    </span>
  );
}

/** Subtítulo de la tarjeta: la lista es de los más elegidos, no un ranking de los mejores. */
const SoloElegidos = () => <span className="texto-secundario">{t('modos.masElegidos')}</span>;

function ListaElementos({
  elementos,
  icono,
  nombre,
}: {
  elementos: ElementoPopular[];
  icono: (e: ElementoPopular) => ReactNode;
  nombre: (e: ElementoPopular) => string;
}) {
  if (elementos.length === 0) return <p className="texto-secundario">{t('modos.sinElementos')}</p>;
  return (
    <ol className="lista-elementos">
      {elementos.map((e) => (
        <li key={e.id} className="elemento-modo">
          {icono(e)}
          <span className="elemento-textos">
            <span className="elemento-nombre">{nombre(e)}</span>
            <Cifras e={e} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Aumentos de ARAM: Caos o de Arena más elegidos, con su icono, su nombre y su % de uso. */
export function TarjetaAumentos({ aumentos, recursos }: { aumentos: ElementoPopular[]; recursos: RecursosBuild }) {
  const nombre = (e: ElementoPopular) => recursos.aumentos?.[e.id]?.nombre ?? t('modos.aumentoDesconocido', { id: e.id });
  return (
    <Tarjeta titulo={t('modos.aumentos')} icono={<Gem size={15} />} className="tarjeta-aumentos" extra={<SoloElegidos />}>
      <ListaElementos
        elementos={ordenarPorUso(aumentos)}
        nombre={nombre}
        icono={(e) => <IconoAumento icono={recursos.aumentos?.[e.id]?.icono ?? null} nombre={nombre(e)} />}
      />
    </Tarjeta>
  );
}

/** Objetos del inventario final en Arena más elegidos, solo con su % de uso. */
export function TarjetaObjetosArena({ objetos, recursos, version }: { objetos: ElementoPopular[]; recursos: RecursosBuild; version: string }) {
  const nombre = (e: ElementoPopular) => recursos.objetos[e.id] ?? String(e.id);
  return (
    <Tarjeta titulo={t('modos.objetosArena')} icono={<ShoppingBag size={15} />} className="tarjeta-objetos-arena" extra={<SoloElegidos />}>
      <ListaElementos
        elementos={ordenarPorUso(objetos)}
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
      {build.respaldoDe === 'aram' && <Aviso tono="info">{t('ui.respaldoAram')}</Aviso>}
      {build.mezclaParches && <Aviso tono="info">{t('ui.mezclaParches')}</Aviso>}
      <div className="rejilla-tarjetas">
        <TarjetaAumentos aumentos={build.aumentosPopulares ?? []} recursos={recursos} />
        <TarjetaObjetosArena objetos={build.objetosArenaPopulares ?? []} recursos={recursos} version={version} />
        <TarjetaHechizos hechizos={build.hechizos} recursos={recursos} version={version} />
      </div>
    </>
  );
}

/** Un aumento de la tier list: icono con su tier y nombre. */
function AumentoTier({ a, compacto = false }: { a: AumentoPanel; compacto?: boolean }) {
  return (
    <li className={compacto ? 'tier-aumento compacto' : 'tier-aumento'} title={a.nombre}>
      <span className="tier-aumento-icono">
        <IconoAumento icono={a.icono} nombre={a.nombre} tamano={compacto ? 32 : 36} />
        <b className={`tier-letra tier-${a.tier}`}>{a.tier}</b>
      </span>
      {!compacto && <span className="tier-aumento-nombre">{a.nombre}</span>}
    </li>
  );
}

/**
 * 3.4: tier list de aumentos de ARAM: Caos para el campeón (prismáticos, oro y plata) y los combos que le encajan.
 * El tier es de encaje con el campeón, nunca de victorias (política de Riot); el mismo panel sale en la partida.
 */
export function TarjetaTierAumentos({ panel }: { panel: PanelAumentos }) {
  return (
    <Tarjeta titulo={t('overlay.aumentos.titulo', { campeon: panel.campeon })} icono={<Sparkles size={15} />} className="tarjeta-tier-aumentos">
      <div className="tier-columnas">
        {panel.columnas.map((c) => (
          <div key={c.rareza} className={`tier-columna rareza-${c.rareza}`}>
            <h4>{t(`overlay.aumentos.rareza.${c.rareza}`)}</h4>
            <ol>
              {c.aumentos.map((a) => (
                <AumentoTier key={a.id} a={a} />
              ))}
            </ol>
          </div>
        ))}
      </div>
      {panel.combos.length > 0 && (
        <div className="tier-combos">
          <h4>{t('overlay.aumentos.combos')}</h4>
          {panel.combos.map((c) => (
            <div key={c.id} className="tier-combo">
              <span className="tier-combo-nombre">{t(`overlay.aumentos.combo.${c.id.replace(':', '.')}`)}</span>
              <ol>
                {c.aumentos.map((a) => (
                  <AumentoTier key={a.id} a={a} compacto />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <p className="tier-pie">{t('modos.tierAumentosPie')}</p>
    </Tarjeta>
  );
}
