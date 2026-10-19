import type { ModoJuego, Rol } from '@coach/shared';
import { ArrowLeft, CircleOff, RotateCw, ServerCrash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../../shared/i18n';
import { buildDeOpcion, opcionesDe } from '../../../shared/opciones';
import type { EstadoPrincipal, RespuestaBuildDe } from '../../../shared/tiposApp';
import { Boton } from '../../comun/componentes';
import { CabeceraCampeon } from './CabeceraCampeon';
import { EstadoVacio, SiluetaBuild } from './EstadoVacio';
import { BotonImportar, CuerpoBuild, type Importacion } from './VistaCampeon';

type Detalle = Extract<RespuestaBuildDe, { ok: true }>;

interface Props {
  /** Id de Data Dragon del campeón. */
  campeon: string;
  /** null fuera de clasificatoria. */
  rol: Rol | null;
  modo: ModoJuego;
  alCambiarRol: (rol: Rol) => void;
  alVolver: () => void;
  /** Estado de la selección de campeones, para ofrecer «Importar» solo si es el mismo campeón y rol. */
  estado: EstadoPrincipal | null;
  importacion: Importacion;
  onImportar: () => void;
  onCambiarOpcion: (i: number) => void;
}

/**
 * Build de un campeón y rol cualquiera, con los mismos componentes que la vista Campeón y en solo
 * lectura: el botón «Importar» solo aparece en la selección de campeones con ese campeón y rol, y
 * entonces las pestañas de opción son las de la selección (lo que se ve es lo que se importa).
 */
export function DetalleCampeon({ campeon, rol, modo, alCambiarRol, alVolver, estado, importacion, onImportar, onCambiarOpcion }: Props) {
  const [respuesta, setRespuesta] = useState<Detalle | 'cargando' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);
  const [opcionLocal, setOpcionLocal] = useState(0);

  useEffect(() => {
    let vigente = true;
    setRespuesta('cargando');
    setOpcionLocal(0);
    window.coach.buildDe(campeon, rol, modo).then(
      (r) => vigente && setRespuesta(r.ok ? r : 'error'),
      () => vigente && setRespuesta('error'),
    );
    return () => {
      vigente = false;
    };
  }, [campeon, rol, modo, intento]);

  const volver = (
    <div className="detalle-barra">
      <Boton variante="fantasma" className="boton-pequeno" onClick={alVolver}>
        <ArrowLeft size={15} aria-hidden="true" />
        {t('campeones.volver')}
      </Boton>
    </div>
  );

  if (respuesta === 'cargando') {
    return (
      <div className="vista-campeon cargando" aria-busy="true">
        {volver}
        <span className="solo-lectores">{t('campeones.cargandoBuild')}</span>
        <div className="cabecera-esqueleto" aria-hidden="true" />
        <SiluetaBuild />
      </div>
    );
  }
  if (respuesta === 'error') {
    return (
      <div className="vista-campeon">
        {volver}
        <EstadoVacio icono={<ServerCrash size={34} />} tono="error" titulo={t('campeones.errorBuild')} descripcion={t('campeones.errorBuildDesc')}>
          <Boton onClick={() => setIntento((n) => n + 1)}>
            <RotateCw size={15} aria-hidden="true" />
            {t('campeones.reintentar')}
          </Boton>
        </EstadoVacio>
      </div>
    );
  }

  const sel = estado?.cliente === 'conectado' ? estado.seleccion : null;
  const enSeleccion =
    !!sel &&
    sel.campeon.id === respuesta.campeon.id &&
    sel.rol === respuesta.rol &&
    (sel.modo ?? 'clasificatoria') === respuesta.modo &&
    respuesta.modo !== 'arena' &&
    sel.resultado.estado !== 'no_disponible';
  const opcion = enSeleccion ? (sel?.opcion ?? 0) : opcionLocal;
  const cambiarOpcion = enSeleccion ? onCambiarOpcion : setOpcionLocal;

  const base = respuesta.resultado;
  const opciones = base.estado === 'no_disponible' ? [] : opcionesDe(base.build);
  const resultado = base.estado === 'no_disponible' ? base : { ...base, build: buildDeOpcion(base.build, opcion) };

  return (
    <div className="vista-campeon" key={`${respuesta.campeon.id}-${respuesta.modo}-${respuesta.rol}`}>
      {volver}
      <CabeceraCampeon
        seleccion={{
          campeon: respuesta.campeon,
          rol: respuesta.rol,
          modo: respuesta.modo,
          rolesDisponibles: respuesta.rolesDisponibles,
          resultado,
          opcion,
        }}
        version={respuesta.version}
        onCambiarRol={alCambiarRol}
        accion={enSeleccion ? <BotonImportar importacion={importacion} onImportar={onImportar} /> : undefined}
      />
      {resultado.estado === 'no_disponible' ? (
        <EstadoVacio icono={<CircleOff size={34} />} titulo={t('estado.buildNoDisponible')} descripcion={t('vacio.noDisponibleDesc')} />
      ) : (
        <CuerpoBuild
          build={resultado.build}
          base={base.estado === 'no_disponible' ? undefined : base.build}
          opciones={opciones}
          opcion={opcion}
          recursos={respuesta.recursos}
          version={respuesta.version}
          alCambiarOpcion={cambiarOpcion}
        />
      )}
    </div>
  );
}
