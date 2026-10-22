import type { Build, OpcionRunas, Rol } from '@coach/shared';
import { Check, CircleOff, DatabaseZap, Download, Gamepad2, LayoutGrid, ListOrdered, LoaderCircle, MessageCircleHeart, MousePointerClick, Target, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Perfil } from '../../../shared/perfil';
import { t } from '../../../shared/i18n';
import type { EstadoPrincipal, Plan, RecursosBuild, ResultadoImportar } from '../../../shared/tiposApp';
import { Aviso, Boton, clases, Tarjeta, type TonoAviso } from '../../comun/componentes';
import { BannerPremium } from './BannerPremium';
import { CabeceraCampeon } from './CabeceraCampeon';
import { EstadoVacio, SiluetaBuild } from './EstadoVacio';
import { RejillaHabilidades } from './RejillaHabilidades';
import { TarjetaBuild } from './TarjetaBuild';
import { TarjetaHechizos, TarjetaRunas } from './TarjetaRunas';
import { SelectorOpciones } from './SelectorOpciones';
import { SelectorRunas } from './SelectorRunas';
import { CuerpoArena, TarjetaAumentos, TarjetaTierAumentos } from './TarjetasModo';
import './perfil.css';
import { TarjetaFichaPrevia } from './TarjetaFichaPrevia';
import { buildElegida, opcionesDe, opcionesRunasDe } from '../../../shared/opciones';

export type Importacion = ResultadoImportar | 'importando' | null;

interface Props {
  estado: EstadoPrincipal | null;
  importacion: Importacion;
  onImportar: () => void;
  onCambiarRol: (rol: Rol) => void;
  /** Elige otra opción de build (índice en las opciones). */
  onCambiarOpcion: (i: number) => void;
  /** Elige otra página de runas (índice en `opcionesRunas`, 3.0.1). */
  onCambiarRunas?: (i: number) => void;
  plan: Plan | null;
  bannerCerrado: boolean;
  alCerrarBanner: () => void;
  alVerPremium: () => void;
  /** 3.6: accesos de la pantalla de inicio sin el cliente (Perfil, Tu coach, Campeones). */
  alNavegar?: (v: 'perfil' | 'coach' | 'campeones') => void;
}

function importacionCompleta(r: ResultadoImportar): boolean {
  return r.runas.ok && r.hechizos.ok && r.objetos.ok;
}

export function mensajeImportacion(r: ResultadoImportar): { texto: string; tono: TonoAviso } {
  // 3.1: sin páginas libres; si hay una que se pueda sustituir, «Importar» la ofrece (con confirmación).
  if (r.runas.ok === false && r.runas.motivo === 'sin_paginas')
    return { texto: t(r.runas.sustituible ? 'ui.sinPaginas' : 'ui.sinPaginasNinguna'), tono: 'aviso' };
  const fallidas = (['runas', 'hechizos', 'objetos'] as const).filter((p) => !r[p].ok).map((p) => t('ui.parte.' + p));
  return fallidas.length === 0
    ? { texto: t('ui.importado'), tono: 'exito' }
    : { texto: t('ui.errorImportar', { partes: fallidas.join(', ') }), tono: 'error' };
}

export function BotonImportar({ importacion, onImportar }: { importacion: Importacion; onImportar: () => void }) {
  const importando = importacion === 'importando';
  const hecho = !!importacion && importacion !== 'importando' && importacionCompleta(importacion);
  return (
    <Boton
      variante="primario"
      className={clases('boton-importar', hecho && 'exito', importando && 'cargando')}
      disabled={importando}
      onClick={onImportar}
      title={t('ui.importarAyuda')}
    >
      {importando ? (
        <LoaderCircle size={17} className="girando" aria-hidden="true" />
      ) : hecho ? (
        <Check size={17} className="marca-exito" aria-hidden="true" />
      ) : (
        <Download size={17} aria-hidden="true" />
      )}
      {importando ? t('ui.importando') : hecho ? t('ui.importadoBoton') : t('ui.importar')}
    </Boton>
  );
}

