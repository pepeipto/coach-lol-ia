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
import { VistaBuild } from './VistaBuild';

export function App() {
  const [estado, setEstado] = useState<EstadoPrincipal | null>(null);
  const [vista, setVista] = useState<Vista>('campeon');
  const [importacion, setImportacion] = useState<ResultadoImportar | 'importando' | null>(null);
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
    void window.coach.importar().then(setImportacion);
  };
  const cambiarRol = (rol: Rol) => void window.coach.cambiarRol(rol);

  let contenido;
  if (vista === 'ajustes' || vista === 'overlay') contenido = <Ajustes />;
  else if (vista === 'premium') contenido = null;
  else if (!estado || estado.cliente === 'esperando') contenido = <p className="estado">{t('estado.esperandoCliente')}</p>;
  else if (estado.error === 'datos') contenido = <p className="estado error">{t('ui.errorDatos')}</p>;
  else if (!estado.seleccion) contenido = <p className="estado">{t('ui.sinSeleccion')}</p>;
  else contenido = <VistaBuild estado={estado} importacion={importacion} onImportar={importar} onCambiarRol={cambiarRol} />;

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
