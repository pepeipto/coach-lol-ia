import { useEffect, useRef, useState } from 'react';
import { PREMIUM_HABILITADO, type Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPrincipal, MensajeAsistente, OpcionesImportar, ResultadoImportar } from '../../shared/tiposApp';
import { Aviso } from '../comun/componentes';
import { useIdioma } from '../comun/idioma';
import { VistaAjustes } from './vistas/VistaAjustes';
import { VistaApoyar } from './vistas/VistaApoyar';
import { VistaAyuda } from './vistas/VistaAyuda';
import { VistaPerfil } from './vistas/VistaPerfil';
import { VistaCoach } from './vistas/VistaCoach';
import type { MensajePersonal } from '@coach/shared';
import { VistaAnalisis } from './vistas/VistaAnalisis';
import { hablar } from '../overlay/voz';
import { VistaCampeones } from './vistas/VistaCampeones';
import { VistaNovedades } from './vistas/VistaNovedades';
import { VistaNotasParche } from './vistas/VistaNotasParche';
import { VistaOverlay } from './vistas/VistaOverlay';
import { VistaPremium } from './vistas/VistaPremium';
import { Arranque } from './Arranque';
import { BarraLateral, type Vista } from './BarraLateral';
import { BarraTitulo } from './BarraTitulo';
import { useLicencia } from './licencia';
import { PieLegal } from './PieLegal';
import { VistaCampeon, type Importacion } from './vistas/VistaCampeon';
import { ModalSustituirPagina } from './vistas/ModalSustituirPagina';

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
  // Ficha del campeón: «parecido» pulsado en la vista Campeón, que se abre en el apartado Campeones.
  const [campeonAbierto, setCampeonAbierto] = useState<{ id: string; n: number } | null>(null);
  const [importacion, setImportacion] = useState<Importacion>(null);
  // El banner promocional se cierra solo durante esta sesión.
  const [bannerCerrado, setBannerCerrado] = useState(false);
  const [licencia, setLicencia] = useLicencia(premiumHabilitado);
  // La conversación con el asistente dura toda la sesión, aunque se cambie de vista.
  const [chat, setChat] = useState<MensajeAsistente[]>([]);
  // 3.6: la conversación con «Tu coach», viva mientras la app está abierta.
  const [chatCoach, setChatCoach] = useState<MensajePersonal[]>([]);
  // 3.1: página de runas que se sustituiría si el jugador confirma (sin páginas libres al pulsar «Importar»).
  const [sustituir, setSustituir] = useState<{ id: number; nombre: string } | null>(null);
  // 3.2: análisis con IA nuevos sin ver (insignia de la barra lateral).
  const [analisisNuevos, setAnalisisNuevos] = useState(0);
  const [analisisActivado, setAnalisisActivado] = useState(true);
  // El servidor no puede consultar a Riot (clave caducada): se avisa arriba de cada vista. Se mira al abrir y cada 15 min.
  const [riotCaido, setRiotCaido] = useState(false);
  useEffect(() => {
    const mirar = () =>
      void window.coach
        .estadoServidor?.()
        .then((s) => setRiotCaido(s.riot === 'caducada'))
        .catch(() => undefined);
    mirar();
    const intervalo = setInterval(mirar, 15 * 60_000);
    return () => clearInterval(intervalo);
  }, []);
  const vistaActual = useRef(vista);
  vistaActual.current = vista;

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

  useEffect(() => {
    const quitarAnalisis = window.coach.alAnalisis?.(({ entrada, hablar: decir }) => {
      if (!entrada) return;
      if (vistaActual.current !== 'analisis') setAnalisisNuevos((n) => n + 1);
      // Una frase con la voz elegida: «Tu análisis está listo».
      if (decir) {
        void window.coach
          .obtenerAjustes()
          .then((a) =>
            hablar(
              t('analisis.voz.listo'),
              globalThis.speechSynthesis,
              { volumen: a.overlay.voz.volumen, vozId: a.overlay.voz.vozId, motor: a.overlay.voz.motor },
              window.coach.sintetizarVoz ? { sintetizar: (texto) => window.coach.sintetizarVoz!(texto) } : undefined,
            ),
          )
          .catch(() => undefined);
      }
    });
    const quitarNavegar = window.coach.alNavegar?.((v) => {
      if (v === 'analisis') setVista('analisis');
      if (v === 'perfil') setVista('perfil');
      if (v === 'coach') setVista('coach');
    });
    return () => {
      quitarAnalisis?.();
      quitarNavegar?.();
    };
  }, []);
  useEffect(() => {
    if (vista !== 'analisis') return;
    setAnalisisNuevos(0);
    void window.coach.obtenerAjustes().then((a) => setAnalisisActivado(a.ia?.analisis !== false), () => undefined);
  }, [vista]);

  const importar = (opciones?: OpcionesImportar) => {
    setImportacion('importando');
    void window.coach.importar(opciones).then(
      (r) => {
        setImportacion(r);
        // Sin páginas libres: se pregunta antes de sustituir una (también si la elegida cambió desde la confirmación).
        if (r.runas.ok === false && r.runas.motivo === 'sin_paginas' && r.runas.sustituible) setSustituir(r.runas.sustituible);
      },
      () => setImportacion(FALLO_IMPORTAR),
    );
  };
  const confirmarSustituir = async (noVolverAPreguntar: boolean) => {
    const pagina = sustituir;
    setSustituir(null);
    if (!pagina) return;
    if (noVolverAPreguntar) {
      const a = await window.coach.obtenerAjustes().catch(() => null);
      if (a) await window.coach.guardarAjustes({ ...a, sustituirPaginaSinPreguntar: true }).catch(() => undefined);
    }
    importar({ sustituirPagina: pagina.id });
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
  else if (vista === 'parche') contenido = <VistaNotasParche />;
  else if (vista === 'campeones')
    contenido = (
      <VistaCampeones
        estado={estado}
        importacion={importacion}
        onImportar={() => importar()}
        onCambiarOpcion={cambiarOpcion}
        onCambiarRunas={cambiarRunas}
        abrir={campeonAbierto}
      />
    );
  else if (vista === 'analisis') contenido = <VistaAnalisis activado={analisisActivado} />;
  else if (vista === 'perfil') contenido = <VistaPerfil coach={{ mensajes: chatCoach, alCambiarMensajes: setChatCoach }} />;
  else if (vista === 'coach') contenido = <VistaCoach mensajes={chatCoach} alCambiarMensajes={setChatCoach} />;
  else if (vista === 'ayuda') contenido = <VistaAyuda historial={chat} alCambiarHistorial={setChat} />;
  else
    contenido = (
      <VistaCampeon
        estado={estado}
        importacion={importacion}
        onImportar={() => importar()}
        onImportarEnfrentamiento={window.coach.importarEnfrentamiento ? () => window.coach.importarEnfrentamiento!() : undefined}
        onCambiarRol={cambiarRol}
        onCambiarOpcion={cambiarOpcion}
        onCambiarRunas={cambiarRunas}
        plan={plan}
        bannerCerrado={bannerCerrado}
        alCerrarBanner={() => setBannerCerrado(true)}
        alVerPremium={verPremium}
        alNavegar={setVista}
        alAbrirCampeon={(id) => {
          setCampeonAbierto((previo) => ({ id, n: (previo?.n ?? 0) + 1 }));
          setVista('campeones');
        }}
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
        analisisNuevos={analisisNuevos}
      />
      <BarraTitulo titulo={t('nav.' + vista)} />
      <main className="contenido">
        <div className="contenido-interior" key={`${vista}:${idioma}`}>
          {estado?.aviso && <Aviso tono="aviso">{estado.aviso}</Aviso>}
          {riotCaido && <Aviso tono="aviso">{t('servidor.riotNoDisponible')}</Aviso>}
          {contenido}
        </div>
        <PieLegal />
      </main>
      <Arranque alVerTodas={() => setVista('novedades')} />
      {sustituir && (
        <ModalSustituirPagina nombre={sustituir.nombre} alSustituir={(n) => void confirmarSustituir(n)} alCancelar={() => setSustituir(null)} />
      )}
    </div>
  );
}
