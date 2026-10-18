import type { Rol } from '@coach/shared';
import { Check, CircleOff, DatabaseZap, Download, Gamepad2, ListOrdered, LoaderCircle, MousePointerClick } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { EstadoPrincipal, Plan, ResultadoImportar } from '../../../shared/tiposApp';
import { Aviso, Boton, clases, Tarjeta, type TonoAviso } from '../../comun/componentes';
import { BannerPremium } from './BannerPremium';
import { CabeceraCampeon } from './CabeceraCampeon';
import { EstadoVacio, SiluetaBuild } from './EstadoVacio';
import { RejillaHabilidades } from './RejillaHabilidades';
import { TarjetaBuild } from './TarjetaBuild';
import { TarjetaHechizos, TarjetaRunas } from './TarjetaRunas';

export type Importacion = ResultadoImportar | 'importando' | null;

interface Props {
  estado: EstadoPrincipal | null;
  importacion: Importacion;
  onImportar: () => void;
  onCambiarRol: (rol: Rol) => void;
  plan: Plan;
  bannerCerrado: boolean;
  alCerrarBanner: () => void;
  alVerPremium: () => void;
}

function importacionCompleta(r: ResultadoImportar): boolean {
  return r.runas.ok && r.hechizos.ok && r.objetos.ok;
}

export function mensajeImportacion(r: ResultadoImportar): { texto: string; tono: TonoAviso } {
  if (r.runas.ok === false && r.runas.motivo === 'sin_paginas') return { texto: t('ui.sinPaginas'), tono: 'aviso' };
  const fallidas = (['runas', 'hechizos', 'objetos'] as const).filter((p) => !r[p].ok).map((p) => t('ui.parte.' + p));
  return fallidas.length === 0
    ? { texto: t('ui.importado'), tono: 'exito' }
    : { texto: t('ui.errorImportar', { partes: fallidas.join(', ') }), tono: 'error' };
}

function BotonImportar({ importacion, onImportar }: { importacion: Importacion; onImportar: () => void }) {
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
export function VistaCampeon(props: Props) {
  const { estado, importacion, onImportar, onCambiarRol, plan, bannerCerrado, alCerrarBanner, alVerPremium } = props;

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
      <EstadoVacio
        icono={<Gamepad2 size={34} />}
        tono="espera"
        titulo={t('estado.esperandoCliente')}
        descripcion={t('vacio.esperandoDesc')}
      />
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

  const { resultado } = sel;
  const disponible = resultado.estado !== 'no_disponible';
  const mensaje = importacion && importacion !== 'importando' ? mensajeImportacion(importacion) : null;

  return (
    <div className="vista-campeon" key={`${sel.campeon.key}-${sel.rol}`}>
      <CabeceraCampeon
        seleccion={sel}
        version={estado.version}
        onCambiarRol={onCambiarRol}
        accion={disponible ? <BotonImportar importacion={importacion} onImportar={onImportar} /> : undefined}
      />
      <BannerPremium plan={plan} cerrado={bannerCerrado} alCerrar={alCerrarBanner} alVer={alVerPremium} />
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      {resultado.estado === 'no_disponible' ? (
        <EstadoVacio icono={<CircleOff size={34} />} titulo={t('estado.buildNoDisponible')} descripcion={t('vacio.noDisponibleDesc')} />
      ) : (
        <>
          {resultado.build.mezclaParches && <Aviso tono="info">{t('ui.mezclaParches')}</Aviso>}
          <div className="rejilla-tarjetas">
            <TarjetaRunas runas={resultado.build.runas} recursos={estado.recursos} version={estado.version} />
            <TarjetaHechizos hechizos={resultado.build.hechizos} recursos={estado.recursos} version={estado.version} />
            <TarjetaBuild build={resultado.build} recursos={estado.recursos} version={estado.version} />
            <Tarjeta titulo={t('ui.habilidades')} icono={<ListOrdered size={15} />} className="tarjeta-habilidades">
              <RejillaHabilidades orden={resultado.build.ordenHabilidades} />
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  );
}
