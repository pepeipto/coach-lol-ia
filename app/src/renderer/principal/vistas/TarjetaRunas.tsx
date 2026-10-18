import type { PaginaRunas } from '@coach/shared';
import { Hexagon, Sparkles } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { RecursosBuild } from '../../../shared/tiposApp';
import { Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';

/** Data Dragon no trae los fragmentos en runesReforged: estas son sus imágenes en el CDN. */
const IMAGEN_FRAGMENTO: Record<number, string> = {
  5001: 'StatModsHealthScalingIcon.png',
  5002: 'StatModsArmorIcon.png',
  5003: 'StatModsMagicResIcon.png',
  5005: 'StatModsAttackSpeedIcon.png',
  5007: 'StatModsCDRScalingIcon.png',
  5008: 'StatModsAdaptiveForceIcon.png',
  5010: 'StatModsMovementSpeedIcon.png',
  5011: 'StatModsHealthPlusIcon.png',
  5013: 'StatModsTenacityIcon.png',
};

interface PropsRuna {
  id: number;
  recursos: RecursosBuild;
  version: string;
  tamano: number;
  clave?: boolean;
}

function Runa({ id, recursos, version, tamano, clave }: PropsRuna) {
  const r = recursos.runas[id];
  return (
    <IconoDDragon
      tipo="runa"
      id={id}
      version={version}
      nombre={r?.nombre ?? t('runa.desconocida')}
      imagen={r?.icono}
      tamano={tamano}
      className={clave ? 'runa-clave' : undefined}
    />
  );
}

function Fragmento({ id, version }: { id: number; version: string }) {
  const clave = `fragmento.${id}`;
  const nombre = t(clave);
  const imagen = IMAGEN_FRAGMENTO[id];
  return (
    <IconoDDragon
      tipo="runa"
      id={id}
      version={version}
      nombre={nombre === clave ? t('fragmento.desconocido') : nombre}
      imagen={imagen ? `perk-images/StatMods/${imagen}` : undefined}
      tamano={28}
      className="fragmento"
    />
  );
}

function CabeceraRama({ titulo, nombre }: { titulo: string; nombre?: string }) {
  return (
    <div className="rama-cabecera">
      <span className="rama-titulo">{titulo}</span>
      {nombre && <span className="rama-nombre">{nombre}</span>}
    </div>
  );
}

export function TarjetaRunas({ runas, recursos, version }: { runas: PaginaRunas; recursos: RecursosBuild; version: string }) {
  const [clave, ...principales] = runas.runas.slice(0, 4);
  const secundarias = runas.runas.slice(4, 6);
  const fragmentos = runas.runas.slice(6, 9);
  return (
    <Tarjeta titulo={t('ui.runas')} icono={<Hexagon size={15} />} className="tarjeta-runas">
      <div className="runas">
        <div className="rama rama-principal">
          <CabeceraRama titulo={t('runas.principal')} nombre={recursos.runas[runas.estiloPrincipal]?.nombre} />
          <div className="rama-iconos">
            <Runa id={runas.estiloPrincipal} recursos={recursos} version={version} tamano={30} />
            <span className="rama-separador" aria-hidden="true" />
            <Runa id={clave ?? 0} recursos={recursos} version={version} tamano={52} clave />
            {principales.map((id, i) => (
              <Runa key={i} id={id} recursos={recursos} version={version} tamano={38} />
            ))}
          </div>
        </div>
        <div className="rama rama-secundaria">
          <CabeceraRama titulo={t('runas.secundaria')} nombre={recursos.runas[runas.estiloSecundario]?.nombre} />
          <div className="rama-iconos">
            <Runa id={runas.estiloSecundario} recursos={recursos} version={version} tamano={30} />
            <span className="rama-separador" aria-hidden="true" />
            {secundarias.map((id, i) => (
              <Runa key={i} id={id} recursos={recursos} version={version} tamano={38} />
            ))}
          </div>
        </div>
        <div className="rama rama-fragmentos">
          <CabeceraRama titulo={t('runas.fragmentos')} />
          <div className="rama-iconos">
            {fragmentos.map((id, i) => (
              <Fragmento key={i} id={id} version={version} />
            ))}
          </div>
        </div>
      </div>
    </Tarjeta>
  );
}

export function TarjetaHechizos({ hechizos, recursos, version }: { hechizos: number[]; recursos: RecursosBuild; version: string }) {
  return (
    <Tarjeta titulo={t('ui.hechizos')} icono={<Sparkles size={15} />} className="tarjeta-hechizos">
      <ul className="hechizos">
        {hechizos.map((id, i) => {
          const h = recursos.hechizos[id];
          const nombre = h?.nombre ?? t('hechizo.desconocido');
          return (
            <li key={`${id}-${i}`} className="hechizo">
              <IconoDDragon tipo="hechizo" id={id} version={version} nombre={nombre} imagen={h?.imagen} tamano={44} />
              <span className="hechizo-nombre">{nombre}</span>
              <kbd className="hechizo-tecla">{t(i === 0 ? 'hechizos.tecla1' : 'hechizos.tecla2')}</kbd>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
