import { useEffect, useState } from 'react';
import { PREMIUM_HABILITADO, type Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPrincipal, MensajeAsistente, ResultadoImportar } from '../../shared/tiposApp';
import { Aviso } from '../comun/componentes';
import { useIdioma } from '../comun/idioma';
import { VistaAjustes } from './vistas/VistaAjustes';
import { VistaApoyar } from './vistas/VistaApoyar';
import { VistaAyuda } from './vistas/VistaAyuda';
import { VistaCampeones } from './vistas/VistaCampeones';
import { VistaNovedades } from './vistas/VistaNovedades';
import { VistaOverlay } from './vistas/VistaOverlay';
import { VistaPremium } from './vistas/VistaPremium';
import { Arranque } from './Arranque';
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

/**
 * `premiumHabilitado`: constante de compilación PREMIUM_HABILITADO (apagada: Coach LoL IA es gratis).
 * Apagada, no se consulta la licencia, no hay banner ni avisos de Premium y la barra lateral ofrece
 * «Apoya el proyecto». Las pruebas la encienden para seguir cubriendo el código de Premium.
 */
export function App({ premiumHabilitado = PREMIUM_HABILITADO }: { premiumHabilitado?: boolean } = {}) {
  // Al cambiar el idioma se repinta todo y la vista se vuelve a montar (sus datos de Data Dragon cambian de idioma).
  const idioma = useIdioma();
  const [estado, setEstado] = useState<EstadoPrincipal | null>(null);
  const [vista, setVista] = useState<Vista>('campeon');
  const [importacion, setImportacion] = useState<Importacion>(null);
  // El banner promocional se cierra solo durante esta sesión.
  const [bannerCerrado, setBannerCerrado] = useState(false);
  const [licencia, setLicencia] = useLicencia(premiumHabilitado);
  // La conversación con el asistente dura toda la sesión, aunque se cambie de vista.
  const [chat, setChat] = useState<MensajeAsistente[]>([]);

  useEffect(() => {
    window.coach.alCambiarEstado((nuevo) => {
      setEstado((previo) => {
        const cambio =
          previo?.seleccion?.campeon.key !== nuevo.seleccion?.campeon.key ||
          previo?.seleccion?.rol !== nuevo.seleccion?.rol ||
          previo?.seleccion?.modo !== nuevo.seleccion?.modo;
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
  const cambiarOpcion = (i: number) => void window.coach.cambiarOpcion(i).catch(() => undefined);
  const cambiarRunas = (i: number) => void window.coach.cambiarRunas(i).catch(() => undefined);

  const verPremium = () => setVista('premium');
  // null mientras la licencia no ha respondido: ni banner ni avisos de plan hasta saberlo.
  const plan = licencia?.plan ?? null;
  let contenido;
  if (vista === 'overlay') contenido = <VistaOverlay plan={plan} alVerPremium={verPremium} />;
  else if (vista === 'ajustes')
    contenido = (
      <VistaAjustes licencia={licencia} alCambiarLicencia={setLicencia} alVerPremium={verPremium} mostrarLicencia={premiumHabilitado} />
    );
  else if (vista === 'premium' && premiumHabilitado) contenido = <VistaPremium licencia={licencia} alCambiarLicencia={setLicencia} />;
  else if (vista === 'apoyar') contenido = <VistaApoyar />;
  else if (vista === 'novedades') contenido = <VistaNovedades />;
  else if (vista === 'campeones')
    contenido = <VistaCampeones estado={estado} importacion={importacion} onImportar={importar} onCambiarOpcion={cambiarOpcion} onCambiarRunas={cambiarRunas} />;
  else if (vista === 'ayuda') contenido = <VistaAyuda historial={chat} alCambiarHistorial={setChat} />;
  else
    contenido = (
      <VistaCampeon
        estado={estado}
        importacion={importacion}
        onImportar={importar}
        onCambiarRol={cambiarRol}
        onCambiarOpcion={cambiarOpcion}
        onCambiarRunas={cambiarRunas}
        plan={plan}
        bannerCerrado={bannerCerrado}
        alCerrarBanner={() => setBannerCerrado(true)}
        alVerPremium={verPremium}
      />
    );

  return (
    <div className="app">
      <BarraLateral
        vista={vista}
        alCambiar={setVista}
        cliente={estado?.cliente ?? 'esperando'}
        plan={plan}
        premiumHabilitado={premiumHabilitado}
      />
      <BarraTitulo titulo={t('nav.' + vista)} />
      <main className="contenido">
        <div className="contenido-interior" key={`${vista}:${idioma}`}>
          {estado?.aviso && <Aviso tono="aviso">{estado.aviso}</Aviso>}
          {contenido}
        </div>
        <PieLegal />
      </main>
      <Arranque alVerTodas={() => setVista('novedades')} />
    </div>
  );
}
