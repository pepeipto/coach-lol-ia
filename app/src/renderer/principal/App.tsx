import { useEffect, useState } from 'react';
import type { Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPrincipal, ResultadoImportar } from '../../shared/tiposApp';
import { Aviso } from '../comun/componentes';
import { Ajustes } from './Ajustes';
import { BarraLateral, type Vista } from './BarraLateral';
import { BarraTitulo } from './BarraTitulo';
import { useLicencia } from './licencia';
import { PieLegal } from './PieLegal';
import { VistaCampeon, type Importacion } from './vistas/VistaCampeon';

/** Si la importación no llega a responder, se informa como fallo en las tres partes. */
const FALLO_IMPORTAR: ResultadoImportar = {
  runas: { ok: false, motivo: 'error' },
  hechizos: { ok: false, motivo: 'error' },
  objetos: { ok: false, motivo: 'error' },
};

export function App() {
  const [estado, setEstado] = useState<EstadoPrincipal | null>(null);
  const [vista, setVista] = useState<Vista>('campeon');
  const [importacion, setImportacion] = useState<Importacion>(null);
  // El banner promocional se cierra solo durante esta sesión.
  const [bannerCerrado, setBannerCerrado] = useState(false);
  const [licencia] = useLicencia();

  useEffect(() => {
    window.coach.alCambiarEstado((nuevo) => {
      setEstado((previo) => {
        const cambio =
          previo?.seleccion?.campeon.key !== nuevo.seleccion?.campeon.key || previo?.seleccion?.rol !== nuevo.seleccion?.rol;
        if (cambio) setImportacion(null);
        if (nuevo.importacion) setImportacion(nuevo.importacion);
        return nuevo;
      });
    });
  }, []);

  const importar = () => {
    setImportacion('importando');
    void window.coach.importar().then(setImportacion, () => setImportacion(FALLO_IMPORTAR));
  };
  const cambiarRol = (rol: Rol) => void window.coach.cambiarRol(rol);

  let contenido;
  if (vista === 'ajustes' || vista === 'overlay') contenido = <Ajustes />;
  else if (vista === 'premium') contenido = null;
  else
    contenido = (
      <VistaCampeon
        estado={estado}
        importacion={importacion}
        onImportar={importar}
        onCambiarRol={cambiarRol}
        plan={licencia.plan}
        bannerCerrado={bannerCerrado}
        alCerrarBanner={() => setBannerCerrado(true)}
        alVerPremium={() => setVista('premium')}
      />
    );

  return (
    <div className="app">
      <BarraLateral vista={vista} alCambiar={setVista} cliente={estado?.cliente ?? 'esperando'} plan={licencia.plan} />
      <BarraTitulo titulo={t('nav.' + vista)} />
      <main className="contenido">
        <div className="contenido-interior" key={vista}>
          {estado?.aviso && <Aviso tono="aviso">{estado.aviso}</Aviso>}
          {contenido}
        </div>
        <PieLegal />
      </main>
    </div>
  );
}