/** Vista principal: la build del campeón elegido al estilo Blitz, o el estado vacío que toque. */
/** 3.6: sin el cliente abierto, la portada ofrece lo que sí se puede hacer: tu reto, tu perfil, tu coach y la tier list. */
function InicioSinCliente({ alNavegar }: { alNavegar: NonNullable<Props['alNavegar']> }) {
  const [reto, setReto] = useState<Perfil['reto']>(null);
  useEffect(() => {
    let vivo = true;
    void window.coach?.perfil?.(false).then((p) => vivo && setReto(p.reto), () => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <div className="inicio-sin-cliente">
      {reto && !reto.completado && (
        <p className="inicio-reto">
          <Target size={15} aria-hidden="true" /> {t('inicio.reto', { reto: t(`perfil.reto.${reto.id}.nombre`), hechas: reto.hechas, objetivo: reto.objetivo })}
        </p>
      )}
      <div className="inicio-accesos">
        <Boton variante="primario" onClick={() => alNavegar('perfil')}>
          <UserRound size={15} aria-hidden="true" /> {t('inicio.perfil')}
        </Boton>
        <Boton onClick={() => alNavegar('coach')}>
          <MessageCircleHeart size={15} aria-hidden="true" /> {t('inicio.coach')}
        </Boton>
        <Boton onClick={() => alNavegar('campeones')}>
          <LayoutGrid size={15} aria-hidden="true" /> {t('inicio.campeones')}
        </Boton>
      </div>
    </div>
  );
}

export function VistaCampeon(props: Props) {
  const { estado, importacion, onImportar, onCambiarRol, onCambiarOpcion, onCambiarRunas, plan, bannerCerrado, alCerrarBanner, alVerPremium } = props;

  if (!estado) {
    return (
      <div className="vista-campeon cargando" aria-busy="true">
        <span className="solo-lectores">{t('vacio.cargando')}</span>
        <div className="cabecera-esqueleto" aria-hidden="true" />
        <SiluetaBuild />
      </div>
    );
  }
  if (estado.cliente === 'esperando') {
    return (
      <EstadoVacio icono={<Gamepad2 size={34} />} tono="espera" titulo={t('estado.esperandoCliente')} descripcion={t('vacio.esperandoDesc')}>
        {props.alNavegar && <InicioSinCliente alNavegar={props.alNavegar} />}
      </EstadoVacio>
    );
  }
  if (estado.error === 'datos') {
    return <EstadoVacio icono={<DatabaseZap size={34} />} tono="error" titulo={t('vacio.errorTitulo')} descripcion={t('ui.errorDatos')} />;
  }
  const sel = estado.seleccion;
  if (!sel) {
    return (
      <EstadoVacio icono={<MousePointerClick size={34} />} titulo={t('vacio.eligeTitulo')} descripcion={t('vacio.eligeDesc')} silueta />
    );
  }

  // Todo (cabecera, tarjetas) muestra la opción elegida; las pestañas permiten cambiarla.
  const opciones = sel.resultado.estado === 'no_disponible' ? [] : opcionesDe(sel.resultado.build);
  const opcion = sel.opcion ?? 0;
  // Las runas, de la página elegida (si el servidor manda páginas elegibles); lo demás, de la opción de build.
  const opcionesRunas = sel.resultado.estado === 'no_disponible' ? [] : opcionesRunasDe(sel.resultado.build);
  const opcionRunas = sel.opcionRunas ?? 0;
  const resultado =
    sel.resultado.estado === 'no_disponible'
      ? sel.resultado
      : { ...sel.resultado, build: buildElegida(sel.resultado.build, opcion, opcionRunas) };
  const selVista = { ...sel, resultado };
  const disponible = resultado.estado !== 'no_disponible';
  const mensaje = importacion && importacion !== 'importando' ? mensajeImportacion(importacion) : null;

  return (
    <div className="vista-campeon" key={`${sel.campeon.key}-${sel.modo ?? 'clasificatoria'}-${sel.rol}`}>
      <CabeceraCampeon
        seleccion={selVista}
        version={estado.version}
        onCambiarRol={onCambiarRol}
        accion={disponible && sel.modo !== 'arena' ? <BotonImportar importacion={importacion} onImportar={onImportar} /> : undefined}
      />
      <BannerPremium plan={plan} cerrado={bannerCerrado} alCerrar={alCerrarBanner} alVer={alVerPremium} />
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
      <TarjetaFichaPrevia campeonKey={sel.campeon.key} nombre={sel.campeon.nombre} />
      {sel.aumentosCaos && <TarjetaTierAumentos panel={sel.aumentosCaos} />}

      {resultado.estado === 'no_disponible' ? (
        <EstadoVacio icono={<CircleOff size={34} />} titulo={t('estado.buildNoDisponible')} descripcion={t('vacio.noDisponibleDesc')} />
      ) : (
        <CuerpoBuild
          build={resultado.build}
          base={sel.resultado.estado === 'no_disponible' ? undefined : sel.resultado.build}
          opciones={opciones}
          opcion={opcion}
          recursos={estado.recursos}
          version={estado.version}
          alCambiarOpcion={onCambiarOpcion}
          opcionesRunas={opcionesRunas}
          opcionRunas={opcionRunas}
          alCambiarRunas={onCambiarRunas}
        />
      )}
    </div>
  );
}

/**
 * Cuerpo de la build (aviso de parches, pestañas de opciones, runas, hechizos, objetos y habilidades; en ARAM: Caos
 * también los aumentos, y en Arena aumentos, objetos y hechizos). Lo comparten la vista Campeón y el detalle del
 * apartado Campeones.
 */
export function CuerpoBuild({
  build,
  base,
  opciones,
  opcion,
  recursos,
  version,
  alCambiarOpcion,
  opcionesRunas = [],
  opcionRunas = 0,
  alCambiarRunas,
}: {
  /** La build de la opción elegida (con las runas de la página elegida). */
  build: Build;
  /** La build de nivel superior (la del servidor), de donde salen los aumentos si la opción no los trae. */
  base?: Build;
  opciones: Build[];
  opcion: number;
  recursos: RecursosBuild;
  version: string;
  alCambiarOpcion: (i: number) => void;
  /** Páginas de runas elegibles (3.0.1); vacía con un servidor anterior. */
  opcionesRunas?: OpcionRunas[];
  opcionRunas?: number;
  alCambiarRunas?: (i: number) => void;
}) {
  if (build.modo === 'arena') return <CuerpoArena build={build} recursos={recursos} version={version} />;
  // El servidor copia los aumentos en cada opción; con uno anterior, solo están en la build de nivel superior.
  const aumentos = build.aumentosPopulares ?? base?.aumentosPopulares ?? [];
  return (
    <>
      {build.respaldoDe === 'aram' && <Aviso tono="info">{t('ui.respaldoAram')}</Aviso>}
      {build.mezclaParches && <Aviso tono="info">{t('ui.mezclaParches')}</Aviso>}
      <SelectorOpciones opciones={opciones} activa={opcion} recursos={recursos} version={version} alCambiar={alCambiarOpcion} />
      <div className="rejilla-tarjetas">
        <TarjetaRunas
          runas={build.runas}
          recursos={recursos}
          version={version}
          selector={
            alCambiarRunas && (
              <SelectorRunas opciones={opcionesRunas} activa={opcionRunas} recursos={recursos} version={version} alCambiar={alCambiarRunas} />
            )
          }
        />
        <TarjetaHechizos hechizos={build.hechizos} recursos={recursos} version={version} />
        <TarjetaBuild build={build} recursos={recursos} version={version} />
        <Tarjeta titulo={t('ui.habilidades')} icono={<ListOrdered size={15} />} className="tarjeta-habilidades">
          <RejillaHabilidades orden={build.ordenHabilidades} />
        </Tarjeta>
        {aumentos.length > 0 && <TarjetaAumentos aumentos={aumentos} recursos={recursos} />}
      </div>
    </>
  );
}
