import type { Build, Rol } from '@coach/shared';
import { ArrowDown, ArrowUp, Ban, CalendarClock, Hand, Medal, Minus, Swords, TriangleAlert, Trophy, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { EstadoPrincipal } from '../../../shared/tiposApp';
import { claveColaNormal, nombreRotativo } from '../../../shared/colas';
import { clases, Insignia } from '../../comun/componentes';
import { CDN_DDRAGON, IconoDDragon } from '../../comun/IconoDDragon';
import { SelectorRol } from '../SelectorRol';

type Seleccion = NonNullable<EstadoPrincipal['seleccion']>;

interface Props {
  seleccion: Seleccion;
  version: string;
  onCambiarRol: (rol: Rol) => void;
  /** Botón Importar (u otra acción), arriba a la derecha. */
  accion?: ReactNode;
  /**
   * La build de nivel superior del servidor: de ella salen las cifras del campeón (tasas de selección y de bloqueo,
   * cambio frente al parche anterior), que las opciones de build no repiten. Sin ella, las de `seleccion.resultado`.
   */
  cifras?: Pick<Build, 'tasaSeleccion' | 'tasaBloqueo' | 'cambioTasaVictoria'>;
}

export function urlSplash(id: string): string {
  return `${CDN_DDRAGON}/img/champion/splash/${id}_0.jpg`;
}

export function porcentaje(tasa: number): string {
  return (tasa * 100).toLocaleString(localeActual(), { maximumFractionDigits: 1 });
}

/** 3.9.2: cambio en puntos porcentuales con signo y un decimal, en el idioma de la app («+0,4 %», «−1,2 %»). */
export function textoCambio(cambio: number): string {
  const n = Math.abs(cambio).toLocaleString(localeActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signo = cambio > 0 ? '+' : cambio < 0 ? '−' : '±';
  return t('formato.porcentaje', { n: `${signo}${n}` });
}

/**
 * 3.9.2: flecha verde (sube) o roja (baja) con el cambio del % de victorias frente al parche anterior. Nada si el
 * servidor no lo da (pocas partidas en alguno de los dos parches).
 */
export function CambioTasa({ cambio }: { cambio: number | undefined }) {
  if (cambio === undefined || !Number.isFinite(cambio)) return null;
  const tono = cambio > 0 ? 'sube' : cambio < 0 ? 'baja' : 'igual';
  const Icono = cambio > 0 ? ArrowUp : cambio < 0 ? ArrowDown : Minus;
  const texto = textoCambio(cambio);
  return (
    <span className={clases('cambio-tasa', tono)} title={t('cambio.ayuda', { cambio: texto })} aria-label={t('cambio.ayuda', { cambio: texto })}>
      <Icono size={12} aria-hidden="true" />
      {texto}
    </span>
  );
}

/**
 * 3.8: lo que dice la cabecera sobre el modo y el rol. En una normal de la Grieta, «Normal · Rol: Mid» (o «Partida
 * rápida», «Flex»); en un modo rotativo, «Modo: URF» (con el rol si se enseña la build de la Grieta).
 */
export function etiquetaModo(seleccion: Pick<Seleccion, 'rol' | 'modo' | 'cola' | 'rotativo'>): string {
  const { rol, rotativo } = seleccion;
  const textoRol = rol ? t('campeon.rolActual', { rol: t('rol.' + rol) }) : null;
  if (rotativo) {
    const modo = t('campeon.modoActual', { modo: nombreRotativo(rotativo) });
    return textoRol ? `${modo} · ${textoRol}` : modo;
  }
  const normal = claveColaNormal(seleccion.cola);
  if (normal) return textoRol ? `${t(normal)} · ${textoRol}` : t(normal);
  return textoRol ?? t('campeon.modoActual', { modo: t('modo.' + (seleccion.modo ?? 'clasificatoria')) });
}

/** Cabecera con el splash art difuminado, el retrato, el nombre, el selector de rol y las insignias. */
export function CabeceraCampeon({ seleccion, version, onCambiarRol, accion, cifras }: Props) {
  const { campeon, rol, rolesDisponibles, resultado } = seleccion;
  const delCampeon = cifras ?? (resultado.estado !== 'no_disponible' ? resultado.build : undefined);
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
          <span className="cabecera-rol">{etiquetaModo(seleccion)}</span>
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
                <>
                  <Insignia tono={resultado.build.tasaVictoria >= 0.5 ? 'exito' : 'aviso'} icono={<Trophy size={13} />}>
                    {t('ui.victorias', { porcentaje: porcentaje(resultado.build.tasaVictoria) })}
                    <CambioTasa cambio={delCampeon?.cambioTasaVictoria} />
                  </Insignia>
                  {/* 3.9.1: tasa de selección y de bloqueo del campeón en clasificatoria (datos agregados del parche). */}
                  {delCampeon?.tasaSeleccion !== undefined && (
                    <Insignia tono="neutro" icono={<Hand size={13} />}>
                      <span title={t('tasas.seleccionAyuda')}>{t('tasas.seleccion', { porcentaje: porcentaje(delCampeon.tasaSeleccion) })}</span>
                    </Insignia>
                  )}
                  {delCampeon?.tasaBloqueo !== undefined && (
                    <Insignia tono="neutro" icono={<Ban size={13} />}>
                      <span title={t('tasas.bloqueoAyuda')}>{t('tasas.bloqueo', { porcentaje: porcentaje(delCampeon.tasaBloqueo) })}</span>
                    </Insignia>
                  )}
                </>
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
