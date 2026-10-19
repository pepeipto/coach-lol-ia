import type { Rol } from '@coach/shared';
import { CalendarClock, Medal, Swords, TriangleAlert, Trophy, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { EstadoPrincipal } from '../../../shared/tiposApp';
import { Insignia } from '../../comun/componentes';
import { CDN_DDRAGON, IconoDDragon } from '../../comun/IconoDDragon';
import { SelectorRol } from '../SelectorRol';

type Seleccion = NonNullable<EstadoPrincipal['seleccion']>;

interface Props {
  seleccion: Seleccion;
  version: string;
  onCambiarRol: (rol: Rol) => void;
  /** Botón Importar (u otra acción), arriba a la derecha. */
  accion?: ReactNode;
}

export function urlSplash(id: string): string {
  return `${CDN_DDRAGON}/img/champion/splash/${id}_0.jpg`;
}

export function porcentaje(tasa: number): string {
  return (tasa * 100).toLocaleString(localeActual(), { maximumFractionDigits: 1 });
}

/** Cabecera con el splash art difuminado, el retrato, el nombre, el selector de rol y las insignias. */
export function CabeceraCampeon({ seleccion, version, onCambiarRol, accion }: Props) {
  const { campeon, rol, rolesDisponibles, resultado } = seleccion;
  const modo = seleccion.modo ?? 'clasificatoria';
  const arena = resultado.estado !== 'no_disponible' ? resultado.build.arena : undefined;
  return (
    <header className="cabecera-campeon">
      <img className="cabecera-splash" src={urlSplash(campeon.id)} alt="" aria-hidden="true" draggable={false} />
      <div className="cabecera-velo" aria-hidden="true" />
      <div className="cabecera-contenido">
        <div className="cabecera-retrato">
          <IconoDDragon tipo="campeon" id={campeon.id} version={version} nombre={campeon.nombre} tamano={84} />
        </div>
        <div className="cabecera-datos">
          <span className="cabecera-rol">
            {rol ? t('campeon.rolActual', { rol: t('rol.' + rol) }) : t('campeon.modoActual', { modo: t('modo.' + modo) })}
          </span>
          <h2 className="cabecera-nombre">{campeon.nombre}</h2>
          {resultado.estado !== 'no_disponible' && (
            <div className="cabecera-insignias">
              {arena ? (
                <>
                  <Insignia tono={arena.posicionMedia <= 4.5 ? 'exito' : 'aviso'} icono={<Medal size={13} />}>
                    {t('modos.posicionMedia', { posicion: arena.posicionMedia.toLocaleString(localeActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                  </Insignia>
                  <Insignia tono="neutro" icono={<Trophy size={13} />}>
                    {t('modos.top4', { porcentaje: porcentaje(arena.top4) })}
                  </Insignia>
                  <Insignia tono="neutro" icono={<Trophy size={13} />}>
                    {t('modos.primero', { porcentaje: porcentaje(arena.victorias) })}
                  </Insignia>
                </>
              ) : (
                <Insignia tono={resultado.build.tasaVictoria >= 0.5 ? 'exito' : 'aviso'} icono={<Trophy size={13} />}>
                  {t('ui.victorias', { porcentaje: porcentaje(resultado.build.tasaVictoria) })}
                </Insignia>
              )}
              <Insignia tono="neutro" icono={<Swords size={13} />}>
                {t('ui.partidas', { partidas: resultado.build.partidas })}
              </Insignia>
              {resultado.build.datosLimitados && (
                <Insignia tono="aviso" icono={<TriangleAlert size={13} />}>
                  {t('datos.limitados')}
                </Insignia>
              )}
              {resultado.estado === 'sin_conexion' ? (
                <Insignia tono="aviso" icono={<WifiOff size={13} />}>
                  {t('estado.sinConexion', { parche: resultado.build.parche })}
                </Insignia>
              ) : (
                <Insignia tono="oro" icono={<CalendarClock size={13} />}>
                  {t('estado.parche', { parche: resultado.build.parche })}
                </Insignia>
              )}
            </div>
          )}
        </div>
        {accion && <div className="cabecera-accion">{accion}</div>}
      </div>
      {rol && (
        <div className="cabecera-roles">
          <SelectorRol rol={rol} disponibles={rolesDisponibles} onCambiar={onCambiarRol} />
        </div>
      )}
    </header>
  );
}
