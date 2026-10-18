import { useEffect, useState } from 'react';
import type { Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPrincipal, ResultadoImportar } from '../../shared/tiposApp';
import { Ajustes } from './Ajustes';
import { PieLegal } from './PieLegal';
import { VistaBuild } from './VistaBuild';

export function App() {
  const [estado, setEstado] = useState<EstadoPrincipal | null>(null);
  const [pestana, setPestana] = useState<'build' | 'ajustes'>('build');
  const [importacion, setImportacion] = useState<ResultadoImportar | 'importando' | null>(null);

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
  if (!estado || estado.cliente === 'esperando') contenido = <p className="estado">{t('estado.esperandoCliente')}</p>;
  else if (estado.error === 'datos') contenido = <p className="estado error">{t('ui.errorDatos')}</p>;
  else if (!estado.seleccion) contenido = <p className="estado">{t('ui.sinSeleccion')}</p>;
  else contenido = <VistaBuild estado={estado} importacion={importacion} onImportar={importar} onCambiarRol={cambiarRol} />;

  return (
    <div className="app">
      <h1>{t('app.titulo')}</h1>
      <nav className="pestanas">
        <button type="button" aria-pressed={pestana === 'build'} onClick={() => setPestana('build')}>
          {t('ui.pestanaBuild')}
        </button>
        <button type="button" aria-pressed={pestana === 'ajustes'} onClick={() => setPestana('ajustes')}>
          {t('ui.pestanaAjustes')}
        </button>
      </nav>
      {estado?.aviso && <p className="nota" role="alert">{estado.aviso}</p>}
      <main>{pestana === 'build' ? contenido : <Ajustes />}</main>
      <PieLegal />
    </div>
  );
}
